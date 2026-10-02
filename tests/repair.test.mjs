import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const script = readFileSync(new URL('../public/repair.js', import.meta.url), 'utf8');
for (const reachable of [true, false]) {
  test(`recovery ${reachable ? 'opens the home screen' : 'reports service failure without claiming offline'}`, async () => {
    const status = {};
    const button = { addEventListener() {} };
    let destination;
    let updated = false;
    const context = vm.createContext({
      document: {getElementById: id => id === 'status' ? status : button},
      navigator: {serviceWorker: {
        controller: {postMessage: (_, ports) => ports[0].postMessage({version:5})},
        register: async (url, options) => {
          assert.equal(url, '/sw.js');
          assert.equal(options.updateViaCache, 'none');
          return {update: async () => {updated = true;}};
        },
      }},
      MessageChannel, setTimeout, clearTimeout, AbortSignal,
      fetch: async url => {
        assert.equal(updated, true);
        assert.equal(url, '/api/dhikr?action=status');
        return {ok: reachable, json: async () => ({apiVersion:2})};
      },
      location: {replace: url => {destination = url;}},
    });
    // Await the same automatic recovery invocation used by the page.
    await vm.runInContext(script.replace('void repair();', 'repair();'), context);
    if (reachable) assert.equal(destination, '/?recovered=5');
    else {
      assert.equal(destination, undefined);
      assert.equal(button.disabled, false);
      assert.match(status.textContent, /قد يكون الإنترنت متصلاً/);
    }
  });
}
