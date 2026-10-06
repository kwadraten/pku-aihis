import {buildIndexText,buildFtsQuery} from './search-text';
import {displayCreator,isCjkCreator} from './creator-name';
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";
import { blake3 } from "@noble/hashes/blake3.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import { openStorage, loadState, saveState } from "./storage";
import { MIGRATIONS, PATCHOULI_MANIFEST } from "./migrations.generated";

declare global {
  interface Window {
    DotNet?: any;
  }
}

const uuid = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const hash = (bytes: Uint8Array) => bytesToHex(blake3(bytes));

// The wasm binary is a copied build asset, not a bundler URL.
const sqliteWasmUrl = () =>
  new URL("assets/vendor/sqlite3.wasm", document.baseURI).href;

export interface PdfPageInfo {
  width: number;
  height: number;
  rotation: number;
}
export interface PageCandidate {
  pageId: string;
  boxes: BoxCandidate[];
}
export interface BoxCandidate {
  id?: string;
  parent?: string | null;
  next?: string | null;
  type?: string;
  baseType?: string | null;
  subType?: string | null;
  continuesFromBoxId?: string | null;
  payloadJson?: string;
  text?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  headingLevel?: number | null;
  codeLanguage?: string | null;
  confidence?: number | null;
  suppressed?: boolean;
}

export class Library {
  sqlite: any;
  storage: IDBDatabase;
  files: Record<string, { name: string; data: Uint8Array; hash: string }> = {};
  db: any;
  libraryId: string;

