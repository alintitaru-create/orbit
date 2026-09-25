/* ═══════════════════════════════════════════════════════════
   SETTORE RICORDO — la card di un viaggio finito.

   Prende il posto di "Oggi" quando le date sono passate: lì un
   countdown non serve più, e serve invece il conto di com'è
   andata. Numeri veri, nessuno inventato: quelli del programma
   stanno nei dati, le spese e le foto nel dispositivo.

   Quando un numero non c'è, la riga non compare: meglio una card
   più corta che uno zero che non vuol dire niente.
   ═══════════════════════════════════════════════════════════ */
const Ricordo={

  num(n){ return (n||0).toLocaleString('it'); },

  /* le giornate in cui è stato scritto qualcosa nel diario */
  giornateScritte(){
    let n=0;
    DAYS.forEach(D=>{
      try{ if((localStorage.getItem(Viaggio.chiave('diary')+':'+D.d)||'').trim()) n++; }catch(e){}
    });
    return n;
  },

  /* quanto è stato speso davvero, dal registro spese */
  speso(){
    try{
      const exp=JSON.parse(localStorage.getItem(Viaggio.chiave('exp'))||'[]');
      if(!exp.length) return null;
      return {voci:exp.length,eur:exp.reduce((t,e)=>t+Money.toEur(e.amt,e.cur),0)};
    }catch(e){ return null; }
  },

  /* il preventivo: quello che era stato messo in conto */
  preventivo(){
    const g=(typeof BUDGET!=='undefined'&&BUDGET.gruppi||[]).reduce((t,x)=>t+(x.tot||0),0);
    return g||null;
  },

  async card(){
    const el=document.getElementById('oggi-card');
    const v=Viaggio.meta||{}, s=Viaggi.stat(Viaggio.id);
    const giorni=s.giorni||DAYS.length;
    const quota=s.quota||Math.max(0,...DAYS.map(D=>D.at||0));
    const piedi=s.kmPiedi||DAYS.reduce((t,D)=>t+(D.km||0),0);
    const sp=this.speso(), prev=this.preventivo();

    const stat=(etichetta,valore,classe)=>
      `<div class="stat ${classe||''}">${etichetta}<b>${valore}</b></div>`;

    const numeri=[
      stat('Giornate',giorni),
      s.km?stat('Percorsi',this.num(s.km)+' km'):'',
      piedi?stat('A piedi',this.num(piedi)+' km'):'',
      quota?stat('Punto più alto',this.num(quota)+' m','cold'):'',
      s.notti?stat('Notti prenotate',s.notti):'',
    ].filter(Boolean).join('');

    /* le spese: solo se il registro è stato usato davvero */
    const soldi=sp
      ? `<div class="statgrid" style="margin-top:12px">
           ${stat('Speso sul posto','~'+this.num(Math.round(sp.eur))+' €','gold')}
           ${prev?stat('Era previsto',this.num(prev)+' €'):''}
           ${stat('Voci annotate',sp.voci)}
         </div>`
      : '';

    el.innerHTML=`
      <div class="today-date">Viaggio finito · ${Viaggi.quando(v)}</div>
      <h3>Com'è andata</h3>
      <p class="lead">${Viaggi.periodo(v)}${(v.paesi||[]).length?' · '+v.paesi.join(' e '):''}.
        Qui sotto è rimasto tutto: le giornate, il percorso sulla mappa, il diario e le foto.</p>
      <div class="statgrid">${numeri}</div>
      ${soldi}
      <p class="ricordo-diario muted" style="margin-top:14px"></p>
      <p style="margin-top:16px"><a href="#giornate">Sfoglia le giornate →</a></p>`;

    /* diario e foto arrivano dal dispositivo: si contano dopo, senza
       far aspettare il resto della card */
    const riga=el.querySelector('.ricordo-diario');
    const scritte=this.giornateScritte();
    let foto=0;
    try{ foto=(await Promise.all(DAYS.map(D=>Media.all(D.d)))).reduce((n,a)=>n+a.length,0); }catch(e){}
    const pezzi=[];
    if(scritte) pezzi.push(`${scritte} giornate con una nota nel diario`);
    if(foto)    pezzi.push(`${foto} fra foto e video su questo dispositivo`);
    riga.textContent=pezzi.length?pezzi.join(', ')+'.'
      :'Nel diario non è ancora rimasto niente su questo dispositivo.';
  },
};
