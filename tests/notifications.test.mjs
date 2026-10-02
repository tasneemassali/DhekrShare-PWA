import test from 'node:test';
import assert from 'node:assert/strict';
import { renewSubscription } from '../lib/notifications.mjs';
test('repair replaces the old browser subscription even when server readiness was true',async()=>{
  const events=[];
  let current={endpoint:'old',unsubscribe:async()=>{events.push('unsubscribe');current=null;return true;}};
  const key=new Uint8Array([1]);
  const registration={pushManager:{getSubscription:async()=>current,subscribe:async options=>{
    assert.equal(current,null);assert.equal(options.userVisibleOnly,true);assert.equal(options.applicationServerKey,key);
    events.push('subscribe');return {endpoint:'fresh'};
  }}};
  assert.equal((await renewSubscription(registration,key)).endpoint,'fresh');
  assert.deepEqual(events,['unsubscribe','subscribe']);
});
test('repair does not claim renewal when browser retains old subscription',async()=>{
  let subscribed=false;
  const old={unsubscribe:async()=>false};
  await assert.rejects(renewSubscription({pushManager:{getSubscription:async()=>old,subscribe:async()=>{subscribed=true;}}},new Uint8Array()),/تعذّر/);
  assert.equal(subscribed,false);
});
