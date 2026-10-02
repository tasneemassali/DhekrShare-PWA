import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('notification worker leaves navigation to Safari and upgrades existing registrations', async () => {
  const handlers = new Map();
  const deleted = [];
  let skipped = false;
  let claimed = false;
  const notifications = [];
  vm.runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    self: {
      addEventListener: (name, handler) => handlers.set(name, handler),
      skipWaiting: async () => { skipped = true; },
      clients: { claim: async () => { claimed = true; }, matchAll: async () => [] },
      registration: { showNotification: async (...args) => notifications.push(args) },
    },
    caches: { keys: async () => ['dhekr-static-v2', 'unrelated'], delete: async key => deleted.push(key) },
  });
  // No intercepted navigation can hand Safari a redirected response, including
  // redirects to/from the sign-in provider. Push handlers remain registered.
  assert.equal(handlers.has('fetch'), false);
  await new Promise(resolve => handlers.get('install')({waitUntil: resolve}));
  await new Promise(resolve => handlers.get('activate')({waitUntil: resolve}));
  assert.equal(skipped, true);
  assert.equal(claimed, true);
  assert.deepEqual(deleted, ['dhekr-static-v2']);
  await new Promise(resolve => handlers.get('push')({data:{json:()=>({body:'الحمد لله'})},waitUntil:resolve}));
  assert.equal(notifications[0][0], 'تذكير');
  assert.equal(notifications[0][1].body, 'الحمد لله');
  assert.equal(handlers.has('notificationclick'), true);
});
