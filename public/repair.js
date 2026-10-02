// Repair an old offline document without removing cookies or push subscriptions.
const statusText = document.getElementById('status');
const retry = document.getElementById('retry');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function workerVersion(worker) {
  if (!worker) return Promise.resolve(null);
  return new Promise(resolve => {
    const channel = new MessageChannel();
    const finish = value => { clearTimeout(timer); channel.port1.close(); resolve(value); };
    const timer = setTimeout(() => finish(null), 600);
    channel.port1.onmessage = event => finish(event.data?.version);
    worker.postMessage({type:'DHEKR_VERSION'}, [channel.port2]);
  });
}
async function repair() {
  retry.disabled = true;
  statusText.textContent = 'جارٍ تحديث التطبيق…';
  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.register('/sw.js', {scope:'/', updateViaCache:'none'});
      await registration.update();
      const deadline = Date.now() + 12000;
      while (await workerVersion(navigator.serviceWorker.controller) !== 5) {
        if (Date.now() > deadline) throw new Error('update');
        await pause(150);
      }
    }
    statusText.textContent = 'جارٍ التحقق من الاتصال بالتطبيق…';
    const response = await fetch('/api/dhikr?action=status', {cache:'no-store', credentials:'same-origin', signal:AbortSignal.timeout(12000)});
    if (!response.ok) throw new Error('server');
    const data = await response.json();
    if (data.apiVersion !== 2) throw new Error('server');
    // Always leave /offline.html, rather than repeatedly reloading it.
    location.replace('/?recovered=5');
  } catch {
    statusText.textContent = 'تعذّر الوصول إلى التطبيق أو إكمال تحديثه. قد يكون الإنترنت متصلاً؛ حاولي مجدداً.';
    retry.disabled = false;
  }
}
retry.addEventListener('click', repair);
void repair();
