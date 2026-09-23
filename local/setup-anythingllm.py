"""Configure the isolated, local-only classroom AnythingLLM through its API."""
import json
from applications import APP_ROOT, DATA, request
base='http://127.0.0.1:3301/api'
p=APP_ROOT/'anythingllm/private.json'
if p.exists(): cfg=json.loads(p.read_text())
else:
    key=request(base+'/system/generate-api-key',{'name':'week03-local-bridge'})
    assert not key.get('error'),key.get('error')
    cfg={'api_key':key['apiKey']['secret'],'version':'1.16.2'}
    p.write_text(json.dumps(cfg,indent=2));p.chmod(0o600)
headers={'Authorization':'Bearer '+cfg['api_key']}
if not cfg.get('workspace'):
    ws=request(base+'/v1/workspace/new',{'name':'第三周史料检索课堂','chatProvider':'ollama','chatModel':'qwen3:4b-instruct-2507-q4_K_M','chatMode':'query','similarityThreshold':.1,'topN':4,'openAiTemp':.1,'openAiHistory':0,'openAiPrompt':'请用中文回答。仅依据提供的课堂史料片段，区分作者原话与推断。引用 source_id 和 PDF 页序；材料不足应明说。不要把语义相似直接解释为思想影响。','queryRefusalResponse':'当前检索没有足够的史料，请换用原文词项或放宽检索范围。'},headers=headers)
    cfg['workspace']=ws['workspace']['slug'];p.write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
imported=set(cfg.get('imported',[]))
for d in json.loads((DATA/'corpus.json').read_text())['records']:
    if d['id'] in imported:continue
    title=f"{d['id']}｜{d['title']}｜PDF {d['pdf_page']}"
    row=request(base+'/v1/document/raw-text',{'textContent':f"source_id: {d['source_id']}\n片段编号: {d['id']}\nPDF页序: {d['pdf_page']}\n标题: {d['title']}\n\n{d['text']}",'addToWorkspaces':cfg['workspace'],'metadata':{'title':title,'docSource':'教师课堂史料片段（保留OCR核查状态）','description':f"{d['source_id']} PDF {d['pdf_page']}"}},headers=headers,timeout=300)
    assert row.get('success'),row.get('error')
    imported.add(d['id']);cfg['imported']=sorted(imported);p.write_text(json.dumps(cfg,ensure_ascii=False,indent=2))
    print('Imported',d['id'],flush=True)
print('Workspace ready:',cfg['workspace'],len(imported))
