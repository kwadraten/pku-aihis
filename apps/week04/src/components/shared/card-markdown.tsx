import { h } from '@stencil/core';

// Markdown is emitted as VNodes, never HTML. Raw HTML remains literal text.
// Local VFS links resolve inside the desk; ordinary links use safe schemes only.
export function markdownInline(text: string, open: (uri: string) => void): any[] {
  const pattern = /\[([^\]]+)\]\(([^\s)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|\*([^*]+)\*/g;
  const result: any[] = []; let offset = 0;
  for (const match of text.matchAll(pattern)) {
    result.push(text.slice(offset, match.index));
    if (match[1]) {
      const uri = match[2], local = /^patchouli:\/\/(notes|texts)\//.test(uri), safe = local || /^https?:\/\//.test(uri);
      result.push(safe ? <a href={uri} title={uri} onClick={local ? event => { event.preventDefault(); open(uri); } : undefined} target={local ? undefined : '_blank'} rel={local ? undefined : 'noopener noreferrer'}>{match[1]}</a> : match[1]);
    } else if (match[3]) result.push(<strong>{match[3]}</strong>);
    else if (match[4]) result.push(<code>{match[4]}</code>);
    else result.push(<em>{match[5]}</em>);
    offset = match.index + match[0].length;
  }
  result.push(text.slice(offset)); return result;
}

export function cardMarkdownView(text: string, open: (uri: string) => void) {
  const blocks: any[] = [], lines = text.replace(/\r\n/g, '\n').split('\n'); let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index++; continue; }
    if (line.startsWith('```')) { const code: string[] = []; index++; while (index < lines.length && !lines[index].startsWith('```')) code.push(lines[index++]); index++; blocks.push(<pre><code>{code.join('\n')}</code></pre>); continue; }
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) { blocks.push(h('h' + Math.min(heading[1].length + 1, 6), {}, markdownInline(heading[2], open))); index++; continue; }
    if (/^>\s?/.test(line)) { const quote: string[] = []; while (index < lines.length && /^>/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, '')); blocks.push(<blockquote>{markdownInline(quote.join(' '), open)}</blockquote>); continue; }
    if (/^(-|\*|\d+\.)\s/.test(line)) { const ordered = /^\d/.test(line), items: any[] = []; while (index < lines.length && (ordered ? /^\d+\.\s/ : /^[-*]\s/).test(lines[index])) items.push(<li>{markdownInline(lines[index++].replace(/^(-|\*|\d+\.)\s+/, ''), open)}</li>); blocks.push(h(ordered ? 'ol' : 'ul', {}, items)); continue; }
    if (/^---+$/.test(line.trim())) { blocks.push(<hr />); index++; continue; }
    const paragraph: string[] = [line]; index++;
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|>|```|[-*]\s|\d+\.\s)/.test(lines[index])) paragraph.push(lines[index++]);
    blocks.push(<p>{markdownInline(paragraph.join('\n'), open)}</p>);
  }
  return blocks;
}
