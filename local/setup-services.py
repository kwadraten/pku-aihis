"""Create only the isolated pku-week03 containers; keep data in the chosen folder.

Usage: python local/setup-services.py /absolute/path/to/week03/apps
Docker manages image layers in its existing VM; this folder owns persistent
application data, config, pinned image identity, and start/stop commands.
"""
import json
import secrets
import subprocess
import sys
from pathlib import Path

base=Path(sys.argv[1]).resolve();base.mkdir(parents=True,exist_ok=True)
for name in ['anythingllm/storage','elasticsearch/data','opensearch/data','runs','source']:
    (base/name).mkdir(parents=True,exist_ok=True)
images={'anythingllm':'mintplexlabs/anythingllm:1.16.2','opensearch':'opensearchproject/opensearch:3.2.0','elasticsearch':'bitnamilegacy/elasticsearch:8.18.0'}
lock_file=base/'container-images.lock.json'
locked=json.loads(lock_file.read_text()) if lock_file.exists() else {}
for name,image in images.items():
    if name in locked:continue
    if subprocess.run(['docker','image','inspect',image],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode:
        subprocess.run(['docker','pull',image],check=True)
    info=json.loads(subprocess.check_output(['docker','image','inspect',image]))[0]
    locked[name]={'tag':image,'id':info['Id'],'digest':info.get('RepoDigests',[info['Id']])[0],'architecture':info['Architecture']}
    lock_file.write_text(json.dumps(locked,indent=2)+'\n')
env_file=base/'anythingllm/.env'
if not env_file.exists():
    env_file.write_text('\n'.join([
        'SERVER_PORT=3001','STORAGE_DIR=/app/server/storage','DISABLE_TELEMETRY=true',
        'JWT_SECRET='+secrets.token_hex(32),'SIG_KEY='+secrets.token_hex(32),'SIG_SALT='+secrets.token_hex(32),
        'LLM_PROVIDER=ollama','OLLAMA_BASE_PATH=http://host.docker.internal:11435',
        'OLLAMA_MODEL_PREF=qwen3:4b-instruct-2507-q4_K_M','OLLAMA_MODEL_TOKEN_LIMIT=8192',
        'EMBEDDING_ENGINE=ollama','EMBEDDING_BASE_PATH=http://host.docker.internal:11435',
        'EMBEDDING_MODEL_PREF=qwen3-embedding:0.6b','EMBEDDING_MODEL_MAX_CHUNK_LENGTH=1200',
        'VECTOR_DB=lancedb','CHUNK_SIZE=600','CHUNK_OVERLAP=80','']) )
    env_file.chmod(0o600)
# Compose JSON is valid YAML and avoids shell interpolation of arbitrary paths.
common={'restart':'no','labels':{'org.pku.classroom':'week03'}}
services={
 'anythingllm':{**common,'image':locked['anythingllm']['digest'],'container_name':'pku-week03-anythingllm','ports':['127.0.0.1:3301:3001'],'env_file':['./anythingllm/.env'],'volumes':['./anythingllm/storage:/app/server/storage','./anythingllm/.env:/app/server/.env'],'mem_limit':'2g'},
 'elasticsearch':{**common,'image':locked['elasticsearch']['id'],'container_name':'pku-week03-elasticsearch','ports':['127.0.0.1:19200:9200'],'entrypoint':['/opt/bitnami/elasticsearch/bin/elasticsearch'],'command':['-Ediscovery.type=single-node','-Enetwork.host=0.0.0.0','-Expack.security.enabled=false','-Expack.ml.enabled=false','-Epath.data=/bitnami/elasticsearch/data','-Ecluster.name=pku-week03'],'environment':{'ES_JAVA_OPTS':'-Xms512m -Xmx512m'},'volumes':['./elasticsearch/data:/bitnami/elasticsearch/data'],'mem_limit':'1536m'},
 'opensearch':{**common,'image':locked['opensearch']['digest'],'container_name':'pku-week03-opensearch','ports':['127.0.0.1:19201:9200'],'environment':{'discovery.type':'single-node','DISABLE_SECURITY_PLUGIN':'true','DISABLE_INSTALL_DEMO_CONFIG':'true','OPENSEARCH_JAVA_OPTS':'-Xms512m -Xmx512m'},'volumes':['./opensearch/data:/usr/share/opensearch/data'],'mem_limit':'1536m'},
}
(base/'compose.yaml').write_text(json.dumps({'name':'pku-week03','services':services},indent=2)+'\n')
for name,action in [('启动应用服务.command','up -d'),('停止应用服务.command','stop')]:
    p=base/name;p.write_text('#!/bin/zsh\ncd -- "${0:A:h}"\n/usr/local/bin/docker compose -f compose.yaml '+action+'\n');p.chmod(0o755)
subprocess.run(['docker','compose','-f',str(base/'compose.yaml'),'up','-d'],check=True,cwd=base)
print('Classroom containers started; check health before reporting completion.')
