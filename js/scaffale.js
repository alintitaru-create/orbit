/* ═══════════════════════════════════════════════════════════
   SETTORE SCAFFALE — la prima schermata: tutti i viaggi.

   Ogni viaggio porta la forma del suo percorso, disegnata dalle
   coordinate vere delle sue tratte (la calcola tools/lock.mjs e la
   salva nell'elenco, così lo scaffale non deve aprirli tutti).
   È il modo più rapido per riconoscerli: il Kirghizistan ha la sua
   forma e nessun altro ce l'ha uguale.

   I gruppi non sono scritti da nessuna parte: li fanno le date.
   ═══════════════════════════════════════════════════════════ */
const Scaffale={

  GRUPPI:[['corso','In corso'],['futuro','In arrivo'],['bozza','Da programmare'],['passato','Ricordi']],

  num(n){ return (n||0).toLocaleString('it'); },

  /* la riga dei numeri sotto il nome, diversa secondo la fase */
  numeri(v){
    const s=Viaggi.stat(v.id), f=Viaggi.fase(v), d=Viaggi.durata(v);
    if(f==='bozza') return 'Ancora senza date';
    if(f==='corso'){
      const n=-Viaggi.giorniDa(v.dal)+1;
      return `${n}° giorno di ${d}`;
    }
    const p=[];
    if(f==='futuro'){ p.push(`${d} giorni`); if(s.notti) p.push(`${s.notti} notti prenotate`); }
    else{
      p.push(`${s.giorni||d} giorni`);
      if(s.km) p.push(`${this.num(s.km)} km`);
      if(s.quota>=1500) p.push(`${this.num(s.quota)} m il punto più alto`);
    }
    return p.join(' · ');
  },

  /* la firma del percorso: una linea sola, nelle sue proporzioni vere */
  firma(v,i){
    const s=Viaggi.stat(v.id);
    if(!s.firma) return '';
    return `<svg class="firma" viewBox="-3 -3 106 ${(s.firmaH||0)+6}" preserveAspectRatio="xMidYMid meet"
       aria-hidden="true" style="--ritardo:${i*90}ms">
      <polyline points="${s.firma}"/></svg>`;
  },

  card(v,i){
    const f=Viaggi.fase(v);
    const cop=v.copertina
      ? `<img src="${v.copertina}" alt="" loading="lazy">`
      : '';
    return `<a class="viaggio ${f}" href="viaggio.html?v=${encodeURIComponent(v.id)}"
               style="--tinta:${v.colore||'var(--blue)'}">
      <div class="copertina">${cop}${this.firma(v,i)}
        <span class="quando">${Viaggi.quando(v)}</span>
      </div>
      <div class="dentro">
        <h3>${v.nome}</h3>
        ${v.sotto?`<p class="sotto">${v.sotto}</p>`:''}
        <p class="periodo">${Viaggi.periodo(v)||'—'}</p>
        <p class="numeri">${this.numeri(v)}</p>
      </div>
    </a>`;
  },

  /* i totali in testa: solo quando c'è qualcosa da dire */
  totali(){
    const t=Viaggi.totali(), el=document.getElementById('totali');
    if(!t.viaggi){ el.textContent='Il primo viaggio comincia da qui.'; return; }
    const pezzi=[t.viaggi===1?'Un viaggio':`${t.viaggi} viaggi`];
    if(t.paesi) pezzi.push(t.paesi===1?'un paese':`${t.paesi} paesi`);
    if(t.giorni) pezzi.push(`${t.giorni} giorni via da casa`);
    if(t.km) pezzi.push(`${this.num(t.km)} km`);
    el.textContent=pezzi.join(', ')+'.';
  },

  render(){
    this.totali();
    const box=document.getElementById('scaffale');
    const tutti=Viaggi.ordinati();
    let n=0, html='';
    for(const [fase,titolo] of this.GRUPPI){
      const gruppo=tutti.filter(v=>Viaggi.fase(v)===fase);
      if(!gruppo.length) continue;
      html+=`<h2 class="gruppo">${titolo}</h2><div class="griglia">`+
            gruppo.map(v=>this.card(v,n++)).join('')+`</div>`;
    }
    if(!html) html=`<p class="vuoto">Non c'è ancora nessun viaggio.</p>`;
    box.innerHTML=html+this.bottoneNuovo();
    this.legaNuovo();
  },

  /* ═══ un viaggio nuovo ═══ */
  bottoneNuovo(){
    return `<div id="nuovoBox">
      <button class="pill on" id="nuovoApri">Aggiungi un viaggio</button>
      <form id="nuovoForm" hidden>
        <h3>Un viaggio nuovo</h3>
        <label>Dove andate<input name="nome" placeholder="Georgia e Armenia" required maxlength="60"></label>
        <label>Paesi, separati da virgola<input name="paesi" placeholder="Georgia, Armenia" maxlength="80"></label>
        <div class="due">
          <label>Dal<input type="date" name="dal" required></label>
          <label>Al<input type="date" name="al" required></label>
        </div>
        <div class="azioni">
          <button class="pill on" type="submit">Crea il viaggio</button>
          <button class="pill" type="button" id="nuovoAnnulla">Annulla</button>
        </div>
        <p class="stato"></p>
      </form>
    </div>`;
  },

  /* un'idea che prende le date: si apre il modulo già compilato, e
     quando il viaggio nasce l'idea lascia la lavagna */
  idea:null,
  daIdea(i){
    this.idea=i;
    const box=document.getElementById('nuovoBox'), form=box.querySelector('#nuovoForm');
    box.querySelector('#nuovoApri').hidden=true; form.hidden=false;
    form.nome.value=i.posto+(i.paese&&i.paese!==i.posto?', '+i.paese:'');
    form.paesi.value=i.paese||'';
    form.scrollIntoView({behavior:'smooth',block:'center'});
    form.dal.focus();
  },

  legaNuovo(){
    const box=document.getElementById('nuovoBox');
    const form=box.querySelector('#nuovoForm');
    const stato=box.querySelector('.stato');
    box.querySelector('#nuovoApri').onclick=()=>{
      form.hidden=false; box.querySelector('#nuovoApri').hidden=true;
      form.nome.focus();
    };
    box.querySelector('#nuovoAnnulla').onclick=()=>{
      form.hidden=true; box.querySelector('#nuovoApri').hidden=false; stato.textContent='';
    };

    form.onsubmit=async e=>{
      e.preventDefault();
      const nome=form.nome.value.trim(), dal=form.dal.value, al=form.al.value;
      const paesi=form.paesi.value.split(',').map(s=>s.trim()).filter(Boolean);
      if(al<dal){ stato.textContent='La data di ritorno viene prima della partenza.'; return; }
      if(!Chiave.key){ stato.textContent='Qui non posso: i viaggi nuovi si creano dalla pagina online, dove serve la password.'; return; }
      if(typeof Pubblica==='undefined'||!Pubblica.token()){
        stato.innerHTML='Serve prima la chiave di GitHub: si prende una volta sola, dalla scheda <b>Diario</b> di una giornata.';
        return;
      }
      const bottone=form.querySelector('[type=submit]');
      bottone.disabled=true;
      try{
        stato.textContent='Preparo il viaggio…';
        const v={id:Viaggi.nuovoId(nome,dal),nome,paesi,dal,al,
                 colore:'var(--blue)',pubblicato:false};
        const b64=await Chiave.cifra(Viaggi.scheletro(v),{});
        await Pubblica.scrivi(`viaggi/${v.id}/data.enc.js`,btoa(Chiave.fileJs(b64,'ORBIT_DATI')),
                              `Viaggio nuovo: ${nome}`);
        stato.textContent='Aggiungo allo scaffale…';
        VIAGGI.push(v);
        /* se nasce da un'idea, quell'idea ha finito il suo lavoro */
        if(this.idea){ const k=IDEE.indexOf(this.idea); if(k>=0) IDEE.splice(k,1); }
        await Viaggi.salva(`Viaggio nuovo: ${nome}`);
        stato.textContent='Fatto. Apro…';
        location.href=`viaggio.html?v=${encodeURIComponent(v.id)}`;
      }catch(err){
        stato.textContent='Non ha funzionato: '+err.message;
        bottone.disabled=false;
      }
    };
  },
};
