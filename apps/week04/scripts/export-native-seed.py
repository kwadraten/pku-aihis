"""Read-only, transaction-consistent subset of the active Patchouli library.

Keeps the original schema, IDs, document trees, history and search projections.
Does not copy credentials, authorization payloads or unrelated library records.
"""
import hashlib,json,os,sqlite3,subprocess,shutil,uuid
from pathlib import Path

APP=Path(__file__).resolve().parents[1]
settings=Path(os.environ['LOCALAPPDATA'])/'Patchouli/settings.json'
source=Path(os.environ.get('PATCHOULI_DATABASE') or json.loads(settings.read_text(encoding='utf-8-sig'))['Patchouli']['RuntimeDatabasePath'])
book_root=Path(os.environ.get('WEEK04_PDF_LIBRARY',''))
if not os.environ.get('WEEK04_PDF_LIBRARY'):
    folders=list((Path.home()/'WPSDrive').glob('*/WPS云盘/PDF书库'))
    if len(folders)!=1: raise RuntimeError('Set WEEK04_PDF_LIBRARY to the PDF library directory')
    book_root=folders[0]
ITEMS=['ef26f586-3974-42d9-8b0c-94b0a605df73','a6b3ba05-1989-454e-a583-97672d2a488a','bd70fce9-6c47-4da5-a894-c2b1f7141255','1e5d7930-c7ed-4208-9086-fd2423c71f91']
dest=APP/'src/assets/seed';dest.mkdir(parents=True,exist_ok=True)
staging=dest/('native-library.partial-'+str(uuid.uuid4())+'.sqlite')
src=sqlite3.connect(source.resolve().as_uri()+'?mode=ro',uri=True)
src.execute('begin')
q=lambda x:'"'+x.replace('"','""')+'"'
params=lambda values:','.join('?' for _ in values)
def query(sql,args=()):return src.execute(sql,args).fetchall()
library_id,epoch,revision=query('select library_id,schema_version,library_revision from library_metadata')[0]
docs=query('select document_instance_id,item_id,file_asset_id,title from document_instances where item_id in ('+params(ITEMS)+')',ITEMS)
if len(docs)!=4: raise RuntimeError('Expected exactly four source document instances')
DOCS=[r[0] for r in docs];ASSETS=[r[2] for r in docs]
revisions=[r[0] for r in query('select tree_revision_id from document_tree_revisions where document_instance_id in ('+params(DOCS)+')',DOCS)]
presets=[r[0] for r in query('select distinct preset_id from ocr_runs where document_instance_id in ('+params(DOCS)+')',DOCS)]
collections=[r[0] for r in query('select distinct collection_id from item_collections where item_id in ('+params(ITEMS)+')',ITEMS)]
filters={}
def scoped(table,col,values):filters[table]=(q(col)+' in ('+params(values)+')' if values else '0',values)
for t in ['items','item_identifiers','item_creators','item_dates','item_type_inferences','item_collections','item_tag_memberships']:scoped(t,'item_id',ITEMS)
for t in ['document_instances','pages','document_tree_revisions','document_boxes','document_commits','ocr_runs','ocr_candidate_adoptions','search_units','fts_row_map']:scoped(t,'document_instance_id',DOCS)
scoped('file_assets','file_asset_id',ASSETS);scoped('known_file_locations','file_asset_id',ASSETS)
scoped('collections','collection_id',collections)
scoped('ocr_presets','preset_id',presets);scoped('ocr_preset_versions','preset_id',presets)
PAGES=[r[0] for r in query('select page_id from pages where document_instance_id in ('+params(DOCS)+')',DOCS)]
for t in ['document_commit_pages','ocr_page_results','page_translations','translation_boxes']:scoped(t,'page_id',PAGES)
scoped('file_asset_payload_refs','tree_revision_id',revisions)
filters['search_index_status']=('scope_id in ('+params([library_id]+ITEMS+DOCS+collections)+')',[library_id]+ITEMS+DOCS+collections)
global_tables={'schema_migrations','library_metadata','search_profiles','search_rewrite_rules','search_settings','csl_styles','csl_settings','fts_cache_state'}
schema=query("select type,name,tbl_name,sql from sqlite_schema where sql is not null and name not like 'sqlite_%' order by rowid")
objects=[r for r in schema if not (r[1].startswith('search_units_fts_'))]
out=sqlite3.connect(staging);out.execute('pragma foreign_keys=off')
for typ,name,table,sql in objects:
    if typ=='table':out.execute(sql)
def fingerprint(rows):
    return hashlib.sha256(json.dumps(rows,ensure_ascii=False,default=lambda x:{'blob':bytes(x).hex()},separators=(',',':')).encode()).hexdigest()
