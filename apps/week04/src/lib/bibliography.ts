import { Cite } from "@citation-js/core";
import "@citation-js/plugin-bibtex";
export function readBiblatex(text: string) {
  const citation: any = new Cite(text);
  const records = citation.get({ type: "json" });
  if (!records.length) throw new Error("未读到 BibTeX/BibLaTeX 题录");
  return records;
}
export function writeBiblatex(records: any[]) {
  return new Cite(records).format("biblatex");
}
