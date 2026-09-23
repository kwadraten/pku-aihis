"""Classroom adapters for real local services. All endpoints are loopback-only.

Application secrets and state live outside the public repository. This module
does not download, silently start, or substitute another engine on failure.
"""
import hashlib
import json
import os
import time
import threading
RESEARCH_LOCK = threading.Lock()
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError

ROOT = Path(__file__).resolve().parents[1]
_machine_file=ROOT/'local-only/machine.json'
_machine=json.loads(_machine_file.read_text()) if _machine_file.exists() else {}
APP_ROOT = Path(os.environ.get('CLASSROOM_APPLICATIONS') or _machine.get('applications') or ROOT.parent / '第三周（9月24日）/本地应用与服务')
DATA = ROOT / 'apps/week03/src/assets/data'
if not DATA.exists():
    DATA = ROOT / 'site/week03/assets/data'


def request(url, data=None, method=None, headers=None, timeout=180):
    headers = dict(headers or {})
    if data is not None and not isinstance(data, bytes):
        data = json.dumps(data, ensure_ascii=False).encode()
        headers.setdefault('Content-Type', 'application/json')
    req = Request(url, data=data, method=method, headers=headers)
    try:
        with build_opener(ProxyHandler({})).open(req, timeout=timeout) as response:
            raw = response.read()
            return json.loads(raw) if raw else {}
    except HTTPError as exc:
        # Service errors are useful teaching observations, credentials never are.
        detail = exc.read().decode(errors='replace')[:1400]
        raise RuntimeError(f'Local service HTTP {exc.code}: {detail}') from exc


def metadata(tool, result, start, **extra):
    return dict(tool=tool, status='actual local run', run_at=time.strftime('%Y-%m-%dT%H:%M:%S%z'),
                seconds=round(time.monotonic()-start,3), **result, **extra)


def search_service(tool, query):
    start = time.monotonic()
    base = {'elasticsearch':'http://127.0.0.1:19200', 'opensearch':'http://127.0.0.1:19201'}[tool]
    info = request(base)
    corpus = json.loads((DATA/'corpus.json').read_text())
    docs = corpus['records']
    index = 'pku-week03-classroom'
    mapping = {'text':{'type':'text','analyzer':'cjk'},'source_id':{'type':'keyword'},'pdf_page':{'type':'integer'},'title':{'type':'text'}}
    sparse = None
    if tool == 'opensearch':
        mapping['sparse'] = {'type':'rank_features'}
        sparse = json.loads((DATA/'neural-sparse.json').read_text())
    # Small isolated classroom indexes: retain an absolute 500 MB flood-stage reserve.
    request(base+'/_cluster/settings', {'persistent':{'cluster.routing.allocation.disk.watermark.low':'2gb','cluster.routing.allocation.disk.watermark.high':'1gb','cluster.routing.allocation.disk.watermark.flood_stage':'500mb'}}, 'PUT')
    if tool == 'opensearch':
        request(base+'/_cluster/settings', {'persistent':{'cluster.blocks.create_index':None}}, 'PUT')
    try:
        request(f'{base}/{index}')
    except RuntimeError as exc:
        if 'HTTP 404' not in str(exc): raise
        request(f'{base}/{index}', {'settings':{'number_of_shards':1,'number_of_replicas':0},'mappings':{'properties':mapping}}, 'PUT')
    request(f'{base}/{index}/_settings', {'index.blocks.read_only_allow_delete':None}, 'PUT')
    if request(f'{base}/{index}/_count')['count'] != len(docs):
        lines=[]
        for d in docs:
            row={k:d[k] for k in ['text','source_id','pdf_page','title'] if k in d}
            if sparse:
                encoded=next(x for x in sparse['records'] if x['id']==d['id'])
                highest=encoded['weights'][0]['weight']
                row['sparse']={f"t{x['token_id']}":x['weight'] for x in encoded['weights'] if x['weight']>highest*.1}
            lines.extend([json.dumps({'index':{'_id':d['id']}},ensure_ascii=False),json.dumps(row,ensure_ascii=False)])
        bulk=request(f'{base}/{index}/_bulk?refresh=true', ('\n'.join(lines)+'\n').encode(), 'POST', {'Content-Type':'application/x-ndjson'})
        if bulk.get('errors'):raise RuntimeError('Bulk indexing failed: '+str([x for x in bulk['items'] if x['index'].get('error')])[:1600])
    if sparse:
        q=next((x for x in sparse['queries'] if x['text']==query),None)
        if q is None:raise ValueError('神经稀疏案例使用已由同一词表编码的查询，请选择“宗教”等课堂预设。')
        query_weights={f"t{x['token_id']}":x['weight'] for x in q['weights']}
        body={'size':5,'query':{'neural_sparse':{'sparse':{'query_tokens':query_weights}}},'_source':{'excludes':['sparse']}}
        metric='OpenSearch neural_sparse dot product; larger is nearer'
        analysis={'query_tokens':q['weights'],'model':sparse['model'],'revision':sparse['revision'],'prune_ratio':.1}
    else:
        body={'size':5,'query':{'match':{'text':query}},'highlight':{'fields':{'text':{}}}}
        analysis=request(f'{base}/{index}/_analyze',{'analyzer':'cjk','text':query})
        metric='Elasticsearch/Lucene BM25 over CJK analyzer; larger is nearer'
    raw=request(f'{base}/{index}/_search',body)
    results=[dict(id=x['_id'],score=x['_score'],text=x.get('_source',{}).get('text'),title=x.get('_source',{}).get('title'),pdf_page=x.get('_source',{}).get('pdf_page')) for x in raw['hits']['hits']]
    return metadata(tool,dict(version=info['version']['number'],query=query,records=len(docs),metric=metric,results=results,request=body,analysis=analysis,engine_took_ms=raw.get('took'),scope='independent single-node classroom service'),start)


