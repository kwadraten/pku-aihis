"""Local Ollama + explicit OpenAI-compatible requests. Never persist credentials."""
from urllib.request import Request, urlopen, build_opener, HTTPRedirectHandler
from urllib.parse import urlparse
from urllib.error import HTTPError
import json, os, time, uuid, re

OLLAMA = os.environ.get('OLLAMA_URL', 'http://127.0.0.1:11434').rstrip('/')
DEFAULT_MODEL = 'qwen3:4b'
MAX_PARAMETERS = 10_000_000_000

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def request_json(url, body=None, key='', timeout=300):
    headers = {'Content-Type': 'application/json'}
    if key: headers['Authorization'] = 'Bearer ' + key
    req = Request(url, data=None if body is None else json.dumps(body, ensure_ascii=False).encode(), headers=headers)
    try:
        with build_opener(NoRedirect).open(req, timeout=timeout) as r: return json.load(r)
    except HTTPError as e:
        # A provider may echo request details. Never return raw provider error bodies.
        raise RuntimeError(f'Model service returned HTTP {e.code}; check endpoint, model and credentials.') from None

def endpoint(base):
    p = urlparse(base)
    if p.username or p.password or p.query or p.fragment or not p.hostname: raise ValueError('Invalid API URL')
    if p.scheme != 'https' and not (p.scheme == 'http' and p.hostname in {'localhost','127.0.0.1','::1'}):
        raise ValueError('API requires HTTPS; HTTP is only allowed on loopback')
    clean = base.rstrip('/')
    return clean if clean.endswith('/chat/completions') else clean + '/chat/completions'

def model_info(name):
    d = request_json(OLLAMA + '/api/show', {'model': name}, timeout=30)
    count = d.get('model_info', {}).get('general.parameter_count')
    if not isinstance(count, (int, float)):
        m = re.fullmatch(r'([\d.]+)([BM])', d.get('details', {}).get('parameter_size', ''))
        if not m: raise ValueError('Cannot verify local model parameter count')
        count = float(m[1]) * (1e9 if m[2] == 'B' else 1e6)
    if count > MAX_PARAMETERS: raise ValueError('课堂本地模型上限为10B总参数；此模型超过上限。')
    tag = next((x for x in request_json(OLLAMA+'/api/tags', timeout=15)['models'] if x['name'] == name or x['model'] == name), {})
    return {'model': name, 'digest': tag.get('digest'), 'parameters': int(count),
            'parameter_size': d.get('details', {}).get('parameter_size'),
            'quantization': d.get('details', {}).get('quantization_level'),
            'capabilities': d.get('capabilities', []),
            'runner': 'Ollama', 'runner_version': request_json(OLLAMA+'/api/version', timeout=15)['version']}

def models():
    output = []
    for row in request_json(OLLAMA+'/api/tags', timeout=15).get('models', []):
        try: output.append(model_info(row['name']))
        except ValueError: continue
    return {'models': output, 'maximum_parameters': MAX_PARAMETERS}

def validate_messages(messages):
    if not isinstance(messages,list) or not 1 <= len(messages) <= 40: raise ValueError('messages required (1–40)')
    for m in messages:
        if not isinstance(m,dict) or m.get('role') not in {'system','user','assistant','tool'}: raise ValueError('Invalid message role')
        if not isinstance(m.get('content'),(str,list)): raise ValueError('Invalid message content')

def ollama_messages(messages):
    result=[]
    for m in messages:
        if isinstance(m['content'],str): result.append({'role':m['role'],'content':m['content']}); continue
        texts=[];images=[]
        for part in m['content']:
            if part.get('type')=='text': texts.append(part['text'])
            elif part.get('type')=='image_url':
                url=part.get('image_url',{}).get('url','')
                if not re.match(r'^data:image/(jpeg|png|webp);base64,',url): raise ValueError('Only embedded classroom images supported')
                images.append(url.split(',',1)[1])
            else: raise ValueError('Unsupported multimodal content')
        result.append({'role':m['role'],'content':'\n'.join(texts),**({'images':images} if images else {})})
    return result

def completion(data):
    messages=data.get('messages');validate_messages(messages)
    tokens=int(data.get('max_tokens',1536))
    if not 64 <= tokens <= 4096: raise ValueError('max_tokens must be 64–4096')
    temperature=float(data.get('temperature',0.6))
    if not 0 <= temperature <= 2: raise ValueError('temperature must be 0–2')
    start=time.monotonic(); provider=data.get('provider','ollama')
    if provider=='ollama':
        name=data.get('model') or DEFAULT_MODEL;info=model_info(name)
        msgs=ollama_messages(messages)
        if any(m.get('images') for m in msgs) and 'vision' not in info['capabilities']: raise ValueError('请选择支持图像的模型，例如Gemma3 4B。')
        body={'model':name,'messages':msgs,'stream':False,'keep_alive':'10m',
              'options':{'temperature':temperature,'num_predict':tokens,'num_ctx':8192,'seed':42,'top_p':0.95,'top_k':20,'repeat_penalty':1.1}}
        if 'thinking' in info['capabilities']:
            body['think']=True
            body['options']['num_predict']=max(8192,tokens)
        if data.get('json_mode'): body['format']='json'
        r=request_json(OLLAMA+'/api/chat',body)
        text=r.get('message',{}).get('content','')
        if not text.strip(): raise RuntimeError('模型没有返回正文；本次输出不作为完成的答案。')
        return {'text':text,**info,'provider':'local','created_at':r.get('created_at'),'request_id':str(uuid.uuid4()),
                'seconds':round(time.monotonic()-start,3),'finish_reason':r.get('done_reason'),
                'usage':{'prompt_tokens':r.get('prompt_eval_count'),'completion_tokens':r.get('eval_count')},
                'generation':{'temperature':temperature,'max_tokens':body['options']['num_predict'],'seed':42,'num_ctx':8192,'top_p':0.95,'top_k':20,'repeat_penalty':1.1,'thinking':body.get('think')}}
    if provider!='openai': raise ValueError('Unsupported provider')
    key=data.get('api_key','');name=data.get('model','').strip()
    if not name: raise ValueError('API model name required')
    url=endpoint(data.get('base_url',''))
    body={'model':name,'messages':messages,'stream':False,'temperature':temperature,'max_tokens':tokens}
    if data.get('json_mode'):body['response_format']={'type':'json_object'}
    if urlparse(url).hostname=='api.deepseek.com':body['thinking']={'type':'disabled'}
    r=request_json(url,body,key=key)
    choice=r['choices'][0];text=choice['message'].get('content','')
    if not text.strip():raise RuntimeError('API未返回答案正文。')
    return {'text':text,'model':r.get('model',name),'provider':'api','endpoint_host':urlparse(url).hostname,
            'created_at':r.get('created'),'request_id':r.get('id',str(uuid.uuid4())),
            'seconds':round(time.monotonic()-start,3),'finish_reason':choice.get('finish_reason'),'usage':r.get('usage'),
            'generation':{'temperature':temperature,'max_tokens':tokens},'version_note':'服务返回的模型标识；供应商未提供权重版本'}
