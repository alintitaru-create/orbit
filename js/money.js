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
  add(amt,cur,desc){
    const d=new Date().toISOString().slice(0,10);
    this.exp.push({t:Date.now(),d,amt,cur,desc});
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },
  del(t){
    this.exp=this.exp.filter(e=>e.t!==t);
    try{ localStorage.setItem(Viaggio.chiave('exp'),JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
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
      <form class="exp-add" id="expForm">
        <input type="number" id="expAmt" placeholder="Importo" min="0" step="any" inputmode="decimal" required>
        <select id="expCur">${this.valute().map(c=>`<option>${c}</option>`).join('')}</select>
        <input type="text" id="expDesc" placeholder="Cosa (es. cena, taxi)" maxlength="60">
        <button class="pill on" type="submit">Aggiungi</button>
      </form>
      ${gruppi.map(g=>bar(tot[g.cur],g.tot,g.title.split(' · ')[0])).join('')}
      ${fuori>0?`<p class="muted" style="margin-top:8px">Fuori budget, in euro o dollari: ${this.fmt(fuori,0)} €</p>`:''}
      ${this.exp.length?`<ul class="exp-list">${[...this.exp].reverse().slice(0,30).map(e=>
        `<li><span class="muted">${e.d.slice(8)}/${e.d.slice(5,7)}</span><span class="txt">${e.desc||'—'}</span>
         <b>${this.fmt(e.amt)} ${e.cur}</b><span class="muted">≈ ${this.fmt(this.toEur(e.amt,e.cur),2)} €</span>
         <button class="del" data-t="${e.t}" title="Rimuovi">×</button></li>`).join('')}</ul>`
      :'<p class="muted" style="margin-top:10px">Annota qui quello che spendete: la barra si confronta col budget stimato.</p>'}`;
    el.querySelector('#expForm').onsubmit=e=>{
      e.preventDefault();
      const amt=+el.querySelector('#expAmt').value;
      if(amt>0) this.add(amt,el.querySelector('#expCur').value,el.querySelector('#expDesc').value.trim());
    };
    el.querySelectorAll('.exp-list .del').forEach(b=>b.onclick=()=>this.del(+b.dataset.t));
  },
};
