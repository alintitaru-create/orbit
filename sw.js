/* ═══════════════════════════════════════════════════════════
   SETTORE OFFLINE — service worker. Attivo solo quando la
   pagina è servita via https (GitHub Pages). Regole:
   - file dell'app e libreria mappa: cache con aggiornamento
     in background (dopo la prima visita funziona offline)
   - tile CARTO: cache man mano che si naviga (mai gli Esri,
     per licenza)
   - meteo, cambi, Wikipedia, rotte: prima la rete, poi la
     cache come riserva
   ═══════════════════════════════════════════════════════════ */
const SHELL='orbit-shell-v4', TILES='orbit-tiles', DATA='orbit-data';
const PRECACHE=['./','./index.html','./manifest.webmanifest','./icon.png',
 './css/tokens.css','./css/base.css','./css/components.css','./css/sections.css',
 './js/data.enc.js','./js/util.js','./js/clocks.js','./js/weather.js','./js/days.js',
 './js/legs.js','./js/map.js','./js/sections.js','./js/checklist.js','./js/money.js',
 './js/main.js','./js/boot.js',
 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.min.js',
 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/5.12.0/maplibre-gl.css'];

self.addEventListener('install',e=>{
  e.waitUntil(caches.open(SHELL).then(c=>Promise.allSettled(PRECACHE.map(u=>c.add(u)))));
  self.skipWaiting();
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(
    ks.filter(k=>k.startsWith('orbit-shell-')&&k!==SHELL).map(k=>caches.delete(k)))));
  self.clients.claim();
});

const isTile=u=>/cartocdn\.com|arcgisonline\.com/.test(u);
const isData=u=>/open-meteo\.com|er-api\.com|wikipedia\.org|wikimedia\.org|project-osrm\.org/.test(u);

self.addEventListener('fetch',e=>{
  const u=e.request.url;
  if(e.request.method!=='GET') return;
  if(isTile(u)){ /* cache-first, ma mai salvare i tile Esri */
    e.respondWith(caches.open(TILES).then(async c=>{
      const hit=await c.match(u); if(hit) return hit;
      try{
        const r=await fetch(e.request);
        if(r.ok&&!/arcgisonline/.test(u)) c.put(u,r.clone());
        return r;
      }catch(err){ return new Response('',{status:504}); }
    }));
    return;
  }
  if(isData(u)){ /* network-first con riserva in cache */
    e.respondWith(fetch(e.request).then(r=>{
      if(r.ok) caches.open(DATA).then(c=>c.put(u,r.clone()));
      return r;
    }).catch(()=>caches.match(u)));
    return;
  }
  /* app: cache subito, aggiornamento in background */
  e.respondWith(caches.open(SHELL).then(async c=>{
    const hit=await c.match(e.request);
    const net=fetch(e.request).then(r=>{ if(r.ok) c.put(e.request,r.clone()); return r; }).catch(()=>hit);
    return hit||net;
  }));
});
