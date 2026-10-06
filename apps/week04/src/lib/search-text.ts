// Port of Patchouli.Infrastructure.Search.SearchTextAnalyzer: NFKC, lowercase
// words, CJK runs of length 1–3, and stable token deduplication.
export function analyzeSearchText(text:string):string[]{
 const tokens:string[]=[];let word='',run='';
 const flushWord=()=>{if(word){tokens.push(word);word='';}};
 const flushCjk=()=>{for(let n=1;n<=3&&n<=run.length;n++)for(let i=0;i<=run.length-n;i++)tokens.push(run.slice(i,i+n));run='';};
 for(const c of text.normalize('NFKC').split('')){const code=c.charCodeAt(0),cjk=code>=0x3400&&code<=0x9fff||code>=0xf900&&code<=0xfaff||code>=0x3040&&code<=0x30ff||code>=0xac00&&code<=0xd7af;if(cjk){flushWord();run+=c;continue;}flushCjk();if(/[\p{L}\p{Nd}]/u.test(c))word+=c.toLowerCase();else flushWord();}
 flushWord();flushCjk();return [...new Set(tokens)];
}
export const buildIndexText=(text:string)=>analyzeSearchText(text).join(' ');
export const buildFtsQuery=(text:string)=>analyzeSearchText(text).map(token=>'"'+token.replaceAll('"','""')+'"').join(' AND ');
