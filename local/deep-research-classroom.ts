// Copy next to the upstream src folder; upstream implementation is unchanged.
import fs from 'node:fs';
import {deepResearch, writeFinalAnswer} from './src/deep-research';
async function main(){
const query=process.env.CLASSROOM_QUERY || '仅在课堂中日文史料片段中研究：井上哲次郎怎样界定宗教、神道与国民道德？检索词请使用短的中文或日文词项。保留片段编号和PDF页序，不能根据相似性断言历史影响，用中文报告材料不足。';
const trace:any[]=[]; const start=Date.now();
const found=await deepResearch({query,breadth:2,depth:2,onProgress:(event)=>{trace.push(event);console.log('progress',event.completedQueries,event.currentQuery)}});
const report=await writeFinalAnswer({prompt:query+" 请用不超过200字中文概括，并明确材料不足之处。",learnings:found.learnings});
fs.writeFileSync(process.env.CLASSROOM_RESULT!,JSON.stringify({tool:'deepresearch',status:'actual local run',query,model:process.env.CUSTOM_MODEL,run_at:new Date().toISOString(),seconds:(Date.now()-start)/1000,answer:report,...found,trace,scope:'Original dzhng/deep-research recursion and concise-answer generation. Qwen3-4B local model; Firecrawl-compatible transport routes only to local classroom BM25, NOT Internet search.'},null,2));

}
main().catch(e=>{console.error(e);process.exitCode=1});
