/* ═══════════════════════════════════════════════════════════
   SETTORE AVVIO — ordine di accensione della pagina.
   Viene chiamato da boot.js quando i dati sono disponibili
   (in chiaro sul Mac, decifrati online dopo la password).
   ═══════════════════════════════════════════════════════════ */
async function startOrbit(){
  /* pannelli fissi: subito, funzionano anche senza rete */
  Legs.render();
  Sections.alloggi();
  Sections.soldi();
  Sections.app();
  Sections.pratico();
  Checklist.init();
  Money.init();
  Docs.init();
  Orn.init();

  /* giornate e card di oggi con le medie climatiche */
  Days.init();
  Sections.oggi();
  setInterval(()=>Sections.oggi(),60000); /* il countdown si aggiorna da solo */

  /* orologi nella testata */
  Clocks.init();

  /* pagina installabile e offline (solo quando è servita via https) */
  if('serviceWorker' in navigator&&location.protocol.startsWith('http'))
    navigator.serviceWorker.register('sw.js').catch(()=>{});

  /* mappa (richiede la libreria dal CDN) */
  OrbitMap.init();

  /* intro cinematografica: parte una volta per sessione */
  document.getElementById('skipIntro').onclick=()=>Cinematic.finish();
  document.getElementById('replayIntro').onclick=()=>Cinematic.replay();
  document.getElementById('docClose').onclick=()=>Docs.close();
  if(window.maplibregl&&Cinematic.shouldPlay()) Cinematic.start();

  /* meteo live, poi si aggiornano giornate e card di oggi */
  await Weather.load();
  Days.renderChips();
  Days.renderDetail();
  Sections.oggi();

  /* frecce ← → per cambiare giornata */
  addEventListener('keydown',e=>{
    if(e.key==='Escape'){ Cinematic.finish(); Docs.close(); return; }
    if(/INPUT|TEXTAREA/.test(e.target.tagName)) return;
    if(e.key==='ArrowRight') Days.select((Days.cur+1)%DAYS.length,true);
    if(e.key==='ArrowLeft')  Days.select((Days.cur-1+DAYS.length)%DAYS.length,true);
  });
}
