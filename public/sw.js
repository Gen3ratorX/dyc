const CACHE='dyc-shell-v3';
const shellAsset=url=>url.origin===location.origin&&(url.pathname.startsWith('/_next/static/')||url.pathname.startsWith('/fonts/')||['/dyc-logo.png','/dyc-logo-light.png','/dyc-icon.png','/favicon.svg'].includes(url.pathname));
self.addEventListener('install',event=>{event.waitUntil(caches.open(CACHE).then(c=>c.add('/')).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('dyc-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
// Warm assets loaded before this worker took control. Never accept API URLs or
// arbitrary documents from a client message as shell-cache entries.
self.addEventListener('message',event=>{if(event.data?.type!=='CACHE_SHELL'||!Array.isArray(event.data.urls))return;const urls=event.data.urls.slice(0,200).filter(value=>{try{return typeof value==='string'&&shellAsset(new URL(value,location.origin));}catch{return false;}});event.waitUntil(caches.open(CACHE).then(cache=>Promise.allSettled(urls.map(url=>cache.add(url)))));});
self.addEventListener('fetch',event=>{const req=event.request,url=new URL(req.url);if(req.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.includes('signin')||url.pathname.includes('signout')||url.pathname.includes('callback'))return;
 if(req.mode==='navigate'){event.respondWith(fetch(req).then(res=>{if(res.ok&&new URL(res.url).pathname==='/'){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put('/',copy)));}return res;}).catch(()=>caches.match('/').then(r=>r||new Response('Open DYC Care online once before using offline capture.',{status:503}))));return;}
 if(shellAsset(url)){event.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(res=>{if(res.ok){const copy=res.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(req,copy)));}return res;})));}
});
