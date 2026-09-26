/* ═══════════════════════════════════════════════════════════
   SETTORE SINCRONIZZAZIONE — le foto sui due telefoni.

   Le foto e i video stanno nella memoria del singolo telefono.
   Qui li si fa viaggiare attraverso GitHub, ma **cifrati** con
   la stessa chiave della password: sul repository finiscono
   file illeggibili, e solo chi ha la password li riapre.

   Serve anche da copia di sicurezza: se un telefono si perde,
   le foto si riscaricano sull'altro.

   Le cancellazioni non vengono propagate di proposito: se uno
   dei due cancella una foto, l'altro la tiene. Meglio una copia
   di troppo che una persa per sbaglio.
   ═══════════════════════════════════════════════════════════ */
const Sync={
  /* una cartella per viaggio: le foto del Kirghizistan non si
     mescolano con quelle del viaggio dopo */
  get CARTELLA(){ return Viaggio.cartellaSync(); },
  MAX:24*1024*1024,

  pronto(){ return typeof ORBIT_KEY!=='undefined'&&!!ORBIT_KEY
                 &&typeof Pubblica!=='undefined'&&!!Pubblica.token(); },

  /* ── cifratura, come per i documenti: iv davanti, poi il contenuto ── */
  async chiudi(buf){
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},ORBIT_KEY,buf));
    const out=new Uint8Array(12+ct.length); out.set(iv,0); out.set(ct,12);
    return out;
  },
  async apri(bytes){
    return new Uint8Array(await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:bytes.slice(0,12)},ORBIT_KEY,bytes.slice(12)));
  },
  b64(b){ let s='',C=0x8000; for(let i=0;i<b.length;i+=C) s+=String.fromCharCode.apply(null,b.subarray(i,i+C)); return btoa(s); },
  daB64(s){ return Uint8Array.from(atob(s.replace(/\n/g,'')),c=>c.charCodeAt(0)); },

  /* ── l'elenco, anch'esso cifrato: le didascalie sono cose vostre ── */
  async elencoRemoto(percorso,cosa){
    /* Prima la domanda giusta: l'elenco c'è o non c'è? Serve saperlo con
       certezza, non per esclusione. Un «non c'è» sbagliato — rete che cade,
       token scaduto, GitHub lento — farebbe ripartire da zero: l'elenco
       verrebbe riscritto con le sole foto di questo telefono, e quelle
       dell'altro resterebbero sul server senza più niente che le nomini,
       cioè irrecuperabili, anche se i file non sono stati cancellati. */
    const versione=await Pubblica.versione(percorso);
    if(versione===null) return {v:1,items:[],versione:null};   /* prima volta davvero */

    const b=await Pubblica.leggi(percorso);
    if(!b) throw new Error(`l'elenco ${cosa} c'è, ma non si riesce a scaricarlo: non tocco niente, riprova fra un minuto.`);
    let el=null;
    try{ el=JSON.parse(new TextDecoder().decode(await this.apri(b))); }catch(e){ el=null; }
    if(!el||!Array.isArray(el.items)){
      /* l'elenco c'è ma non si apre: meglio fermarsi che ripartire da zero,
         perché ripartire da zero significherebbe ricaricare tutto sopra */
      throw new Error(`l'elenco ${cosa} non si apre: password diversa da quella usata per caricarli?`);
    }
    el.versione=versione;
    return el;
  },
  async salvaElenco(el,percorso,messaggio){
    /* Dentro il file ci vanno solo v e items: `versione` è un appunto per
       la scrittura, non un dato da conservare (domani sarebbe già vecchio). */
    const dati=await this.chiudi(new TextEncoder().encode(
      JSON.stringify({v:el.v||1,items:el.items})));
    await Pubblica.scrivi(percorso,this.b64(dati),messaggio,el.versione);
  },

  /* ogni foto ha bisogno di un nome suo, valido su tutti i telefoni:
     i numeri interni ripartono da 1 su ogni dispositivo e si scontrerebbero */
  async conUid(items){
    for(const it of items){
      if(!it.uid){
        it.uid=(it.t||Date.now()).toString(36)+'-'+Math.random().toString(36).slice(2,8);
        await Media.put(it);
      }
    }
    return items;
  },

  /* ── il giro completo ── */
  async gira(dice){
    const say=t=>dice&&dice(t);
    if(!this.pronto()) throw new Error('Servono la password e la chiave di GitHub.');

    say('Guardo cosa c\'è già…');
    await Media.open();
    const locali=await this.conUid(await new Promise(res=>{
      const out=[],q=Media.tx('readonly').openCursor();
      q.onsuccess=e=>{const c=e.target.result; if(c){out.push(c.value);c.continue();} else res(out);};
      q.onerror=()=>res([]);
    }));
    const remoto=await this.elencoRemoto(`${this.CARTELLA}/index.bin`,'delle foto');
    const inRemoto=new Set(remoto.items.map(x=>x.uid));
    const inLocale=new Set(locali.map(x=>x.uid));

    /* 1. quello che c'è qui e non di là: si carica */
    const daCaricare=locali.filter(x=>!inRemoto.has(x.uid)&&x.size<=this.MAX);
    const troppoGrandi=locali.filter(x=>x.size>this.MAX).length;
    for(let i=0;i<daCaricare.length;i++){
      const it=daCaricare[i];
      say(`Carico ${i+1} di ${daCaricare.length}…`);
      const dati=await this.chiudi(await it.blob.arrayBuffer());
      await Pubblica.scrivi(`${this.CARTELLA}/${it.uid}.bin`,this.b64(dati),'Foto sincronizzata');
      remoto.items.push({uid:it.uid,day:it.day,type:it.type,caption:it.caption||'',
                         size:it.size,t:it.t,name:it.name||'',
                         /* dove è stata scattata: viaggia con la foto, così
                            anche l'altro telefono la vede sulla mappa */
                         ...(it.lat!=null?{lat:it.lat,lon:it.lon}:{}),
                         ...(it.alt!=null?{alt:it.alt}:{})});
    }

    /* 2. quello che c'è di là e non qui: si scarica */
    const daScaricare=remoto.items.filter(x=>!inLocale.has(x.uid));
    let scaricate=0, nonRiuscite=0;
    for(let i=0;i<daScaricare.length;i++){
      const x=daScaricare[i];
      say(`Scarico ${i+1} di ${daScaricare.length}…`);
      const b=await Pubblica.leggi(`${this.CARTELLA}/${x.uid}.bin`);
      if(!b){ nonRiuscite++; continue; }
      let chiaro;
      try{ chiaro=await this.apri(b); }catch(e){ nonRiuscite++; continue; }
      await Media.put({viaggio:Viaggio.id,uid:x.uid,day:x.day,type:x.type,caption:x.caption||'',
                       name:x.name||'',size:chiaro.length,t:x.t||Date.now(),
                       ...(x.lat!=null?{lat:x.lat,lon:x.lon}:{}),
                       ...(x.alt!=null?{alt:x.alt}:{}),
                       blob:new Blob([chiaro],{type:x.type==='video'?'video/mp4':'image/jpeg'})});
      scaricate++;   /* si contano quelle davvero salvate, non quelle tentate */
    }

    /* 3. didascalie: vince la più recente fra le due */
    let cambiate=0;
    for(const it of locali){
      const r=remoto.items.find(x=>x.uid===it.uid);
      if(r&&(r.caption||'')!==(it.caption||'')){
        if((it.mod||0)>=(r.mod||0)){ r.caption=it.caption||''; r.mod=it.mod||Date.now(); }
        else { it.caption=r.caption; await Media.put(it); }
        cambiate++;
      }
    }

    if(daCaricare.length||scaricate||cambiate){
      say('Aggiorno l\'elenco…');
      await this.salvaElenco(remoto,`${this.CARTELLA}/index.bin`,'Elenco foto aggiornato');
    }
    const foto={caricate:daCaricare.length,scaricate,nonRiuscite,cambiate,troppoGrandi,
                totale:remoto.items.length};
    /* stesso giro, altro deposito: i percorsi */
    const tracce=await this.giraTracce(say);
    return {...foto,tracce};
  },

  /* ═══ i percorsi ═══
     Stesse regole delle foto, altro deposito: si carica quello che qui
     c'è e di là no, si scarica il contrario, e le cancellazioni non si
     propagano — se uno dei due elimina un percorso, l'altro lo tiene.

     Differenza unica: un percorso è testo, non un file. Va cifrato
     com'è e riaperto come tale. Uno in registrazione non si manda: si
     aspetta che sia finito, altrimenti di là arriverebbe monco. */
  async giraTracce(dice){
    const say=t=>dice&&dice(t);
    if(typeof Tracce==='undefined') return {caricati:0,scaricati:0,nonRiusciti:0,cambiati:0,totale:0};
    const cartella=`${this.CARTELLA}/tracce`;

    await Tracce.open();
    const locali=(await new Promise(res=>{
      const out=[],q=Tracce.tx('readonly').openCursor();
      q.onsuccess=e=>{const c=e.target.result; if(c){out.push(c.value);c.continue();} else res(out);};
      q.onerror=()=>res([]);
    })).filter(t=>t.viaggio===Viaggio.id&&!t.aperta&&t.punti&&t.punti.length>1);

    say('Guardo i percorsi…');
    const remoto=await this.elencoRemoto(`${cartella}/index.bin`,'dei percorsi');
    const diLa=new Set(remoto.items.map(x=>x.uid));
    const diQua=new Set(locali.map(x=>x.uid));

    /* la scheda di un percorso, senza i punti: quelli stanno nel suo file */
    const scheda=t=>({uid:t.uid,day:t.day,nome:t.nome,tipo:t.tipo,fonte:t.fonte,
                      km:t.km,salita:t.salita,discesa:t.discesa,durata:t.durata,
                      quotaMax:t.quotaMax,quanti:t.punti.length,t:t.t,mod:t.mod||0});

    const daCaricare=locali.filter(t=>!diLa.has(t.uid));
    for(let i=0;i<daCaricare.length;i++){
      const t=daCaricare[i];
      say(`Mando il percorso ${i+1} di ${daCaricare.length}…`);
      const dati=await this.chiudi(new TextEncoder().encode(JSON.stringify(t.punti)));
      await Pubblica.scrivi(`${cartella}/${t.uid}.bin`,this.b64(dati),'Percorso sincronizzato');
      remoto.items.push(scheda(t));
    }

    const daScaricare=remoto.items.filter(x=>!diQua.has(x.uid));
    let scaricati=0, nonRiusciti=0;
    for(let i=0;i<daScaricare.length;i++){
      const x=daScaricare[i];
      say(`Scarico il percorso ${i+1} di ${daScaricare.length}…`);
      const b=await Pubblica.leggi(`${cartella}/${x.uid}.bin`);
      if(!b){ nonRiusciti++; continue; }
      let punti=null;
      try{ punti=JSON.parse(new TextDecoder().decode(await this.apri(b))); }catch(e){}
      if(!Array.isArray(punti)||punti.length<2){ nonRiusciti++; continue; }
      await Tracce.put({viaggio:Viaggio.id,uid:x.uid,day:x.day,nome:x.nome||'Percorso',
                        tipo:x.tipo||'foot',fonte:x.fonte||'importata',punti,
                        km:x.km,salita:x.salita,discesa:x.discesa,durata:x.durata,
                        quotaMax:x.quotaMax,t:x.t||Date.now(),mod:x.mod||0});
      scaricati++;
    }

    /* il nome: vince chi l'ha cambiato per ultimo */
    let cambiati=0;
    for(const t of locali){
      const r=remoto.items.find(x=>x.uid===t.uid);
      if(r&&(r.nome||'')!==(t.nome||'')){
        if((t.mod||0)>=(r.mod||0)){ r.nome=t.nome; r.mod=t.mod||Date.now(); }
        else { t.nome=r.nome; await Tracce.put(t); }
        cambiati++;
      }
    }

    if(daCaricare.length||scaricati||cambiati)
      await this.salvaElenco(remoto,`${cartella}/index.bin`,'Elenco percorsi aggiornato');
    return {caricati:daCaricare.length,scaricati,nonRiusciti,cambiati,totale:remoto.items.length};
  },

  /* ── il pannello ── */
  mount(day,root){
    const box=root.querySelector('.sync-box'); if(!box) return;
    if(!this.pronto()){ box.innerHTML=''; return; }
    box.innerHTML=`
      <b>Le stesse foto e gli stessi percorsi sui due telefoni</b>
      <p class="muted">Li manda cifrati con la vostra password: sul server restano illeggibili,
      e li riapre solo chi ha la password. Vale anche come copia di sicurezza.</p>
      <div class="pub-azioni"><button class="pill" id="syncVia">Sincronizza ora</button></div>
      <p class="sync-stato muted"></p>`;
    /* Il messaggio va scritto DOPO aver ridisegnato la griglia: rinfrescare
       le foto ricostruisce anche questo riquadro, e un messaggio scritto
       prima sparirebbe subito, facendo sembrare che non sia successo nulla. */
    const scrivi=t=>{ const el=root.querySelector('.sync-stato'); if(el) el.textContent=t; };
    box.querySelector('#syncVia').onclick=async ev=>{
      ev.target.disabled=true;
      try{
        const r=await this.gira(scrivi);
        const t=r.tracce||{};
        const pezzi=[];
        if(r.caricate) pezzi.push(`${r.caricate} foto mandate`);
        if(r.scaricate) pezzi.push(`${r.scaricate} foto arrivate`);
        if(r.cambiate) pezzi.push(`${r.cambiate} didascalie allineate`);
        if(t.caricati) pezzi.push(`${t.caricati} percors${t.caricati===1?'o mandato':'i mandati'}`);
        if(t.scaricati) pezzi.push(`${t.scaricati} percors${t.scaricati===1?'o arrivato':'i arrivati'}`);
        const messaggio=(pezzi.length?pezzi.join(', '):'Era già tutto in pari')+
          `. In tutto ${r.totale} foto`+(t.totale?` e ${t.totale} percors${t.totale===1?'o':'i'}`:'')+
          ' al sicuro.'+
          (r.troppoGrandi?` ${r.troppoGrandi} troppo grandi, saltati.`:'')+
          (r.nonRiuscite?` ${r.nonRiuscite} foto non sono arrivate: riprova fra un minuto.`:'')+
          (t.nonRiusciti?` ${t.nonRiusciti} percorsi non sono arrivati: riprova fra un minuto.`:'');
        if(r.scaricate) await Media.mount(day,root);
        if(t.scaricati){
          /* il pannello dei percorsi è un'altra scheda della stessa
             giornata, non sta dentro questa: si cerca nella pagina */
          const pane=document.querySelector('.pane[data-t="percorso"]');
          if(pane&&typeof Tracce!=='undefined') Tracce.pannello(day,pane);
          if(typeof OrbitMap!=='undefined'&&OrbitMap.ready) OrbitMap.mostraTracce(day);
        }
        scrivi(messaggio);
      }catch(e){ scrivi('Non ha funzionato: '+e.message); }
      const btn=root.querySelector('#syncVia'); if(btn) btn.disabled=false;
    };
  },
};
