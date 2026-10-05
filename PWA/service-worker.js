const CACHE_NAME='s2a-pilot-v1-4-24-app-shell';
const APP_SHELL=[
  './',
  './index.html',
  './app.js',
  './technical-preview.js',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.4.24',
  './icons/s2a-pilot-192.png?v=1.4.24',
  './icons/s2a-pilot-512.png?v=1.4.24',
  './manifest.webmanifest',
  './companion/S2A-Copilote-1.2.5-app.zip',
  './companion/app-files.json',
  './icons/s2a-pilot-192.png',
  './icons/s2a-pilot-512.png'
];

self.addEventListener('install',(event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache)=>cache.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',(event)=>{
  event.waitUntil(
    caches.keys()
      .then((keys)=>Promise.all(
        keys.filter((key)=>key!==CACHE_NAME && /^(s2a-pilot-|showcue|chokyu)/i.test(key)).map((key)=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET') return;
  if(new URL(event.request.url).pathname.endsWith('/version.json')){event.respondWith(fetch(event.request,{cache:'no-store'}));return;}
  event.respondWith(
    caches.match(event.request).then((cached)=>{
      if(cached) return cached;
      return fetch(event.request)
        .then((response)=>{
          if(!response || response.status!==200 || response.type==='opaque') return response;
          const copy=response.clone();
          caches.open(CACHE_NAME).then((cache)=>cache.put(event.request,copy));
          return response;
        })
        .catch(()=>{
          if(event.request.mode==='navigate') return caches.match('./index.html');
          return Response.error();
        });
    })
  );
});
