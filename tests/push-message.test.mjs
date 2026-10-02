import test from 'node:test';
import assert from 'node:assert/strict';
import { pushMessage } from '../lib/push-message.mjs';
test('push has Apple declarative fallback and preserves old worker compatibility',()=>{
  const message=pushMessage('الحمد لله','https://example.test');
  assert.equal(message.web_push,8030);
  assert.equal(message.notification.title,'تذكير');
  assert.equal(message.notification.body,'الحمد لله');
  assert.equal(message.notification.navigate,'https://example.test/');
  assert.equal(message.notification.silent,false);
  assert.equal(message.body,message.notification.body);
});
