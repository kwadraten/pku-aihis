"""Pull the three <=10B classroom models into a running dedicated Ollama."""
from pathlib import Path
from urllib.request import Request,urlopen
import json,os,time
url=os.environ.get('OLLAMA_URL','http://127.0.0.1:11435')
for model in ['qwen3:4b','deepseek-r1:8b-0528-qwen3-q4_K_M','gemma3:4b','qwen3-vl:4b-instruct-q4_K_M']:
 print('下载／核对',model,flush=True);last=0
 req=Request(url+'/api/pull',data=json.dumps({'model':model,'stream':True}).encode(),headers={'Content-Type':'application/json'})
 with urlopen(req,timeout=900) as r:
  for line in r:
   d=json.loads(line)
   if 'error' in d:raise RuntimeError(d['error'])
   if time.time()-last>20 or d.get('status')=='success':
    print(d.get('status'),round(d.get('completed',0)/max(1,d.get('total',1))*100,1),'%',flush=True);last=time.time()
print('模型已就绪。回课堂的模型接入窗口点击检测。')
