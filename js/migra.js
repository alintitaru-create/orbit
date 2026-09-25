/* ═══════════════════════════════════════════════════════════
   SETTORE TRASLOCO — una volta sola, e poi mai più.

   Prima dello scaffale c'era un viaggio solo, e le cose salvate
   nel browser non portavano il suo nome: la checklist si chiamava
   "orbit_chk", il diario "orbit_diary_2026-09-11". Con più viaggi
   quei nomi si darebbero addosso a vicenda.

   Qui le cose vecchie prendono il nome del viaggio a cui
   appartengono — il Kirghizistan, l'unico che ci fosse. Senza
   questo passaggio il diario e le spese sembrerebbero spariti.

   Gira su tutti e due i telefoni e sul Mac, ognuno una volta sola:
   il segno resta nel browser.
   ═══════════════════════════════════════════════════════════ */
const Migra={
  SEGNO:'orbit_traslocato',
  PRIMO:'kg2026',          /* il viaggio che c'era prima dello scaffale */

  fatto(){ try{ return localStorage.getItem(this.SEGNO)==='1'; }catch(e){ return true; } },

  /* Le cose salvate nel browser. I nomi nuovi finiscono con il
     viaggio: orbit_chk:kg2026, orbit_diary:kg2026:2026-09-11 */
  chiavi(){
    const v=this.PRIMO, mappa=[
      ['orbit_chk',        `orbit_chk:${v}`],
      ['orbit_chk_extra',  `orbit_chk_extra:${v}`],
      ['orbit_exp',        `orbit_exp:${v}`],
      ['orbit_geo',        `orbit_geo:${v}`],
      ['orbit_wx2',        `orbit_wx2:${v}`],
    ];
    /* il diario ha una chiave per giornata */
    for(let i=0;i<localStorage.length;i++){
      const k=localStorage.key(i);
      if(k&&k.startsWith('orbit_diary_')) mappa.push([k,`orbit_diary:${v}:${k.slice(12)}`]);
    }
    let spostate=0;
    mappa.forEach(([vecchia,nuova])=>{
      try{
        const val=localStorage.getItem(vecchia);
        if(val===null) return;
        if(localStorage.getItem(nuova)===null) localStorage.setItem(nuova,val);
        localStorage.removeItem(vecchia);
        spostate++;
      }catch(e){}
    });
    return spostate;
  },

  async tutto(){
    if(this.fatto()) return;
    const n=this.chiavi();
    /* le foto le sistema media.js quando apre il suo deposito:
       lì si può marcarle tutte dentro la stessa operazione */
    try{ localStorage.setItem(this.SEGNO,'1'); }catch(e){}
    if(n) console.log(`Trasloco: ${n} cose passate sotto "${this.PRIMO}".`);
  },
};
