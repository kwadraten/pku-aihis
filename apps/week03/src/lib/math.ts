// Pure numerical routines; tested against fixed counterexamples.
// @ts-nocheck
export function tokenize(text, mode = "bigram") {
  const s = text.normalize("NFKC").toLocaleLowerCase();
  if (mode === "word")
    return [...new Intl.Segmenter("ja", { granularity: "word" }).segment(s)]
      .filter((x) => x.isWordLike)
      .map((x) => x.segment);
  const runs = s.match(/[\p{L}\p{N}]+/gu) || [];
  return runs.flatMap((w) => {
    const c = [...w];
    return mode === "char" || c.length < 2
      ? c
      : c.slice(0, -1).map((x, i) => x + c[i + 1]);
  });
}
export function count(items) {
  return items.reduce((m, x) => ((m[x] = (m[x] || 0) + 1), m), {});
}
export function bm25(
  docs,
  query,
  { k1 = 1.2, b = 0.75, mode = "bigram" } = {},
) {
  const bags = docs.map((d) => count(tokenize(d.text, mode))),
    lens = docs.map((d) => tokenize(d.text, mode).length),
    avg = lens.reduce((a, b) => a + b, 0) / Math.max(1, docs.length);
  const terms = [...new Set(tokenize(query, mode))];
  return docs
    .map((d, i) => {
      const parts = terms.map((term) => {
        const tf = bags[i][term] || 0,
          df = bags.filter((x) => x[term]).length,
          idf = Math.log(1 + (docs.length - df + 0.5) / (df + 0.5));
        const value = tf
          ? (idf * tf * (k1 + 1)) /
            (tf + k1 * (1 - b + (b * lens[i]) / (avg || 1)))
          : 0;
        return { term, tf, df, idf, value };
      });
      return {
        id: d.id,
        score: parts.reduce((a, x) => a + x.value, 0),
        parts,
        length: lens[i],
        avg,
      };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
export function unit(v) {
  const n = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  if (!n) throw Error("零向量不能归一化");
  return v.map((x) => x / n);
}
export function cosine(a, b) {
  if (a.length !== b.length) throw Error("向量维数不一致");
  const x = unit(a),
    y = unit(b);
  return x.reduce((s, v, i) => s + v * y[i], 0);
}
export function rankVectors(docs, query) {
  return docs
    .filter((x) => x.vector?.length)
    .map((x) => ({ id: x.id, score: cosine(x.vector, query) }))
    .sort((a, b) => b.score - a.score);
}
export function rrf(lists, c = 60) {
  if (c < 0) throw Error("c须非负");
  const scores = new Map();
  lists.forEach((list, j) =>
    list.forEach((x, i) => {
      const r = scores.get(x.id) || {
        id: x.id,
        score: 0,
        ranks: [],
        parts: [],
      };
      r.score += 1 / (c + i + 1);
      r.ranks[j] = i + 1;
      r.parts[j] = 1 / (c + i + 1);
      scores.set(x.id, r);
    }),
  );
  return [...scores.values()].sort(
    (a, b) => b.score - a.score || a.id.localeCompare(b.id),
  );
}
export function metrics(ids, qrels, k) {
  const top = ids.slice(0, k),
    unjudged = top.filter((id) => qrels[id] === undefined).length;
  const relevant = top.filter((id) => qrels[id] > 0).length;
  const gain = (r) => 2 ** r - 1;
  const dcg = top.reduce(
    (s, id, i) => s + gain(qrels[id] ?? 0) / Math.log2(i + 2),
    0,
  );
  const ideal = Object.values(qrels)
    .sort((a, b) => b - a)
    .slice(0, k)
    .reduce((s, x, i) => s + gain(x) / Math.log2(i + 2), 0);
  return {
    precision: relevant / k,
    ndcg: ideal ? dcg / ideal : null,
    unjudged,
    dcg,
    ideal,
    recall: null,
  };
}
export function chunks(text, size = 180, overlap = 30) {
  if (size <= overlap || overlap < 0) throw Error("块长必须大于重叠");
  const a = [...text],
    res = [];
  for (let i = 0; i < a.length; i += size - overlap) {
    res.push({
      start: i,
      end: Math.min(a.length, i + size),
      text: a.slice(i, i + size).join(""),
    });
    if (i + size >= a.length) break;
  }
  return res;
}
export function rocchio(
  q,
  positive,
  negative,
  alpha = 1,
  beta = 0.75,
  gamma = 0.15,
) {
  const mean = (v) =>
    q.map((_, i) =>
      v.length ? v.reduce((s, x) => s + x[i], 0) / v.length : 0,
    );
  const p = mean(positive),
    n = mean(negative);
  return unit(q.map((x, i) => alpha * x + beta * p[i] - gamma * n[i]));
}
export function validateCorpus(data) {
  const records = Array.isArray(data) ? data : data.records;
  if (!Array.isArray(records) || !records.length)
    throw Error("文件须为记录数组或含records数组的对象");
  const ids = new Set();
  const emb = data.manifest?.embedding;
  const vectors = records.filter((d) => d.vector);
  if (vectors.length) {
    if (!emb?.model || !emb?.revision || !emb.dimensions)
      throw Error("向量包必须声明模型、修订与维数");
    if (emb.normalize !== true) throw Error("本课堂向量入口要求L2归一化配置");
    for (const d of [...vectors, ...(data.queries || [])]) {
      if (
        !Array.isArray(d.vector) ||
        d.vector.length !== emb.dimensions ||
        d.vector.some((x) => !Number.isFinite(x))
      )
        throw Error("向量与配置维数不一致");
      const norm = Math.sqrt(d.vector.reduce((s, x) => s + x * x, 0));
      if (Math.abs(norm - 1) > 0.002) throw Error("向量并未按配置归一化");
    }
  }
  return records.map((d, i) => {
    if (typeof d.id !== "string" || ids.has(d.id) || typeof d.text !== "string")
      throw Error(`第${i + 1}条缺少唯一id或text`);
    ids.add(d.id);
    if (
      d.vector &&
      (!Array.isArray(d.vector) || d.vector.some((x) => !Number.isFinite(x)))
    )
      throw Error("向量必须为有限数值数组");
    return {
      ...d,
      title: d.title || d.source_id || d.id,
      status: d.status || "未校订工作转录",
      author: d.author || null,
    };
  });
}
