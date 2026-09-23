"""Run upstream research/evaluation code with explicitly documented local adapters."""
import os
for k in ('ALL_PROXY','HTTP_PROXY','HTTPS_PROXY','all_proxy','http_proxy','https_proxy'):os.environ.pop(k,None)
os.environ['NO_PROXY']='127.0.0.1,localhost'
os.environ['LITELLM_LOCAL_MODEL_COST_MAP']='True'
os.environ['OPENAI_API_KEY']='classroom-local'
os.environ['OPENAI_API_BASE']='http://127.0.0.1:8870/v1'
os.environ['OPENAI_BASE_URL']='http://127.0.0.1:8870/v1'
import asyncio, importlib.metadata as md, json, sys, time, types, threading, subprocess
from pathlib import Path
from applications import APP_ROOT, DATA, request, metadata
MODEL='qwen3:4b-instruct-2507-q4_K_M'
BASE='http://127.0.0.1:8870/v1'
DOCS=json.loads((DATA/'corpus.json').read_text())['records']
TRACE=[]
def llm(prompt,limit=1600):
    r=request(BASE+'/chat/completions',{'model':MODEL,'messages':[{'role':'user','content':prompt}],'temperature':.1,'max_tokens':limit},timeout=300)
    answer=r['choices'][0]['message']['content'];TRACE.append({'input':prompt,'output':answer});return answer

def source_commit(name):return subprocess.check_output(['git','-C',str(APP_ROOT/'source'/name),'rev-parse','HEAD'],text=True).strip()

async def paperqa(query):
    from paperqa import Docs,Settings
    def cfg(name):return {'model_list':[{'model_name':name,'litellm_params':{'model':name,'api_base':BASE,'api_key':'classroom-local','max_tokens':1800}}],'router_kwargs':{'num_retries':0}}
    name='openai/'+MODEL;emb='openai/qwen3-embedding:0.6b'
    settings=Settings(llm=name,llm_config=cfg(name),summary_llm=name,summary_llm_config=cfg(name),embedding=emb,embedding_config={'kwargs':{'api_base':BASE,'api_key':'classroom-local'}},parsing={'use_doc_details':False,'multimodal':False,'disable_doc_valid_check':True,'reader_config':{'chunk_chars':1500,'overlap':100}},answer={'evidence_k':3,'answer_max_sources':3,'max_concurrent_requests':1,'answer_length':'约400字中文','evidence_summary_length':'约100字中文'},verbosity=0)
    docs=Docs();folder=APP_ROOT/'paperqa/inputs';folder.mkdir(parents=True,exist_ok=True)
    subset=[d for d in DOCS if d['id'] in ['JP16-p0012-01','JP16-p0012-02','JP12-p0017-01','JP13-p0012-01','ZT8-p0436-01']]
    for d in subset:
        p=folder/(d['id']+'.txt');p.write_text(d['text'])
        await docs.aadd(p,citation=f"{d['id']}, {d['title']}, PDF页序{d['pdf_page']}",docname=d['id'],dockey=d['id'],settings=settings)
    session=await docs.aquery(query+' 请用中文，仅依据提供的材料回答，注明引文编号，材料不足须明说。',settings=settings)
    return {'version':md.version('paper-qa'),'query':query,'answer':session.formatted_answer,'details':session.model_dump(mode='json'),'records':len(subset),'scope':'Official Docs.aadd/aquery pipeline; local 4B answer+summary and 0.6B embedding; five classroom excerpts; no external bibliographic lookup.'}

def ragchecker(query):
    from ragchecker import RAGResults,RAGChecker
    from ragchecker.metrics import all_metrics
    d=next(x for x in DOCS if x['id']=='JP12-p0017-01')
    # Deliberately contradictory answer is a labelled classroom test input, not a historical conclusion.
    test={'query_id':'classroom-1','query':'这段原文怎样判断神道是否为宗教？','gt_answer':'原文说神社崇拜具有宗教性质，因为它依靠信仰，信仰设定了人类以上的灵。','response':'原文认为神社崇拜具有宗教性质。原文还明确说井上哲次郎已经废除了所有神社。','retrieved_context':[{'doc_id':d['id'],'text':d['text']}]}
    results=RAGResults.from_json(json.dumps({'results':[test]},ensure_ascii=False))
    evaluator=RAGChecker(custom_llm_api_func=lambda prompts:[llm(p,1500) for p in prompts],batch_size_extractor=1,batch_size_checker=1)
    evaluator.evaluate(results,all_metrics)
    return {'version':md.version('ragchecker'),'query':test['query'],'input':test,'results_detail':json.loads(results.to_json()),'trace':TRACE,'scope':'Official RAGChecker metrics and claim extraction/checking; custom local 4B LLM callback; one explicitly constructed error case, not historical ground truth.'}

