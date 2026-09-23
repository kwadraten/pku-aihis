// A locator may describe a PDF page, an ebook chapter, or an upstream record.
export function sourceLocation(d: any) {
  const parts = [];
  if (d.locator) parts.push(d.locator);
  else if (d.pdf_page != null) parts.push(`PDF 第 ${d.pdf_page} 页`);
  if (d.printed_page != null) parts.push(`原书 ${d.printed_page}`);
  return parts.join(' / ') || '定位待核';
}
export function sourceLabel(d: any) {
  return `${d.title} · ${sourceLocation(d)} · ${d.author || '作者待核'}`;
}
export function sourceWebURL(d: any) {
  try {
    const url = new URL(d.source_url);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}
export function localOriginalURL(d: any, hostname: string) {
  if (!['127.0.0.1', 'localhost'].includes(hostname) || !/^originals\/[A-Za-z0-9_.-]+\.(pdf|txt)$/.test(d.raw_file || '')) return null;
  const page = Number.isInteger(d.pdf_page) && d.pdf_page > 0 ? `#page=${d.pdf_page}` : '';
  return '/api/corpus-source/' + encodeURIComponent(d.raw_file) + page;
}
