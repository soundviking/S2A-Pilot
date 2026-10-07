const CACHE_NAME='s2a-pilot-v1-4-54-app-shell';
const APP_SHELL=[
  './quick-help.js',
  './help-images.js',
  './quick-help.css',
  './assets/help/en-create.png',
  './assets/help/en-cue.png',
  './assets/help/en-show.png',
  './assets/help/fr-create.png',
  './assets/help/fr-cue.png',
  './assets/help/fr-show.png',
  './assets/help/legacy-en-create.png',
  './assets/help/legacy-en-cue.png',
  './assets/help/legacy-en-show.png',
  './assets/help/legacy-fr-create.png',
  './assets/help/legacy-fr-cue.png',
  './assets/help/legacy-fr-show.png',
  './material-ui.js',
  './material-ui.css',
  './compat/polyfills.js?v=1.4.54',
  './compat/adapters.js?v=1.4.54',
  './compat/i18n.es5.js?v=1.4.54',
  './compat/app.es5.js?v=1.4.54',
  './compat/technical-preview.es5.js?v=1.4.54',
  './compat/compat-ui.css?v=1.4.54',
  './compat/conduite-header.jpg',
  './compat/technical-header-data.js?v=1.4.54',
  './',
  './index.html',
  './compatibility-loader.js?v=1.4.54',
  './legacy/index.html',
  './legacy/legacy.js?v=1.4.54',
  './app.js?v=1.4.54',
  './i18n.js?v=1.4.54',
  './technical-preview.js?v=1.4.54',
  './technical-header-data.js?v=1.4.54',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.4.54',
  './icons/s2a-pilot-192.png?v=1.4.54',
  './icons/s2a-pilot-512.png?v=1.4.54',
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
