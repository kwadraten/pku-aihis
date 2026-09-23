"""Reproduce the pinned OpenSearch multilingual model card on classroom excerpts.

Usage: python scripts/run-neural-sparse.py MODEL_DIRECTORY OUTPUT_JSON
No remote code; weights and dependencies must already be installed locally.
"""
import hashlib
import json
import sys
import time
from pathlib import Path

import torch
import transformers
from transformers import AutoModelForMaskedLM, AutoTokenizer

root = Path(__file__).resolve().parents[1]
model_dir, output_file = map(Path, sys.argv[1:])
data = json.loads((root / "apps/week03/src/assets/data/corpus.json").read_text())
torch.set_num_threads(6)
model = AutoModelForMaskedLM.from_pretrained(model_dir, local_files_only=True).eval()
tokenizer = AutoTokenizer.from_pretrained(model_dir, local_files_only=True)
idf = json.loads((model_dir / "idf.json").read_text())
records = []
for doc in data["records"]:
    start = time.monotonic()
    feature = tokenizer([doc["text"]], truncation=True, max_length=512,
                        return_tensors="pt", return_token_type_ids=False)
    with torch.inference_mode():
        logits = model(**feature).logits
        # Same pooling and activation as the upstream model card, before pruning.
        values = torch.log1p(torch.relu((logits * feature["attention_mask"].unsqueeze(-1)).max(1).values))[0]
        values[tokenizer.all_special_ids] = 0
    present = set(feature["input_ids"][0].tolist())
    entries = [{"token_id": i, "token": tokenizer.convert_ids_to_tokens(i),
                "weight": float(values[i]), "in_input": i in present}
               for i in torch.nonzero(values).flatten().tolist()]
    entries.sort(key=lambda x: -x["weight"])
    records.append({"id": doc["id"], "input_text": doc["text"], "text_sha256": hashlib.sha256(doc["text"].encode()).hexdigest(),
                    "input_tokens": feature["input_ids"].shape[1], "weights": entries})
    print(doc["id"], len(entries), round(time.monotonic() - start, 2), flush=True)
queries = []
for query in data["queries"]:
    ids = set(tokenizer(query["text"], truncation=True, max_length=512)["input_ids"])
    weights = [{"token_id": i, "token": tokenizer.convert_ids_to_tokens(i),
                "weight": idf.get(tokenizer.convert_ids_to_tokens(i), 0)} for i in sorted(ids)]
    queries.append({"text": query["text"], "weights": [x for x in weights if x["weight"]]})
result = {"model": "opensearch-project/opensearch-neural-sparse-encoding-multilingual-v1",
          "revision": "1e0f096c2b51c234f1d20725c793e1b5b6d556db",
          "parameters": sum(p.numel() for p in model.parameters()),
          "vocabulary_size": tokenizer.vocab_size, "torch": torch.__version__,
          "transformers": transformers.__version__, "device": "cpu", "dtype": "float32",
          "mode": "真实模型本地离线计算；页面实时改变剪枝阈值与点积",
          "document_formula": "log(1 + ReLU(max_position(logit)))",
          "query_formula": "unique tokenizer token × upstream IDF (doc-only encoder)",
          "source": "https://huggingface.co/opensearch-project/opensearch-neural-sparse-encoding-multilingual-v1",
          "records": records, "queries": queries}
output_file.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print("saved", output_file, flush=True)
