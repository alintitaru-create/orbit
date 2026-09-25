/* ═══════════════════════════════════════════════════════════
   SETTORE FOTO E VIDEO — le immagini e i filmati vostri,
   uno spazio per ogni giornata, dentro la scheda Diario.

   Stanno in IndexedDB, non in localStorage: le foto vengono
   ridotte a 1600 px e salvate come file veri (Blob), i video
   restano come sono. Così ci sta molta più roba dei 5 MB
   scarsi che regge localStorage.

   Attenzione: è la memoria del browser, non un backup. Le foto
   vanno comunque tenute nel rullino del telefono.
   ═══════════════════════════════════════════════════════════ */
const Media={
  db:null, urls:[], day:null,

  /* ── deposito ──
     Versione 2: ogni foto porta il nome del viaggio. Quelle già
     depositate sono del Kirghizistan, l'unico viaggio che ci fosse
     prima dello scaffale: le marca il passaggio qui sotto, dentro la
     stessa operazione di apertura, così non restano mai orfane. */
  open(){
    if(this.db) return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      const r=indexedDB.open('orbit-media',2);
      r.onupgradeneeded=()=>{
        const db=r.result, tx=r.transaction;
        const s=db.objectStoreNames.contains('m')?tx.objectStore('m')
               :db.createObjectStore('m',{keyPath:'id',autoIncrement:true});
        if(!s.indexNames.contains('day')) s.createIndex('day','day');
        if(!s.indexNames.contains('viaggio')){
          s.createIndex('viaggio','viaggio');
          s.openCursor().onsuccess=e=>{
            const c=e.target.result; if(!c) return;
            if(!c.value.viaggio){ c.value.viaggio=(typeof Migra!=='undefined'?Migra.PRIMO:'kg2026'); c.update(c.value); }
            c.continue();
          };
        }
      };
      r.onsuccess=()=>{ this.db=r.result; res(this.db); };
      r.onerror=()=>rej(r.error);
    });
  },
  tx(mode){ return this.db.transaction('m',mode).objectStore('m'); },
  viaggio(){ return typeof Viaggio!=='undefined'&&Viaggio.id?Viaggio.id:'kg2026'; },
  async all(day){
    await this.open();
    const v=this.viaggio();
    return new Promise(res=>{
      const out=[], q=this.tx('readonly').index('day').openCursor(IDBKeyRange.only(day));
      q.onsuccess=e=>{ const c=e.target.result;
        if(c){ if((c.value.viaggio||'kg2026')===v) out.push(c.value); c.continue(); } else res(out); };
      q.onerror=()=>res([]);
    });
  },
  async put(rec){ await this.open(); return new Promise((res,rej)=>{
    const r=this.tx('readwrite').put(rec); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async del(id){ await this.open(); return new Promise(res=>{
    const r=this.tx('readwrite').delete(id); r.onsuccess=res; r.onerror=res; }); },
  async get(id){ await this.open(); return new Promise(res=>{
    const r=this.tx('readonly').get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }); },

  peso(b){ return b<1048576?Math.max(1,Math.round(b/1024))+' KB':(b/1048576).toFixed(1)+' MB'; },

  /* ── riduce una foto prima di salvarla ── */
  async shrink(file){
    const MAX=1600;
    try{
      const bmp=await createImageBitmap(file);
      const s=Math.min(1,MAX/Math.max(bmp.width,bmp.height));
      if(s===1&&file.size<900000) return file;      /* già piccola: si tiene com'è */
      const c=document.createElement('canvas');
      c.width=Math.round(bmp.width*s); c.height=Math.round(bmp.height*s);
      c.getContext('2d').drawImage(bmp,0,0,c.width,c.height);
      bmp.close?.();
      return await new Promise(r=>c.toBlob(r,'image/jpeg',.82));
    }catch(e){ return file; }
  },

  /* ── aggiunge i file scelti ──
     Le coordinate si leggono dal file ORIGINALE, prima di
     rimpicciolirlo: shrink() ridisegna la foto su una tela, e la tela
     porta con sé solo i pixel. Dopo non c'è più niente da leggere. */
  async addFiles(day,files,onProgress){
    let n=0;
    for(const f of files){
      const video=f.type.startsWith('video');
      const dove=video?null:await Exif.posizione(f);
      const blob=video?f:await this.shrink(f);
      await this.put({viaggio:this.viaggio(),day,type:video?'video':'foto',blob,name:f.name,
                      ...(dove||{}),
                      size:blob.size,caption:'',t:Date.now(),
                      /* nome valido su tutti i telefoni: i numeri interni
                         ripartono da 1 su ogni dispositivo e si scontrerebbero */
                      uid:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8)});
      onProgress&&onProgress(++n,files.length);
    }
    /* chiede al browser di non buttare via i ricordi alla prima pulizia */
    try{ navigator.storage?.persist?.(); }catch(e){}
  },

  /* ── disegna la griglia dentro la scheda Diario ── */
  async mount(day,root){
    this.day=day;
    this.urls.forEach(u=>URL.revokeObjectURL(u)); this.urls=[];
    const grid=root.querySelector('.media-grid'); if(!grid) return;
    const items=(await this.all(day)).sort((a,b)=>a.t-b.t);
    if(this.day!==day) return;                       /* giornata cambiata nel frattempo */

    grid.innerHTML=items.map(it=>{
      const url=URL.createObjectURL(it.blob); this.urls.push(url);
      const media=it.type==='video'
        ? `<video src="${url}" controls playsinline preload="metadata"></video>`
        : `<img src="${url}" alt="" loading="lazy">`;
      return `<figure data-id="${it.id}">
        <div class="mw">${media}</div>
        <figcaption>
          <input class="cap" value="${typeof Pubblica!=='undefined'?Pubblica.testo(it.caption):''}" placeholder="Aggiungi una didascalia…" maxlength="140">
          <div class="row">
            <span class="muted">${it.type==='video'?'video':'foto'} · ${this.peso(it.size)}</span>
            <a class="lnk" href="${url}" download="${(it.name||'orbit').replace(/"/g,'')}">Salva</a>
            <button class="lnk del">Elimina</button>
          </div>
        </figcaption></figure>`;
    }).join('');

    const info=root.querySelector('.media-info');
    if(info){
      const tot=items.reduce((s,i)=>s+i.size,0);
      info.textContent=items.length
        ? `${items.length} element${items.length>1?'i':'o'} · ${this.peso(tot)}. Restano su questo dispositivo: teneteli anche nel rullino.`
        : 'Le foto e i video restano su questo dispositivo, non vengono caricati da nessuna parte.';
    }

    /* didascalie, cancellazione */
    grid.querySelectorAll('figure').forEach(fig=>{
      const id=+fig.dataset.id;
      const cap=fig.querySelector('.cap');
      let t=null;
      cap.oninput=()=>{ clearTimeout(t); t=setTimeout(async()=>{
        const rec=await this.get(id); if(rec){ rec.caption=cap.value; rec.mod=Date.now(); await this.put(rec); }
      },500); };
      fig.querySelector('.del').onclick=async()=>{
        if(!confirm('Elimino questo elemento?')) return;
        await this.del(id); this.mount(day,root);
      };
    });

    this.mostraRecuperoPosti(day,root,items);

    /* il pannello "condividi con i cari" elenca le stesse foto:
       va ridisegnato ogni volta che se ne aggiunge o toglie una */
    if(typeof Pubblica!=='undefined') Pubblica.mount(day,root);
    if(typeof Sync!=='undefined') Sync.mount(day,root);
  },

  /* ═══ recuperare la posizione di foto già caricate ═══
     Le foto aggiunte prima di questo settore hanno perso le coordinate:
     venivano rimpicciolite e la scheda con la posizione restava fuori.
     Gli originali però sono ancora nel rullino del telefono.

     Si ripescano da lì: di ogni file si legge solo la posizione, e la
     si attacca alla foto che è già qui, riconosciuta dal nome. Non si
     aggiunge niente e non si sostituisce niente — nessun doppione, le
     foto restano quelle. */
  /* l'esito dell'ultimo recupero: sopravvive al ridisegno del
     pannello, altrimenti sparirebbe nell'istante in cui si scrive */
  esitoPosti:'',

  async mostraRecuperoPosti(day,root,items){
    const box=root.querySelector('.media-posti'); if(!box) return;
    const senza=items.filter(x=>x.type!=='video'&&x.lat==null);
    const esito=this.esitoPosti?`<p class="muted media-posti-stato" style="font-size:12.5px">${this.esitoPosti}</p>`:'';
    if(!senza.length){ box.innerHTML=esito; return; }
    const con=items.filter(x=>x.lat!=null).length;
    box.innerHTML=`<label class="media-posti-btn">
        <input type="file" accept="image/*" multiple hidden>
        <span>Ritrova dove sono state scattate (${senza.length})</span>
      </label>
      <p class="muted" style="font-size:12.5px;margin-top:6px">
        ${con?`${con} di queste foto sono già sulla mappa. `:''}Le altre sono arrivate
        qui senza la posizione. Riscegliendole dal rullino, Orbit legge solo dove
        erano e la attacca a quelle che ci sono già: niente doppioni.</p>
      ${esito||'<p class="muted media-posti-stato" style="font-size:12.5px"></p>'}`;

    const inp=box.querySelector('input');
    const stato=box.querySelector('.media-posti-stato');
    inp.onchange=async()=>{
      const files=[...inp.files]; if(!files.length) return;
      this.esitoPosti=''; stato.textContent='Guardo le foto…';
      let trovate=0, senzaPosto=0, nonRiconosciute=0;
      const tutte=[];
      for(const g of DAYS) tutte.push(...await this.all(g.d));
      for(const f of files){
        const dove=await Exif.posizione(f);
        if(!dove){ senzaPosto++; continue; }
        const rec=tutte.find(x=>x.name===f.name&&x.lat==null);
        if(!rec){ nonRiconosciute++; continue; }
        rec.lat=dove.lat; rec.lon=dove.lon;
        if(dove.alt!=null) rec.alt=dove.alt;
        rec.mod=Date.now();
        await this.put(rec);
        trovate++;
      }
      const pezzi=[];
      if(trovate) pezzi.push(`${trovate} foto ${trovate===1?'ha ritrovato':'hanno ritrovato'} il suo posto`);
      if(senzaPosto) pezzi.push(`${senzaPosto} non ${senzaPosto===1?'aveva':'avevano'} la posizione salvata`);
      if(nonRiconosciute) pezzi.push(`${nonRiconosciute} non ${nonRiconosciute===1?'corrisponde':'corrispondono'} a foto già qui`);
      this.esitoPosti=pezzi.join(', ')+'.';
      stato.textContent=this.esitoPosti;
      inp.value='';
      if(trovate){
        this.mount(day,root);
        if(typeof OrbitMap!=='undefined'&&OrbitMap.ready) OrbitMap.mostraFoto(day);
      }
    };
  },

  /* ── collega il bottone di aggiunta ── */
  bind(day,root){
    const inp=root.querySelector('.media-add input');
    const lbl=root.querySelector('.media-add span');
    if(!inp) return;
    inp.onchange=async()=>{
      const files=[...inp.files]; if(!files.length) return;
      const testo=lbl.textContent;
      lbl.textContent='Salvo…';
      try{
        await this.addFiles(day,files,(n,tot)=>lbl.textContent=`Salvo ${n} di ${tot}…`);
      }catch(e){ alert('Non sono riuscito a salvare: spazio esaurito sul dispositivo.'); }
      lbl.textContent=testo; inp.value='';
      this.mount(day,root);
    };
  },
};
