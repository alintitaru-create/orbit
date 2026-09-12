/* ═══════════════════════════════════════════════════════════
   SETTORE OROLOGI — ora locale di Italia, Kirghizistan,
   Uzbekistan e Abu Dhabi nella testata.
   ═══════════════════════════════════════════════════════════ */
const Clocks={
  zones:[["Italia","Europe/Rome"],["Kirghizistan","Asia/Bishkek"],["Uzbekistan","Asia/Tashkent"],["Abu Dhabi","Asia/Dubai"]],
  init(){
    const box=document.getElementById('clocks');
    box.innerHTML=this.zones.map(([n])=>`<div>${n}<b data-z="${n}">--:--</b></div>`).join('');
    const tick=()=>this.zones.forEach(([n,tz])=>{
      box.querySelector(`[data-z="${n}"]`).textContent=
        new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:tz});
    });
    tick(); setInterval(tick,15000);
  },
};
