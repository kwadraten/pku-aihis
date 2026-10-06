export const CSL_STYLES = [
 {id:'mla',label:'MLA 第9版',locale:'en-US',source:'https://github.com/citation-style-language/styles/blob/master/modern-language-association.csl'},
 {id:'apa',label:'APA 第7版',locale:'en-US',source:'https://github.com/citation-style-language/styles/blob/master/apa.csl'},
 {id:'chicago',label:'Chicago 第18版（注释与书目）',locale:'en-US',source:'https://github.com/citation-style-language/styles/blob/master/chicago-notes-bibliography.csl'},
 {id:'world-history',label:'《世界历史》',locale:'zh-CN',source:'https://zotero-chinese.com/styles/世界历史/'},
] as const;
const loaded=new Map<string,Promise<string>>();
export function loadCslStyle(id:string):Promise<string>{
 if(!CSL_STYLES.some(style=>style.id===id))throw Error('未知CSL样式');
 let promise=loaded.get(id);if(!promise){promise=(async()=>{const response=await fetch(new URL(`assets/csl/${id}.csl`,document.baseURI));if(!response.ok)throw Error(`CSL样式读取失败：${response.status}`);return response.text();})();loaded.set(id,promise);promise.catch(()=>loaded.delete(id));}return promise;
}
const choices=new WeakMap<object,{styleId:string;locale:string}>();
export function cslChoice(database:object){let choice=choices.get(database);if(!choice){choice={styleId:'mla',locale:'en-US'};choices.set(database,choice);}return choice;}
