const CACHE_NAME='s2a-pilot-v1-5-2-app-shell';
const APP_SHELL=[
 './copilot.html', './copilot-ui.css', './compat/copilot.es5.js', './copilot/qrcode.js', './icons/s2a-copilot-192.png',
  './startup.js?v=1.5.2',
  './startup.css?v=1.5.2',
  './quick-help.js?v=1.5.2',
  './help-images.js?v=1.5.2',
  './quick-help.css?v=1.5.2',
  './assets/help/en-create.png?v=1.5.2',
  './assets/help/en-cue.png?v=1.5.2',
  './assets/help/en-show.png?v=1.5.2',
  './assets/help/en-maverick.png?v=1.5.2',
  './assets/help/en-iceman.png?v=1.5.2',
  './assets/help/fr-maverick.png?v=1.5.2',
  './assets/help/fr-iceman.png?v=1.5.2',
  './assets/help/fr-create.png?v=1.5.2',
  './assets/help/fr-cue.png?v=1.5.2',
  './assets/help/fr-show.png?v=1.5.2',
  './material-ui.js',
  './material-ui.css',
  './compat/polyfills.js?v=1.5.2',
  './compat/adapters.js?v=1.5.2',
  './compat/i18n.es5.js?v=1.5.2',
  './compat/app.es5.js?v=1.5.2',
  './compat/technical-preview.es5.js?v=1.5.2',
  './compat/compat-ui.css?v=1.5.2',
  './compat/conduite-header.jpg',
  './compat/technical-header-data.js?v=1.5.2',
  './',
  './index.html',
  './compatibility-loader.js?v=1.5.2',
  './app.js?v=1.5.2',
  './i18n.js?v=1.5.2',
  './technical-preview.js?v=1.5.2',
  './technical-header-data.js?v=1.5.2',
  './technical-qr-data.js?v=1.5.2',
  './assets/s2a-pilot-qr.png',
  './assets/s2a-pilot-qr.jpg',
  './assets/conduite-header.webp',
  './icons/s2a-pilot-180.png?v=1.5.2',
  './icons/s2a-pilot-192.png?v=1.5.2',
  './icons/s2a-pilot-512.png?v=1.5.2',
  './manifest.webmanifest',
  './manifest.en.webmanifest',
  './companion/S2A-Pilot-Bridge-1.3.1-app.zip',
  './companion/app-files.json',
  './companion/app-files.json?v=1.3.1',
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
 if(new URL(event.request.url).pathname.includes('/api/')||new URL(event.request.url).pathname.endsWith('/bridge-state'))return;
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
