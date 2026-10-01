const CACHE='dhekr-static-v1';
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/offline.html','/icons/icon-192.png','/icons/icon-512.png'])).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('dhekr-static-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  // Never cache authenticated pages, API responses, cookies, or subscriptions.
  if(event.request.mode==='navigate')event.respondWith(fetch(event.request).catch(()=>caches.match('/offline.html')));
});
self.addEventListener('push',event=>{
  let value={title:'تذكير ❤️',body:'استغفر الله'};
  try{if(event.data)value=event.data.json();}catch{}
  const body=typeof value.body==='string'?value.body.slice(0,200):'استغفر الله';
  event.waitUntil(Promise.all([
    self.registration.showNotification('تذكير ❤️',{body,icon:'/icons/icon-192.png',badge:'/icons/icon-192.png',lang:'ar',dir:'rtl',data:{url:'/'}}),
    self.clients.matchAll({type:'window',includeUncontrolled:true}).then(clients=>clients.forEach(client=>client.postMessage({type:'dhikr',body})))
  ]));
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const own=clients.find(client=>new URL(client.url).origin===self.location.origin);
    if(own){await own.focus();own.postMessage({type:'dhikr',body:event.notification.body});return;}
    await self.clients.openWindow('/');
  }));
});
self.addEventListener('pushsubscriptionchange',event=>{
  // Renewal needs a foreground session on this private Site; never silently send.
  event.waitUntil(self.clients.matchAll({type:'window'}).then(clients=>clients.forEach(client=>client.postMessage({type:'subscription-changed'}))));
});
