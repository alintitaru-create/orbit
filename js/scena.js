/* ═══════════════════════════════════════════════════════════
   SETTORE SCENA — la pagina che si muove con chi la scorre.

   Due cose sole:
   · nella barra in alto si accende la voce della sezione che si
     sta guardando, così si sa sempre dove si è
   · le sezioni salgono piano quando entrano nello schermo, una
     volta sola, e poi restano ferme

   Senza questo file la pagina funziona e si vede tutta: le sezioni
   partono nascoste solo se c'è la classe "scena" su <html>, che
   mette questo file. Chi ha chiesto meno movimento al telefono non
   vede animazioni, ma la voce accesa nella barra sì.
   ═══════════════════════════════════════════════════════════ */
const Scena={
  init(){
    if(!('IntersectionObserver' in window)) return;
    this.barra();
    if(!matchMedia('(prefers-reduced-motion:reduce)').matches) this.entrate();
  },

  /* la voce accesa: vince la sezione che occupa la fascia alta dello schermo */
  barra(){
    const voci=[...document.querySelectorAll('nav .in a[href^="#"]')];
    if(!voci.length) return;
    const perId=new Map(voci.map(a=>[a.getAttribute('href').slice(1),a]));
    const sezioni=[...perId.keys()].map(id=>document.getElementById(id)).filter(Boolean);
    const accendi=id=>{
      voci.forEach(a=>{ const si=a===perId.get(id); a.classList.toggle('qui',si); if(si) a.setAttribute('aria-current','true'); else a.removeAttribute('aria-current'); });
      /* sul telefono la voce accesa scorre in vista dentro la barra */
      const a=perId.get(id), box=a?.parentElement;
      if(a&&box&&box.scrollWidth>box.clientWidth)
        box.scrollTo({left:a.offsetLeft-box.clientWidth/2+a.offsetWidth/2,behavior:'smooth'});
    };
    const io=new IntersectionObserver(es=>{
      es.forEach(e=>{ if(e.isIntersecting) accendi(e.target.id); });
    },{rootMargin:'-30% 0px -65% 0px'});
    sezioni.forEach(s=>io.observe(s));
  },

  /* le sezioni che salgono: si accendono appena ne spunta un pezzo */
  entrate(){
    const sezioni=[...document.querySelectorAll('main > section')];
    if(!sezioni.length) return;
    document.documentElement.classList.add('scena');
    const io=new IntersectionObserver(es=>es.forEach(e=>{
      if(e.isIntersecting){ e.target.classList.add('vista'); io.unobserve(e.target); }
    }),{rootMargin:'0px 0px -8% 0px'});
    sezioni.forEach(s=>io.observe(s));
  },
};
Scena.init();
