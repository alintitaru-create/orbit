/* ═══════════════════════════════════════════════════════════
   SETTORE TRASLOCO — le cose salvate prima dello scaffale.

   Prima c'era un viaggio solo, e quello che il browser teneva da
   parte non portava il suo nome: la checklist si chiamava
   "orbit_chk", il diario "orbit_diary_2026-09-11", le spese
   "orbit_exp". Con più viaggi quei nomi si darebbero addosso.

   Qui le cose vecchie prendono il nome del viaggio a cui
   appartengono — il Kirghizistan, l'unico che ci fosse.

   Gira a ogni avvio, non una volta sola, e **unisce invece di
   sostituire**. Il motivo è pratico: la pagina si salva per
   funzionare offline, quindi dopo un aggiornamento il telefono può
   ancora far girare il codice vecchio per un giro, e quel giro
   scrive di nuovo con i nomi di prima. Se il trasloco fosse una
   cosa sola, quelle spese resterebbero in un cassetto che nessuno
   apre più. Così invece il giro dopo le ritrova e le rimette a posto.

   Regola che non si tocca: **non si cancella mai niente prima di
   averlo messo al sicuro altrove.**
   ═══════════════════════════════════════════════════════════ */
const Migra={
  PRIMO:'kg2026',          /* il viaggio che c'era prima dello scaffale */

  leggi(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } },
  scrivi(k,v){ try{ localStorage.setItem(k,v); return true; }catch(e){ return false; } },
  togli(k){ try{ localStorage.removeItem(k); }catch(e){} },

  /* ── le spese: due elenchi diventano uno, senza doppioni ──
     Ogni spesa ha il suo istante (t): è quello a dire se è la stessa. */
  uniSpese(vecchio,nuovo){
    const a=JSON.parse(vecchio), b=nuovo?JSON.parse(nuovo):[];
    if(!Array.isArray(a)) return null;
    const visti=new Set((Array.isArray(b)?b:[]).map(x=>x.t));
    const insieme=[...(Array.isArray(b)?b:[])];
    a.forEach(x=>{ if(!visti.has(x.t)){ insieme.push(x); visti.add(x.t); } });
    return JSON.stringify(insieme.sort((x,y)=>x.t-y.t));
  },

  /* ── checklist: due mappe di spunte diventano una ──
     Chi ha spuntato vince: una spunta in più è meno grave di una persa. */
  uniSpunte(vecchio,nuovo){
    const a=JSON.parse(vecchio), b=nuovo?JSON.parse(nuovo):{};
    if(typeof a!=='object'||!a) return null;
    return JSON.stringify({...a,...(typeof b==='object'&&b?b:{})});
  },

  /* ── diario: se ci sono due testi diversi si tengono tutti e due ──
     Quasi sempre uno è la continuazione dell'altro — si era ripresa la
     nota e si è scritto ancora — e allora vince il più lungo, senza
     ripetizioni. Solo quando sono davvero diversi si tengono tutti e
     due: meglio una riga da cancellare a mano che una sera persa. */
  uniTesto(vecchio,nuovo){
    const v=(vecchio||'').trim(), n=(nuovo||'').trim();
    if(!v) return n;
    if(!n) return v;
    if(n.includes(v)) return n;
    if(v.includes(n)) return v;
    return n+'\n\n'+v;
  },

  /* Sposta una chiave sola. Scrive prima, cancella dopo: se la
     scrittura non riesce (memoria piena), il vecchio resta dov'era. */
  sposta(vecchia,nuova,unisci){
    const val=this.leggi(vecchia);
    if(val===null) return 0;
    let finale=val;
    const gia=this.leggi(nuova);
    if(gia!==null&&unisci){
      try{ finale=unisci(val,gia); }catch(e){ finale=null; }
      if(finale===null){
        /* non si capisce come unirli: si mette da parte il vecchio
           invece di buttarlo, e si lascia stare */
        if(this.scrivi(nuova+':prima-dello-scaffale',val)) this.togli(vecchia);
        return 1;
      }
    }
    if(!this.scrivi(nuova,finale)) return 0;
    this.togli(vecchia);
    return 1;
  },

  async tutto(){
    const v=this.PRIMO;
    let n=0;
    n+=this.sposta('orbit_exp',       `orbit_exp:${v}`,       (a,b)=>this.uniSpese(a,b));
    n+=this.sposta('orbit_chk',       `orbit_chk:${v}`,       (a,b)=>this.uniSpunte(a,b));
    n+=this.sposta('orbit_chk_extra', `orbit_chk_extra:${v}`, (a,b)=>this.uniSpunte(a,b));

    /* il diario ha una chiave per giornata */
    const diari=[];
    try{
      for(let i=0;i<localStorage.length;i++){
        const k=localStorage.key(i);
        if(k&&k.startsWith('orbit_diary_')) diari.push(k);
      }
    }catch(e){}
    diari.forEach(k=>{ n+=this.sposta(k,`orbit_diary:${v}:${k.slice(12)}`,(a,b)=>this.uniTesto(a,b)); });

    /* meteo e strade sono solo copie di comodo: si rifanno da sole */
    ['orbit_geo','orbit_wx2'].forEach(k=>this.togli(k));

    if(n) console.log(`Trasloco: ${n} cose passate sotto "${v}".`);
  },
};
