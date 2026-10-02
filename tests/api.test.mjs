import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { createHandler } from '../lib/api.ts';
import { digest } from '../lib/policy.mjs';
const origin='https://example.test';
async function harness(){
  const sqlite=new DatabaseSync(':memory:');
  sqlite.exec(readFileSync(new URL('../drizzle/0000_tense_wallflower.sql',import.meta.url),'utf8'));
  const db={prepare(sql){
    const statement=(args=[])=>({
      bind:(...values)=>statement(values),
      first:async()=>sqlite.prepare(sql).get(...args)??null,
      run:async()=>({meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}),
    });return statement();
  }};
  const key=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const sends=[];
  const handler=createHandler({db:()=>db,env:{APP_ORIGIN:origin,OWNER_EMAIL_HASH:await digest('owner@example.test'),VAPID_SUBJECT:origin,
    VAPID_PUBLIC_KEY:Buffer.from(await crypto.subtle.exportKey('raw',key.publicKey)).toString('base64url'),
    VAPID_PRIVATE_KEY:(await crypto.subtle.exportKey('jwk',key.privateKey)).d},
    sendFetch:async(url,payload)=>{assert.equal(payload.redirect,'manual');assert.equal(new Headers(payload.headers).get('urgency'),'high');sends.push({url,payload});return new Response('',{status:201});}});
  const req=(action,data={},cookie='',owner=false)=>new Request(origin+'/api/dhikr',{
    method:action==='status'?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{}),...(owner?{'oai-authenticated-user-email':'owner@example.test'}:{})},
    ...(action==='status'?{}:{body:JSON.stringify({action,...data})}),
  });
  return {sqlite,handler,req,sends,clearRates:()=>sqlite.exec('DELETE FROM limits')};
}
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
async function subscription(suffix){
  const key=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  return {endpoint:'https://web.push.apple.com/'+suffix,keys:{p256dh:Buffer.from(await crypto.subtle.exportKey('raw',key.publicKey)).toString('base64url'),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')}};
}
test('actual API: owner creates, anonymous second session joins, both send without ChatGPT login',async()=>{
  const h=await harness();const {handler,req}=h;
  const status=await handler(req('status'));assert.equal(status.status,200);assert.equal((await status.json()).state,'new');
  assert.equal((await handler(req('create'))).status,401,'stranger cannot claim installation');
  const first=await handler(req('create',{},'',true));assert.equal(first.status,200);
  const a=cookie(first);const {code}=await first.json();assert.match(code,/^\d{6}$/);
  const joined=await handler(req('join',{code}));assert.equal(joined.status,200,'guest requires code, no ChatGPT headers');
  const b=cookie(joined);assert.notEqual(a,b);
  for(const device of [a,b])assert.equal((await (await handler(req('status',{},device))).json()).state,'paired');
  h.clearRates();assert.equal((await handler(req('join',{code}))).status,409,'third device refused');
  assert.equal((await handler(req('send',{dhikrID:0}))).status,403,'public viewer cannot send');
  assert.equal((await handler(req('send',{dhikrID:0},a))).status,409,'no false success before receiver ready');
  for(const [device,suffix] of [[a,'test-a'],[b,'test-b']])assert.equal((await handler(req('subscribe',{subscription:await subscription(suffix)},device))).status,200);
  assert.equal((await handler(req('send',{dhikrID:0},a))).status,200);
  assert.equal(h.sends[0].url,'https://web.push.apple.com/test-b');
  assert.equal((await handler(req('send',{dhikrID:0},a))).status,429,'server cooldown');
  assert.equal((await handler(req('send',{dhikrID:1},b))).status,200);
  assert.equal(h.sends[1].url,'https://web.push.apple.com/test-a');
  assert.equal(new Headers(h.sends[0].payload.headers).get('content-encoding'),'aes128gcm');
  assert.equal((await handler(req('send',{dhikrID:99},b))).status,400);
  h.sqlite.close();
});
test('actual API: owner may recover only an unfinished browser pairing, old cookie is revoked',async()=>{
  const h=await harness();const {handler,req}=h;
  const first=await handler(req('create',{},'',true));const a=cookie(first);h.clearRates();
  assert.equal((await (await handler(req('status',{},'',true))).json()).canRecover,true);
  assert.equal((await handler(req('recover'))).status,401);
  const recovered=await handler(req('recover',{},'',true));assert.equal(recovered.status,200);
  assert.notEqual(cookie(recovered),a);
  assert.equal((await (await handler(req('status',{},a))).json()).state,'new');
  assert.equal((await handler(req('join',{code:(await recovered.json()).code}))).status,200);
  h.clearRates();assert.equal((await handler(req('recover',{},'',true))).status,409,'completed pair cannot be reset this way');
  h.sqlite.close();
});
test('actual API: cross-origin write rejected and unrelated signed-in account cannot create',async()=>{
  const h=await harness();
  assert.equal((await h.handler(new Request(origin+'/api/dhikr',{method:'POST',headers:{Origin:'https://evil.test','Content-Type':'application/json'},body:'{"action":"join","code":"123456"}'}))).status,403);
  const other=h.req('create');other.headers.set('oai-authenticated-user-email','someone@example.test');
  assert.equal((await h.handler(other)).status,401);
  h.sqlite.close();
});
for(const initiatingRole of ['owner','guest'])test(`unlink from ${initiatingRole}: revoke old devices and re-pair with replacement`,async()=>{
  const h=await harness();const {handler,req}=h;
  const first=await handler(req('create',{},'',true));const a=cookie(first);const oldCode=(await first.json()).code;
  const second=await handler(req('join',{code:oldCode}));const b=cookie(second);
  for(const [device,suffix] of [[a,'original-a'],[b,'original-b']])await handler(req('subscribe',{subscription:await subscription(suffix)},device));
  assert.equal((await handler(req('unlink'))).status,403,'anonymous visitors cannot disconnect');
  const unlinked=await handler(req('unlink',{},initiatingRole==='owner'?a:b));assert.equal(unlinked.status,200);
  const fresh=cookie(unlinked);assert.notEqual(fresh,a);assert.notEqual(fresh,b);
  for(const old of [a,b]){
    assert.equal((await (await handler(req('status',{},old))).json()).state,'new');
    assert.equal((await handler(req('send',{dhikrID:0},old))).status,403);
    assert.equal((await handler(req('subscribe',{subscription:await subscription('stale')},old))).status,403);
    assert.equal((await handler(req('unlink',{},old))).status,403);
  }
  const state=await (await handler(req('status',{},fresh))).json();
  assert.equal(state.state,'waiting');assert.equal(state.canCreate,true);
  assert.equal(state.pushReady,false);assert.equal(state.otherReady,false);
  assert.equal((await handler(req('send',{dhikrID:0},fresh))).status,409);
  h.clearRates();assert.equal((await handler(req('join',{code:oldCode}))).status,409);
  h.clearRates();
  const replacementCode=await handler(req('create',{},fresh));assert.equal(replacementCode.status,200);
  const replacement=await handler(req('join',{code:(await replacementCode.json()).code}));assert.equal(replacement.status,200);
  const c=cookie(replacement);
  await handler(req('subscribe',{subscription:await subscription('replacement')},c));
  assert.equal((await handler(req('send',{dhikrID:0},fresh))).status,200);
  assert.equal(h.sends.at(-1).url,'https://web.push.apple.com/replacement');
  await handler(req('subscribe',{subscription:await subscription('original-'+(initiatingRole==='owner'?'a':'b'))},fresh));
  assert.equal((await handler(req('send',{dhikrID:1},c))).status,200);
  assert.equal(h.sends.at(-1).url,'https://web.push.apple.com/original-'+(initiatingRole==='owner'?'a':'b'));
  h.sqlite.close();
});
