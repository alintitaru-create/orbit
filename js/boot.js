/* ═══════════════════════════════════════════════════════════
   SETTORE AVVIO DEL VIAGGIO — apre un viaggio e accende la pagina.

   Quale viaggio lo dice l'indirizzo: viaggio.html?v=kg2026.
   Senza indicazioni si apre quello giusto per oggi — quello in
   corso, se no il prossimo, se no l'ultimo ricordo.

   Sul Mac i dati in chiaro ci sono e si parte subito. Online c'è
   solo il cifrato: si passa dalla porta (js/chiave.js), si decifra
   prima l'elenco e poi il viaggio scelto, e si parte.
   ═══════════════════════════════════════════════════════════ */
(function(){

  const dillo=(testo,dettaglio)=>{
    document.getElementById('oggi-card').innerHTML=
      `<div class="today-date">Niente da mostrare</div><h3>${testo}</h3>`+
      (dettaglio?`<p class="lead">${dettaglio}</p>`:'')+
      `<p style="margin-top:16px"><a href="index.html">Torna allo scaffale →</a></p>`;
  };

  /* quale viaggio: quello chiesto, se esiste; se no il primo dello scaffale */
  function scelto(){
    const id=new URLSearchParams(location.search).get('v');
    return (id&&Viaggi.trova(id))||Viaggi.ordinati()[0]||null;
  }

  /* i dati del viaggio: prima in chiaro (Mac), poi cifrati (online) */
  async function caricaDati(id){
    if(await Chiave.script(`viaggi/${id}/data.js`)) return 'chiaro';
    if(await Chiave.script(`viaggi/${id}/data.enc.js`)) return 'cifrato';
    return null;
  }

  /* testata: nome del viaggio, periodo e i suoi numeri */
  function intestazione(v){
    const s=Viaggi.stat(v.id);
    const pezzi=[Viaggi.periodo(v)];
    if(s.giorni) pezzi.push(`${s.giorni} giorni`);
    if(s.km) pezzi.push(`${s.km.toLocaleString('it')} km`);
    document.title='Orbit — '+v.nome;
    document.getElementById('titolo').innerHTML=
      v.nome.replace(/ e /,'<br>e ')+'.'+
      `<small>${pezzi.filter(Boolean).join(' · ')}</small>`;
    document.body.dataset.fase=Viaggi.fase(v);
  }

  async function parti(v,tipo){
    Viaggio.apri(v.id,v);
    if(tipo==='cifrato')
      globalThis.ORBIT_SRC=Chiave.esegui(await Chiave.apri(Chiave.b64(ORBIT_DATI)));
    intestazione(v);
    startOrbit();
  }

  (async function(){
    await Migra.tutto();

    /* l'elenco dei viaggi: in chiaro se siamo sul Mac, cifrato sempre.
       Servono tutti e due: dal cifrato si prende il sale della chiave. */
    const chiaro=await Chiave.script('viaggi/index.js');
    await Chiave.script('viaggi/index.enc.js');

    if(chiaro){
      const v=scelto();
      if(!v) return dillo('Nell\'elenco non c\'è nessun viaggio.');
      const tipo=await caricaDati(v.id);
      if(tipo==='chiaro') return parti(v,tipo);      /* sul Mac non si chiede niente */
      if(!tipo) return dillo('I dati di questo viaggio non ci sono.',
        `Manca la cartella viaggi/${v.id}. Sul Mac si rifà con: node tools/unlock.mjs`);
    }

    if(typeof ORBIT_INDICE==='undefined')
      return dillo('L\'elenco dei viaggi non si carica.',
        'Manca viaggi/index.enc.js. Sul Mac si rifà con: node tools/lock.mjs');

    /* online: la password apre prima l'elenco, poi il viaggio */
    const testa=Chiave.b64(ORBIT_INDICE);
    await Chiave.porta({
      salt:testa.slice(0,16),
      prova:async key=>{ Chiave.esegui(await Chiave.apri(testa.slice(16),key)); },
      pronto:async()=>{
        const v=scelto();
        if(!v) return dillo('Nell\'elenco non c\'è nessun viaggio.');
        const tipo=await caricaDati(v.id);
        if(!tipo) return dillo('I dati di questo viaggio non ci sono.');
        parti(v,tipo);
      },
    });
  })();
})();
