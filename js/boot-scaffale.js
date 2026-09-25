/* ═══════════════════════════════════════════════════════════
   SETTORE AVVIO DELLO SCAFFALE — accende la prima schermata.

   Sul Mac l'elenco in chiaro c'è già e non si chiede niente.
   Online c'è solo viaggi/index.enc.js: si chiede la password una
   volta per dispositivo, si decifra e si mostra lo scaffale.
   La stessa password apre poi ogni viaggio, senza richiederla.
   ═══════════════════════════════════════════════════════════ */
(async function(){
  await Migra.tutto();

  const mostra=()=>{ Scaffale.render(); Idee.render(); };
  const dillo=t=>{ document.getElementById('scaffale').innerHTML=`<p class="vuoto">${t}</p>`; };

  /* l'elenco: in chiaro se siamo sul Mac, cifrato sempre.
     Servono tutti e due: dal cifrato si prende il sale della chiave. */
  const chiaro=await Chiave.script('viaggi/index.js');
  await Chiave.script('viaggi/index.enc.js');

  if(chiaro) return mostra();

  if(typeof ORBIT_INDICE==='undefined')
    return dillo('L\'elenco dei viaggi non si carica. Sul Mac si rifà con: node tools/lock.mjs');

  const testa=Chiave.b64(ORBIT_INDICE);
  await Chiave.porta({
    salt:testa.slice(0,16),
    prova:async key=>{ Chiave.esegui(await Chiave.apri(testa.slice(16),key)); },
    pronto:mostra,
  });
})();
