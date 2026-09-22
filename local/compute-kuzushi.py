import requests,json,io,time
from pathlib import Path
from PIL import Image
import numpy as np,onnxruntime as ort
import argparse
ap=argparse.ArgumentParser();ap.add_argument('--models',type=Path,required=True);args=ap.parse_args();p=args.models;a=Path(__file__).resolve().parents[1]/'apps/week03/src/assets';(a/'images/kuzushi').mkdir(parents=True,exist_ok=True)
meta={'sha':'104357ebbd319f829e365d68c8b143855ed8d789'}
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
_session=requests.Session();_session.mount('https://',HTTPAdapter(max_retries=Retry(total=3,backoff_factor=1,status_forcelist=[429,500,502,503])))
requests.get=_session.get
current=requests.get("https://huggingface.co/api/datasets/kwadraten/hi-utokyo-kuzushi",timeout=30).json()
if current.get("sha")!=meta["sha"]:raise RuntimeError("Dataset revision changed; restore the recorded parquet revision before recomputing.")
import concurrent.futures
def getrows(offset):
 r=requests.get('https://datasets-server.huggingface.co/rows',params=dict(dataset='kwadraten/hi-utokyo-kuzushi',config='default',split='train',offset=offset,length=6),timeout=60);r.raise_for_status();return r.json()['rows']
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as ex:rows=[r for group in ex.map(getrows,[0,1000,10000,50000,100000,180000,250000,320000]) for r in group]
(p/'hiutokyo-rows.json').write_text(json.dumps(rows,ensure_ascii=False));print('rows',len(rows),flush=True)
s=ort.InferenceSession(str(p/'shikiji/supervised_pretrain_checkpoint.embedding.onnx'),providers=['CPUExecutionProvider']);items=[]
for row in rows:
 d=row['row'];idx=row['row_idx'];im=Image.open(io.BytesIO(requests.get(d['image']['src'],timeout=35).content)).convert('RGB');im.save(a/f'images/kuzushi/{idx:04}.jpg',quality=94)
 x=np.asarray(im.resize((160,160),Image.Resampling.BILINEAR),dtype=np.float32).transpose(2,0,1)[None]/255;v=s.run(None,{'input':x})[0][0];v=v/np.linalg.norm(v)
 items.append({'id':f'KU-{idx:04}','label':d['char'],'unicode':d['unicode'],'image':f'assets/images/kuzushi/{idx:04}.jpg','vector':v.tolist(),'source':f'東京大学史料編纂所くずし字データ / kwadraten/hi-utokyo-kuzushi train row {idx}','source_url':'https://huggingface.co/datasets/kwadraten/hi-utokyo-kuzushi','license':'CC BY 4.0 (dataset card)','row_index':idx})
 if idx%10==0:print('embedded',idx,flush=True)
mp=a/'data/multimodal.json';m=json.loads(mp.read_text());m['kuzushi']={'model':'kwadraten/shikiji · ConvNeXt Tiny pooled 768维','revision':'84cc2fbec1603cd72daaf1c2814a65b977636b5c','dataset':'kwadraten/hi-utokyo-kuzushi','dataset_revision':meta['sha'],'preprocess':'RGB, bilinear resize160x160, NCHW float32/255, no mean/std; output L2 normalize','runtime':'ONNX Runtime '+ort.__version__,'sample':'train固定8处偏移各6项（0、1000、10000、50000、100000、180000、250000、320000）；仅教学相似度例子，不作为独立准确率评测','upstream_demo':'https://github.com/kwadraten/kuzushi-classifier-app','items':items};mp.write_text(json.dumps(m,ensure_ascii=False));print('complete',len(items),flush=True)
