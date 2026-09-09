/* ═══════════════════════════════════════════════════════════
   SETTORE ORNAMENTI — i motivi tradizionali della pagina.

   tunduk    : la corona di legno del tetto della yurta, quella
               della bandiera kirghisa. Ruota lentamente.
   corna     : la fascia a "corna d'ariete" (kochkor muyuz), il
               motivo più diffuso sui feltri kirghisi. Scorre.
   riga      : la riga ornamentale che si disegna da sola quando
               la sezione entra nello schermo.
   girih     : la stella a otto punte islamica, il motivo delle
               piastrelle di Samarcanda. Compare sulle sezioni
               uzbeke e come sigillo nelle card.
   ═══════════════════════════════════════════════════════════ */
const Orn={
  tunduk(size){ return `<svg class="tunduk" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <circle cx="50" cy="50" r="42" stroke="var(--kg-red)" stroke-width="5"/>
    <circle cx="50" cy="50" r="30" stroke="var(--kg-red)" stroke-width="3"/>
    <path d="M50 20v60M20 50h60M29 29l42 42M71 29L29 71" stroke="var(--steppe)" stroke-width="3" stroke-linecap="round"/>
    <g stroke="var(--steppe)" stroke-width="4" stroke-linecap="round">
      <path d="M8 50c0-16 8-28 16-34M92 50c0-16-8-28-16-34M8 50c0 16 8 28 16 34M92 50c0 16-8 28-16 34"/>
    </g></svg>`; },

  /* fascia a corna d'ariete: pattern che scorre all'infinito */
  banda(){ return `<div class="orn" aria-hidden="true"><svg viewBox="0 0 2000 24" preserveAspectRatio="none">
    <defs><pattern id="kochkor" width="80" height="24" patternUnits="userSpaceOnUse">
      <path d="M40 21V9M40 9c0-6 5-8 8-5s2 7-3 7c-3 0-5-2-5-2M40 9c0-6-5-8-8-5s-2 7 3 7c3 0 5-2 5-2M0 12h20M60 12h20"
            fill="none" stroke="var(--steppe)" stroke-width="1.7" stroke-linecap="round"/>
      <circle cx="20" cy="12" r="1.9" fill="var(--kg-red)"/><circle cx="60" cy="12" r="1.9" fill="var(--kg-red)"/>
    </pattern></defs><rect width="2000" height="24" fill="url(#kochkor)"/></svg></div>`; },

  /* stella a otto punte (girih), motivo delle maioliche uzbeke */
  girih(size,cls){ return `<svg class="girih ${cls||''}" width="${size}" height="${size}" viewBox="0 0 100 100" fill="none" aria-hidden="true">
    <g stroke="var(--teal)" stroke-width="2.4" stroke-linejoin="round">
      <path d="M50 6 61 28 85 28 68 45 76 68 50 55 24 68 32 45 15 28 39 28Z" opacity=".9"/>
      <path d="M50 94 39 72 15 72 32 55 24 32 50 45 76 32 68 55 85 72 61 72Z" opacity=".55"/>
    </g><circle cx="50" cy="50" r="7" stroke="var(--steppe)" stroke-width="2.4"/></svg>`; },

  /* riga ornamentale che si disegna quando entra nello schermo */
  riga(){ return `<div class="rule" aria-hidden="true"><svg viewBox="0 0 1200 16" preserveAspectRatio="none">
    <path d="M0 8h430c10 0 14-6 20-6s10 6 20 6h28c8 0 8-7 14-7s6 7 14 7h28c10 0 14-6 20-6s10 6 20 6h606"/></svg></div>`; },

  /* mette una riga ornamentale sotto ogni titolo di sezione e
     la fa disegnare quando la sezione entra nello schermo */
  init(){
    document.querySelectorAll('main section > h2').forEach(h=>{
      h.insertAdjacentHTML('afterend',this.riga());
    });
    /* le sezioni uzbeke prendono il sigillo girih, le altre il tunduk */
    const uz=['soldi','documenti'];
    document.querySelectorAll('main section').forEach(s=>{
      const h=s.querySelector('h2'); if(!h) return;
      h.insertAdjacentHTML('afterbegin',
        uz.includes(s.id)?this.girih(26,'inline'):`<span class="tk-inline">${this.tunduk(24)}</span>`);
    });
    if('IntersectionObserver' in window){
      const io=new IntersectionObserver(es=>es.forEach(e=>{
        if(e.isIntersecting){ e.target.classList.add('draw'); io.unobserve(e.target); }
      }),{rootMargin:'-10% 0px'});
      document.querySelectorAll('.rule').forEach(r=>io.observe(r));
    } else document.querySelectorAll('.rule').forEach(r=>r.classList.add('draw'));
  },
};
