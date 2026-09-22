"""Start the classroom and a separate loopback Ollama instance. No autostart job."""
from pathlib import Path
from urllib.request import urlopen
import argparse,json,os,shutil,subprocess,sys,time,webbrowser
ROOT=Path(__file__).resolve().parents[1]
def alive(url):
    try:
        with urlopen(url,timeout=2) as r:return r.status==200
    except Exception:return False

def main():
    p=argparse.ArgumentParser();p.add_argument('--no-browser',action='store_true');p.add_argument('--config',type=Path,default=ROOT/'local-only/machine.json');a=p.parse_args()
    cfg=json.loads(a.config.read_text()) if a.config.exists() else {}
    binary=cfg.get('ollama_bin') or os.environ.get('OLLAMA_BIN') or shutil.which('ollama')
    if not binary:
        candidate=Path('/Applications/Ollama.app/Contents/Resources/ollama')
        if candidate.exists():binary=str(candidate)
    store=Path(cfg.get('model_store',ROOT/'local-only/ollama-models'));store.mkdir(parents=True,exist_ok=True)
    model_port=int(cfg.get('model_port',11435));class_port=int(cfg.get('classroom_port',8767));model_url=f'http://127.0.0.1:{model_port}';url=f'http://127.0.0.1:{class_port}'
    processes=[];log=None
    try:
        if not alive(model_url+'/api/version'):
            if binary:
                logdir=ROOT/'local-only';logdir.mkdir(exist_ok=True);log=open(logdir/'ollama.log','a')
                env={**os.environ,'OLLAMA_HOST':f'127.0.0.1:{model_port}','OLLAMA_MODELS':str(store),'OLLAMA_NUM_PARALLEL':'1','OLLAMA_MAX_LOADED_MODELS':'1','OLLAMA_NO_CLOUD':'1'}
                process=subprocess.Popen([binary,'serve'],env=env,stdout=log,stderr=log);processes.append(process)
                for _ in range(60):
                    if alive(model_url+'/api/version'):break
                    if process.poll() is not None:raise RuntimeError('Ollama启动失败；见local-only/ollama.log')
                    time.sleep(.5)
                else:raise RuntimeError('Ollama启动超时')
            else:print('未找到Ollama；保存示例和API仍可使用。需要本地模型时安装 https://ollama.com/download')
        if not alive(url+'/api/health'):
            env={**os.environ,'OLLAMA_URL':model_url,'CLASSROOM_MODEL_ASSETS':str(cfg.get('embedding_models',ROOT/'models'))}
            proc=subprocess.Popen([sys.executable,str(ROOT/'local/runtime.py'),'--port',str(class_port)],env=env);processes.append(proc)
            for _ in range(40):
                if alive(url+'/api/health'):break
                if proc.poll() is not None:raise RuntimeError('课堂服务启动失败')
                time.sleep(.25)
            else:raise RuntimeError('课堂服务启动超时')
        print('课堂地址：'+url+'/week03/\n保持此窗口开启；Control+C退出。',flush=True)
        if not a.no_browser:webbrowser.open(url+'/week03/')
        while True:
            if any(x.poll() is not None for x in processes):raise RuntimeError('本次启动的服务已停止')
            time.sleep(1)
    except KeyboardInterrupt:pass
    finally:
        for x in reversed(processes):
            if x.poll() is None:x.terminate()
        for x in processes:
            try:x.wait(timeout=8)
            except subprocess.TimeoutExpired:x.kill()
        if log:log.close()
if __name__=='__main__':main()
