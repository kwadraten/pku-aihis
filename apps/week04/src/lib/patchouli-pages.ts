export type PatchouliPage = 'library' | 'search' | 'editor' | 'attachments' | 'reader' | 'processing' | 'ocr' | 'history' | 'csl' | 'uri' | 'tags' | 'collections';
export const PATCHOULI_PAGES: Record<PatchouliPage, string> = {
  library: '书库', search: '全文检索', editor: '编辑题录', attachments: '文件关联', reader: 'PDF工作台',
  processing: '导入与文字提取', ocr: 'OCR队列', history: '文件身份与修订', csl: '引文与样式', uri: '证据地址', tags: '标签', collections:'集合',
};
const SLIDE_PAGES: Record<string, PatchouliPage> = { D04:'library', D05:'editor', D06:'search', D08:'history', D11:'editor', D12:'csl', D13:'uri', D14:'tags', D26:'ocr' };
export const pageFromSlide = (id: string): PatchouliPage => SLIDE_PAGES[id] || 'library';
export const PATCHOULI_ITEM_TYPES: Record<string,string> = {book:'图书','article-journal':'期刊论文','paper-conference':'会议论文',thesis:'学位论文',chapter:'书中章节',manuscript:'手稿'};
export interface PatchouliRequest {
  page: PatchouliPage;
  field?: string;
  focusKind?: 'item' | 'field' | 'metadata' | 'attachment';
  selector?: string;
  notePart?: string;
  readerSection?: '校对' | '历史' | '正文';
  readerEditing?: boolean;
  ocrConfirm?: boolean;
  keepDraft?: boolean;
  documentId?: string;
  pageNumber?: number;
  revisionId?: string;
  evidenceUri?: string;
}
export interface PatchouliState {
  page: PatchouliPage;
  item: any;
  items: any[];
  docs: any[];
  fields: Record<string, string>;
  creators: any[];
  issued: string;
  focusField: string;
  focusKind: PatchouliRequest['focusKind'];
  boundDocuments: number;
  editing: boolean;
  totals: { items: number; documents: number; searchUnits: number };
}
