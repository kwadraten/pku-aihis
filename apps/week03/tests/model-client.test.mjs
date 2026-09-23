import {test} from 'node:test';import assert from 'node:assert/strict';
import {apiEndpoint,bridgeEndpoint,parseAction,generate,citationCheck} from '../src/lib/model-client.ts';
test('citation validation accepts imported IDs and rejects unprovided evidence',()=>{
 const ids=['B03-00002','1906.11238v1-p001-00000','LEY-GOOD-00008','片段甲'];
 const good=citationCheck(ids.map(id=>`[${id}]`).join(' '),ids);
 assert.deepEqual(good.cited_ids,ids);assert.deepEqual(good.unknown_ids,[]);assert.equal(good.missing_ids,false);
 assert.deepEqual(citationCheck('[B03-99999]',ids).unknown_ids,['B03-99999']);
 assert.equal(citationCheck('回答没有引文',ids).missing_ids,true);
});
test('endpoint guards and completion path normalization',()=>{
 assert.equal(apiEndpoint('https://api.deepseek.com'),'https://api.deepseek.com/chat/completions');
 assert.equal(apiEndpoint('https://api.example/v1/chat/completions'),'https://api.example/v1/chat/completions');
 for(const s of ['https://key@api.example','https://api.example?key=x','http://api.example'])assert.throws(()=>apiEndpoint(s));
 assert.throws(()=>bridgeEndpoint('https://outside.example','/api/generate'));
});
test('tool schema rejects unknown action and missing parameter',()=>{
 assert.deepEqual(parseAction('```json\n{"action":"read","id":"ZT8-1"}\n```'),{tool:'read',id:'ZT8-1'});
 assert.throws(()=>parseAction('{"action":"shell","command":"do anything"}'));
 assert.throws(()=>parseAction('{"action":"read","id":42}'));
});
test('API key sent only in authorization; returned metadata stays clean',async()=>{
 const original=globalThis.fetch;let captured;
 globalThis.fetch=async(url,options)=>{captured={url,options};return new Response(JSON.stringify({id:'test1',model:'server-version',choices:[{message:{content:'actual mock answer'},finish_reason:'stop'}]}),{status:200});};
 try{const result=await generate([{role:'user',content:'question'}],{config:{mode:'api',apiKey:'TEST_ONLY_KEY',apiModel:'m',baseUrl:'https://api.example/v1',localModel:'',bridge:'',transport:'direct'}});
 assert.equal(captured.options.headers.Authorization,'Bearer TEST_ONLY_KEY');assert(!captured.options.body.includes('TEST_ONLY_KEY'));assert(!JSON.stringify(result).includes('TEST_ONLY_KEY'));assert.equal(result.model,'server-version');}finally{globalThis.fetch=original;}
});
