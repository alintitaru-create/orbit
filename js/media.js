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

  /* ── deposito ── */
  open(){
    if(this.db) return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      const r=indexedDB.open('orbit-media',1);
      r.onupgradeneeded=()=>{
        const s=r.result.createObjectStore('m',{keyPath:'id',autoIncrement:true});
        s.createIndex('day','day');
      };
      r.onsuccess=()=>{ this.db=r.result; res(this.db); };
      r.onerror=()=>rej(r.error);
    });
  },
  tx(mode){ return this.db.transaction('m',mode).objectStore('m'); },
  async all(day){
    await this.open();
    return new Promise(res=>{
      const out=[], q=this.tx('readonly').index('day').openCursor(IDBKeyRange.only(day));
      q.onsuccess=e=>{ const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out); };
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

  /* ── aggiunge i file scelti ── */
  async addFiles(day,files,onProgress){
    let n=0;
    for(const f of files){
      const video=f.type.startsWith('video');
      const blob=video?f:await this.shrink(f);
      await this.put({day,type:video?'video':'foto',blob,name:f.name,
                      size:blob.size,caption:'',t:Date.now()});
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
          <input class="cap" value="${(it.caption||'').replace(/"/g,'&quot;')}" placeholder="Aggiungi una didascalia…" maxlength="140">
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
        const rec=await this.get(id); if(rec){ rec.caption=cap.value; await this.put(rec); }
      },500); };
      fig.querySelector('.del').onclick=async()=>{
        if(!confirm('Elimino questo elemento?')) return;
        await this.del(id); this.mount(day,root);
      };
    });
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
