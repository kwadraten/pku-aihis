export type DiagramKind = 'flow' | 'branch' | 'network' | 'cycle' | 'timeline';
export interface ConceptNode { label: string; detail: string; target: 'panel' | 'editor' | 'attachments' | 'reader' | 'library' | 'search'; page?: string; field?: string; selector?: string; }
export interface ConceptNavigation { title: string; kind: DiagramKind; nodes: ConceptNode[]; }
const panel = (label: string, detail: string, page: string, selector?: string): ConceptNode => ({ label, detail, target: 'panel', page, selector });
const node = (label: string, detail: string, target: ConceptNode['target'], field?: string): ConceptNode => ({ label, detail, target, field });
export const CONCEPT_NAVIGATION: Record<string, ConceptNavigation> = {
  D06: {title:'从检索到原页',kind:'flow',nodes:[node('全文检索','复制命中的证据URI','search'),panel('证据定位','解析已取得的地址','D13'),node('原页核对','查看定位与解析链','reader')]},
  D08: { title: '所用材料的定位层次', kind: 'timeline', nodes: [node('出版版本', '题录中的出版日期与版次', 'editor', 'edition'), panel('文件副本', '文件哈希与文档身份', 'D08'), node('文字修订', '原页对照当前及历史正文', 'reader'), panel('引文位置', '固定到页与修订的地址', 'D13')] },
  D11: { title: '来源信息的不同职责', kind: 'branch', nodes: [node('一份材料', '身份与取得关系分别记录', 'library'), node('出版来源', '书名、期刊与出版者', 'editor', 'publication_title'), node('取得原件', '数字文件与所用副本', 'attachments'), panel('衍生说明', '在研究记录中说明来历', 'D20', '[aria-label="题录笔记"]')] },
  D12: { title: '结构数据与引文呈现', kind: 'flow', nodes: [node('结构化题录', '作者、日期与版本信息', 'editor'), panel('样式与语言', '同一数据选择不同体例', 'D12'), panel('引文输出', '核对渲染文本与 CSL JSON', 'D12', '.w12-rendered')] },
  D13: { title: '证据地址的逐级定位', kind: 'flow', nodes: [node('文档', '附件对应的文档身份', 'attachments'), node('页', '正文与原页的对应位置', 'reader'), node('修订', '同一页的历次文字版本', 'reader'), panel('证据 URI', '用固定地址回查原文', 'D13')] },
  D14: { title: '集合、主题与工作进度', kind: 'branch', nodes: [node('文献', '同一材料保留多个入口', 'library'), panel('集合', '服务一个研究问题', 'D14', '[aria-label="新收藏"]'), panel('主题标签', '描述材料谈论的内容', 'D14', 'tag-lab'), node('工作进度', '记录阅读与核验安排', 'editor', 'status')] },
  D15: { title: '一个装置一种职责', kind: 'branch', nodes: [node('研究任务', '按用途选择组织装置', 'library'), panel('集合', '组织问题所需材料', 'D14', '[aria-label="新收藏"]'), panel('主题标签', '汇集相同主题的材料', 'D14', 'tag-lab'), node('工作状态', '安排下一次研究动作', 'editor', 'status')] },
  D26: { title: '原件、修订与旧引用', kind: 'timeline', nodes: [node('原始页影', '保留所用原件', 'reader'), panel('提取与识别', '为页面产生正文', 'D26'), node('校对修订', '对照原页提交新文字', 'reader'), node('历史回查', '沿旧地址读取旧版本', 'reader')] },
};
