export interface CardCitation { label: string; uri: string; reason: string; }
export interface ReadingCard { id: string; title: string; body: string; citations: CardCitation[]; }
export const noteUri = (id: string) => `patchouli://notes/${id}.md`;

// Addresses are authored once. Page numbers are PDF ordinals, revisions and boxes
// are taken verbatim from the bundled native database, not generated at runtime.
export const CARD_SOURCES = [
  { label: 'Spivak · PDF 第8页', uri: 'patchouli://texts/10a8f257-14d2-44cc-a253-5ac5e3c21528/page-8.md?rev=840f0b6f-8e39-429b-9852-671c3befb3dc&box=f5afe5da-84fb-4209-911d-e56d1e1db041' },
  { label: 'Spivak · PDF 第4页', uri: 'patchouli://texts/10a8f257-14d2-44cc-a253-5ac5e3c21528/page-4.md?rev=b1a08e87-9d01-41dd-982b-68e15372a18d&box=a9ce9769-ebcf-4160-8eea-7eebcc73c3f7' },
  { label: 'Milk Is Gold · PDF 第151页', uri: 'patchouli://texts/ca0d41b6-3d40-49f1-8e7a-6f27efbda856/page-151.md?rev=e8eddd13-173b-45c1-b43a-05915d481217&box=b5452864-e53a-4600-a54e-936271e4e70f' },
  { label: 'Milk Is Gold · PDF 第122页', uri: 'patchouli://texts/ca0d41b6-3d40-49f1-8e7a-6f27efbda856/page-122.md?rev=3abc15ba-88f9-4b5a-b1c0-17e510b6d5bc&box=3a40dc4a-3b26-4972-8ea6-a69059b4deb1' },
  { label: '数字人文与生成式AI · PDF 第1页', uri: 'patchouli://texts/3520c3f0-5daf-4527-9231-d76f6fd237b3/page-1.md?rev=12ca88e4-87b7-4456-babe-500542817862&box=c63f92c7-30c8-432a-893e-07db242f1cba' },
  { label: '藤井定義《元文元年の貨幣改鋳思想》· PDF 第6页', uri: 'patchouli://texts/08b4f303-d6d5-41c0-a395-48cd79940bfd/page-6.md?rev=74aaf5b5-6e39-4a12-baf6-00e63fd6ff2c&box=e6efec8d-eef1-4b42-a67e-ad035b3ddaf6' },
] as const;

export const SEED_CARDS: ReadingCard[] = [
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc01', title: '材料变得可见，就等于当事人发声了吗？', body: '使被忽略的材料进入历史叙述，与使其中的个人能够发声，是两个需要分别检验的步骤。\n\n**阅读时追问**：是谁挑选材料、组织叙述，并替当事人解释其处境？', citations: [{ ...CARD_SOURCES[0], reason: '这一段直接指出从“使机制可见”滑向“使个人发声”的问题，因此适合检查研究者是否把自己的解释当作当事人的声音。' }] },
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc02', title: '代言与描绘为什么不能合并为一种代表？', body: 'Spivak 区分政治上的代言（Vertretung）与表述、描绘（Darstellung），并要求考察两者如何共同发生。\n\n可继续追问：[材料可见与个人发声的区别](patchouli://notes/812cfe38-9d7e-4b76-95b4-dc7c108abc01.md)。', citations: [{ ...CARD_SOURCES[1], reason: '这一段以马克思的阶级分析说明两种代表的联系及差别，为“谁替谁说话”和“如何描绘谁”提供了不同的分析入口。' }] },
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc03', title: '科学技术进入草原后，地方知识消失了吗？', body: '这段研究指出，蒙古本地的实施者把繁育、疾病和放牧经验与科学兽医技术结合起来。\n\n因此，我会把“地方知识被抹去”改写成一个待检验的问题，继续寻找具体的实施者与实践。', citations: [{ ...CARD_SOURCES[2], reason: '作者在这里直接检验“技术引入抹去了蒙古知识”的判断，并列出保留、结合地方经验的行动者，可用来检验技术替代叙事。' }] },
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc04', title: '高产牲畜为什么不能直接复制到新环境？', body: '改良品种需要更多饲料、水和庇护，迁移能力也可能不同。本地杂交的目的之一，正是回应这些环境条件。\n\n与[地方知识如何继续起作用](patchouli://notes/812cfe38-9d7e-4b76-95b4-dc7c108abc03.md)相连：两张卡都提醒我检查技术被采用时的具体条件。', citations: [{ ...CARD_SOURCES[3], reason: '这一段同时讨论外来品种的资源需求与本地杂交的目的，适合把“技术是否先进”拆成“它适合什么环境”的问题。' }] },
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc05', title: '研究者认可AI的效率，就会接受它的角色吗？', body: '这项调查显示，学者既认可生成式 AI 对效率和技能的帮助，也担心它改变自己的知识生产角色。工具的进入仍处于协商之中。\n\n我会分别记录**做了什么任务**与**如何看待研究者角色**，避免把“使用”直接等同于“认可”。', citations: [{ ...CARD_SOURCES[4], reason: '摘要同时报告了效率收益与知识身份方面的顾虑，正好支持把工具使用和角色认同分开提问；这是该研究的观察，而非对所有学者的推断。' }] },
  { id: '812cfe38-9d7e-4b76-95b4-dc7c108abc06', title: '提高货币成色为什么未必改善流通？', body: '藤井定義讨论正德、享保时期的良铸时，把铸造量、紧缩政策与米价变化一并纳入，说明通货不足和武士困窘的背景。\n\n**待追问**：评价一项改铸政策时，除成色之外，还应查看谁取得了货币、能购买什么？', citations: [{ ...CARD_SOURCES[5], reason: '这一段将成色放回铸造量、价格与财政政策的共同作用中，帮助我避免仅凭金属品质判断货币政策的效果。' }] },
];

export function cardMarkdown(card: ReadingCard): string {
  return `# ${card.title}\n\n[${noteUri(card.id)}](${noteUri(card.id)})\n\n${card.body}\n\n## 引用\n\n` + card.citations.map(citation => `[${citation.label}](${citation.uri})\n\n**引用理由**：${citation.reason}`).join('\n\n');
}

export function isExactEvidence(uri: string): boolean {
  try { const parsed = new URL(uri); return parsed.protocol === 'patchouli:' && parsed.hostname === 'texts' && /^\/[0-9a-f-]{36}\/page-[1-9]\d*\.md$/.test(parsed.pathname) && /^[0-9a-f-]{36}$/.test(parsed.searchParams.get('rev') || '') && /^[0-9a-f-]{36}$/.test(parsed.searchParams.get('box') || ''); } catch { return false; }
}
