// 第四讲模型接入：OpenAI 兼容 chat/completions 配置与调用。
// 配置持久化到 localStorage；Key 只发往所填端点，不写入其他渠道。
export interface ModelSettings {
  baseUrl: string;
  apiKey: string;
  model: string;
}

const STORAGE_KEY = "week04-model-settings";

function load(): ModelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      localStorage.setItem(STORAGE_KEY,JSON.stringify({baseUrl:String(parsed.baseUrl||''),model:String(parsed.model||'')}));
      return {
        baseUrl: String(parsed.baseUrl || ""),
        apiKey: "",
        model: String(parsed.model || ""),
      };
    }
  } catch {
    /* 损坏的本地配置按未配置处理 */
  }
  return { baseUrl: "", apiKey: "", model: "" };
}

let settings: ModelSettings = load();

export const getModelSettings = (): ModelSettings => ({ ...settings });

export function setModelSettings(patch: Partial<ModelSettings>) {
  settings = { ...settings, ...patch };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ baseUrl: settings.baseUrl, model: settings.model }));
  } catch {
    /* 隐私模式等场景写不进 localStorage 时，配置仍在本页内存生效 */
  }
  window.dispatchEvent(new CustomEvent("model-settings-change"));
}

export const isModelReady = () =>
  !!settings.baseUrl.trim() && !!settings.model.trim() && (!!settings.apiKey.trim() || /^http:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(settings.baseUrl));

export function openModelSettings() {
  window.dispatchEvent(new CustomEvent("open-model-settings"));
}

export function chatEndpoint(base: string) {
  const u = new URL(base.trim());
  if (u.username || u.password || u.search || u.hash)
    throw Error("服务地址不能包含密钥、查询参数或用户密码。");
  if (
    u.protocol !== "https:" &&
    !(
      u.protocol === "http:" &&
      ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)
    )
  )
    throw Error("远程 API 须使用 HTTPS；HTTP 仅用于本机。");
  const clean = u.href.replace(/\/$/, "");
  return clean.endsWith("/chat/completions")
    ? clean
    : clean + "/chat/completions";
}

export interface ChatResult {
  text: string;
  model: string;
  seconds: number;
  usage?: any;
  finishReason?: string;
  toolCalls?: any[];
}

export async function chatCompletions(
  messages: { role: string; content: string | null; tool_calls?: any[]; tool_call_id?: string }[],
  opts: { maxTokens?: number; signal?: AbortSignal; tools?: any[]; onDelta?: (text:string)=>void } = {},
): Promise<ChatResult> {
  const c = getModelSettings();
  if (!isModelReady()) throw Error("请先在右上角「模型接入」中填写端点、模型与 Key。");
  const url = chatEndpoint(c.baseUrl);
  const signal = opts.signal
    ? AbortSignal.any([opts.signal, AbortSignal.timeout(180000)])
    : AbortSignal.timeout(180000);
  const start = performance.now();
  let r: Response;
  try {
    r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${c.apiKey}`,
      },
      body: JSON.stringify({
        messages,
        model: c.model,
        stream: !!opts.onDelta,
        temperature: 0.3,
        max_tokens: opts.maxTokens || 2048,
        ...(opts.tools ? {tools:opts.tools,tool_choice:'auto'} : {}),
      }),
      signal,
      redirect: "error",
      credentials: "omit",
    });
  } catch (e) {
    if (signal.aborted) throw Error("请求已取消或模型响应超时。");
    throw Error("API 连接失败；请核对端点地址与网络。");
  }
  if (!r.ok) {
    const detail = await r.text().catch(() => "");
    throw Error(
      `API 返回 HTTP ${r.status}${detail ? "：" + detail.slice(0, 200) : ""}；请核对模型、余额和 Key。`,
    );
  }
  if(opts.onDelta&&r.headers.get('content-type')?.includes('text/event-stream')){
    const reader=r.body.getReader(),decoder=new TextDecoder();let pending='',text='',model=c.model,usage:any,finishReason='',calls:any[]=[];
    const consume=(line:string)=>{if(!line.startsWith('data:'))return;const data=line.slice(5).trim();if(!data||data==='[DONE]')return;const frame=JSON.parse(data),choice=frame.choices?.[0];model=frame.model||model;usage=frame.usage||usage;if(choice?.finish_reason)finishReason=choice.finish_reason;const delta=choice?.delta;if(typeof delta?.content==='string'){text+=delta.content;opts.onDelta(text);}for(const part of delta?.tool_calls||[]){const index=part.index||0,current=calls[index] ||= {id:'',type:'function',function:{name:'',arguments:''}};if(part.id)current.id=part.id;if(part.function?.name)current.function.name+=part.function.name;if(part.function?.arguments)current.function.arguments+=part.function.arguments;}};
    try{while(true){const result=await reader.read();pending+=decoder.decode(result.value||new Uint8Array(),{stream:!result.done});let newline;while((newline=pending.indexOf('\n'))>=0){consume(pending.slice(0,newline).replace(/\r$/,''));pending=pending.slice(newline+1);}if(result.done)break;}if(pending.trim())consume(pending.replace(/\r$/,''));}finally{reader.releaseLock();}
    if(!text.trim()&&!calls.length)throw Error('API 未返回答案正文。');
    return {text,model,usage,finishReason,seconds:(performance.now()-start)/1000,toolCalls:calls.filter(Boolean)};
  }
  const d = await r.json();
  const choice = d.choices?.[0];
  const text = choice?.message?.content;
  if ((!text || !text.trim()) && !choice?.message?.tool_calls?.length)
    throw Error("API 未返回答案正文。");
  opts.onDelta?.(text||'');
  return {
    text: text || '',
    model: d.model || c.model,
    seconds: (performance.now() - start) / 1000,
    usage: d.usage,
    finishReason: choice.finish_reason,
    toolCalls: choice.message.tool_calls,
  };
}
