/* ═══════════════════════════════════════════════════════════
   SETTORE TRACCE — i percorsi fatti davvero.

   Una traccia è l'elenco dei punti dove siete passati: la salita ad
   Ala Kul, il giro in bici intorno a Kochkor, una mattina a piedi per
   Samarcanda. Arrivano da due strade:

   · registrate qui (js/registra.js), col telefono che segue il passo
   · importate da un file GPX (js/gpx.js), da Komoot o da qualunque
     altra app

   Stanno nel dispositivo, in un deposito loro, come le foto: sono
   troppo grosse per il file dei dati del viaggio, che va ricifrato e
   ripubblicato tutto intero a ogni modifica.

   I conti — chilometri, dislivello, durata — non si scrivono a mano:
   si ricavano dai punti. Una traccia non può mentire sui suoi numeri.
   ═══════════════════════════════════════════════════════════ */
const Tracce={
  db:null, urls:[],

  TIPI:{foot:'A piedi',bike:'In bici',horse:'A cavallo',ski:'Con gli sci',road:'In auto'},

  /* ── deposito ── */
  open(){
    if(this.db) return Promise.resolve(this.db);
    return new Promise((res,rej)=>{
      const r=indexedDB.open('orbit-tracce',1);
      r.onupgradeneeded=()=>{
        const s=r.result.createObjectStore('t',{keyPath:'id',autoIncrement:true});
        s.createIndex('day','day');
        s.createIndex('viaggio','viaggio');
      };
      r.onsuccess=()=>{ this.db=r.result; res(this.db); };
      r.onerror=()=>rej(r.error);
    });
  },
  tx(mode){ return this.db.transaction('t',mode).objectStore('t'); },
  viaggio(){ return typeof Viaggio!=='undefined'&&Viaggio.id?Viaggio.id:'kg2026'; },

  async all(day){
    await this.open();
    const v=this.viaggio();
    return new Promise(res=>{
      const out=[], q=this.tx('readonly').index('day').openCursor(IDBKeyRange.only(day));
      q.onsuccess=e=>{ const c=e.target.result;
        if(c){ if((c.value.viaggio||v)===v) out.push(c.value); c.continue(); } else res(out.sort((a,b)=>a.t-b.t)); };
      q.onerror=()=>res([]);
    });
  },
  async put(rec){ await this.open(); return new Promise((res,rej)=>{
    const r=this.tx('readwrite').put(rec); r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); }); },
  async del(id){ await this.open(); return new Promise(res=>{
    const r=this.tx('readwrite').delete(id); r.onsuccess=res; r.onerror=res; }); },
  async get(id){ await this.open(); return new Promise(res=>{
    const r=this.tx('readonly').get(id); r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); }); },

  /* ═══ i conti ═══
     Il dislivello si conta solo quando il cambio di quota supera i tre
     metri: il GPS oscilla in continuazione, e senza questa soglia una
     passeggiata in pianura "salirebbe" di duecento metri. */
  SOGLIA_QUOTA:3,

  conti(punti){
    let km=0, salita=0, discesa=0, quotaMax=null, quotaMin=null, rif=null;
    for(let i=0;i<punti.length;i++){
      const [la,lo,q]=punti[i];
      if(i) km+=hav([punti[i-1][0],punti[i-1][1]],[la,lo]);
      if(q!=null){
        if(quotaMax==null||q>quotaMax) quotaMax=q;
        if(quotaMin==null||q<quotaMin) quotaMin=q;
        if(rif==null) rif=q;
        else if(q-rif>=this.SOGLIA_QUOTA){ salita+=q-rif; rif=q; }
        else if(rif-q>=this.SOGLIA_QUOTA){ discesa+=rif-q; rif=q; }
      }
    }
    const tempi=punti.map(p=>p[3]).filter(t=>t!=null);
    const durata=tempi.length>1?Math.max(...tempi)-Math.min(...tempi):null;
    /* il conteggio si chiama "quanti" e non "punti": i conti vengono
       riversati sulla traccia, e un campo "punti" numerico prenderebbe
       il posto dell'elenco dei punti veri, cancellando la traccia
       mentre la si registra. Preso con le mani nel sacco da una prova. */
    return {km:+km.toFixed(2),salita:Math.round(salita),discesa:Math.round(discesa),
            quotaMax,quotaMin,durata,quanti:punti.length};
  },

  /* "3 h 20" oppure "48 min" */
  durataTesto(ms){
    if(!ms||ms<60000) return null;      /* sotto il minuto non si scrive */
    const min=Math.round(ms/60000);
    return min<60?`${min} min`:`${Math.floor(min/60)} h ${String(min%60).padStart(2,'0')}`;
  },

  /* ── il nome del file quando si esporta ── */
  nomeFile(tr){
    return (tr.nome||'traccia').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,40)+'-'+tr.day+'.gpx';
  },

  /* ═══ una traccia nuova, da qualunque strada arrivi ═══ */
  async salva({day,nome,tipo,punti,fonte}){
    const c=this.conti(punti);
    const rec={viaggio:this.viaggio(),day,nome:nome||'Percorso',tipo:tipo||'foot',
               punti,fonte:fonte||'registrata',t:Date.now(),
               uid:Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8),
               km:c.km,salita:c.salita,discesa:c.discesa,durata:c.durata,quotaMax:c.quotaMax};
    rec.id=await this.put(rec);
    return rec;
  },
};