  async init(initial?: { libraryId: string; load: () => Promise<{bytes:Uint8Array;files:Library['files']}> }) {
    // The upstream typings declare no init options; locateFile is supported at runtime.
    this.sqlite = await (sqlite3InitModule as any)({
      locateFile: (file: string) =>
        file.endsWith(".wasm") ? sqliteWasmUrl() : file,
    });
    this.storage = await openStorage();
    let state = await loadState(this.storage);
    if(state && initial){
      const previous=this.openDatabase(state.bytes);
      try {
        const id=previous.exec({sql:'select library_id from library_metadata',rowMode:'object',returnValue:'resultRows'})[0]?.library_id;
        const trial=previous.exec({sql:"select name from sqlite_schema where name='browser_seed_imports'",rowMode:'object',returnValue:'resultRows'}).length;
        if(!id||trial)state=null;
      }finally{previous.close();}
    }
    if(!state&&initial)state=await initial.load();
    this.files = state?.files || {};
    this.db = this.openDatabase(state?.bytes);
    this.migrate();
    if (!this.rows("select * from library_metadata").length) {
      this.insert("library_metadata", {
        library_id: uuid(),
        display_name: "第四讲实验书库",
        schema_version: 2,
        created_at: now(),
        updated_at: now(),
      });
    }
    this.libraryId = this.rows("select library_id from library_metadata")[0]
      .library_id;
    const obsolete=this.rows("select setting_key,value_json from library_setting_records where setting_key like 'web.%' and merge_policy='replace'");
    for(const row of obsolete)await this.saveToolRecord(row.setting_key,JSON.parse(row.value_json));
    if(obsolete.length)await this.mutate(()=>{for(const row of obsolete)this.run('delete from library_setting_records where setting_key=?',[row.setting_key]);});
    await this.persist();
    return this;
  }
  openDatabase(bytes?: Uint8Array) {
    const db = new this.sqlite.oo1.DB(":memory:");
    if (bytes) {
      const pointer = this.sqlite.wasm.allocFromTypedArray(bytes);
      // SQLite takes ownership of this allocation, including close/free.
      const rc = this.sqlite.capi.sqlite3_deserialize(
        db.pointer,
        "main",
        pointer,
        bytes.length,
        bytes.length,
        this.sqlite.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
          this.sqlite.capi.SQLITE_DESERIALIZE_RESIZEABLE,
      );
      if (rc) {
        db.close();
        throw new Error(`SQLite deserialize failed: ${rc}`);
      }
    }
    db.exec("pragma foreign_keys=on;");
    return db;
  }
  rows(sql: string, bind: any[] = []) {
    return this.db.exec({
      sql,
      bind,
      rowMode: "object",
      returnValue: "resultRows",
    });
  }
  run(sql: string, bind: any[] = []) {
    this.db.exec({ sql, bind });
  }
  insert(table: string, row: Record<string, any>) {
    const keys = Object.keys(row);
    this.run(
      `insert into ${table} (${keys.join(",")}) values (${keys
        .map(() => "?")
        .join(",")})`,
      Object.values(row),
    );
  }
  migrate() {
    this.run(
      "create table if not exists schema_migrations(id text primary key, name text not null, applied_at text not null)",
    );
    const applied = new Set(
      this.rows("select id from schema_migrations").map((r: any) => r.id),
    );
    for (const [path, sql] of Object.entries(MIGRATIONS)) {
      const name = path.replace(/\.sql$/, "");
      const id = name.split("_")[0];
      if (applied.has(id)) continue;
      this.run("pragma foreign_keys=off; begin;");
      try {
        this.run(sql);
        this.insert("schema_migrations", { id, name, applied_at: now() });
        this.run("commit;");
      } catch (error: any) {
        this.run("rollback;");
        throw new Error(`${name}: ${error.message}`);
      } finally {
        this.run("pragma foreign_keys=on;");
      }
    }
    this.checkIntegrity();
  }
  checkIntegrity() {
    if (this.rows("pragma integrity_check")[0].integrity_check !== "ok")
      throw new Error("SQLite integrity check failed");
    if (this.rows("pragma foreign_key_check").length)
      throw new Error("SQLite foreign key check failed");
  }
  bytes() {
    return this.sqlite.capi.sqlite3_js_db_export(this.db.pointer);
  }
  private pdfUrls=new Map<string,string>();
  pdfUrl(documentId:string,page=1){
    const doc=this.rows('select file_asset_id from document_instances where document_instance_id=?',[documentId])[0];
    const file=doc&&this.files[doc.file_asset_id];if(!file)return null;
    const key=doc.file_asset_id+':'+file.hash;
    if(!this.pdfUrls.has(key))this.pdfUrls.set(key,URL.createObjectURL(new Blob([file.data.slice().buffer as ArrayBuffer],{type:'application/pdf'})));
    return this.pdfUrls.get(key)+'#page='+page;
  }
  async persist() {
    await saveState(this.storage, { bytes: this.bytes(), files: this.files });
  }
  private mutationQueue:Promise<any>=Promise.resolve();
  mutate(fn: () => any) {
    const task=this.mutationQueue.then(()=>this.applyMutation(fn));
    this.mutationQueue=task.catch(()=>undefined);
    return task;
  }
  private async applyMutation(fn: () => any) {
    const before = this.bytes(),
      oldFiles = { ...this.files };
    this.run("begin;");
    try {
      const result = fn();
      const revision =
        this.rows("select library_revision from library_metadata")[0]
          ?.library_revision || 0;
      this.run(
        "update library_metadata set library_revision=?, updated_at=?",
        [revision + 1, now()],
      );
      this.run("commit;");
      this.checkIntegrity();
      await this.persist();
      window.dispatchEvent(new CustomEvent('week04-library-change'));
      return result;
    } catch (error) {
      try {
        this.run("rollback;");
      } catch {
        /* COMMIT may have succeeded before persistence failed. Restore pre-operation image below. */
      }
      this.db.close();
      this.db = this.openDatabase(before);
      this.files = oldFiles;
      throw error;
    }
  }
  items({
    trash = false,
    tag = "",
    collection = "",
    query = "",
  }: {
    trash?: boolean;
    tag?: string;
    collection?: string;
    query?: string;
  } = {}) {
    return this.rows(
      `select i.*, (select count(*) from document_instances d where d.item_id=i.item_id) as document_count
      from items i where i.merged_into_item_id is null and i.deleted_at is ${
        trash ? "not " : ""
      }null
      and (?='' or exists(select 1 from item_tag_memberships t where t.item_id=i.item_id and t.tag=?))
      and (?='' or exists(select 1 from item_collections c where c.item_id=i.item_id and c.collection_id=?))
      and (?='' or instr(lower(i.title || i.creators_json || coalesce(i.note,'')), lower(?))>0)
      order by i.updated_at desc, i.item_id`,
      [tag, tag, collection, collection, query, query],
    );
  }
  async createItem(title: string, extra: Record<string, any> = {}) {
    if (!title.trim()) throw new Error("题名不能为空");
    return this.mutate(() => {
      const id = uuid();
      this.insert("items", {
        item_id: id,
        library_id: this.libraryId,
        item_type: "book",
        title: title.trim(),
        created_at: now(),
        updated_at: now(),
        ...extra,
      });
      return id;
    });
  }
  toolRecord<T>(key:string,fallback:T):T {
    for(const row of this.rows('select custom_fields_json from items order by created_at,item_id')){
      const records=JSON.parse(row.custom_fields_json||'{}')['x-pku-research'];
      if(records&&Object.prototype.hasOwnProperty.call(records,key))return records[key].value;
    }
    return fallback;
  }
  async saveToolRecord(key:string,value:any){
    return this.mutate(()=>{
      const items=this.rows('select item_id,custom_fields_json from items order by created_at,item_id');
      const owner=items.find(item=>Object.prototype.hasOwnProperty.call(JSON.parse(item.custom_fields_json||'{}')['x-pku-research']||{},key))||items.find(item=>key.endsWith('/'+item.item_id))||items[0];
      if(!owner)throw Error('请先创建一条题录');
      const fields=JSON.parse(owner.custom_fields_json||'{}'),records=fields['x-pku-research']||{};
      fields['x-pku-research']={...records,[key]:{version:1,updated_at:now(),value}};
      this.run('update items set custom_fields_json=?,updated_at=? where item_id=?',[JSON.stringify(fields),now(),owner.item_id]);
    });
  }
  private validateItemFields(fields:Record<string,string|null>){
    const allowed=new Set(['title','note','status','edition','item_type','publication_title','publisher','place','language','volume','issue','pages','abstract']);
    if(Object.keys(fields).some(k=>!allowed.has(k)))throw Error('字段不支持');
    if('title' in fields&&!fields.title?.trim())throw Error('题名不能为空');
  }
  private writeItemFields(id:string,fields:Record<string,string|null>){
    if(!this.rows('select item_id from items where item_id=?',[id]).length)throw Error('题录已不存在');
    if(Object.keys(fields).length)this.run(`update items set ${Object.keys(fields).map(k=>k+'=?').join(',')},updated_at=? where item_id=?`,[...Object.values(fields),now(),id]);
  }
  async patchItem(id:string,fields:Record<string,string|null>){
    if(!Object.keys(fields).length)throw Error('字段不支持');
    this.validateItemFields(fields);
    return this.mutate(()=>{
      this.writeItemFields(id,fields);
    });
  }
  private validateCreators(creators:any[]){
    if(creators.some(a=>![a.literal,a.family,a.given].some(v=>typeof v==='string'&&v.trim())))throw Error('每位责任者需填写姓名原样或姓／名');
    if(creators.some(a=>!a.role||!/^[a-z][a-z-]*$/.test(a.role)))throw Error('责任者角色无效');
    const ids=creators.filter(a=>a.creator_id).map(a=>a.creator_id);
    if(new Set(ids).size!==ids.length)throw Error('责任者身份重复');
  }
  private writeCreators(item:string,creators:any[],authorOnly=false){
    const existing=this.rows('select * from item_creators where item_id=?'+(authorOnly?" and role='author'":''),[item]);
    const records=creators.map(a=>({...a,creator_id:existing.some(row=>row.creator_id===a.creator_id)?a.creator_id:uuid()}));
    const keep=new Set(records.map(a=>a.creator_id));
    for(const row of existing)if(!keep.has(row.creator_id))this.run('delete from item_creators where creator_id=?',[row.creator_id]);
    let nextSequence=Math.max(-1,...existing.map(row=>row.sequence_index))+1;
    records.forEach((a,index)=>{
      const prior=existing.find(row=>row.creator_id===a.creator_id);
      const sequence=authorOnly?index:prior?prior.sequence_index:nextSequence++;
      const values=[a.role,a.family||null,a.given||null,a.literal||null,a.suffix||null,a.particles||null,sequence];
      if(existing.some(row=>row.creator_id===a.creator_id))this.run('update item_creators set role=?,family=?,given=?,literal=?,suffix=?,particles=?,sequence_index=? where creator_id=?',[...values,a.creator_id]);
      else this.insert('item_creators',{creator_id:a.creator_id,item_id:item,role:a.role,family:a.family||null,given:a.given||null,literal:a.literal||null,suffix:a.suffix||null,particles:a.particles||null,sequence_index:sequence,created_at:now()});
    });
    const authors=this.rows("select * from item_creators where item_id=? and role='author' order by sequence_index",[item]);
    this.run('update items set creators_json=?,updated_at=? where item_id=?',[JSON.stringify(authors.map(a=>a.literal?{literal:a.literal}:{family:a.family,given:a.given,suffix:a.suffix,'non-dropping-particle':a.particles})),now(),item]);
    return records;
  }
  async saveAuthors(item:string,authors:any[]){
    const records=authors.map(a=>({...a,role:'author'}));
    this.validateCreators(records);
    const saved=await this.mutate(()=>this.writeCreators(item,records,true));
    saved.forEach((record,index)=>authors[index].creator_id=record.creator_id);
  }
  private issuedParts(value:string){
    const parts=value?value.split('-').map(Number):[];
    if(value&&(!/^\d{4}(-\d{2}){0,2}$/.test(value)||parts[0]<1||parts[1]!==undefined&&(parts[1]<1||parts[1]>12)||parts[2]!==undefined&&(parts[2]<1||parts[2]>31)))throw Error('出版日期须为YYYY、YYYY-MM或YYYY-MM-DD');
    if(parts.length===3){const date=new Date(0);date.setUTCFullYear(parts[0],parts[1]-1,parts[2]);if(date.getUTCMonth()!==parts[1]-1||date.getUTCDate()!==parts[2])throw Error('出版日期不是有效日历日期');}
    return parts;
  }
  private writeIssuedDate(item:string,value:string,parts:number[]){
      const old=this.rows("select date_id from item_dates where item_id=? and role='issued'",[item])[0];
      if(!value)this.run("delete from item_dates where item_id=? and role='issued'",[item]);
      else if(old)this.run('update item_dates set date_parts_json=?,literal=? where date_id=?',[JSON.stringify([parts]),value,old.date_id]);
      else this.insert('item_dates',{date_id:uuid(),item_id:item,role:'issued',date_parts_json:JSON.stringify([parts]),literal:value,circa:0,created_at:now()});
      this.run('update items set date=?,updated_at=? where item_id=?',[value||null,now(),item]);
  }
  async saveIssuedDate(item:string,value:string){
    const parts=this.issuedParts(value);
    return this.mutate(()=>this.writeIssuedDate(item,value,parts));
  }
  async saveMetadata(item:string,fields:Record<string,string|null>,creators?:any[],issued?:string){
    this.validateItemFields(fields);
    if(creators!==undefined)this.validateCreators(creators);
    const parts=issued!==undefined?this.issuedParts(issued):null;
    return this.mutate(()=>{
      this.writeItemFields(item,fields);
      if(creators!==undefined)this.writeCreators(item,creators);
      if(issued!==undefined)this.writeIssuedDate(item,issued,parts);
    });
  }
  async updateItem(
    id: string,
    {
      title,
      tags,
      note,
      status,
      edition,
      creators,
    }: {
      title: string;
      tags: string[];
      note?: string;
      status?: string;
      edition?: string;
      creators?: string;
    },
  ) {
    if (!title?.trim()) throw new Error("题名不能为空");
    tags = await window.DotNet.invokeMethodAsync(
      "CoreProbe",
      "NormalizeTags",
      tags,
    );
    return this.mutate(() => {
      this.run(
        `update items set title=?, tags_json=?, note=?, status=?, edition=?, creators_json=?, updated_at=? where item_id=?`,
        [
          title.trim(),
          JSON.stringify(tags),
          note || null,
          status || null,
          edition || null,
          JSON.stringify(
            creators?.trim() ? [{ literal: creators.trim() }] : [],
          ),
          now(),
          id,
        ],
      );
      this.run(
        "delete from item_creators where item_id=? and role='author'",
        [id],
      );
      if (creators?.trim())
        this.insert("item_creators", {
          creator_id: uuid(),
          item_id: id,
          role: "author",
          literal: creators.trim(),
          sequence_index: 0,
          created_at: now(),
        });
    });
  }
  async importPdf(
    file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> },
    pageInfos: PdfPageInfo[],
    targetItem: string | null = null,
  ) {
    const data = new Uint8Array(await file.arrayBuffer());
    const fingerprint = hash(data);
    const duplicate = this.rows(
      "select file_asset_id from file_assets where full_blake3=?",
      [fingerprint],
    )[0];
    if (duplicate)
      throw new Error("相同 BLAKE3 文件已入库；请在原题录中管理版本");
    if (!pageInfos.length) throw new Error("PDF 没有页面");
    return this.mutate(() => {
      const item = targetItem || uuid(),
        asset = uuid(),
        document = uuid();
      if (!targetItem)
        this.insert("items", {
          item_id: item,
          library_id: this.libraryId,
          item_type: "book",
          title: file.name.replace(/\.pdf$/i, ""),
          created_at: now(),
          updated_at: now(),
        });
      this.insert("file_assets", {
        file_asset_id: asset,
        library_id: this.libraryId,
        original_path: `browser:${asset}`,
        file_name: file.name,
        size_bytes: data.length,
        full_blake3: fingerprint,
        page_count: pageInfos.length,
        status: "available",
        created_at: now(),
        updated_at: now(),
      });
      this.insert("document_instances", {
        document_instance_id: document,
        item_id: item,
        file_asset_id: asset,
        title: file.name,
        instance_type: "scan",
        is_primary: targetItem ? 0 : 1,
        status: "active",
        created_at: now(),
        updated_at: now(),
      });
      pageInfos.forEach((info, index) =>
        this.insert("pages", {
          page_id: uuid(),
          document_instance_id: document,
          page_index: index,
          width: info.width,
          height: info.height,
          rotation: info.rotation,
          coordinate_basis: "pdf_points",
          basis_width: info.width,
          basis_height: info.height,
          renderer_basis_version: "pdfjs-browser",
          source_file_hash: fingerprint,
          created_at: now(),
          updated_at: now(),
        }),
      );
      this.files[asset] = { name: file.name, data, hash: fingerprint };
      return { item, asset, document };
    });
  }
  documents(item: string) {
    return this.rows(
      "select d.*, f.file_name, f.full_blake3 from document_instances d left join file_assets f on f.file_asset_id=d.file_asset_id where item_id=? order by d.created_at",
      [item],
    );
  }
  pages(document: string) {
    return this.rows(
      "select * from pages where document_instance_id=? order by page_index",
      [document],
    );
  }
  pageTree(page: string, revision: string | null = null) {
    const rev = revision
      ? this.rows(
          "select * from document_tree_revisions where tree_revision_id=? and page_id=? and status='committed'",
          [revision, page],
        )[0]
      : this.rows(
          "select * from document_tree_revisions where page_id=? and status='committed' and is_current=1",
          [page],
        )[0];
    return {
      revision: rev || null,
      boxes: rev
        ? this.rows(
            "select * from document_boxes where tree_revision_id=?",
            [rev.tree_revision_id],
          )
        : [],
    };
  }
  ordered(boxes: any[]) {
    if (!boxes.length) return [];
    const ordered: any[] = [],
      seen = new Set();
    const walk = (parent: string | null) => {
      const siblings = boxes.filter(
        (b) => (b.parent_box_id || null) === parent,
      );
      if (!siblings.length) return;
      const next = new Set(
        siblings.map((b) => b.next_sibling_box_id).filter(Boolean),
      );
      const heads = siblings.filter((b) => !next.has(b.box_id));
      if (heads.length !== 1)
        throw new Error("Box sibling chain has no unique head");
      let current = heads[0];
      while (current) {
        if (seen.has(current.box_id)) throw new Error("Box sibling cycle");
        seen.add(current.box_id);
        ordered.push(current);
        walk(current.box_id);
        if (!current.next_sibling_box_id) break;
        current = siblings.find(
          (b) => b.box_id === current.next_sibling_box_id,
        );
        if (!current)
          throw new Error("Box next sibling does not belong to parent");
      }
    };
    walk(null);
    if (ordered.length !== boxes.length)
      throw new Error("Box tree is disconnected");
    return ordered;
  }
  boxText(box: any) {
    const payload = JSON.parse(box.payload_json || "{}");
    return (
      payload.markdown ??
      payload.latex ??
      payload.code ??
      payload.description ??
      ""
    );
  }
  candidate(box: any): BoxCandidate {
    return {
      id: box.box_id,
      parent: box.parent_box_id,
      next: box.next_sibling_box_id,
      type: box.box_type,
      baseType: box.base_type,
      subType: box.sub_type,
      continuesFromBoxId: box.continues_from_box_id,
      payloadJson: box.payload_json,
      text: this.boxText(box),
      x: box.bbox_x,
      y: box.bbox_y,
      width: box.bbox_width,
      height: box.bbox_height,
      headingLevel: box.heading_level,
      codeLanguage: box.code_language,
      confidence: box.confidence,
      suppressed: !!box.suppressed,
    };
  }
  async compilePage(pageId: string, revision: string | null = null) {
    const page = this.rows("select * from pages where page_id=?", [pageId])[0],
      tree = this.pageTree(pageId, revision);
    return window.DotNet.invokeMethodAsync(
      "CoreProbe",
      "CompilePage",
      page.document_instance_id,
      pageId,
      JSON.stringify(this.ordered(tree.boxes).map((b) => this.candidate(b))),
    );
  }
  async commitPages(
    document: string,
    candidates: PageCandidate[],
    source = "manual_edit",
    message = "",
    revertedFrom: string | null = null,
    run: string | null = null,
  ) {
    for (const candidate of candidates) {
      candidate.boxes.forEach((box) => {
        if (![box.x, box.y, box.width, box.height].every(Number.isFinite))
          throw new Error("Invalid bbox");
        box.id ||= uuid();
        box.type ||= "text";
      });
      const parents = new Set(
        candidate.boxes.map((box) => box.parent || null),
      );
      for (const parent of parents) {
        const siblings = candidate.boxes.filter(
          (box) => (box.parent || null) === parent,
        );
        siblings.forEach(
          (box, index) => (box.next = siblings[index + 1]?.id || null),
        );
      }
      const validation = await window.DotNet.invokeMethodAsync(
        "CoreProbe",
        "ValidateTree",
        document,
        candidate.pageId,
        source,
        JSON.stringify(candidate.boxes),
      );
      if (validation !== "ok") throw new Error(validation);
    }
    return this.mutate(() => {
      const commit = uuid(),
        parent =
          this.rows(
            "select commit_id from document_commits where document_instance_id=? order by created_at desc, rowid desc limit 1",
            [document],
          )[0]?.commit_id || null;
      this.insert("document_commits", {
        commit_id: commit,
        document_instance_id: document,
        parent_commit_id: parent,
        source,
        message,
        created_at: now(),
      });
      const newRevisions: string[] = [];
      for (const candidate of candidates) {
        const page = this.rows(
          "select * from pages where page_id=? and document_instance_id=?",
          [candidate.pageId, document],
        )[0];
        if (!page) throw new Error("Page does not belong to document");
        const previous =
            this.pageTree(page.page_id).revision?.tree_revision_id || null,
          revision = uuid();
        this.insert("document_tree_revisions", {
          tree_revision_id: revision,
          document_instance_id: document,
          page_id: page.page_id,
          parent_tree_revision_id: previous,
          source,
          status: "working",
          is_current: 0,
          source_full_blake3: page.source_file_hash,
          source_basis_status: "current",
          created_at: now(),
          reverted_from_tree_revision_id: revertedFrom,
        });
        const ids = candidate.boxes.map((b) => b.id || uuid());
        candidate.boxes.forEach((b, index) =>
          this.insert("document_boxes", {
            tree_revision_id: revision,
            box_id: ids[index],
            document_instance_id: document,
            page_id: page.page_id,
            parent_box_id: b.parent || null,
            next_sibling_box_id: b.next,
            box_type: b.type || "text",
            base_type: b.baseType || null,
            sub_type: b.subType || null,
            continues_from_box_id: b.continuesFromBoxId || null,
            bbox_x: b.x,
            bbox_y: b.y,
            bbox_width: b.width,
            bbox_height: b.height,
            payload_json: b.payloadJson ?? JSON.stringify({ markdown: b.text }),
            heading_level: b.headingLevel ?? null,
            code_language: b.codeLanguage ?? null,
            confidence: b.confidence ?? null,
            suppressed: b.suppressed ? 1 : 0,
          }),
        );
        this.run(
          "update document_tree_revisions set is_current=0 where page_id=? and is_current=1",
          [page.page_id],
        );
        this.run(
          "update document_tree_revisions set status='committed', is_current=1, committed_at=? where tree_revision_id=?",
          [now(), revision],
        );
        newRevisions.push(revision);
      }
      for (const rev of this.rows(
        "select page_id, tree_revision_id from document_tree_revisions where document_instance_id=? and is_current=1 and status='committed'",
        [document],
      ))
        this.insert("document_commit_pages", {
          commit_id: commit,
          page_id: rev.page_id,
          tree_revision_id: rev.tree_revision_id,
        });
      if (run) {
        this.run(
          "update ocr_runs set state='completed', output_tree_revision_id=?, updated_at=? where ocr_run_id=?",
          [newRevisions[0] || null, now(), run],
        );
        candidates.forEach((c, index) =>
          this.insert("ocr_page_results", {
            result_id: uuid(),
            ocr_run_id: run,
            page_id: c.pageId,
            state: "succeeded",
            working_tree_revision_id: newRevisions[index],
            created_at: now(),
            updated_at: now(),
          }),
        );
      }
      this.reindex(document);
      return commit;
    });
  }
  reindex(document: string) {
    this.run("delete from search_units_fts where document_instance_id=?", [
      document,
    ]);
    this.run("delete from fts_row_map where document_instance_id=?", [
      document,
    ]);
    this.run(
      "update search_units set status='stale' where document_instance_id=?",
      [document],
    );
    const revisions = this.rows(
      "select * from document_tree_revisions where document_instance_id=? and status='committed' and is_current=1",
      [document],
    );
    for (const r of revisions)
      this.ordered(this.pageTree(r.page_id).boxes)
        .filter(
          (b) => !b.suppressed && (b.box_type !== "logical_page" || b.payload_json) && !!this.boxText(b).trim(),
        )
        .forEach((box, ordinal) => {
          const text = this.boxText(box).trim();
          const existing = this.rows(
            "select unit_id from search_units where tree_revision_id=? and box_id=?",
            [r.tree_revision_id, box.box_id],
          )[0];
          const id = existing?.unit_id || uuid();
          if (existing)
            this.run(
              "update search_units set status='current', resolved_text=?, updated_at=? where unit_id=?",
              [text, now(), id],
            );
          else
            this.insert("search_units", {
              unit_id: id,
              document_instance_id: document,
              page_id: r.page_id,
              box_id: box.box_id,
              tree_revision_id: r.tree_revision_id,
              resolved_text: text,
              bbox_json: JSON.stringify({
                x: box.bbox_x,
                y: box.bbox_y,
                width: box.bbox_width,
                height: box.bbox_height,
              }),
              box_type: box.box_type,
              ordinal,
              status: "current",
              created_at: now(),
              updated_at: now(),
            });
          this.insert("fts_row_map", {
            document_instance_id: document,
            unit_id: id,
          });
          const row = this.rows(
            "select fts_row_id from fts_row_map where unit_id=?",
            [id],
          )[0];
          this.insert("search_units_fts", {
            rowid: row.fts_row_id,
            unit_id: id,
            document_instance_id: document,
            page_id: r.page_id,
            resolved_text: buildIndexText(text),
          });
        });
  }
  search(query: string, mode = "phrase") {
    if (!query.trim()) return [];
    const ftsQuery=mode==='fts'?buildFtsQuery(query):'';
    if(mode==='fts'&&!ftsQuery)return [];
    const common = `select s.*, p.page_index, i.title from search_units s join pages p on p.page_id=s.page_id
      join document_instances d on d.document_instance_id=s.document_instance_id join items i on i.item_id=d.item_id
      join document_tree_revisions r on r.tree_revision_id=s.tree_revision_id
      where r.is_current=1 and r.status='committed' and i.deleted_at is null and i.merged_into_item_id is null`;
    const rows =
      mode === "fts"
        ? this.rows(
            `${common} and s.unit_id in(select unit_id from search_units_fts where search_units_fts match ?) limit 100`,
            [ftsQuery],
          )
        : this.rows(`${common} and instr(lower(s.resolved_text),lower(?))>0 limit 100`, [
            query,
          ]);
    return rows.map((r: any) => ({
      ...r,
      uri: `patchouli://texts/${r.document_instance_id}/page-${
        r.page_index + 1
      }.md?rev=${r.tree_revision_id}&box=${r.box_id}`,
    }));
  }
  fetch(uri: string) {
    const parsed = new URL(uri);
    if (parsed.protocol !== "patchouli:" || parsed.hostname !== "texts")
      throw new Error("仅支持 texts 证据 URI");
    const match = parsed.pathname.match(/^\/([^/]+)\/page-(\d+)\.md$/);
    if (!match) throw new Error("Invalid evidence URI");
    const page = this.rows(
      "select page_id from pages where document_instance_id=? and page_index=?",
      [match[1], Number(match[2]) - 1],
    )[0];
    if (!page) throw new Error("Page not found");
    const tree = this.pageTree(
      page.page_id,
      parsed.searchParams.get("rev"),
    );
    if (!tree.revision) throw new Error("Committed revision not found");
    const ordered = this.ordered(tree.boxes),
      id = parsed.searchParams.get("box");
    const boxes = id
      ? ordered.filter((b) => b.box_id === id)
      : ordered.filter((b) => !b.suppressed);
    if (id && !boxes.length) throw new Error("Box not found");
    return {
      ...tree,
      boxes,
      pageIndex: Number(match[2]),
      text: boxes.map((b) => this.boxText(b)).join("\n\n"),
    };
  }
  async startOcr(document: string, language: string, provenance:Record<string,any>={}) {
    return this.mutate(() => {
      const preset = uuid(),
        version = uuid(),
        run = uuid();
      this.insert("ocr_presets", {
        preset_id: preset,
        library_id: this.libraryId,
        name: `浏览器 OCR ${language}`,
        created_at: now(),
        updated_at: now(),
      });
      this.insert("ocr_preset_versions", {
        preset_version_id: version,
        preset_id: preset,
        engine_id: "browser-ocr",
        model_id: language,
        parameters_json: JSON.stringify({ language, runtime: "browser",...provenance }),
        apply_on_success: 1,
        created_at: now(),
      });
      this.run("update ocr_presets set current_version_id=? where preset_id=?", [
        version,
        preset,
      ]);
      this.insert("ocr_runs", {
        ocr_run_id: run,
        document_instance_id: document,
        preset_id: preset,
        preset_version_id: version,
        engine_id: "browser-ocr",
        model_id: language,
        parameters_snapshot_json: JSON.stringify({
          language,
          runtime: "browser",
          ...provenance,
        }),
        state: "running",
        created_at: now(),
        updated_at: now(),
      });
      return run;
    });
  }
  async failOcr(run: string, error: any) {
    await this.mutate(() =>
      this.run(
        "update ocr_runs set state=?, updated_at=? where ocr_run_id=?",
        [error.name === "AbortError" ? "cancelled" : "failed", now(), run],
      ),
    );
    console.error("OCR failed:", error.message);
  }
  async trash(id: string, restore = false) {
    return this.mutate(() =>
      this.run(
        "update items set deleted_at=?, updated_at=? where item_id=?",
        [restore ? null : now(), now(), id],
      ),
    );
  }
  async merge(source: string, target: string) {
    if (source === target) throw new Error("Cannot merge item with itself");
    return this.mutate(() => {
      const a = this.rows(
        "select * from items where item_id=? and merged_into_item_id is null",
        [source],
      )[0],
        b = this.rows(
          "select * from items where item_id=? and merged_into_item_id is null",
          [target],
        )[0];
      if (!a || !b) throw new Error("Active merge source/target missing");
      this.run("update document_instances set item_id=? where item_id=?", [
        target,
        source,
      ]);
      this.run(
        "insert or ignore into item_collections select collection_id, ?, added_at from item_collections where item_id=?",
        [target, source],
      );
      this.run("delete from item_collections where item_id=?", [source]);
      this.run("update items set tags_json=?, updated_at=? where item_id=?", [
        JSON.stringify([
          ...new Set([...JSON.parse(b.tags_json), ...JSON.parse(a.tags_json)]),
        ]),
        now(),
        target,
      ]);
      this.run(
        "update items set merged_into_item_id=?, updated_at=? where item_id=?",
        [target, now(), source],
      );
    });
  }
  collections() {
    return this.rows("select * from collections order by name");
  }
  async createCollection(name: string) {
    if (!name.trim()) throw new Error("集合名不能为空");
    return this.mutate(() => {
      const id = uuid();
      this.insert("collections", {
        collection_id: id,
        library_id: this.libraryId,
        name: name.trim(),
        created_at: now(),
        updated_at: now(),
      });
      return id;
    });
  }
  async setCollection(item: string, collection: string, included: boolean) {
    return this.mutate(() =>
      included
        ? this.run(
            "insert or ignore into item_collections values(?,?,?)",
            [collection, item, now()],
          )
        : this.run(
            "delete from item_collections where collection_id=? and item_id=?",
            [collection, item],
          ),
    );
  }
  async dissolveCollection(collection: string) {
    return this.mutate(() =>
      this.run("delete from collections where collection_id=?", [collection]),
    );
  }
  async renameTag(oldName: string, newName: string) {
    if (!newName.trim()) throw new Error("标签名不能为空");
    return this.mutate(() => {
      for (const item of this.rows(
        "select item_id,tags_json from items",
      )) {
        const tags = JSON.parse(item.tags_json);
        if (tags.includes(oldName))
          this.run(
            "update items set tags_json=?, updated_at=? where item_id=?",
            [
              JSON.stringify([
                ...new Set(
                  tags.map((t: string) =>
                    t === oldName ? newName.trim() : t,
                  ),
                ),
              ]),
              now(),
              item.item_id,
            ],
          );
      }
    });
  }
  csl() {
    return this.items().map((i: any) => {
      const record: Record<string, any> = {
        ...JSON.parse(i.custom_fields_json || "{}"),
        id: i.item_id,
        type: i.item_type,
        title: i.title,
        edition: i.edition || undefined,
        note: i.note || undefined,
        keyword: JSON.parse(i.tags_json).join(", "),
      };
      for (const [field, column] of Object.entries({
        "container-title": "publication_title",
        publisher: "publisher",
        "publisher-place": "place",
        volume: "volume",
        issue: "issue",
        page: "pages",
        language: "language",
        abstract: "abstract",
        "title-short": "title_short",
        "collection-title": "collection_title",
        genre: "genre",
        number: "number",
        version: "version",
      }))
        if (i[column]) record[field] = i[column];
      const creators = this.rows(
        "select * from item_creators where item_id=? order by sequence_index",
        [i.item_id],
      );
      for (const role of [...new Set(creators.map((c: any) => c.role))] as string[])
        record[role] = creators
          .filter((c: any) => c.role === role)
          .map((c: any) =>
            isCjkCreator(c) ? {literal:displayCreator(c)} : c.literal
              ? { literal: c.literal }
              : {
                  family: c.family || undefined,
                  given: c.given || undefined,
                  suffix: c.suffix || undefined,
                  "non-dropping-particle": c.particles || undefined,
                },
          );
      if (!record.author && !creators.length)
        record.author = JSON.parse(i.creators_json).map((name:any)=>isCjkCreator(name)?{literal:displayCreator(name)}:name);
      for (const date of this.rows(
        "select * from item_dates where item_id=?",
        [i.item_id],
      ))
        record[date.role] = {
          "date-parts": JSON.parse(date.date_parts_json),
          literal: date.literal || undefined,
          circa: !!date.circa,
        };
      for (const identifier of this.rows(
        "select scheme,value from item_identifiers where item_id=?",
        [i.item_id],
      ))
        record[identifier.scheme.toUpperCase()] = identifier.value;
      return record;
    });
  }
  async importCsl(records: any[]) {
    if (!Array.isArray(records) || !records.length || records.length > 10000)
      throw new Error("CSL JSON 应是 1–10000 条题录数组");
    for (const r of records)
      if (typeof r.title !== "string" || !r.title.trim())
        throw new Error("CSL 题录缺少题名");
    return this.mutate(() =>
      records.map((r) => {
        const id = uuid(),
          row: Record<string, any> = {
            item_id: id,
            library_id: this.libraryId,
            item_type: r.type || "book",
            title: r.title,
            creators_json: JSON.stringify(r.author || []),
            edition: r.edition || null,
            note: r.note || null,
            tags_json: JSON.stringify(
              (r.keyword || "")
                .split(",")
                .map((t: string) => t.trim())
                .filter(Boolean),
            ),
            created_at: now(),
            updated_at: now(),
          };
        const mapped = {
          "container-title": "publication_title",
          publisher: "publisher",
          "publisher-place": "place",
          volume: "volume",
          issue: "issue",
          page: "pages",
          language: "language",
          abstract: "abstract",
          "title-short": "title_short",
          "collection-title": "collection_title",
          genre: "genre",
          number: "number",
          version: "version",
        };
        for (const [field, column] of Object.entries(mapped))
          if (r[field] != null) row[column] = String(r[field]);
        const known = new Set([
          "id",
          "type",
          "title",
          "author",
          "editor",
          "translator",
          "container-author",
          "issued",
          "accessed",
          "original-date",
          "edition",
          "note",
          "keyword",
          "DOI",
          "ISBN",
          "ISSN",
          "URL",
          ...Object.keys(mapped),
        ]);
        row.custom_fields_json = JSON.stringify(
          Object.fromEntries(
            Object.entries(r).filter(([k]) => !known.has(k)),
          ),
        );
        this.insert("items", row);
        for (const role of [
          "author",
          "editor",
          "translator",
          "container-author",
        ])
          (r[role] || []).forEach((c: any, index: number) =>
            this.insert("item_creators", {
              creator_id: uuid(),
              item_id: id,
              role,
              family: c.family || null,
              given: c.given || null,
              literal: c.literal || null,
              suffix: c.suffix || null,
              particles: c["non-dropping-particle"] || null,
              sequence_index: index,
              created_at: now(),
            }),
          );
        for (const role of ["issued", "accessed", "original-date"])
          if (r[role])
            this.insert("item_dates", {
              date_id: uuid(),
              item_id: id,
              role,
              date_parts_json: JSON.stringify(
                r[role]["date-parts"] || [],
              ),
              circa: r[role].circa ? 1 : 0,
              literal: r[role].literal || null,
              created_at: now(),
            });
        for (const scheme of ["DOI", "ISBN", "ISSN", "URL"])
          if (r[scheme])
            this.insert("item_identifiers", {
              identifier_id: uuid(),
              item_id: id,
              scheme: scheme.toLowerCase(),
              value: String(r[scheme]),
              created_at: now(),
            });
        return id;
      }),
    );
  }
  backup() {
    const bytes = this.bytes(),
      files: Record<string, Uint8Array> = { "library.sqlite": bytes },
      assets = [];
    for (const [id, file] of Object.entries(this.files)) {
      files[`files/${id}.pdf`] = file.data;
      assets.push({ id, name: file.name, hash: file.hash, bytes: file.data.length });
    }
    files["manifest.json"] = strToU8(
      JSON.stringify(
        {
          format: "patchouli-browser-backup-v1",
          created_at: now(),
          database_blake3: hash(bytes),
          assets,
          source: PATCHOULI_MANIFEST,
        },
        null,
        2,
      ),
    );
    return zipSync(files, { level: 1 });
  }
  async restore(data: Uint8Array, archive = true) {
    let bytes: Uint8Array,
      files: Record<string, { name: string; hash: string; data: Uint8Array }> =
        {};
    if (archive) {
      const entries = unzipSync(data),
        m = JSON.parse(
          strFromU8(entries["manifest.json"] || new Uint8Array()),
        );
      if (m.format !== "patchouli-browser-backup-v1")
        throw new Error("不支持的备份格式");
      bytes = entries["library.sqlite"];
      if (!bytes || hash(bytes) !== m.database_blake3)
        throw new Error("数据库备份哈希不匹配");
      for (const asset of m.assets) {
        const content = entries[`files/${asset.id}.pdf`];
        if (
          !content ||
          content.length !== asset.bytes ||
          hash(content) !== asset.hash
        )
          throw new Error("PDF 备份哈希不匹配");
        files[asset.id] = {
          name: asset.name,
          hash: asset.hash,
          data: content,
        };
      }
    } else bytes = data;
    if (new TextDecoder().decode(bytes.slice(0, 16)) !== "SQLite format 3\0")
      throw new Error("不是 SQLite 数据库");
    const old = this.db,
      oldFiles = this.files,
      oldLibrary = this.libraryId;
    this.db = this.openDatabase(bytes);
    try {
      const libraries = this.rows("select * from library_metadata");
      if (libraries.length !== 1 || libraries[0].schema_version !== 2)
        throw new Error("仅支持单库、schema epoch 2");
      this.migrate();
      if(!archive){
        for(const asset of this.rows('select file_asset_id,full_blake3,file_name from file_assets')){
          const known=Object.values(oldFiles).find(f=>f.hash===asset.full_blake3);
          if(known)files[asset.file_asset_id]={...known,name:asset.file_name};
        }
      }
      this.files = files;
      this.libraryId = libraries[0].library_id;
      // Browser permissions/paths are not portable. Imported desktop PDFs must be rebound by hash.
      await this.persist();
      window.dispatchEvent(new CustomEvent('week04-library-change'));
      old.close();
    } catch (error) {
      this.db.close();
      this.db = old;
      this.files = oldFiles;
      this.libraryId = oldLibrary;
      throw error;
    }
  }
  async rebind(
    asset: string,
    file: { name: string; arrayBuffer: () => Promise<ArrayBuffer> },
  ) {
    const data = new Uint8Array(await file.arrayBuffer()),
      fingerprint = hash(data);
    const row = this.rows(
      "select full_blake3 from file_assets where file_asset_id=?",
      [asset],
    )[0];
    if (!row || row.full_blake3 !== fingerprint)
      throw new Error("文件 BLAKE3 与记录不符，不能静默替换版本");
    return this.mutate(() => {
      this.files[asset] = { name: file.name, data, hash: fingerprint };
    });
  }
}
