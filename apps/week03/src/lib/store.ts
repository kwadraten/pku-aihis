import { validateCorpus } from "./math";
export type Doc = {
  id: string;
  text: string;
  title: string;
  source_id?: string;
  author?: string;
  year?: number;
  pdf_page?: number;
  printed_page?: string;
  status?: string;
  image?: string;
  vector?: number[];
  [key: string]: any;
};
export const state: {
  docs: Doc[];
  manifest: any;
  queries: any[];
  local: boolean;
  version: number;
} = { docs: [], manifest: {}, queries: [], local: false, version: 0 };
let loading: Promise<void>;
export function loadCorpus() {
  return (loading ??= (async () => {
    const r = await fetch("assets/data/corpus.json");
    if (!r.ok) throw Error("语料载入失败");
    const d = await r.json();
    state.docs = validateCorpus(d);
    state.manifest = d.manifest || {};
    state.queries = d.queries || [];
  })());
}
export function replaceCorpus(data: any) {
  state.docs = validateCorpus(data);
  state.manifest = data.manifest || {};
  state.queries = data.queries || [];
  state.local = true;
  state.version++;
  window.dispatchEvent(new CustomEvent("corpus-change"));
}
export function sourceLabel(d: Doc) {
  return `${d.title} · PDF ${d.pdf_page ?? "待核"} / 原书 ${d.printed_page ?? "待核"} · ${d.author ?? "作者待核"}`;
}
export function saveFile(name: string, data: any) {
  const b = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
    a = document.createElement("a");
  a.href = URL.createObjectURL(b);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 500);
}