/* ═══════════════════════════════════════════════════════════
   Il pannello dentro la giornata: registra, importa, elenca.
   ═══════════════════════════════════════════════════════════ */
Object.assign(Tracce,{

  num(n,dec=0){ return (n||0).toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec}); },

  rigaNumeri(tr){
    const p=[`${this.num(tr.km,1)} km`];
    if(tr.salita) p.push(`+${this.num(tr.salita)} m`);
    const d=this.durataTesto(tr.durata);
    if(d) p.push(d);
    if(tr.quotaMax>=1500) p.push(`fino a ${this.num(tr.quotaMax)} m`);
    return p.join(' · ');
  },

  async pannello(day,root){
    const box=root.querySelector('.tracce-box'); if(!box) return;
    const lista=(await this.all(day)).filter(t=>!t.aperta);
    const inCorso=Registra.attiva&&Registra.attiva.day===day;

    box.innerHTML=`
      ${inCorso?`<div class="tracce-live">
          <b class="live-km">0,0 km</b><span class="live-info"></span>
          <button class="pill" id="trFerma">Ferma</button>
        </div>`
        :`<div class="tracce-cmd">
          <input id="trNome" placeholder="Come si chiama" maxlength="50"
                 value="Percorso del ${day.slice(8)}/${day.slice(5,7)}">
          <select id="trTipo">${Object.entries(this.TIPI).map(([k,v])=>
            `<option value="${k}">${v}</option>`).join('')}</select>
          <button class="pill on" id="trRegistra">Registra</button>
          <label class="pill" id="trImporta">Importa un GPX<input type="file" accept=".gpx,application/gpx+xml" hidden></label>
        </div>`}
      <p class="muted tracce-nota">${inCorso
        ? 'Tieni lo schermo acceso e questa pagina davanti: con lo schermo spento il telefono smette di dare la posizione.'
        : 'Registrare tiene acceso lo schermo e consuma batteria: benissimo per una camminata o un giro in città, per un trekking lungo conviene l\'app del trekking e poi importare il GPX qui.'}</p>
      <p class="tracce-stato muted"></p>
      <div class="tracce-elenco">${lista.length?lista.map(t=>`
        <div class="traccia" data-id="${t.id}">
          <div class="top"><b>${this.esc(t.nome)}</b><span class="badge">${this.TIPI[t.tipo]||t.tipo}</span></div>
          <div class="numeri">${this.rigaNumeri(t)}</div>
          <div class="azioni">
            <button class="lnk scarica">Scarica GPX</button>
            <button class="lnk togli">Elimina</button>
          </div>
        </div>`).join('')
        :'<p class="muted">Ancora nessun percorso in questa giornata.</p>'}</div>
      ${lista.length?`<p class="muted tracce-nota">I percorsi viaggiano fra i due telefoni col tasto
        <b>Sincronizza</b> della scheda Diario, cifrati come le foto. Per tenerne una copia fuori da
        qui: <b>Scarica GPX</b>, che è un file normale e si riapre con qualsiasi app.</p>`:''}`;

    this.lega(day,root,box);
  },

  esc(s){ return String(s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])); },

  lega(day,root,box){
    const stato=box.querySelector('.tracce-stato');
    const ridisegna=()=>{ this.pannello(day,root);
      if(typeof OrbitMap!=='undefined'&&OrbitMap.ready) OrbitMap.mostraTracce(day); };

    /* ── registra ── */
    const bRec=box.querySelector('#trRegistra');
    if(bRec) bRec.onclick=async()=>{
      const nome=box.querySelector('#trNome').value.trim();
      const tipo=box.querySelector('#trTipo').value;
      stato.textContent='Cerco la posizione…';
      try{
        await Registra.parti(day,tipo,nome,()=>this.aggiornaLive(box));
        stato.textContent='';
        ridisegna();
      }catch(e){ stato.textContent='Non riesco a partire: '+e.message; }
    };

    const bStop=box.querySelector('#trFerma');
    if(bStop) bStop.onclick=async()=>{
      const rec=await Registra.ferma();
      stato.textContent=rec?`Percorso salvato: ${this.rigaNumeri(rec)}.`
                           :'Registrazione chiusa: non è arrivato nessun punto.';
      ridisegna();
    };

    /* ── importa un GPX ── */
    const imp=box.querySelector('#trImporta input');
    if(imp) imp.onchange=async()=>{
      const f=imp.files[0]; if(!f) return;
      stato.textContent='Leggo il file…';
      try{
        const {nome,punti}=Gpx.leggi(await f.text());
        const tr=await this.salva({day,nome:nome||f.name.replace(/\.gpx$/i,''),
                                   tipo:'foot',punti,fonte:'importata'});
        stato.textContent=`Importato: ${this.rigaNumeri(tr)}.`;
        ridisegna();
      }catch(e){ stato.textContent='Non riesco a importarlo: '+e.message; }
      imp.value='';
    };

    /* ── scarica ed elimina ── */
    box.querySelectorAll('.traccia').forEach(el=>{
      const id=+el.dataset.id;
      el.querySelector('.scarica').onclick=async()=>{
        const tr=await this.get(id); if(!tr) return;
        const xml=Gpx.scrivi({nome:tr.nome,punti:tr.punti,tipo:tr.tipo});
        const url=URL.createObjectURL(new Blob([xml],{type:'application/gpx+xml'}));
        const a=document.createElement('a');
        a.href=url; a.download=this.nomeFile(tr); a.click();
        setTimeout(()=>URL.revokeObjectURL(url),4000);
      };
      el.querySelector('.togli').onclick=async()=>{
        const tr=await this.get(id);
        if(!confirm(`Elimino «${tr?.nome||'questo percorso'}»? Non si recupera.`)) return;
        await this.del(id); ridisegna();
      };
    });
  },

  /* i numeri che cambiano mentre si cammina */
  aggiornaLive(box){
    const a=Registra.attiva; if(!a) return;
    const km=box.querySelector('.live-km'), info=box.querySelector('.live-info');
    if(!km) return;
    km.textContent=this.num(a.km||0,1)+' km';
    const p=[this.durataTesto(Registra.trascorso())||'0 min'];
    if(a.salita) p.push(`+${this.num(a.salita)} m`);
    p.push(`${(a.punti||[]).length} punti`);
    if(Registra.precisione) p.push(`±${Registra.precisione} m`);
    info.textContent=p.join(' · ');
  },
});
