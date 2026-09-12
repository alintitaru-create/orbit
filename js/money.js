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
    try{ this.exp=JSON.parse(localStorage.getItem('orbit_exp')||'[]'); }catch(e){}
    this.renderConv(); this.renderExp();
    try{
      const c=JSON.parse(localStorage.getItem('orbit_fx')||'null');
      if(c&&Date.now()-c.t<432e5){ this.rates=c.r; this.live=true; }
      else{
        const j=await (await fetch('https://open.er-api.com/v6/latest/EUR',{signal:AbortSignal.timeout(8000)})).json();
        if(j.rates?.KGS){
          this.rates={KGS:j.rates.KGS,UZS:j.rates.UZS,USD:j.rates.USD}; this.live=true;
          try{ localStorage.setItem('orbit_fx',JSON.stringify({t:Date.now(),r:this.rates})); }catch(e){}
        }
      }
    }catch(e){}
    this.renderConv(); this.renderExp();
  },

  toEur(amt,cur){ return cur==='EUR'?amt:amt/(this.rates[cur]||1); },
  fmt(n,dec=0){ return n.toLocaleString('it-IT',{maximumFractionDigits:dec}); },

  /* ── convertitore ── */
  renderConv(){
    const el=document.getElementById('fxCard');
    const r=this.rates;
    el.innerHTML=`
      <h3>Convertitore ${this.live?'<span class="badge green">tassi live</span>':'<span class="badge">tassi indicativi</span>'}</h3>
      <div class="fx-row">
        <input type="number" id="fxAmt" value="10" min="0" inputmode="decimal">
        <select id="fxCur"><option>EUR</option><option>KGS</option><option>UZS</option><option>USD</option></select>
        <div id="fxOut" class="fx-out"></div>
      </div>
      <table class="fx-cheat"><tr><td>1 €</td><td>${this.fmt(r.KGS)} som KG</td><td>${this.fmt(r.UZS)} som UZ</td></tr>
      <tr><td>1.000 som KG</td><td colspan="2">≈ ${this.fmt(1000/r.KGS*1,2)} €</td></tr>
      <tr><td>100.000 som UZ</td><td colspan="2">≈ ${this.fmt(100000/r.UZS,2)} €</td></tr></table>`;
    const upd=()=>{
      const a=+el.querySelector('#fxAmt').value||0, c=el.querySelector('#fxCur').value;
      const eur=this.toEur(a,c);
      el.querySelector('#fxOut').innerHTML=
        c==='EUR'
        ?`<b>${this.fmt(eur*this.rates.KGS)}</b> som KG · <b>${this.fmt(eur*this.rates.UZS)}</b> som UZ · <b>${this.fmt(eur*this.rates.USD,2)}</b> $`
        :`<b>${this.fmt(eur,2)} €</b>`;
    };
    el.querySelector('#fxAmt').oninput=upd; el.querySelector('#fxCur').onchange=upd; upd();
  },

  /* ── registro spese ── */
  country(d){ return d<'2026-09-19'?'kg':d<'2026-09-23'?'uz':'other'; },
  add(amt,cur,desc){
    const d=new Date().toISOString().slice(0,10);
    this.exp.push({t:Date.now(),d,amt,cur,desc});
    try{ localStorage.setItem('orbit_exp',JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },
  del(t){
    this.exp=this.exp.filter(e=>e.t!==t);
    try{ localStorage.setItem('orbit_exp',JSON.stringify(this.exp)); }catch(e){}
    this.renderExp();
  },

  renderExp(){
    const el=document.getElementById('expCard');
    const tot={kg:0,uz:0,other:0};
    this.exp.forEach(e=>{ tot[e.cur==='KGS'?'kg':e.cur==='UZS'?'uz':this.country(e.d)]+=this.toEur(e.amt,e.cur); });
    const bar=(v,max,label)=>`<div class="exp-bar"><span>${label}</span>
      <div class="check-bar"><i style="width:${Math.min(100,Math.round(100*v/max))}%;${v>max?'background:var(--red)':''}"></i></div>
      <b>${this.fmt(v,0)} / ${max} €</b></div>`;
    el.innerHTML=`
      <h3>Spese vere <span class="badge">${this.exp.length}</span></h3>
      <form class="exp-add" id="expForm">
        <input type="number" id="expAmt" placeholder="Importo" min="0" step="any" inputmode="decimal" required>
        <select id="expCur"><option>KGS</option><option>UZS</option><option>EUR</option><option>USD</option></select>
        <input type="text" id="expDesc" placeholder="Cosa (es. cena, taxi)" maxlength="60">
        <button class="pill on" type="submit">Aggiungi</button>
      </form>
      ${bar(tot.kg,BUDGET.kg.tot,'Kirghizistan')}
      ${bar(tot.uz,BUDGET.uz.tot,'Uzbekistan')}
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
