"""Loopback classroom server. API keys are used per request, never logged or stored."""
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.error import URLError
from urllib.parse import unquote, urlsplit
from corpus_sources import read_original
import argparse,json,os,functools,shutil
from model_backend import completion, models
ROOT=Path(__file__).resolve().parents[1]
MODEL_ROOT=Path(os.environ.get('CLASSROOM_MODEL_ASSETS',ROOT/'models'))
MODEL_ROWS=json.loads((ROOT/'local/models.json').read_text()) if (ROOT/'local/models.json').exists() else []
MODEL_FILES={row['repo']+'/'+f: MODEL_ROOT/row['directory']/f for row in MODEL_ROWS for f in row['files']}
ALLOWED={'http://127.0.0.1:8767','http://localhost:8767','https://lyzhackjp.github.io'}

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cross-Origin-Opener-Policy','same-origin');self.send_header('Cross-Origin-Embedder-Policy','credentialless');self.send_header('Cross-Origin-Resource-Policy','cross-origin')
        origin=self.headers.get('Origin')
        if origin in ALLOWED:self.send_header('Access-Control-Allow-Origin',origin);self.send_header('Vary','Origin')
        self.send_header('Access-Control-Allow-Methods','GET, POST, OPTIONS');self.send_header('Access-Control-Allow-Headers','Content-Type');self.send_header('Access-Control-Allow-Private-Network','true');self.send_header('Cache-Control','no-store' if self.path.startswith('/api/') else 'no-cache');super().end_headers()
    def answer(self,status,data):
        body=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Content-Length',str(len(body)));self.end_headers()
        try:self.wfile.write(body)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_OPTIONS(self):
        if self.headers.get('Origin') not in ALLOWED|{None}:return self.answer(403,{'error':'Origin not allowed'})
        self.answer(200,{'ok':True})
    def do_GET(self):
        if self.path.startswith('/api/') and self.headers.get('Origin') not in ALLOWED|{None}:return self.answer(403,{'error':'Origin not allowed'})
        if self.path.startswith('/api/corpus-source/'):
            try:
                body, mime = read_original(unquote(urlsplit(self.path).path[len('/api/corpus-source/'):]))
            except FileNotFoundError:return self.answer(404,{'error':'本地未找到白名单内的核验原件。'})
            except ValueError as e:return self.answer(409,{'error':str(e)})
            self.send_response(200);self.send_header('Content-Type',mime);self.send_header('Content-Length',str(len(body)));self.send_header('X-Content-Type-Options','nosniff');self.end_headers()
            try:self.wfile.write(body)
            except (BrokenPipeError,ConnectionResetError):pass
            return
        if self.path=='/api/model-assets':return self.answer(200,{'available':all(p.exists() for k,p in MODEL_FILES.items() if k.startswith('Xenova/paraphrase')) and bool(MODEL_FILES)})
        if self.path.startswith('/models/'):
            target=MODEL_FILES.get(self.path[len('/models/'):])
            if target is None or not target.is_file():return self.answer(404,{'error':'Model asset not available'})
            self.send_response(200);self.send_header('Content-Type','application/json' if target.suffix=='.json' else 'application/octet-stream');self.send_header('Content-Length',str(target.stat().st_size));self.end_headers()
            try:
                with target.open('rb') as f:shutil.copyfileobj(f,self.wfile)
            except (BrokenPipeError,ConnectionResetError):pass
            return
        if self.path=='/api/health':return self.answer(200,{'ok':True,'generation':'Check /api/models, then run an actual request.'})
        if self.path=='/api/models':
            try:return self.answer(200,models())
            except Exception:return self.answer(502,{'error':'本机Ollama未启动或模型尚不可用。请运行启动课堂脚本。'})
        return super().do_GET()
    def do_POST(self):
        if self.headers.get('Origin') not in ALLOWED|{None}:return self.answer(403,{'error':'Origin not allowed'})
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.answer(415,{'error':'application/json required'})
        try:
            n=int(self.headers.get('Content-Length',0))
            if not 0<n<=12000000:raise ValueError('request size invalid')
            d=json.loads(self.rfile.read(n))
            if self.path=='/api/generate':return self.answer(200,completion(d))
            if self.path.startswith('/api/tool/'):
                from retrieval import run
                return self.answer(200,run(self.path.rsplit('/',1)[-1],d.get('query','宗教')))
            return self.answer(404,{'error':'unknown endpoint'})
        except (ValueError,KeyError,TypeError) as e:self.answer(400,{'error':str(e)})
        except (URLError,TimeoutError):self.answer(502,{'error':'模型服务连接失败或超时；检查本机服务、端点和模型。'})
        except RuntimeError as e:self.answer(502,{'error':str(e)})
        except Exception as e:self.answer(500,{'error':'模型调用失败：'+type(e).__name__})
    def log_message(self,format,*args):pass
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--port',type=int,default=8767);p.add_argument('--directory',default=str(ROOT/'site'));a=p.parse_args()
    ALLOWED.update({f'http://127.0.0.1:{a.port}',f'http://localhost:{a.port}'})
    print(f'Classroom server: http://127.0.0.1:{a.port}/week03/',flush=True)
    ThreadingHTTPServer(('127.0.0.1',a.port),functools.partial(Handler,directory=a.directory)).serve_forever()
