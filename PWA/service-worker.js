const CACHE_NAME='s2a-pilot-beta-1-6-layout6-app-shell';
const APP_SHELL=[
 './help-video.js?v=1.6.0-video1',
 './assets/help/es-create.png?v=1.6.0',
 './assets/help/es-cue.png?v=1.6.0',
 './assets/help/es-show.png?v=1.6.0',
 './assets/help/es-maverick.png?v=1.6.0',
 './assets/help/es-iceman.png?v=1.6.0',
 './assets/help/de-create.png?v=1.6.0',
 './assets/help/de-cue.png?v=1.6.0',
 './assets/help/de-show.png?v=1.6.0',
 './assets/help/de-maverick.png?v=1.6.0',
 './assets/help/de-iceman.png?v=1.6.0',
 './i18n-catalog.js?v=1.6.0-layout6', './manifest.es.webmanifest', './manifest.de.webmanifest',
 './Bridge/S2A-Pilot-Bridge-1.6.0-app.zip', './Bridge/app-files.json',
  './startup.js?v=1.6.0',
  './startup.css?v=1.6.0',
  './quick-help.js?v=1.6.0-layout6',
  './help-images.js?v=1.6.0',
  './quick-help.css?v=1.6.0-layout6',
  './assets/help/en-create.png?v=1.6.0',
  './assets/help/en-cue.png?v=1.6.0',
  './assets/help/en-show.png?v=1.6.0',
  './assets/help/en-maverick.png?v=1.6.0',
  './assets/help/en-iceman.png?v=1.6.0',
  './assets/help/fr-maverick.png?v=1.6.0',
  './assets/help/fr-iceman.png?v=1.6.0',
  './assets/help/fr-create.png?v=1.6.0',
  './assets/help/fr-cue.png?v=1.6.0',
  './assets/help/fr-show.png?v=1.6.0',
  './material-ui.js',
  './material-ui.css',
  './compat/polyfills.js?v=1.6.0',
  './compat/adapters.js?v=1.6.0',
  './compat/i18n.es5.js?v=1.6.0',
  './compat/app.es5.js?v=1.6.0-layout6',
  './compat/technical-preview.es5.js?v=1.6.0',
  './compat/compat-ui.css?v=1.6.0-layout6',
  './compat/conduite-header.jpg',
  './compat/technical-header-data.js?v=1.6.0',
  './',
  './index.html',
  './compatibility-loader.js?v=1.6.0-layout6',
  './app.js?v=1.6.0-layout6',
  './i18n.js?v=1.6.0',
  './technical-preview.js?v=1.6.0',
  './technical-header-data.js?v=1.6.0',
  './technical-qr-data.js?v=1.6.0',
  './assets/s2a-pilot-qr.png',
  './assets/s2a-pilot-qr.jpg',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.6.0-logo2',
  './icons/s2a-pilot-192.png?v=1.6.0-logo2',
  './icons/s2a-pilot-512.png?v=1.6.0-logo2',
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
        keys.filter((key)=>key!==CACHE_NAME && /^s2a-pilot-beta-/i.test(key)).map((key)=>caches.delete(key))
      ))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',(event)=>{
  if(event.request.method!=='GET') return;
  // Video is streamed on demand. Let the server handle Range/206 for playback and seeking.
  if(new URL(event.request.url).pathname.indexOf('/assets/tutorials/')!==-1)return;
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
