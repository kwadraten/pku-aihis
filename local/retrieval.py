"""Reproducible local retrieval against the public classroom snapshot."""
from pathlib import Path
import json, time,uuid,importlib.metadata as md,argparse
ROOT=Path(__file__).resolve().parents[1]
def run(tool,query='宗教'):
    if tool in {'anythingllm','elasticsearch','opensearch'}:
        from applications import run as run_application
        return run_application(tool,query)
    if tool in {'deep-research','pasa','paperqa2','evaluation'}:
        from applications import research_tool
        return research_tool(tool,query)
    corpus=ROOT/'apps/week03/src/assets/data/corpus.json'
    if not corpus.exists():corpus=ROOT/'site/week03/assets/data/corpus.json'
    c=json.loads(corpus.read_text());docs=c['records'];q=next((x for x in c['queries'] if x['text']==query),None)
    if tool!='tantivy' and q is None:raise ValueError('This local runner requires a saved query vector; choose a query from corpus.json.')
    ids=[x['id'] for x in docs];vecs=[x['vector'] for x in docs];t=time.perf_counter();scores=[]
    if tool=='chroma':
        import chromadb
        cli=chromadb.EphemeralClient();name='classroom-'+uuid.uuid4().hex;col=cli.create_collection(name,metadata={'hnsw:space':'cosine'},embedding_function=None)
        col.add(ids=ids,embeddings=vecs,documents=[d['text'] for d in docs]);r=col.query(query_embeddings=[q['vector']],n_results=5)
        scores=[{'id':i,'score':float(s)} for i,s in zip(r['ids'][0],r['distances'][0])];metric='cosine distance; smaller is nearer';cli.delete_collection(name);pkg='chromadb'
    elif tool=='qdrant':
        from qdrant_client import QdrantClient,models
        cli=QdrantClient(':memory:');cli.create_collection('classroom',vectors_config=models.VectorParams(size=384,distance=models.Distance.COSINE));cli.upsert('classroom',points=[models.PointStruct(id=i,vector=v,payload={'source_id':ids[i]}) for i,v in enumerate(vecs)])
        r=cli.query_points('classroom',query=q['vector'],limit=5);scores=[{'id':x.payload['source_id'],'score':float(x.score)} for x in r.points];metric='cosine similarity; larger is nearer';cli.close();pkg='qdrant-client'
    elif tool=='milvus':
        from pymilvus import MilvusClient
        import tempfile
        with tempfile.TemporaryDirectory(prefix='week03-milvus-') as td:
            cli=MilvusClient(uri=str(Path(td)/'classroom.db'));cli.create_collection(collection_name='classroom',dimension=384,metric_type='COSINE',consistency_level='Strong');cli.insert(collection_name='classroom',data=[{'id':i,'vector':v,'source_id':ids[i]} for i,v in enumerate(vecs)]);r=cli.search(collection_name='classroom',data=[q['vector']],limit=5,output_fields=['source_id']);scores=[{'id':x['entity']['source_id'],'score':float(x['distance'])} for x in r[0]];cli.close()
        metric='cosine similarity (response field distance); larger is nearer';pkg='pymilvus'
    elif tool=='tantivy':
        import tantivy
        sb=tantivy.SchemaBuilder();sb.add_text_field('id',stored=True);sb.add_text_field('body',stored=True,tokenizer_name='ngram2');schema=sb.build();idx=tantivy.Index(schema);idx.register_tokenizer('ngram2',tantivy.TextAnalyzerBuilder(tantivy.Tokenizer.ngram(min_gram=2,max_gram=2,prefix_only=False)).build());w=idx.writer()
        for d in docs:w.add_document(tantivy.Document(id=d['id'],body=d['text']))
        w.commit();idx.reload();searcher=idx.searcher();r=searcher.search(idx.parse_query(query,['body']),limit=5);scores=[{'id':searcher.doc(addr)['id'][0],'score':float(score)} for score,addr in r.hits];metric='Tantivy BM25 over character bigrams; larger is nearer';pkg='tantivy'
    else:raise ValueError('Unknown or unsupported local tool')
    return {'tool':tool,'version':md.version(pkg),'corpus':c['manifest']['id'],'records':len(docs),'query':query,'metric':metric,'results':scores,'embedding':c['manifest']['embedding'] if tool!='tantivy' else None,'seconds':round(time.perf_counter()-t,4),'run_at':time.strftime('%Y-%m-%dT%H:%M:%S%z'),'status':'actual local run','scope':'single-process local teaching mode; not a distributed server benchmark'}
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('tool',choices=['chroma','qdrant','milvus','tantivy']);p.add_argument('--query',default='宗教');a=p.parse_args();print(json.dumps(run(a.tool,a.query),ensure_ascii=False,indent=2))
