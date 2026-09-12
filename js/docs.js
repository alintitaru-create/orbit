/* ═══════════════════════════════════════════════════════════
   SETTORE DOCUMENTI — i PDF delle prenotazioni.

   Online sono pubblicati cifrati (docs/*.bin): il telefono li
   scarica, li decifra con la stessa chiave della password e li
   apre. Chi non ha la password scarica solo byte illeggibili.
   Sul Mac, se la cartella cifrata non c'è, si collegano
   direttamente i PDF originali sul Desktop.
   ═══════════════════════════════════════════════════════════ */
const Docs={
  list:[], urls:{},

  async init(){
    const grid=document.getElementById('docGrid'), hint=document.getElementById('docHint');
    try{
      const r=await fetch('docs/index.json',{cache:'no-cache'});
      if(!r.ok) throw 0;
      this.list=await r.json();
    }catch(e){ this.list=null; }

    if(!this.list||!this.list.length||typeof ORBIT_KEY==='undefined'||!ORBIT_KEY){
      /* copia locale: i PDF stanno sul Desktop, si aprono da lì */
      hint.textContent='I PDF si aprono dalla cartella Bishkek sul Mac.';
      grid.innerHTML=DOCS.map(x=>
        `<a class="app" href="${DOCS_BASE+encodeURIComponent(x.f)}" target="_blank"><b>${x.t}</b><span>${x.d}</span><em>PDF</em></a>`).join('');
      return;
    }

    /* titoli e descrizioni arrivano dai dati cifrati: nel manifest
       pubblico c'è solo la posizione, per non rivelare nulla */
    hint.textContent='Cifrati insieme al resto: si aprono solo qui dentro, anche dal telefono e anche senza rete.';
    grid.innerHTML=this.list.map((x,k)=>{
      const d=DOCS[x.i]||{t:'Documento',d:''};
      return `<button class="app doc" data-i="${k}"><b>${d.t}</b><span>${d.d}</span><em>PDF · ${x.kb} KB</em></button>`;
    }).join('');
    grid.onclick=e=>{ const b=e.target.closest('.doc'); if(b) this.open(+b.dataset.i); };
  },

  /* scarica, decifra e mostra */
  async open(k){
    const doc=this.list[k], meta=DOCS[doc.i]||{t:'Documento'};
    const box=document.getElementById('docView');
    box.hidden=false; document.body.classList.add('viewing');
    document.getElementById('docTitle').textContent=meta.t;
    document.getElementById('docFrame').removeAttribute('src');
    document.getElementById('docDl').removeAttribute('href');
    const st=document.getElementById('docState');
    st.textContent='Apro il documento…';
    try{
      let url=this.urls[doc.f];
      if(!url){
        const raw=new Uint8Array(await (await fetch('docs/'+doc.f)).arrayBuffer());
        const plain=await crypto.subtle.decrypt(
          {name:'AES-GCM',iv:raw.slice(0,12)},ORBIT_KEY,raw.slice(12));
        url=this.urls[doc.f]=URL.createObjectURL(new Blob([plain],{type:'application/pdf'}));
      }
      st.textContent='';
      const dl=document.getElementById('docDl');
      dl.href=url; dl.download=meta.t.replace(/[^\w\s-]/g,'').trim()+'.pdf';
      document.getElementById('docFrame').src=url;
    }catch(e){ st.textContent='Non riesco ad aprirlo. Prova a ricaricare la pagina.'; }
  },

  close(){
    document.getElementById('docView').hidden=true;
    document.body.classList.remove('viewing');
    document.getElementById('docFrame').removeAttribute('src');
  },
};
