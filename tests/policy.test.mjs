import test from 'node:test';
import assert from 'node:assert/strict';
import { validCode, validDhikr, validSubscription, digest, deviceCookie, randomCode, randomToken } from '../lib/policy.mjs';
import { buildPushPayload } from '@block65/webcrypto-web-push';
const sub={endpoint:'https://web.push.apple.com/Q-test',keys:{p256dh:'A'.repeat(87),auth:'A'.repeat(22)}};
test('only six-digit codes and seven fixed dhikr IDs',()=>{
  assert.ok(validCode('123456'));assert.ok(!validCode('12345'));assert.ok(!validCode(123456));
  for(let i=0;i<7;i++)assert.ok(validDhikr(i));
  for(const id of [-1,7,'1',null,1.5])assert.ok(!validDhikr(id));
});
test('reject SSRF hosts, redirects targets, credentials, malformed subscription keys',()=>{
  assert.ok(validSubscription(sub));
  for(const endpoint of ['http://web.push.apple.com/x','https://evil.example/x','https://web.push.apple.com.evil.example/x','https://user:password@web.push.apple.com/x','https://127.0.0.1/x','https://fcm.googleapis.com:8080/x'])assert.ok(!validSubscription({...sub,endpoint}));
  assert.ok(!validSubscription({...sub,keys:{p256dh:'short',auth:'short'}}));
});
test('opaque device credentials are hashed and exact cookie parsing rejects partial credentials',async()=>{
  const token=randomToken();assert.match(token,/^[a-f0-9]{64}$/);
  const hash=await digest(token);assert.notEqual(hash,token);assert.equal(hash,await digest(token));
  assert.equal(deviceCookie(new Request('https://example.test',{headers:{cookie:'a=1; __Host-dhekr='+token+'; b=2'}})),token);
  assert.equal(deviceCookie(new Request('https://example.test',{headers:{cookie:'__Host-dhekr='+token+'bad'}})),null);
  for(let i=0;i<100;i++)assert.ok(validCode(randomCode()));
});
test('real Web Crypto produces Apple-compatible encrypted and VAPID-authenticated payload',async()=>{
  const vapid=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const client=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const raw=async key=>Buffer.from(await crypto.subtle.exportKey('raw',key)).toString('base64url');
  const subscription={endpoint:sub.endpoint,keys:{p256dh:await raw(client.publicKey),auth:Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString('base64url')}};
  assert.ok(validSubscription(subscription));
  const keys={subject:'https://example.test',publicKey:await raw(vapid.publicKey),privateKey:(await crypto.subtle.exportKey('jwk',vapid.privateKey)).d};
  const payload=await buildPushPayload({data:JSON.stringify({title:'تذكير ❤️',body:'الحمد لله'}),options:{ttl:3600}},subscription,keys);
  const headers=new Headers(payload.headers);
  assert.equal(headers.get('content-encoding'),'aes128gcm');
  assert.match(headers.get('authorization'),/^vapid t=/);
  assert.equal(headers.get('ttl'),'3600');
  assert.ok(payload.body.byteLength>0);
});
