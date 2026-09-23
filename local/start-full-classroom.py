"""Start installed classroom apps, adapters, models and the current presentation."""
from pathlib import Path
import argparse,json,os,subprocess,sys
from applications import APP_ROOT,request
ROOT=Path(__file__).resolve().parents[1]
def alive(url):
    try:return request(url,timeout=2).get('ok',False)
    except Exception:return False
p=argparse.ArgumentParser();p.add_argument('--no-browser',action='store_true');a=p.parse_args()
cfg_path=ROOT/'local-only/machine.json';cfg=json.loads(cfg_path.read_text())
node=cfg.get('node') or __import__('shutil').which('node')
if not node:raise RuntimeError('Node runtime missing; see machine.json')
env={**os.environ,'CLASSROOM_APPLICATIONS':str(APP_ROOT),'CLASSROOM_NODE':node,'NO_PROXY':'localhost,127.0.0.1,host.docker.internal'}
subprocess.run(['docker','compose','-f',str(APP_ROOT/'compose.yaml'),'up','-d'],cwd=APP_ROOT,check=True)
processes=[]
try:
    if not alive('http://127.0.0.1:8870/health'):
        proc=subprocess.Popen([str(APP_ROOT/'neural-sparse/.venv/bin/python'),str(ROOT/'local/research-gateway.py')],env=env);processes.append(proc)
    args=[sys.executable,str(ROOT/'local/start-classroom.py'),'--config',str(cfg_path)]
    if a.no_browser:args.append('--no-browser')
    proc=subprocess.Popen(args,env=env);processes.append(proc)
    print('应用入口：http://127.0.0.1:3301\n课堂入口：http://127.0.0.1:8767/week03/\n关闭窗口停止本次启动的课堂进程；应用容器可用“停止应用服务”关闭。',flush=True)
    proc.wait()
except KeyboardInterrupt:pass
finally:
    for proc in reversed(processes):
        if proc.poll() is None:proc.terminate()
