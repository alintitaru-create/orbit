/* ═══════════════════════════════════════════════════════════
   SETTORE DATI — modificare il viaggio dal telefono.

   Mostra il file dei dati in chiaro (quello che sul Mac è
   js/data.js), permette di correggerlo e lo rimanda su GitHub
   già ricifrato, usando la stessa chiave della password e lo
   stesso token delle foto.

   Appena il file cifrato arriva su GitHub, l'officina automatica
   (.github/workflows/rigenera.yml) rifà da sola anche la pagina
   dei cari. Nessun computer coinvolto.

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
      <p class="muted">Qui c'è il file che contiene tutto il viaggio: giornate, tratte, luoghi,
      prenotazioni. Modificarlo cambia entrambe le pagine. Il testo è codice: se sbagli una
      virgoletta il salvataggio si rifiuta di partire, senza combinare danni.</p>
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
      const pub=Sanifica.genera(esito.dati);
      if(pub.trovati.length){
        stato.textContent='Non pubblico: nella pagina dei cari finirebbe qualcosa di riservato ('+
                          pub.trovati.join(', ')+').';
        return;
      }
      b.disabled=true; stato.textContent='Richiudo i dati…';
      try{
        const b64=await this.cifra(ta.value);
        stato.textContent='Mando i dati su GitHub…';
        await Pubblica.scrivi('js/data.enc.js',
          btoa('/* Dati del viaggio cifrati (AES-256-GCM). Generato da tools/lock.mjs — non modificare a mano. */\n'+
               'const ORBIT_ENC="'+b64+'";\n'),
          'Dati aggiornati dal viaggio');
        stato.textContent='Aggiorno la pagina dei cari…';
        await Pubblica.scrivi('pubblico/dati.js',
          btoa(unescape(encodeURIComponent(pub.testo))),
          'Pagina dei cari aggiornata dal viaggio');
        globalThis.ORBIT_SRC=ta.value;
        stato.innerHTML=`Fatto: ${pub.conteggi.giornate} giornate e ${pub.conteggi.luoghi} luoghi, `+
          'senza dati riservati. Fra un paio di minuti sono aggiornate tutte e due le pagine.';
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
      ifr.contentWindow.eval(testo+`\n;window.__esito={${this.ATTESE.join(',')},`+
        `RISERVATI:typeof RISERVATI!=='undefined'?RISERVATI:[]};`);
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
    if(!Array.isArray(g.LEGS)||!g.LEGS.length) return {errore:'le tratte sono vuote'};
    const fuori=g.LEGS.filter(l=>l.day>=g.DAYS.length||!g.P[l.a]||!g.P[l.b]).length;
    if(fuori) return {errore:`${fuori} tratte puntano a giornate o luoghi che non esistono`};
    /* i dati validati servono anche a rifare la pagina dei cari */
    return {errore:null,dati:g};
  },

  /* richiude i dati con la stessa chiave e lo stesso sale del file attuale */
  async cifra(testo){
    /* si riaggiunge la riga che porta le costanti nello spazio globale,
       come fa tools/lock.mjs sul Mac */
    const nomi=[...testo.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
    const completo=testo+`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\n`+
                   `Object.assign(globalThis,{${nomi.join(',')}});\n`;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv},ORBIT_KEY,new TextEncoder().encode(completo)));
    const out=new Uint8Array(ORBIT_SALT.length+iv.length+ct.length);
    out.set(ORBIT_SALT,0); out.set(iv,ORBIT_SALT.length); out.set(ct,ORBIT_SALT.length+iv.length);
    let s='', C=0x8000;
    for(let i=0;i<out.length;i+=C) s+=String.fromCharCode.apply(null,out.subarray(i,i+C));
    return btoa(s);
  },
};