def anythingllm(query):
    start=time.monotonic()
    config=json.loads((APP_ROOT/'anythingllm/private.json').read_text())
    base='http://127.0.0.1:3301'
    answer=request(f"{base}/api/v1/workspace/{config['workspace']}/chat", {'message':query,'mode':'query','sessionId':'week03-classroom'}, headers={'Authorization':'Bearer '+config['api_key']}, timeout=360)
    return metadata('anythingllm',dict(version=config.get('version'),query=query,model='qwen3:4b-instruct-2507-q4_K_M',embedding_model='qwen3-embedding:0.6b',answer=answer.get('textResponse'),sources=answer.get('sources',[]),raw_type=answer.get('type'),error=answer.get('error'),application_url=base,scope='official AnythingLLM application; local Ollama generation and embeddings'),start)


def run(tool, query='宗教'):
    if tool in ('elasticsearch','opensearch'):return search_service(tool,query)
    if tool == 'anythingllm':return anythingllm(query)
    raise ValueError('Unsupported application')



def research_tool(tool, query):
    if not isinstance(query,str) or not 1 <= len(query) <= 2000:raise ValueError("查询长度须为1至2000字符")
    if not RESEARCH_LOCK.acquire(blocking=False):raise RuntimeError("已有研究工具正在运行，请等待其完成。")
    try:return _research_tool(tool,query)
    finally:RESEARCH_LOCK.release()

def _research_tool(tool, query):
    """Run installed upstream packages; never substitute a saved result as live."""
    import subprocess
    env={**os.environ,'CLASSROOM_APPLICATIONS':str(APP_ROOT)}
    python=str(APP_ROOT/'neural-sparse/.venv/bin/python')
    mapping={'pasa':['pasa'],'paperqa2':['paperqa'],'evaluation':['ragchecker','deepresearchbench']}
    if tool=='deep-research':
        # The upstream project owns Node dependencies; its entry is our explicit transport adapter.
        node=os.environ.get('CLASSROOM_NODE') or __import__('shutil').which('node')
        if not node:raise RuntimeError('未找到 Node；请从本周“启动完整课堂”入口启动。')
        env.update(OPENAI_KEY='classroom-local',OPENAI_ENDPOINT='http://127.0.0.1:8870/v1',CUSTOM_MODEL='qwen3:4b-instruct-2507-q4_K_M',CONTEXT_SIZE='12000',FIRECRAWL_KEY='classroom-local',FIRECRAWL_BASE_URL='http://127.0.0.1:8870',FIRECRAWL_CONCURRENCY='1',CLASSROOM_RESULT=str(APP_ROOT/'runs/deepresearch.json'),CLASSROOM_QUERY=query)
        folder=APP_ROOT/'source/deep-research'
        commands=[([node,'--import','tsx','classroom-run.ts'],folder)]
        outputs=['deepresearch']
    else:
        outputs=mapping[tool]
        commands=[([python,str(ROOT/'local/research-run.py'),name,'--query',query],ROOT) for name in outputs]
    for command,folder in commands:
        completed=subprocess.run(command,cwd=folder,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=600)
        (APP_ROOT/'runs'/f'{tool}-last-console.txt').write_text(completed.stdout)
        if completed.returncode:raise RuntimeError('应用运行失败；完整日志位于本周本地应用与服务/runs。保存示例没有替代本次运行。')
    rows=[json.loads((APP_ROOT/'runs'/f'{name}.json').read_text()) for name in outputs]
    return public_research(rows[0], rows[1] if len(rows)>1 else None)


def public_research(data, benchmark=None):
    """Only classroom texts/outputs; private paths, package diagnostics and keys stay local."""
    out={k:data[k] for k in ['tool','version','query','model','run_at','seconds','scope','answer','learnings','visitedUrls','trace','evaluation'] if k in data}
    if data['tool']=='paperqa':
        out['sources']=[{'title':x['text']['name'],'text':x['text']['text'],'summary':x['context'],'score':x['score']} for x in data['details']['contexts']]
        out['records']=data['records']
    if data['tool']=='pasa':out['tree']=data['tree']
    if data['tool']=='ragchecker':out.update(input=data['input'],results_detail=data['results_detail'],benchmark=benchmark)
    return out

if __name__=='__main__':
    import argparse
    p=argparse.ArgumentParser();p.add_argument('tool',choices=['elasticsearch','opensearch','anythingllm']);p.add_argument('--query',default='宗教');p.add_argument('--output');a=p.parse_args()
    result=run(a.tool,a.query);out=json.dumps(result,ensure_ascii=False,indent=2)
    if a.output:Path(a.output).write_text(out)
    print(out)
