/* ═══════════════════════════════════════════════════════════
   SETTORE DATI — modificare il viaggio dal telefono.

   Mostra il file dei dati in chiaro del viaggio aperto (quello che
   sul Mac è viaggi/<id>/data.js), permette di correggerlo e lo
   rimanda su GitHub già ricifrato, usando la stessa chiave della
   password e lo stesso token delle foto.

   Nello stesso salvataggio viene rifatta anche la pagina dei cari,
   ma solo se è questo il viaggio pubblicato: altrimenti si
   sostituirebbe il viaggio che i parenti stanno guardando.

   Prima di salvare il testo viene controllato: se non è codice
   valido, o se manca una delle costanti attese, non parte nulla.
   ═══════════════════════════════════════════════════════════ */
const Dati={
  ATTESE:['P','LEGS','DAYS','POIS','WAYPTS','BOOKINGS','BUDGET','APPS','DOCS','PRATICO','CHECKLISTS'],

  disponibile(){ return typeof ORBIT_KEY!=='undefined'&&!!ORBIT_KEY&&typeof ORBIT_SRC==='string'; },

  mount(){
    const sez=document.getElementById('dati');
    if(!this.disponibile()){ sez.hidden=true; return; }
    sez.hidden=false;
    const box=document.getElementById('datiBox');
    box.innerHTML=`
      <p class="muted">Qui c'è il file che contiene tutto questo viaggio: giornate, tratte, luoghi,
      prenotazioni. Il testo è codice: se sbagli una virgoletta il salvataggio si rifiuta di
      partire, senza combinare danni.</p>
      <textarea class="dati-testo" spellcheck="false" rows="16"></textarea>
      <div class="dati-azioni">
        <button class="pill on" id="datiSalva">Salva e pubblica</button>
        <button class="pill" id="datiRipristina">Annulla le modifiche</button>
        <span class="muted" id="datiInfo"></span>
      </div>
      <p class="dati-stato muted"></p>`;

    const ta=box.querySelector('.dati-testo');
    const info=box.querySelector('#datiInfo');
    const stato=box.querySelector('.dati-stato');
    ta.value=ORBIT_SRC;
    const conta=()=>info.textContent=`${ta.value.length.toLocaleString('it')} caratteri`;
    conta(); ta.oninput=conta;

    box.querySelector('#datiRipristina').onclick=()=>{ ta.value=ORBIT_SRC; conta(); stato.textContent=''; };
    box.querySelector('#datiSalva').onclick=async ev=>{
      const b=ev.target;
      const esito=this.controlla(ta.value);
      if(esito.errore){ stato.textContent='Non salvo: '+esito.errore; return; }
      if(typeof Pubblica==='undefined'||!Pubblica.token()){
        stato.innerHTML='Serve prima la chiave di GitHub: la trovi nella scheda <b>Diario</b> di una giornata.';
        return;
      }
      /* la pagina dei cari si rifà con la stessa ripulitura del computer;
         se ne esce qualcosa di riservato non si pubblica niente */
      const d=esito.dati;
      const cari=!!Viaggio.meta?.pubblicato;
      let pub=null;
      if(cari){
        pub=Sanifica.genera(d.P,d.LEGS,d.DAYS,d.POIS,d.WAYPTS);
        if(pub.trovati.length){
          stato.textContent='Non pubblico: nella pagina dei cari finirebbe qualcosa di riservato ('+
                            pub.trovati.join(', ')+').';
          return;
        }
      }
      b.disabled=true; stato.textContent='Richiudo i dati…';
      try{
        const b64=await Chiave.cifra(ta.value,{});
        stato.textContent='Mando i dati su GitHub…';
        await Pubblica.scrivi(Viaggio.file('data.enc.js'),
          btoa(Chiave.fileJs(b64,'ORBIT_DATI')),
          `Dati aggiornati: ${Viaggio.nome()}`);
        if(cari){
          stato.textContent='Aggiorno la pagina dei cari…';
          await Pubblica.scrivi('pubblico/dati.js',
            btoa(unescape(encodeURIComponent(pub.testo+
              `\nconst VIAGGIO_ID=${JSON.stringify(Viaggio.id)};\n`+
              `const VIAGGIO_NOME=${JSON.stringify(Viaggio.nome())};\n`))),
            'Pagina dei cari aggiornata dal viaggio');
        }
        globalThis.ORBIT_SRC=ta.value;
        stato.innerHTML=cari
          ? `Fatto: ${pub.conteggi.giornate} giornate e ${pub.conteggi.luoghi} luoghi, senza dati `+
            'riservati. Fra un paio di minuti sono aggiornate tutte e due le pagine.'
          : 'Fatto. Fra un paio di minuti la pagina è aggiornata. '+
            'La pagina dei cari non l\'ho toccata: mostra un altro viaggio.';
      }catch(e){ stato.textContent='Non ha funzionato: '+e.message; }
      b.disabled=false;
    };
  },

  /* Il testo regge? Ci sono tutte le costanti che servono?
     Si prova dentro una finestrella separata e poi la si butta: se si
     usasse questa pagina, le costanti già caricate coprirebbero quelle
     eventualmente cancellate e il controllo direbbe che va tutto bene. */
  controlla(testo){
    const ifr=document.createElement('iframe');
    ifr.style.display='none'; ifr.src='about:blank';
    document.body.appendChild(ifr);
    let g;
    try{
      ifr.contentWindow.eval(testo+`\n;window.__esito={${this.ATTESE.join(',')}};`);
      g=ifr.contentWindow.__esito;
    }catch(e){
      const m=String(e.message);
      return {errore:/is not defined/.test(m)
        ? 'manca '+m.replace(/ is not defined.*/,'')
        : 'il testo non è codice valido ('+m.slice(0,80)+')'};
    }finally{ ifr.remove(); }
    if(!g) return {errore:'il testo non produce i dati attesi'};
    const mancano=this.ATTESE.filter(n=>g[n]===undefined);
    if(mancano.length) return {errore:'mancano '+mancano.join(', ')};
    if(!Array.isArray(g.DAYS)||!g.DAYS.length) return {errore:'le giornate sono vuote'};
    /* le tratte possono non esserci ancora: un viaggio da programmare
       comincia con le sole giornate */
    if(!Array.isArray(g.LEGS)) return {errore:'le tratte non sono un elenco'};
    const fuori=g.LEGS.filter(l=>l.day>=g.DAYS.length||!g.P[l.a]||!g.P[l.b]).length;
    if(fuori) return {errore:`${fuori} tratte puntano a giornate o luoghi che non esistono`};
    /* i dati validati servono anche a rifare la pagina dei cari */
    return {errore:null,dati:g};
  },

};
