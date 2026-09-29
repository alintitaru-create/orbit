/* ═══════════════════════════════════════════════════════════
   SETTORE SOLDI 2.0 — tassi di cambio live (open.er-api.com,
   gratuito e senza chiave, cache 12 ore), convertitore rapido
   e registro delle spese reali confrontato col budget.
   ═══════════════════════════════════════════════════════════ */
const Money={
  /* tassi di riserva se la rete manca (settembre 2026, indicativi) */
  rates:{KGS:100,UZS:14500,USD:1.1},
  live:false,
  exp:[],   /* spese: {t, d:'2026-09-10', amt, cur, desc} */

  async init(){
    try{ this.exp=JSON.parse(localStorage.getItem(Viaggio.chiave('exp'))||'[]'); }catch(e){}
    this.renderConv(); this.renderExp();
    try{
      const c=JSON.parse(localStorage.getItem(Viaggio.chiave('fx'))||'null');
      if(c&&Date.now()-c.t<432e5){ this.rates=c.r; this.live=true; }
      else{
        const j=await (await fetch('https://open.er-api.com/v6/latest/EUR',{signal:AbortSignal.timeout(8000)})).json();
        const serve=this.valute().filter(c=>c!=='EUR');
        if(j.rates&&serve.some(c=>j.rates[c])){
          this.rates={...this.rates,...Object.fromEntries(serve.map(c=>[c,j.rates[c]]).filter(([,v])=>v))};
          this.live=true;
          try{ localStorage.setItem(Viaggio.chiave('fx'),JSON.stringify({t:Date.now(),r:this.rates})); }catch(e){}
        }
      }
    }catch(e){}
    this.renderConv(); this.renderExp();
  },

  toEur(amt,cur){ return cur==='EUR'?amt:amt/(this.rates[cur]||1); },
  fmt(n,dec=0){ return Number.isFinite(n)
    ? n.toLocaleString('it-IT',{maximumFractionDigits:dec,minimumFractionDigits:dec})
    : '—'; },
  /* Quante cifre dopo la virgola servono per un tasso: con 13.454 som
     per euro nessuna, con 1,14 dollari per euro due. Senza questo, il
     dollaro diventerebbe "1 €" e direbbe una bugia. */
  cifre(v){ return v>=100?0:v>=10?1:2; },

  /* ── convertitore ──
     Le valute non sono scritte qui: le dichiarano i gruppi del
     budget del viaggio (BUDGET.gruppi, campo "cur"), più euro e
     dollaro che servono sempre. Un viaggio in Georgia mostrerà i
     lari senza che nessuno tocchi questo file. */
  renderConv(){
    const el=document.getElementById('fxCard');
    const r=this.rates;
    const altre=this.valute().filter(c=>c!=='EUR'&&r[c]);
    const riga=c=>`<tr><td>1 €</td><td colspan="2">${this.fmt(r[c],this.cifre(r[c]))} ${c}</td></tr>`+
      `<tr><td>1.000 ${c}</td><td colspan="2">≈ ${this.fmt(1000/r[c],2)} €</td></tr>`;
    el.innerHTML=`
      <h3>Convertitore ${this.live?'<span class="badge green">tassi live</span>':'<span class="badge">tassi indicativi</span>'}</h3>
      <div class="fx-row">
        <input type="number" id="fxAmt" value="10" min="0" inputmode="decimal">
        <select id="fxCur">${this.valute().map(c=>`<option>${c}</option>`).join('')}</select>
        <div id="fxOut" class="fx-out"></div>
      </div>
      ${altre.length?`<table class="fx-cheat">${altre.map(riga).join('')}</table>`
                    :'<p class="muted" style="margin-top:10px">Nessuna valuta straniera in questo viaggio.</p>'}`;
    const upd=()=>{
      const a=+el.querySelector('#fxAmt').value||0, c=el.querySelector('#fxCur').value;
      const eur=this.toEur(a,c);
      el.querySelector('#fxOut').innerHTML=
        c==='EUR'
        ? (altre.map(x=>`<b>${this.fmt(eur*r[x],this.cifre(r[x]))}</b> ${x}`).join(' · ')||`<b>${this.fmt(eur,2)} €</b>`)
        : `<b>${this.fmt(eur,2)} €</b>`;
    };
    el.querySelector('#fxAmt').oninput=upd; el.querySelector('#fxCur').onchange=upd; upd();
  },

  /* ── registro spese ── */
  /* le valute del viaggio: le dichiarano i gruppi del budget */
  gruppi(){ return (typeof BUDGET!=='undefined'&&BUDGET.gruppi||[]).filter(g=>g.cur); },
  valute(){ return [...new Set([...this.gruppi().map(g=>g.cur),'EUR','USD'])]; },
  /* Il giorno della spesa si sceglie. Prima era sempre "oggi": va bene
     mentre si viaggia, ma a viaggio finito una spesa da recuperare
     finiva fuori dal viaggio, in una data che non c'entrava niente. */
  giornoPredefinito(){
    const oggi=new Date().toISOString().slice(0,10);
    if(!DAYS.length) return oggi;
    const primo=DAYS[0].d, ultimo=DAYS[DAYS.length-1].d;
    return oggi<primo?primo:oggi>ultimo?ultimo:oggi;
  },

  /* L'istante è il nome della spesa: lo usano la cancellazione, il
     "rimettila" e la fusione fra i due telefoni. Due spese annotate
     nello stesso millisecondo avrebbero lo stesso nome e una
     mangerebbe l'altra — succede davvero, battendo due importi di
     fila. Se l'istante è già preso si va al millisecondo dopo. */
  istante(){
    let t=Date.now();
    const presi=new Set(this.exp.map(e=>e.t));
    while(presi.has(t)) t++;
    return t;
  },

  add(amt,cur,desc,d,chi,solo){
    d=d||this.giornoPredefinito();
    const e={t:this.istante(),d,amt,cur,desc};
    /* il nome si scrive solo se il viaggio è di gruppo: in due da soli
       sarebbe una colonna in più che non dice niente */
    if(chi) e.chi=chi;
    if(solo) e.solo=1;
    this.exp.push(e);
    this.salvaSpese();
    this.renderExp();
  },

  salvaSpese(){
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
  },

  /* ═══ IL CONTO DEL GRUPPO ═══
     Chi ha pagato quanto, quanto tocca a testa, e chi deve a chi.

     Le spese marcate "solo mia" restano fuori dalla divisione: il
     souvenir che uno si compra non lo pagano gli altri. Entra invece
     nel totale suo, perché è un soldo che ha speso davvero.

     La chiusura dei conti è la più semplice possibile: chi è in credito
     e chi è in debito si accoppiano dal più grosso al più piccolo. Con
     cinque persone vengono al massimo quattro passaggi di denaro
     invece di venti: nessuno vuole fare venti bonifici. */
  conto(){
    const persone=Viaggio.persone();
    if(persone.length<2) return null;
    const ignoto=Viaggio.io()||persone[0];

    const pagato={}, proprie={};
    persone.forEach(p=>{ pagato[p]=0; proprie[p]=0; });
    let comune=0;

    this.exp.forEach(e=>{
      const chi=persone.includes(e.chi)?e.chi:ignoto;
      const v=this.toEur(e.amt,e.cur);
      pagato[chi]+=v;
      if(e.solo) proprie[chi]+=v; else comune+=v;
    });

    const quota=comune/persone.length;
    /* il saldo: quello che uno ha messo per il gruppo, meno la sua parte */
    const saldi=persone.map(p=>({chi:p,pagato:pagato[p],proprie:proprie[p],
                                 saldo:(pagato[p]-proprie[p])-quota}));

    /* chi deve a chi, al centesimo: sotto il centesimo non è un debito */
    const creditori=saldi.filter(x=>x.saldo>0.01).map(x=>({...x})).sort((a,b)=>b.saldo-a.saldo);
    const debitori =saldi.filter(x=>x.saldo<-0.01).map(x=>({...x, saldo:-x.saldo})).sort((a,b)=>b.saldo-a.saldo);
    const passaggi=[];
    let i=0,j=0;
    while(i<debitori.length&&j<creditori.length){
      const q=Math.min(debitori[i].saldo,creditori[j].saldo);
      if(q>0.01) passaggi.push({da:debitori[i].chi,a:creditori[j].chi,quanto:q});
      debitori[i].saldo-=q; creditori[j].saldo-=q;
      if(debitori[i].saldo<=0.01) i++;
      if(creditori[j].saldo<=0.01) j++;
    }
    return {persone,saldi,quota,comune,
            totale:saldi.reduce((n,x)=>n+x.pagato,0),passaggi};
  },
  /* Togliere una spesa era immediato e definitivo: un tocco storto
     sulla × e quella riga spariva senza chiedere niente e senza modo
     di tornare indietro. Su un telefono, in viaggio, con le mani
     piene, succede. Ora resta da parte e si può rimettere. */
  ultimaTolta:null,

  /* di una spesa tolta resta l'ora: serve a far sparire la spesa anche
     sull'altro telefono, se no il conto di chi deve a chi resterebbe
     sbagliato per sempre. È l'unica cosa che si propaga cancellandosi. */
  tolte(){ try{ return JSON.parse(localStorage.getItem(Viaggio.chiave('exp_tolte'))||'[]'); }catch(e){ return []; } },
  segnaTolta(t,togli){
    try{
      const l=this.tolte().filter(x=>x!==t);
      if(!togli) l.push(t);
      localStorage.setItem(Viaggio.chiave('exp_tolte'),JSON.stringify(l));
    }catch(e){}
  },

  del(t){
    const tolta=this.exp.find(e=>e.t===t);
    this.exp=this.exp.filter(e=>e.t!==t);
    this.segnaTolta(t);
    this.ultimaTolta=tolta||null;
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },

  rimetti(){
    if(!this.ultimaTolta) return;
    this.segnaTolta(this.ultimaTolta.t,true);   /* non è più cancellata */
    this.exp.push(this.ultimaTolta);
    this.exp.sort((a,b)=>a.t-b.t);
    this.ultimaTolta=null;
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },

  avvisoTolta(){
    const t=this.ultimaTolta;
    if(!t) return '';
    return `<p class="exp-tolta">Tolta «${t.desc||'senza nome'}», ${this.fmt(t.amt)} ${t.cur}.
      <button class="lnk" id="expRimetti">Rimettila</button></p>`;
  },

  renderExp(){
    const el=document.getElementById('expCard');
    /* ogni spesa finisce nel gruppo della sua valuta; quelle in euro o
       in dollari non hanno un gruppo e si contano a parte */
    const gruppi=this.gruppi();
    const tot={}; gruppi.forEach(g=>tot[g.cur]=0); let fuori=0;
    this.exp.forEach(e=>{ const v=this.toEur(e.amt,e.cur);
      if(tot[e.cur]!==undefined) tot[e.cur]+=v; else fuori+=v; });
    const bar=(v,max,label)=>`<div class="exp-bar"><span>${label}</span>
      <div class="check-bar"><i style="width:${Math.min(100,Math.round(100*v/(max||1)))}%;${v>max?'background:var(--red)':''}"></i></div>
      <b>${this.fmt(v,0)} / ${max} €</b></div>`;
    el.innerHTML=`
      <h3>Spese vere <span class="badge">${this.exp.length}</span></h3>
      ${this.avvisoDispersi()}
      ${this.avvisoTolta()}
      ${this.gruppoHtml()}
      <form class="exp-add" id="expForm">
        <input type="number" id="expAmt" placeholder="Importo" min="0" step="any" inputmode="decimal" required>
        <select id="expCur">${this.valute().map(c=>`<option>${c}</option>`).join('')}</select>
        <input type="text" id="expDesc" placeholder="Cosa (es. cena, taxi)" maxlength="60">
        <input type="date" id="expDay" value="${this.giornoPredefinito()}"
               ${DAYS.length?`min="${DAYS[0].d}" max="${DAYS[DAYS.length-1].d}"`:''} title="Il giorno della spesa">
        ${Viaggio.inGruppo()?`<select id="expChi" title="Chi ha pagato">${
          Viaggio.persone().map(p=>`<option${p===Viaggio.io()?' selected':''}>${this.esc(p)}</option>`).join('')
        }</select>
        <label class="exp-solo"><input type="checkbox" id="expSolo"> solo mia</label>`:''}
        <button class="pill on" type="submit">Aggiungi</button>
      </form>
      ${gruppi.map(g=>bar(tot[g.cur],g.tot,g.title.split(' · ')[0])).join('')}
      ${fuori>0?`<p class="muted" style="margin-top:8px">Fuori budget, in euro o dollari: ${this.fmt(fuori,0)} €</p>`:''}
      ${this.contoHtml()}
      ${this.exp.length?this.elenco()
      :'<p class="muted" style="margin-top:10px">Annota qui quello che spendete: la barra si confronta col budget stimato.</p>'}`;
    el.querySelector('#expForm').onsubmit=e=>{
      e.preventDefault();
      const amt=+el.querySelector('#expAmt').value;
      if(amt>0) this.add(amt,el.querySelector('#expCur').value,
                         el.querySelector('#expDesc').value.trim(),
                         el.querySelector('#expDay').value,
                         el.querySelector('#expChi')?.value||'',
                         el.querySelector('#expSolo')?.checked);
    };
    el.querySelectorAll('.exp-list .del').forEach(b=>b.onclick=()=>this.del(+b.dataset.t));
    const rec=el.querySelector('#expRecupera');
    if(rec) rec.onclick=()=>this.recupera();
    this.legaGruppo(el);
    const sy=el.querySelector('#expSync');
    if(sy) sy.onclick=async()=>{
      const stato=el.querySelector('.conto-sync-stato');
      if(typeof Sync==='undefined'||!Sync.pronto()){
        stato.textContent='Servono la password e la chiave di GitHub.'; return;
      }
      sy.disabled=true; stato.textContent='Guardo…';
      try{
        const r=await Sync.giraSpese(t=>stato.textContent=t);
        const p=[];
        if(r.mandate) p.push(`${r.mandate} mandate`);
        if(r.arrivate) p.push(`${r.arrivate} arrivate`);
        if(r.spariteQui) p.push(`${r.spariteQui} tolte dagli altri`);
        stato.textContent=(p.length?p.join(', '):'Già in pari')+`. In tutto ${r.totale}.`;
        this.renderExp();
      }catch(e){ stato.textContent='Non ha funzionato: '+e.message; }
    };
    const rim=el.querySelector('#expRimetti');
    if(rim) rim.onclick=()=>this.rimetti();
  },

  /* ── le spese finite fuori posto ──
     Non dovrebbe succedere: js/migra.js rimette dentro a ogni avvio
     quello che trova. Ma se un elenco restasse in un angolo del
     browser — un nome vecchio, un viaggio sbagliato, un salvataggio
     messo da parte — è meglio che la pagina lo dica invece di far
     finta di niente. Una spesa che sembra sparita quasi sempre è
     ancora qui dentro. */
  dispersi(){
    const mia=Viaggio.chiave('exp'), fuori=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(!k||k===mia||!/^orbit_exp(:|$)/.test(k)) continue;
        try{
          const v=JSON.parse(localStorage.getItem(k));
          if(Array.isArray(v)&&v.length) fuori.push({k,voci:v});
        }catch(e){}
      }
    }catch(e){}
    return fuori;
  },

  avvisoDispersi(){
    const f=this.dispersi();
    if(!f.length) return '';
    const n=f.reduce((t,x)=>t+x.voci.length,0);
    return `<p class="exp-dispersi">Ho trovato ${n} spes${n===1?'a':'e'} rimast${n===1?'a':'e'} in un
      angolo del browser, fuori da questo viaggio.
      <button class="lnk" id="expRecupera">Rimettile nell'elenco</button></p>`;
  },

  recupera(){
    const f=this.dispersi();
    if(!f.length) return;
    const visti=new Set(this.exp.map(e=>e.t));
    f.forEach(({k,voci})=>{
      voci.forEach(e=>{ if(!visti.has(e.t)){ this.exp.push(e); visti.add(e.t); } });
      try{ localStorage.removeItem(k); }catch(err){}
    });
    this.exp.sort((a,b)=>a.t-b.t);
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },

  esc(t){ return String(t||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },

  legaGruppo(el){
    /* "sono io": basta un tocco, e le spese già annotate su questo
       telefono prendono il nome — erano sue comunque */
    el.querySelectorAll('[data-io]').forEach(b=>b.onclick=()=>{
      const nome=b.dataset.io;
      Viaggio.setIo(nome);
      let toccate=0;
      this.exp.forEach(e=>{ if(!e.chi){ e.chi=nome; toccate++; } });
      if(toccate) this.salvaSpese();
      this.renderExp();
    });

    const apri=el.querySelector('#expGruppoApri');
    const box=el.querySelector('#expGruppoForm');
    if(apri&&box) apri.onclick=()=>{
      box.hidden=false; box.innerHTML=this.formGruppo(); apri.hidden=true;
      const stato=box.querySelector('.exp-nomi-stato');
      box.querySelector('#expNomiAnnulla').onclick=()=>{ box.hidden=true; box.innerHTML=''; apri.hidden=false; };
      box.querySelector('#expNomiSalva').onclick=async()=>{
        const nomi=[...new Set(box.querySelector('#expNomi').value
          .split(',').map(x=>x.trim()).filter(Boolean))];
        if(!Chiave.key||typeof Pubblica==='undefined'||!Pubblica.token()){
          stato.textContent=!Chiave.key
            ? 'Qui non posso: i nomi si cambiano dalla pagina online, con la password.'
            : 'Serve prima la chiave di GitHub, quella della scheda Diario.';
          return;
        }
        const prima=Viaggio.meta.persone;
        Viaggio.meta.persone=nomi.length?nomi:undefined;
        stato.textContent='Salvo…';
        try{
          await Viaggi.salva(nomi.length?`Chi viaggia: ${nomi.join(', ')}`:'Viaggio di nuovo da soli');
          /* se il mio nome non è più in elenco, questo telefono non sa più chi è */
          if(!nomi.includes(Viaggio.io())) Viaggio.setIo('');
          this.renderExp();
        }catch(e){
          Viaggio.meta.persone=prima;
          stato.textContent='Non ha funzionato: '+e.message;
        }
      };
    };
  },

  /* ═══ chi divide le spese ═══
     Tre stati, tre cose diverse da mostrare:
     · nessuno dichiarato → un invito discreto, che chi viaggia in due
       e non vuole conti può ignorare per sempre
     · dichiarati ma il telefono non sa chi sia → si chiede una volta
     · a posto → una riga sola, con la via per cambiare idea */
  gruppoHtml(){
    const p=Viaggio.persone(), io=Viaggio.io();
    if(p.length<2) return `<p class="exp-gruppo">
      <button class="lnk" id="expGruppoApri">Siete in più di uno? Dividi le spese</button></p>
      <div id="expGruppoForm" hidden></div>`;
    if(!io) return `<div class="exp-gruppo chiedi">
      <b>Chi sei, su questo telefono?</b>
      <div class="scelte">${p.map(n=>`<button class="pill" data-io="${this.esc(n)}">${this.esc(n)}</button>`).join('')}</div>
      <p class="muted">Serve una volta sola: da qui in poi le tue spese portano il tuo nome.</p>
    </div><div id="expGruppoForm" hidden></div>`;
    return `<p class="exp-gruppo">In ${p.length}: ${p.map(n=>this.esc(n)).join(', ')} · sei <b>${this.esc(io)}</b>
      <button class="lnk" id="expGruppoApri">cambia</button></p>
      <div id="expGruppoForm" hidden></div>`;
  },

  formGruppo(){
    const p=Viaggio.persone();
    return `<label>I nomi di chi viaggia, separati da virgola
        <input id="expNomi" value="${this.esc(p.join(', '))}" placeholder="Alin, Benedetta, Marco" maxlength="120">
      </label>
      <div class="azioni">
        <button class="pill on" id="expNomiSalva">Salva</button>
        <button class="pill" id="expNomiAnnulla">Annulla</button>
        <span class="muted exp-nomi-stato"></span>
      </div>
      <p class="muted">I nomi stanno nell'elenco dei viaggi, non fra i dati: cambiarli
        non ricifra niente. Ognuno poi dice chi è sul proprio telefono.</p>`;
  },

  /* ═══ il conto del gruppo ═══ */
  contoHtml(){
    const c=this.conto();
    if(!c||!this.exp.length) return '';
    const riga=s=>`<div class="saldo-riga ${s.saldo>0.01?'credito':s.saldo<-0.01?'debito':''}">
        <span class="chi">${this.esc(s.chi)}</span>
        <span class="quanto">${this.fmt(s.pagato,2)} €${s.proprie?` <em>di cui ${this.fmt(s.proprie,2)} suoi</em>`:''}</span>
        <b>${s.saldo>0.01?'+':''}${this.fmt(s.saldo,2)} €</b>
      </div>`;
    return `<div class="conto-gruppo">
      <h4>Il conto fra voi</h4>
      <p class="muted">${this.fmt(c.comune,2)} € da dividere in ${c.persone.length}:
        <b>${this.fmt(c.quota,2)} € a testa</b>${c.totale>c.comune?
        ` · ${this.fmt(c.totale-c.comune,2)} € di spese solo proprie, fuori dalla divisione`:''}</p>
      ${c.saldi.map(riga).join('')}
      <p class="conto-sync"><button class="lnk" id="expSync">Aggiorna con le spese degli altri</button>
        <span class="muted conto-sync-stato"></span></p>
      ${c.passaggi.length?`<div class="passaggi"><b>Per pareggiare</b>
        ${c.passaggi.map(p=>`<div class="passaggio">${this.esc(p.da)} <span>→</span> ${this.esc(p.a)}
          <b>${this.fmt(p.quanto,2)} €</b></div>`).join('')}</div>`
        :'<p class="muted" style="margin-top:8px">Siete pari.</p>'}
    </div>`;
  },

  /* ── l'elenco delle spese, tutte, giornata per giornata ──
     Prima se ne vedevano solo le ultime trenta: il numero accanto al
     titolo le contava tutte e l'elenco ne mostrava una parte, quindi
     una spesa più vecchia sembrava sparita pur essendo lì. Un registro
     che nasconde delle voci non è un registro. Raggruppate per data si
     legge anche un viaggio lungo, e si vede subito se manca un giorno. */
  elenco(){
    const perGiorno=new Map();
    [...this.exp].sort((a,b)=>(b.d||'').localeCompare(a.d||'')||b.t-a.t)
      .forEach(e=>{ const k=e.d||'senza data';
        if(!perGiorno.has(k)) perGiorno.set(k,[]); perGiorno.get(k).push(e); });

    return '<div class="exp-registro">'+[...perGiorno].map(([giorno,voci])=>{
      const somma=voci.reduce((t,e)=>t+this.toEur(e.amt,e.cur),0);
      const titolo=giorno==='senza data'?'Senza data'
        :new Date(giorno+'T12:00:00').toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
      return `<div class="exp-giorno"><span>${titolo}</span><b>${this.fmt(somma,2)} €</b></div>
        <ul class="exp-list">${voci.map(e=>
          `<li><span class="txt">${e.desc||'—'}</span>${Viaggio.inGruppo()
             ? `<em class="chi">${this.esc(e.chi||Viaggio.io()||'?')}${e.solo?' · solo sua':''}</em>`:''}
           <b>${this.fmt(e.amt)} ${e.cur}</b><span class="muted">≈ ${this.fmt(this.toEur(e.amt,e.cur),2)} €</span>
           <button class="del" data-t="${e.t}" title="Rimuovi">×</button></li>`).join('')}</ul>`;
    }).join('')+'</div>';
  },
};
