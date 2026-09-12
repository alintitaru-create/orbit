/* ═══════════════════════════════════════════════════════════
   SETTORE PANNELLI FISSI — Oggi, Alloggi, Soldi, App.
   Tutto è generato dai dati in data.js.
   ═══════════════════════════════════════════════════════════ */
const Sections={

  /* ── OGGI: la card cambia da sola in base alla data ── */
  oggi(){
    const el=document.getElementById('oggi-card');
    const today=new Date(); const iso=today.toISOString().slice(0,10);
    const i=DAYS.findIndex(D=>D.d===iso);
    if(i>=0){
      const D=DAYS[i], wx=Weather.of(D), legs=LEGS.filter(l=>l.day===i);
      const nx=this.nextEvent();
      el.innerHTML=`
        <div class="today-date">Oggi · ${D.lbl}</div>
        <h3>${D.title}</h3>
        ${nx?`<div class="next-ev">${micon(nx.Lg.m)}<b>${nx.Lg.t}</b><span>${this.cdTxt(nx.ts-Date.now())}</span></div>`:''}
        <p class="lead">${D.lead}</p>
        <div class="statgrid">
          <div class="stat ${wx.live?'live':''}">Temperatura<b>${Math.round(wx.min)}° / ${Math.round(wx.max)}°</b></div>
          ${wx.pp!=null?`<div class="stat ${wx.pp>=40?'cold':''}">Pioggia<b>${Math.round(wx.pp)}%${wx.pr>0.2?` · ${wx.pr.toFixed(1)} mm`:''}</b></div>`:''}
          <div class="stat">${D.stay?'Stanotte':'Notte'}<b style="font-size:15px;line-height:1.3;margin-top:4px">${D.stay||'—'}</b></div>
          <div class="stat gold">Da spendere<b>~${D.eur} €</b></div>
        </div>
        ${legs.length?`<div class="today-legs">${legs.map(l=>
          `<div class="today-leg">${micon(l.m)}<div><b>${l.t}</b> <span>· ${l.s}</span>${l.warn?`<div class="warn">${l.warn}</div>`:''}</div></div>`).join('')}</div>`:''}
        <p style="margin-top:16px"><a href="#giornate" onclick="Days.select(${i},true)">Apri la giornata completa →</a></p>`;
    } else if(iso<DAYS[0].d){
      const gg=Math.ceil((new Date(DAYS[0].d)-today)/864e5);
      el.innerHTML=`<div class="today-date">In attesa</div><h3>Mancano ${gg} giorni alla partenza</h3><p class="lead">Si parte il ${fmtDay(DAYS[0].d)} da Bergamo, volo Pegasus delle 17:15.</p>`;
    } else {
      el.innerHTML=`<div class="today-date">Concluso</div><h3>Viaggio terminato il ${fmtDay(DAYS[DAYS.length-1].d)}</h3><p class="lead">Quindici giorni, cinque mezzi, dodicimila chilometri. Le informazioni restano qui sotto.</p>`;
    }
  },

  /* ── ALLOGGI ── */
  alloggi(){
    const el=document.getElementById('stayList');
    el.innerHTML=BOOKINGS.map(b=>`
      <div class="card stay-card">
        <div class="top"><span class="city">${b.city}</span><span class="badge ${b.pay.includes('carta')?'blue':'green'}">${b.pay.includes('carta')?'Carta':'Contanti'}</span></div>
        <h3>${b.name}</h3>
        <div class="dates">${fmtDay(b.from)} → ${fmtDay(b.to)} · ${b.nights} ${b.nights>1?'notti':'notte'} · <b>${b.price}</b></div>
        <div class="room">${b.room} · ${b.meals}</div>
        <div class="meta">
          ${pnrHtml('Conferma '+b.conf)}${pnrHtml('PIN '+b.pin)}
          <a class="pnr" style="text-decoration:none" href="tel:${b.tel.replace(/\s/g,'')}">☎ ${b.tel}</a>
        </div>
        <div class="addr">${b.addr}</div>
        ${b.note?`<div class="warn">${b.note}</div>`:''}
        <div class="canc ${b.warn?'bad':''}">${b.canc}</div>
      </div>`).join('');
    bindCopy(el);
  },

  /* ── SOLDI ── */
  soldi(){
    const el=document.getElementById('moneyGrid');
    const table=g=>`<div class="card"><h3>${g.title}</h3><table>
      ${g.rows.map(([n,v])=>`<tr><td>${n}</td><td>${v} €</td></tr>`).join('')}
      <tr class="tot"><td>Totale stimato</td><td>${g.tot} €</td></tr></table>
      <div class="cash">${g.cash}</div></div>`;
    el.innerHTML=`
      <div class="card"><h3>Già pagato</h3><table>
        ${BUDGET.paid.map(([n,v])=>`<tr><td>${n}</td><td>${v}</td></tr>`).join('')}</table>
        <div class="cash">Stime per due persone, dal vostro foglio costi.</div></div>
      ${table(BUDGET.kg)}${table(BUDGET.uz)}`;
    document.getElementById('moneyNote').innerHTML=BUDGET.note;
  },

  /* ── APP ── */
  app(){
    document.getElementById('appGrid').innerHTML=APPS.map(([n,u,d,t])=>
      `<a class="app" href="${u}" target="_blank" rel="noopener"><b>${n}</b><span>${d}</span><em>${t}</em></a>`).join('');
  },

  /* ── PRATICO & EMERGENZE ── */
  pratico(){
    document.getElementById('praticoGrid').innerHTML=`
      <div class="card"><h3>Emergenze</h3><table class="plain">
        ${PRATICO.emergenze.map(([n,d])=>`<tr><td><a href="tel:${n.replace(/[^\d+]/g,'')}" class="pnr" style="text-decoration:none">${n}</a></td><td>${d}</td></tr>`).join('')}
      </table></div>
      <div class="card"><h3>Da sapere</h3><table class="plain">
        ${PRATICO.info.map(([n,d])=>`<tr><td><b>${n}</b></td><td>${d}</td></tr>`).join('')}
      </table></div>
      <div class="card"><h3>Frasi che aprono porte</h3><table class="plain frasi">
        ${PRATICO.frasi.map(([it,pr,orig])=>`<tr><td>${it}</td><td><b>${pr}</b></td><td class="muted">${orig}</td></tr>`).join('')}
      </table><p class="muted" style="margin-top:10px">${PRATICO.note}</p></div>`;
  },

  /* ── prossimo evento con orario, per il countdown di Oggi ── */
  nextEvent(){
    const now=Date.now();
    for(const Lg of LEGS){
      const m=Lg.s.match(/(\d{1,2}):(\d{2})/); if(!m) continue;
      const D=DAYS[Lg.day], [y,mo,d]=D.d.split('-').map(Number);
      const ts=Date.UTC(y,mo-1,d,+m[1]-tzOf(Lg.a),+m[2]);
      if(ts>now) return {Lg,ts};
    }
    return null;
  },
  cdTxt(ms){
    const min=Math.round(ms/60000), h=Math.floor(min/60), g=Math.floor(h/24);
    return g>0?`tra ${g} g e ${h%24} h`:h>0?`tra ${h} h ${min%60} min`:`tra ${min} min`;
  },
};
