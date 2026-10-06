import { Library } from "../../lib/library";

export interface UriStep {
  level: string;
  ok: boolean;
  detail: string;
}

export interface UriResolution {
  uri: string;
  kind: "texts" | "items" | "unknown";
  steps: UriStep[];
  title?: string;
  pageIndex?: number;
  revisionId?: string;
  boxId?: string;
  text?: string;
  itemFields?: any;
  error?: string;
}

// 证据 URI 的解析语义与 library.fetch 一致（页序 1-based，rev+box 定位历史文本），
// 但逐步暴露解析链，供 D13 / D18 / D26 复用。
export function resolveUri(lib: Library, uri: string): UriResolution {
  const steps: UriStep[] = [];
  const fail = (level: string, detail: string): UriResolution => {
    steps.push({ level, ok: false, detail });
    return { uri, kind: "unknown", steps, error: detail };
  };
  let parsed: URL;
  try {
    parsed = new URL(uri.trim());
  } catch {
    return fail("库", "不是合法的 URI");
  }
  if (parsed.protocol !== "patchouli:")
    return fail("库", `方案名 ${parsed.protocol || "(无)"} 不是 patchouli://`);
  steps.push({ level: "库", ok: true, detail: `patchouli:// 方案 → 当前书库` });

  if (parsed.hostname === "items") {
    const m = parsed.pathname.match(/^\/([^/]+)\.bib$/);
    if (!m) return fail("题录", "items 入口只接受 /items/<id>.bib");
    const item = lib.rows("select * from items where item_id=?", [m[1]])[0];
    if (!item) return fail("题录", `题录 ${m[1]} 不存在`);
    steps.push({ level: "题录", ok: true, detail: item.title });
    const docs = lib.documents(item.item_id);
    steps.push({
      level: "文档",
      ok: true,
      detail: docs.length ? `${docs.length} 个文档实例` : "已知其书、未得其文：没有文档实例（合法状态）",
    });
    const record = lib.csl().find((r: any) => r.id === item.item_id);
    return {
      uri,
      kind: "items",
      steps,
      title: item.title,
      itemFields: record,
      text: item.note || undefined,
    };
  }

  if (parsed.hostname !== "texts")
    return fail("入口", `未知入口 ${parsed.hostname}（可用 items / texts）`);
  const match = parsed.pathname.match(/^\/([^/]+)\/page-(\d+)\.md$/);
  if (!match) return fail("文档", "texts 入口只接受 /texts/<doc>/page-<n>.md");
  const doc = lib.rows("select * from document_instances where document_instance_id=?", [
    match[1],
  ])[0];
  if (!doc) return fail("文档", `文档实例 ${match[1]} 不存在`);
  const item = lib.rows("select * from items where item_id=?", [doc.item_id])[0];
  steps.push({
    level: "文档",
    ok: true,
    detail: `${item?.title || doc.title || "(无题名)"} · ${doc.document_instance_id}`,
  });
  const pageIndex = Number(match[2]);
  const page = lib.rows(
    "select * from pages where document_instance_id=? and page_index=?",
    [match[1], pageIndex - 1],
  )[0];
  if (!page) return fail("页", `第 ${pageIndex} 页不存在（页序从 1 开始）`);
  steps.push({ level: "页", ok: true, detail: `库内页序 ${page.page_index}（1-based 第 ${pageIndex} 页）` });

  const revParam = parsed.searchParams.get("rev");
  const tree = lib.pageTree(page.page_id, revParam);
  if (!tree.revision)
    return fail("修订", revParam ? `修订 ${revParam} 未提交或不存在` : "该页没有已提交的当前修订");
  steps.push({
    level: "修订",
    ok: true,
    detail: `${tree.revision.tree_revision_id} · ${tree.revision.source}${revParam ? "（rev 参数钉住历史版本）" : "（当前版本）"}`,
  });

  const boxParam = parsed.searchParams.get("box");
  const ordered = lib.ordered(tree.boxes);
  const boxes = boxParam
    ? ordered.filter((b: any) => b.box_id === boxParam)
    : ordered.filter((b: any) => !b.suppressed);
  if (boxParam && !boxes.length) return fail("文本块", `块 ${boxParam} 不在该修订中`);
  steps.push({
    level: "文本块",
    ok: true,
    detail: boxParam ? `块 ${boxParam}（共 ${ordered.length} 块）` : `${boxes.length} 个未抑制块`,
  });
  return {
    uri,
    kind: "texts",
    steps,
    title: item?.title,
    pageIndex,
    revisionId: tree.revision.tree_revision_id,
    boxId: boxParam || undefined,
    text: boxes.map((b: any) => lib.boxText(b)).join("\n\n"),
  };
}

// 从活体库枚举真实存在的证据 URI 候选（当前修订 + 首个未抑制块）。
export function listTextUris(lib: Library, perDoc = 3): string[] {
  const uris: string[] = [];
  for (const item of lib.items()) {
    for (const doc of lib.documents(item.item_id)) {
      const pages = lib.pages(doc.document_instance_id).slice(0, perDoc);
      for (const page of pages) {
        const tree = lib.pageTree(page.page_id);
        if (!tree.revision) continue;
        const box = lib.ordered(tree.boxes).find((b: any) => !b.suppressed);
        if (!box) continue;
        uris.push(
          `patchouli://texts/${doc.document_instance_id}/page-${page.page_index + 1}.md?rev=${tree.revision.tree_revision_id}&box=${box.box_id}`,
        );
      }
    }
  }
  return uris;
}

export function listItemUris(lib: Library): string[] {
  return lib.items().map((i: any) => `patchouli://items/${i.item_id}.bib`);
}
