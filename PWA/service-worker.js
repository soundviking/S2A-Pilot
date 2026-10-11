const CACHE_NAME='s2a-pilot-v1-5-5-app-shell';
const APP_SHELL=[
 './companion/S2A-Pilot-Bridge-1.3.2-app.zip', './companion/app-files.json',
  './startup.js?v=1.5.5',
  './startup.css?v=1.5.5',
  './quick-help.js?v=1.5.5',
  './help-images.js?v=1.5.5',
  './quick-help.css?v=1.5.5',
  './assets/help/en-create.png?v=1.5.5',
  './assets/help/en-cue.png?v=1.5.5',
  './assets/help/en-show.png?v=1.5.5',
  './assets/help/en-maverick.png?v=1.5.5',
  './assets/help/en-iceman.png?v=1.5.5',
  './assets/help/fr-maverick.png?v=1.5.5',
  './assets/help/fr-iceman.png?v=1.5.5',
  './assets/help/fr-create.png?v=1.5.5',
  './assets/help/fr-cue.png?v=1.5.5',
  './assets/help/fr-show.png?v=1.5.5',
  './material-ui.js',
  './material-ui.css',
  './compat/polyfills.js?v=1.5.5',
  './compat/adapters.js?v=1.5.5',
  './compat/i18n.es5.js?v=1.5.5',
  './compat/app.es5.js?v=1.5.5',
  './compat/technical-preview.es5.js?v=1.5.5',
  './compat/compat-ui.css?v=1.5.5',
  './compat/conduite-header.jpg',
  './compat/technical-header-data.js?v=1.5.5',
  './',
  './index.html',
  './compatibility-loader.js?v=1.5.5',
  './app.js?v=1.5.5',
  './i18n.js?v=1.5.5',
  './technical-preview.js?v=1.5.5',
  './technical-header-data.js?v=1.5.5',
  './technical-qr-data.js?v=1.5.5',
  './assets/s2a-pilot-qr.png',
  './assets/s2a-pilot-qr.jpg',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.5.5',
  './icons/s2a-pilot-192.png?v=1.5.5',
  './icons/s2a-pilot-512.png?v=1.5.5',
  './manifest.webmanifest',
  './manifest.en.webmanifest',
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
