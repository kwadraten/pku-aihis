"""Explicit local adapters: OpenAI request shape -> Ollama; Firecrawl search -> classroom corpus.

This is NOT the Firecrawl service or Internet search. The original research
loop can run against a bounded, source-addressed corpus without external keys.
"""
import json
import re
import time
import unicodedata
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
from applications import request, DATA, APP_ROOT

CORPUS=json.loads((DATA/'corpus.json').read_text())['records']
LOG=APP_ROOT/'runs/gateway-events.jsonl'
OLLAMA='http://127.0.0.1:11435'

def log(event):
    LOG.parent.mkdir(parents=True,exist_ok=True)
    with LOG.open('a') as f:f.write(json.dumps({'at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),**event},ensure_ascii=False)+'\n')

def lexical_search(query,limit=5):
    from rank_bm25 import BM25Okapi
    def terms(text):
        parts=re.findall(r'[\u3400-\u9fff]+|[a-z0-9]+',unicodedata.normalize('NFKC',text).lower())
        return [p[i:i+2] for p in parts for i in range(max(1,len(p)-1))]
    scores=BM25Okapi([terms(d['text']) for d in CORPUS]).get_scores(terms(query))
    hits=sorted([(d,float(s)) for d,s in zip(CORPUS,scores) if s>0],key=lambda x:-x[1])[:limit]
    log({'type':'local_corpus_search','query':query,'ids':[d['id'] for d,s in hits],'mode':'BM25 character bigrams; classroom excerpts, no Internet search'})
    return [dict(id=d['id'],title=d['title'],score=s,source_id=d['source_id'],pdf_page=d.get('pdf_page'),text=d['text']) for d,s in hits]

def chat(body):
    name=body.get('model','qwen3:4b-instruct-2507-q4_K_M').removeprefix('openai/')
    if name not in {'qwen3:4b-instruct-2507-q4_K_M','deepseek-r1:8b-0528-qwen3-q4_K_M','gemma3:4b'}:raise ValueError('Classroom text model not allowed')
    messages=body.get('messages',[])
    native={'model':name,'messages':messages,'stream':False,'think':False,'options':{'temperature':body.get('temperature',.1),'num_predict':min(body.get('max_tokens') or body.get('max_completion_tokens') or 2048,4096),'num_ctx':16384,'seed':42}}
    form=body.get('response_format',{})
    if form.get('type')=='json_schema':native['format']=form['json_schema']['schema']
    elif form.get('type')=='json_object':native['format']='json'
    start=time.monotonic();r=request(OLLAMA+'/api/chat',native,timeout=300)
    content=r.get('message',{}).get('content','')
    log({'type':'model_call','model':name,'seconds':round(time.monotonic()-start,3),'input_messages':len(messages),'output':content,'finish_reason':r.get('done_reason'),'thinking':False})
    return {'id':'chatcmpl-'+uuid.uuid4().hex,'object':'chat.completion','created':int(time.time()),'model':name,'choices':[{'index':0,'message':{'role':'assistant','content':content},'finish_reason':'length' if r.get('done_reason')=='length' else 'stop'}],'usage':{'prompt_tokens':r.get('prompt_eval_count',0),'completion_tokens':r.get('eval_count',0),'total_tokens':r.get('prompt_eval_count',0)+r.get('eval_count',0)}}

class Handler(BaseHTTPRequestHandler):
    def send(self,data,status=200):
        raw=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(raw)));self.end_headers()
        try:self.wfile.write(raw)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        if self.path=='/health':return self.send({'ok':True,'search':'local corpus adapter, NOT Firecrawl Internet search'})
        if self.path=='/v1/models':return self.send({'object':'list','data':[{'id':'qwen3:4b-instruct-2507-q4_K_M','object':'model'},{'id':'qwen3-embedding:0.6b','object':'model'}]})
        self.send({'error':'not found'},404)
    def do_POST(self):
        try:
            n=int(self.headers.get('Content-Length',0))
            if not 0<n<2000000:raise ValueError('invalid request size')
            body=json.loads(self.rfile.read(n))
            if self.path=='/v1/chat/completions':return self.send(chat(body))
            if self.path=='/v1/embeddings':
                r=request(OLLAMA+'/api/embed',{'model':'qwen3-embedding:0.6b','input':body['input']},timeout=180)
                return self.send({'object':'list','model':'qwen3-embedding:0.6b','data':[{'object':'embedding','index':i,'embedding':v} for i,v in enumerate(r['embeddings'])],'usage':{'prompt_tokens':r.get('prompt_eval_count',0),'total_tokens':r.get('prompt_eval_count',0)}})
            if self.path in ('/v1/search','/v2/search','/search'):
                hits=lexical_search(body.get('query',''),min(int(body.get('limit',5)),10))
                return self.send({'success':True,'data':[{'url':'https://lyzhackjp.github.io/pku-aihis/week03/?source='+d['id']+'#D01','title':d['title']+' ['+d['id']+']','description':d['text'][:120],'markdown':f"[{d['id']}] {d['title']} PDF {d['pdf_page']}\n{d['text']}"} for d in hits],'mode':'local classroom corpus adapter'})
            self.send({'error':'not found'},404)
        except Exception as e:self.send({'error':str(e)},500)
    def log_message(self,*args):pass

if __name__=='__main__':
    print('Research adapters: http://127.0.0.1:8870',flush=True)
    ThreadingHTTPServer(('127.0.0.1',8870),Handler).serve_forever()
