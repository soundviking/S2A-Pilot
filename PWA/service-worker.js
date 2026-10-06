const CACHE_NAME='s2a-pilot-v1-4-43-app-shell';
const APP_SHELL=[
  './',
  './index.html',
  './compatibility-loader.js?v=1.4.44',
  './legacy/index.html',
  './legacy/legacy.js?v=1.4.44',
  './app.js?v=1.4.44',
  './i18n.js?v=1.4.44',
  './technical-preview.js?v=1.4.44',
  './technical-header-data.js?v=1.4.44',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.4.44',
  './icons/s2a-pilot-192.png?v=1.4.44',
  './icons/s2a-pilot-512.png?v=1.4.44',
  './manifest.webmanifest',
  './manifest.en.webmanifest',
  './companion/S2A-Copilote-1.2.10-app.zip',
  './companion/app-files.json',
  './icons/s2a-pilot-192.png',
  './icons/s2a-pilot-512.png'
];

self.addEventListener('install',(event)=>{
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache)=>cache.addAll(APP_SHELL.map(path=>new Request(path,{cache:'reload'}))))
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
  if(event.request.mode==='navigate'){
    event.respondWith(fetch(event.request,{cache:'no-store'}).then(response=>{if(!response.ok)throw new Error('Page indisponible');return response;}).catch(()=>caches.open(CACHE_NAME).then(cache=>cache.match(event.request,{ignoreSearch:true}).then(cached=>cached||cache.match('./index.html')))));return;
  }
  event.respondWith(
    caches.open(CACHE_NAME).then(cache=>cache.match(event.request)).then((cached)=>{
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
