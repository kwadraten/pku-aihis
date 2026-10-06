export interface MetadataDraft { fields: Record<string,string>; creators: any[]; issued: string; }
export interface PatchouliSession {
  drafts: Map<string,MetadataDraft>;
  library: { filter: string; collection: string; trash: boolean };
  search: { query: string; mode: string; hits: any[]; searched: boolean };
  notes: Map<string,string>;
  tools: Record<string,Record<string,any>>;
}
// Every example is a view of the same application. Switching slides or reading
// a PDF must not fork filters, searches or unsaved metadata into different UIs.
const sessions = new WeakMap<object,PatchouliSession>();
export function patchouliSession(database: object): PatchouliSession {
  let session = sessions.get(database);
  if (!session) {
    session = { drafts: new Map(), library: { filter:'', collection:'', trash:false }, search: { query:'', mode:'fts', hits:[], searched:false }, notes:new Map(), tools:{} };
    sessions.set(database,session);
  }
  return session;
}
