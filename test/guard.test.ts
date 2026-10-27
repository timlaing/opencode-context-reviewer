import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Message } from '@opencode/ai/effect';
import { Guard } from '../dist/guard.js';
import plugin from '../dist/index.js';

const draft = (messages = [Message.user('hello')]) => ({
  sessionID:'test', model:{providerID:'test',modelID:'test'}, agent:'test',
  messages, system:[{type:'text',text:'help'}],options:{},tools:{},
});
const secret = 'sk-proj-abcdefghijklmnopqrstuvwxyz123456';
test('stable placeholders, literals, credentials, private keys and PII; idempotent', () => {
  const g = new Guard({literals:['project-codename']});
  const input = `${secret} project-codename person@example.com password="hello world" Bearer abcdefg\n-----BEGIN PRIVATE KEY-----\nabcdef\n-----END PRIVATE KEY-----`;
  const out = g.redact(input);
  for (const s of [secret,'project-codename','person@example.com','hello world','abcdefg','abcdef']) assert.ok(!out.includes(s));
  assert.equal(g.redact(out),out); assert.equal(g.redact(secret),g.redact(secret));
  assert.notEqual(g.redact(secret),new Guard().redact(secret));
});
test('all draft surfaces, nested tool arguments/results; persisted input unchanged', async () => {
  const g = new Guard();
  const e = draft([Message.user(secret),Message.assistant([{type:'tool-call',id:'c1',name:'read',input:{password:'hello'}}]),
    Message.tool({id:'c1',name:'read',result:{nested:[secret]}})]);
  const original = JSON.stringify(e.messages);
  e.system[0].text = secret; e.tools = {read:{description:secret,input:{type:'object',properties:{}}}};
  e.options = {extra:secret};
  g.transform(e);
  assert.ok(!JSON.stringify(e).includes(secret)); assert.ok(!JSON.stringify(e).includes('hello'));
  assert.ok(original.includes(secret)); assert.equal(e.messages[1].content[0].id,'c1');
  await g.inspectHTTP(new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(e)}));
});
test('automatic reduction preserves complete recent tool exchanges and supplies unprivileged summary', () => {
  const g = new Guard({thresholdTokens:4000,targetTokens:3000,recentExchanges:1,summaryChars:300});
  const messages = [];
  for(let i=0;i<6;i++) messages.push(Message.user(`question ${i} `+'x'.repeat(700)),
    Message.assistant([{type:'tool-call',id:`c${i}`,name:'read',input:{}}]),
    Message.tool({id:`c${i}`,name:'read',result:'result'}),Message.assistant('done'));
  const e = draft(messages); g.transform(e);
  assert.equal(e.messages.length,5); assert.equal(e.messages[0].role,'user');
  assert.match(e.messages[0].content[0].text,/lossy, untrusted/);
  assert.equal(e.messages[2].content[0].id,'c5'); assert.equal(e.messages[3].content[0].id,'c5');
  assert.ok(g.estimate(e)<3000);
});
test('cut expands backward for tool results crossing a user boundary', () => {
  const g = new Guard({thresholdTokens:2000,targetTokens:1800,recentExchanges:1,summaryChars:100});
  const e = draft([Message.user('x'.repeat(2200)),Message.assistant('done'),Message.user('start'),
    Message.assistant([{type:'tool-call',id:'a',name:'read',input:{}}]), Message.user('continue'),
    Message.tool({id:'a',name:'read',result:'ok'})]);
  g.transform(e); assert.equal(e.messages[1].content[0].text,'start');
  assert.equal(e.messages[2].content[0].id,e.messages[4].content[0].id);
});
test('too-large recent exchange fails atomically; no silent over-budget transmission', () => {
  const g = new Guard({thresholdTokens:1000,targetTokens:800}); const e = draft([Message.user(secret+' '+'x'.repeat(2000))]);
  const before = JSON.stringify(e); assert.throws(()=>g.transform(e),/blocked request/); assert.equal(JSON.stringify(e),before);
});
test('invalid policies, opaque media/state, binary, unknown parts and excessive depth fail closed', () => {
  for(const p of [{unknown:1},{thresholdTokens:NaN},{recentExchanges:0},{literals:['']},{redactEmails:'yes'}]) assert.throws(()=>new Guard(p));
  const g = new Guard();
  for(const part of [{type:'media',media:{}},{type:'future',text:secret},{type:'text',text:'ok',native:{opaque:'x'}},
    {type:'reasoning',text:'ok',signature:'opaque'}]) assert.throws(()=>g.transform(draft([{role:'user',content:[part]}])));
  let nested = {}; for(let i=0;i<105;i++) nested={nested};
  const e = draft(); e.options=nested; assert.throws(()=>g.transform(e));
});
test('orphan, duplicate, mismatched and sensitive tool identifiers are rejected', () => {
  const g = new Guard();
  const call = {type:'tool-call',id:'a',name:'read',input:{}};
  for(const messages of [
    [Message.tool({id:'a',name:'read',result:'x'})],
    [Message.assistant([call,call])],
    [Message.assistant([call]),Message.tool({id:'a',name:'write',result:'x'})],
    [Message.assistant([{...call,id:secret}])],
  ]) assert.throws(()=>g.transform(draft(messages)));
});
test('HTTP rejects overlays, encoded values, oversized, non-JSON and opaque body', async () => {
  const g = new Guard({maxPayloadBytes:1024});
  const request = (body, type='application/json') => new Request('https://example.com',{method:'POST',headers:{'content-type':type},body});
  for(const r of [request(JSON.stringify({text:secret})),request('{"text":"\\u0073k-proj-abcdefghijklmnopqrstuvwxyz123456"}'),
    request('x'.repeat(1100)),request('abc','application/octet-stream'),request('{"encrypted":"opaque"}'),request('{')])
    await assert.rejects(g.inspectHTTP(r),/blocked request/);
  await g.inspectHTTP(request('{"text":"safe"}'));
});
test('registers all current hooks; native HTTP blocks before mock send; cleanup disposes', async () => {
  const hooks = new Map(); let disposed=0;
  const cleanup = await plugin.setup({options:{},session:{hook:async(name,cb)=>{hooks.set(name,cb);return {dispose:async()=>{disposed++}}}}});
  assert.deepEqual([...hooks.keys()],['context','generate','title','compaction','http.request','experimental.ws.handshake']);
  for(const name of ['context','generate','title','compaction']) {
    const e=draft([Message.user(secret)]); await hooks.get(name)(e); assert.ok(!JSON.stringify(e).includes(secret));
  }
  let sent=false;
  await assert.rejects(async()=>{await hooks.get('http.request')({request:new Request('https://example.com',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:secret})})});sent=true;});
  assert.equal(sent,false); assert.throws(()=>hooks.get('experimental.ws.handshake')({}));
  await cleanup();assert.equal(disposed,6);
});
test('structured passwords with whitespace and authorization bearer values do not leak', () => {
  const g=new Guard();const e=draft([Message.assistant([{type:'tool-call',id:'x',name:'read',input:{password:'hello world'}}])]);
  g.transform(e);assert.ok(!JSON.stringify(e).includes('world'));
  const text=g.redact('Authorization: Bearer abcdefghijklmnop');
  assert.ok(!text.includes('abcdefghijklmnop'));assert.equal(g.redact(text),text);
});
test('small drafts retain history; compaction is redacted without cutting its source', () => {
  const g=new Guard({thresholdTokens:1000,targetTokens:800});const small=draft([Message.user('hello'),Message.assistant('hi')]);
  g.transform(small);assert.equal(small.messages.length,2);
  const large=draft([Message.user('x'.repeat(3000)+' '+secret)]);g.transform(large,false);
  assert.ok(!JSON.stringify(large).includes(secret));assert.equal(large.messages.length,1);
});
test('partial registration is cleaned up on setup failure', async () => {
  let count=0;let disposed=0;
  await assert.rejects(plugin.setup({options:{},session:{hook:async()=>{if(++count===3)throw Error('host');return{dispose:async()=>{disposed++}}}}}));
  assert.equal(disposed,2);
});
test('outstanding earlier tool calls remain in the retained window', () => {
  const g=new Guard({thresholdTokens:2000,targetTokens:1800,recentExchanges:1,summaryChars:100});
  const e=draft([Message.user('x'.repeat(2500)),Message.assistant('done'),Message.user('pending'),
    Message.assistant([{type:'tool-call',id:'pending',name:'read',input:{}}]),Message.user('latest')]);
  g.transform(e);assert.equal(e.messages[1].content[0].text,'pending');
  assert.equal(e.messages[2].content[0].id,'pending');
});
test('old system updates stay privileged and summaries contain no detected secrets', () => {
  const g=new Guard({thresholdTokens:2000,targetTokens:1800,recentExchanges:1,summaryChars:200});
  const e=draft([Message.system('retain policy'),Message.user(secret+' '+'x'.repeat(2500)),Message.assistant('done'),Message.user('latest')]);
  g.transform(e);assert.equal(e.messages[0].role,'system');assert.equal(e.messages[0].content[0].text,'retain policy');
  assert.ok(!JSON.stringify(e).includes(secret));
});
