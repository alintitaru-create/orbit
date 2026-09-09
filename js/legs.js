/* ═══════════════════════════════════════════════════════════
   SETTORE SPOSTAMENTI — le 23 tratte del viaggio raggruppate
   per giornata, con orari, note, avvisi e codici copiabili.
   ═══════════════════════════════════════════════════════════ */
const Legs={
  render(){
    const box=document.getElementById('legList');
    let html='',lastDay=-1;
    LEGS.forEach((Lg,i)=>{
      if(Lg.day!==lastDay){
        lastDay=Lg.day;
        html+=`<div class="leg-day">${DAYS[Lg.day].lbl} — ${DAYS[Lg.day].title}</div>`;
      }
      html+=`<div class="leg" id="leg-${i}">
        <div class="ic" style="background:color-mix(in srgb,${MODE_VAR[Lg.m]} 15%,transparent);color:${MODE_VAR[Lg.m]}">${ICONS[Lg.m]}</div>
        <div>
          <h4>${Lg.t}</h4>
          <div class="when">${Lg.s} · ${MODE_IT[Lg.m]}</div>
          ${Lg.info?`<div class="info">${Lg.info}</div>`:''}
          ${Lg.stay?`<div class="stay"><b>Dormite:</b> ${Lg.stay}</div>`:''}
          ${Lg.warn?`<div class="warn">${Lg.warn}</div>`:''}
          ${Lg.pnr?`<div>${Lg.pnr.map(pnrHtml).join('')}</div>`:''}
        </div>
      </div>`;
    });
    box.innerHTML=html;
    bindCopy(box);
  },
};
