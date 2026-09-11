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
  CARTELLA:'sync',
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
  async elencoRemoto(){
    const b=await Pubblica.leggi(`${this.CARTELLA}/index.bin`);
    if(!b) return {v:1,items:[]};              /* non c'è ancora: prima volta */
    try{ return JSON.parse(new TextDecoder().decode(await this.apri(b))); }
    catch(e){
      /* l'elenco c'è ma non si apre: meglio fermarsi che ripartire da zero,
         perché ripartire da zero significherebbe ricaricare tutto sopra */
      throw new Error('l\'elenco delle foto non si apre: password diversa da quella usata per caricarle?');
    }
  },
  async salvaElenco(el){
    const dati=await this.chiudi(new TextEncoder().encode(JSON.stringify(el)));
    await Pubblica.scrivi(`${this.CARTELLA}/index.bin`,this.b64(dati),'Elenco foto aggiornato');
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
    const remoto=await this.elencoRemoto();
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
                         size:it.size,t:it.t,name:it.name||''});
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
      await Media.put({uid:x.uid,day:x.day,type:x.type,caption:x.caption||'',
                       name:x.name||'',size:chiaro.length,t:x.t||Date.now(),
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
      await this.salvaElenco(remoto);
    }
    return {caricate:daCaricare.length,scaricate,nonRiuscite,cambiate,troppoGrandi,
            totale:remoto.items.length};
  },

  /* ── il pannello ── */
  mount(day,root){
    const box=root.querySelector('.sync-box'); if(!box) return;
    if(!this.pronto()){ box.innerHTML=''; return; }
    box.innerHTML=`
      <b>Le stesse foto sui due telefoni</b>
      <p class="muted">Le manda cifrate con la vostra password: sul server restano illeggibili,
      e le riapre solo chi ha la password. Vale anche come copia di sicurezza.</p>
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
        const pezzi=[];
        if(r.caricate) pezzi.push(`${r.caricate} mandate`);
        if(r.scaricate) pezzi.push(`${r.scaricate} arrivate`);
        if(r.cambiate) pezzi.push(`${r.cambiate} didascalie allineate`);
        const messaggio=(pezzi.length?pezzi.join(', '):'Era già tutto in pari')+
          `. In tutto ${r.totale} element${r.totale===1?'o':'i'} al sicuro.`+
          (r.troppoGrandi?` ${r.troppoGrandi} troppo grandi, saltati.`:'')+
          (r.nonRiuscite?` ${r.nonRiuscite} non sono arrivate: riprova fra un minuto.`:'');
        if(r.scaricate) await Media.mount(day,root);
        scrivi(messaggio);
      }catch(e){ scrivi('Non ha funzionato: '+e.message); }
      const btn=root.querySelector('#syncVia'); if(btn) btn.disabled=false;
    };
  },
};
