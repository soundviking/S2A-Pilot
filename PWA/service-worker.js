const CACHE_NAME='s2a-pilot-beta-1-6-23-bridge-top-order1-app-shell';
const APP_SHELL=[
 './copilot-assets/copilot-logo.png',
 './zip-assets/pako_inflate.min.js?v=2.1.0',
 './copilot-host.js?v=1.6.23-bridge-top-order1', './copilot-assets/qrcode.js?v=1.6.23-bridge-top-order1',
 './help-video.js?v=1.6.4-video1',
 './assets/help/es-create.png?v=1.6.4',
 './assets/help/es-cue.png?v=1.6.4',
 './assets/help/es-show.png?v=1.6.4',
 './assets/help/es-maverick.png?v=1.6.4',
 './assets/help/es-iceman.png?v=1.6.4',
 './assets/help/de-create.png?v=1.6.4',
 './assets/help/de-cue.png?v=1.6.4',
 './assets/help/de-show.png?v=1.6.4',
 './assets/help/de-maverick.png?v=1.6.4',
 './assets/help/de-iceman.png?v=1.6.4',
 './i18n-catalog.js?v=1.6.23-bridge-top-order1', './manifest.es.webmanifest', './manifest.de.webmanifest',
 './Bridge/S2A-Pilot-Bridge-1.6.4-app.zip', './Bridge/app-files.json',
  './startup.js?v=1.6.23-bridge-top-order1',
  './startup.css?v=1.6.4',
  './quick-help.js?v=1.6.23-bridge-top-order1',
  './help-images.js?v=1.6.4',
  './quick-help.css?v=1.6.23-bridge-top-order1',
  './assets/help/en-create.png?v=1.6.4',
  './assets/help/en-cue.png?v=1.6.4',
  './assets/help/en-show.png?v=1.6.4',
  './assets/help/en-maverick.png?v=1.6.4',
  './assets/help/en-iceman.png?v=1.6.4',
  './assets/help/fr-maverick.png?v=1.6.4',
  './assets/help/fr-iceman.png?v=1.6.4',
  './assets/help/fr-create.png?v=1.6.4',
  './assets/help/fr-cue.png?v=1.6.4',
  './assets/help/fr-show.png?v=1.6.4',
  './material-ui.js?v=1.6.4-qr2',
  './material-ui.css',
  './compat/polyfills.js?v=1.6.4',
  './compat/adapters.js?v=1.6.4',
  './compat/i18n.es5.js?v=1.6.4',
  './compat/app.es5.js?v=1.6.23-bridge-top-order1',
  './compat/technical-preview.es5.js?v=1.6.4',
  './compat/compat-ui.css?v=1.6.23-bridge-top-order1',
  './compat/conduite-header.jpg',
  './compat/technical-header-data.js?v=1.6.4',
  './',
  './index.html',
  './compatibility-loader.js?v=1.6.23-bridge-top-order1',
  './app.js?v=1.6.23-bridge-top-order1',
  './i18n.js?v=1.6.4',
  './technical-preview.js?v=1.6.4',
  './technical-header-data.js?v=1.6.4',
  './technical-qr-data.js?v=1.6.4',
  './assets/s2a-pilot-qr.png',
  './assets/s2a-pilot-qr.jpg',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.6.23-bridge-top-order1',
  './icons/s2a-pilot-192.png?v=1.6.23-bridge-top-order1',
  './icons/s2a-pilot-512.png?v=1.6.23-bridge-top-order1',
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
  // Copilot PHP diagnostics and relay must never use the Pilot offline shell/cache.
  const requestUrl=new URL(event.request.url),appScope=new URL(self.registration.scope);
  if(requestUrl.origin!==appScope.origin)return;
  const relativePath=requestUrl.pathname.slice(appScope.pathname.length);
  if(requestUrl.pathname.startsWith(appScope.pathname)&&/^(copilot-test|copilot)(\/|$)/.test(relativePath))return;
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