def pasa(query):
    folder=APP_ROOT/'source/pasa';sys.path.insert(0,str(folder))
    models=types.ModuleType('models');models.Agent=object;sys.modules['models']=models
    utils=types.ModuleType('utils');byid={d['id']:d for d in DOCS}
    def search(q,n,end):
        hits=request('http://127.0.0.1:8870/v1/search',{'query':q,'limit':n})['data']
        import re
        ids=[re.search(r'\[([^]]+)\]',h['markdown']).group(1) for h in hits]
        TRACE.append({'action':'local_corpus_search','query':q,'ids':ids});return ids
    def doc(i):
        d=byid.get(i)
        return None if d is None else {'title':d['id']+' '+d['title'],'abstract':d['text'],'arxiv_id':d['id'],'sections':{'原文片段':[]},'source':'classroom excerpt; ID is not an arXiv ID'}
    utils.google_search_arxiv_id=search;utils.search_paper_by_arxiv_id=doc;utils.search_paper_by_title=lambda t:None;utils.search_section_by_arxiv_id=lambda *a:{'原文片段':[]};sys.modules['utils']=utils
    from paper_agent import PaperAgent
    class LocalAgent:
        def infer(self,p):
            if isinstance(p,list):return [self.infer(x) for x in p]
            instruction='\n课堂适配：仅检索中日文历史史料。请给出最多两个中文或日文短查询，输出严格使用 [Search]宗教[End] 这样的格式；不要解释。' if 'generate' in p else '\n只输出 [Expand]原文片段[End]。'
            return llm(p+instruction,400)
        def batch_infer(self,ps):return [self.infer(p) for p in ps]
        def infer_score(self,ps):
            out=[]
            for p in ps:
                r=llm(p+'\n请先输出 Decision: True 或 Decision: False，再用中文简述。',500)
                import re
                m=re.search(r'Decision:\s*(True|False)',r,re.I)
                if not m:raise ValueError('Local selector did not return a parsable decision')
                out.append(1.0 if m[1].lower()=='true' else 0.0)
            return out
    agent=PaperAgent(query,LocalAgent(),LocalAgent(),prompts_path=str(folder/'agent_prompt.json'),expand_layers=1,search_queries=2,search_papers=3,expand_papers=2,threads_num=1)
    agent.run()
    return {'version':source_commit('pasa'),'query':query,'tree':agent.root.todic(),'trace':TRACE,'scope':'Original PaperAgent search/expand orchestration with local corpus and Qwen3-4B adapters. Not original PaSa-7B weights, Serper or arXiv. Selector score is parsed True/False, NOT trained token probability. Excerpts have no verified citation edges; expansion therefore adds none.'}

def race(query):
    os.environ.update(LLM_BACKEND='openai',OPENAI_API_KEY='classroom-local',OPENAI_BASE_URL=BASE,RACE_MODEL=MODEL,CLEAN_MODEL=MODEL,FACT_MODEL=MODEL,MAX_OUTPUT_TOKENS='3000',LLM_HTTP_TIMEOUT='300')
    sys.path.insert(0,str(APP_ROOT/'source/deep_research_bench'))
    from deepresearch_bench_race import process_single_item
    from utils.api import AIClient
    dims={'comprehensiveness':('材料范围','交代材料仅是少量片段，不能概括全部思想。'),'insight':('推论边界','区分文本相似、概念关系与历史影响，不能把相似直接作为影响证据。'),'instruction_following':('出处核验','保留片段编号和页序；不编造来源。'),'readability':('清楚表达','用简洁中文清楚说明。')}
    query='根据课堂片段说明宗教与国民道德的关系，同时交代材料和推论的边界。'
    criteria={'id':'classroom-1','prompt':query,'dimension_weight':{k:.25 for k in dims},'criterions':{k:[{'criterion':v[0],'explanation':v[1],'weight':1}] for k,v in dims.items()}}
    target='井上哲次郎与章太炎的思想完全相同，检索分数很高足以证明二人有直接影响关系。'
    reference='本轮只查看课堂片段。相似检索提示宗教、道德等词项可能相关，尚不能据此判定思想相同或直接影响。应回查片段编号、PDF页序、发表时间和引述主体，再寻找往来、引用等独立证据。材料不足时保留判断。'
    class Progress:
        def update(self,n):pass
    result=process_single_item({'id':'classroom-1','prompt':query},{query:{'article':target}},{query:{'article':reference}},{query:criteria},AIClient(),threading.Lock(),Progress(),2,'zh')
    return {'version':source_commit('deep_research_bench'),'query':query,'criteria':criteria,'test_answer':target,'reference_answer':reference,'evaluation':result,'scope':'Original RACE prompt, parsing and score calculation on ONE teacher-constructed comparison; local 4B judge, not official 100-task leaderboard or FACT Internet verification.'}

def main():
    import argparse
    p=argparse.ArgumentParser();p.add_argument('tool',choices=['paperqa','ragchecker','pasa','deepresearchbench']);p.add_argument('--query',default='井上哲次郎怎样区分宗教、神道和国民道德？');a=p.parse_args();start=time.monotonic()
    result=asyncio.run(paperqa(a.query)) if a.tool=='paperqa' else {'ragchecker':ragchecker,'pasa':pasa,'deepresearchbench':race}[a.tool](a.query)
    result=metadata(a.tool,result,start,model=MODEL,embedding_model='qwen3-embedding:0.6b' if a.tool=='paperqa' else None)
    out=APP_ROOT/'runs'/f'{a.tool}.json';out.write_text(json.dumps(result,ensure_ascii=False,indent=2));print('Saved actual result',a.tool,flush=True)
if __name__=='__main__':main()
