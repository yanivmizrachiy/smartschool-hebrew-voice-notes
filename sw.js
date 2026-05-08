const CACHE_NAME='yaniv-speak-copy-paste-auto-update-20260508-180741';
const ASSETS=['./','./index.html','./styles.css','./script.js','./manifest.webmanifest','./icon.svg'];

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(ASSETS)));
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE_NAME).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('message',event=>{
  if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});

self.addEventListener('fetch',event=>{
  const req=event.request;

  if(req.method!=='GET') return;

  if(req.mode==='navigate'){
    event.respondWith(
      fetch(req,{
        cache:'no-store'
      }).catch(()=>caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(req,{cache:'no-store'}).then(response=>{
      const copy=response.clone();
      caches.open(CACHE_NAME).then(cache=>cache.put(req,copy));
      return response;
    }).catch(()=>caches.match(req))
  );
});
