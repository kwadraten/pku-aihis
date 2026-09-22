from pathlib import Path
import argparse,json,urllib.request,hashlib
p=argparse.ArgumentParser();p.add_argument('directory',type=Path);a=p.parse_args()
for model in json.loads(Path(__file__).with_name('models.json').read_text()):
    for f in model['files']:
        target=a.directory/model['directory']/f;target.parent.mkdir(parents=True,exist_ok=True)
        if not target.exists():urllib.request.urlretrieve('https://huggingface.co/'+model['repo']+'/resolve/'+model['revision']+'/'+f,target)
        if hashlib.sha256(target.read_bytes()).hexdigest()!=model['sha256'][f]:raise ValueError('Model digest mismatch: '+f)
        print(model['directory'],f,'verified')
