const CACHE='pzc-hub-shell-v0.3-rider-ice-uat';
const SHELL=['./','./index.html','./css/styles.css','./js/app.js','./js/hero-manager.js','./js/rider-ice.js','./js/api.js','./js/config.js','./manifest.webmanifest','./assets/logo-pzc.png','./assets/icon-192.png','./assets/icon-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(!SHELL.some(p=>new URL(p,self.registration.scope).href===request.url))return;
  event.respondWith(fetch(request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(request,copy));}return response;}).catch(()=>caches.match(request)));
});