counts={};row_hashes={}
for typ,table,_,sql in objects:
    if typ!='table' or table=='search_units_fts':continue
    if table in filters:where,args=filters[table]
    elif table in global_tables:where,args='1',[]
    else:where,args='0',[]
    # The selected rows retain every original column, including nullable fields.
    info=query('pragma table_info('+q(table)+')');cols=[r[1] for r in info]
    order=[r[1] for r in sorted(info,key=lambda r:r[5]) if r[5]] or cols
    order_sql=','.join(map(q,order))
    rows=query('select '+','.join(map(q,cols))+' from '+q(table)+' where '+where+' order by '+order_sql,args)
    if table in ['ocr_presets','ocr_preset_versions','ocr_runs']:
        for row in rows:
            for col,value in zip(cols,row):
                if col in ['parameters_json','parameters_snapshot_json'] and value:
                    def inspect(obj):
                        if isinstance(obj,dict):
                            for k,v in obj.items():
                                if k.lower().replace('_','') in ['apikey','accesstoken','token','secret','password'] and v:raise RuntimeError('Secret found in OCR parameters; not exported')
                                inspect(v)
                        elif isinstance(obj,list):
                            for v in obj:inspect(v)
                    inspect(json.loads(value))
    out.executemany('insert into '+q(table)+'('+','.join(map(q,cols))+') values('+params(cols)+')',rows)
    copied=out.execute('select '+','.join(map(q,cols))+' from '+q(table)+' order by '+order_sql).fetchall()
    if copied!=rows:raise RuntimeError('Row identity mismatch: '+table)
    counts[table]=len(rows);row_hashes[table]=fingerprint(rows)
fts=query('select rowid,unit_id,document_instance_id,page_id,resolved_text from search_units_fts where document_instance_id in ('+params(DOCS)+') order by rowid',DOCS)
out.executemany('insert into search_units_fts(rowid,unit_id,document_instance_id,page_id,resolved_text) values(?,?,?,?,?)',fts)
if out.execute('select rowid,unit_id,document_instance_id,page_id,resolved_text from search_units_fts order by rowid').fetchall()!=fts:raise RuntimeError('FTS row mismatch')
counts['search_units_fts']=len(fts);row_hashes['search_units_fts']=fingerprint(fts)
for typ,name,table,sql in objects:
    if typ!='table':out.execute(sql)
for pragma in ['user_version','application_id']:
    value=query('pragma '+pragma)[0][0];out.execute('pragma '+pragma+'='+str(value))
out.commit();out.execute('pragma foreign_keys=on')
if out.execute('pragma foreign_key_check').fetchall():raise RuntimeError('Subset has missing foreign-key dependencies')
if out.execute('pragma integrity_check').fetchone()[0]!='ok':raise RuntimeError('Subset integrity failed')
schema_projection=lambda db: sorted(db.execute("select type,name,tbl_name,sql from sqlite_schema where sql is not null and name not like 'sqlite_%' and name not like 'search_units_fts_%'").fetchall())
if schema_projection(out)!=schema_projection(src):raise RuntimeError('Schema differs from source')
pdfs=[]
for doc,item,asset,title in docs:
    name,expected_hash,page_count=query('select file_name,full_blake3,page_count from file_assets where file_asset_id=?',[asset])[0]
    pdf=book_root/name
    if not pdf.is_file():raise RuntimeError('Missing source PDF: '+name)
    js="const fs=require('node:fs');import('@noble/hashes/blake3.js').then(({blake3})=>console.log(Buffer.from(blake3(fs.readFileSync(process.argv[1]))).toString('hex')))"
    actual_hash=subprocess.check_output(['node','-e',js,str(pdf)],cwd=APP,text=True).strip()
    if actual_hash!=expected_hash:raise RuntimeError('PDF differs from original BLAKE3: '+name)
    target=dest/'pdfs'/(asset+'.pdf');target.parent.mkdir(exist_ok=True);shutil.copyfile(pdf,target)
    pdfs.append({'item_id':item,'document_id':doc,'file_asset_id':asset,'name':name,'path':'pdfs/'+target.name,'pages':page_count,'bytes':target.stat().st_size,'blake3':actual_hash,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()})
out.close();src.rollback();src.close()
target=dest/'native-library.sqlite';staging.replace(target)
manifest={'format':'patchouli-native-classroom-subset-v1','library_id':library_id,'library_revision':revision,'schema_epoch':epoch,'database':{'path':target.name,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()},'schema_sha256':fingerprint(sorted(objects)),'rows':counts,'row_sha256':row_hashes,'pdfs':pdfs,'mode':'Original SQLite rows and schema, read-only consistent subset; no BibLaTeX/Markdown reconstruction','excluded':'Unrelated documents, credentials, authorization bindings and device operational logs'}
(dest/'native-seed.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
allowed={'native-seed.json',target.name,*(pdf['path'] for pdf in pdfs)}
for obsolete in dest.rglob('*'):
    if obsolete.is_file() and obsolete.relative_to(dest).as_posix() not in allowed:
        obsolete.unlink()
print(json.dumps({'library_id':library_id,'revision':revision,'items':counts['items'],'pages':counts['pages'],'revisions':counts['document_tree_revisions'],'boxes':counts['document_boxes'],'fts':len(fts),'pdfs':len(pdfs),'database_bytes':target.stat().st_size,'schema_identical':True,'copied_rows_identical':True},ensure_ascii=False))

subprocess.run([os.sys.executable, str(APP / "scripts/prepare-classroom-tags.py")], check=True)
