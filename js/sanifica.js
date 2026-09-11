/* ═══════════════════════════════════════════════════════════
   SETTORE RIPULITURA — decide cosa può vedere chi non è di casa.

   Questo file è usato da due parti diverse:
     · tools/lock.mjs sul computer
     · js/dati.js nel telefono, quando si pubblica dalla pagina
   ed è di proposito uno solo: due copie della stessa logica
   potrebbero divergere, e una divergenza qui significa dati
   riservati finiti su una pagina pubblica.

   Tiene il racconto — giornate, luoghi, cosa si va a vedere —
   e butta via codici di prenotazione, nomi delle strutture,
   indirizzi, telefoni e spese. Alla fine ricontrolla il
   risultato: se qualcosa è sfuggito, lo dice e non si pubblica.
   ═══════════════════════════════════════════════════════════ */
const Sanifica={
  /* codici di prenotazione in ogni forma */
  CODICI:/\b(?:conf\.?|PNR|TKT|Ordine|Trip\.com|BRB|TRPAP)[\s:]*[A-Z0-9-]{5,}\b/gi,
  /* nomi propri delle strutture: sostituiti da una parola generica,
     così la frase resta leggibile invece di spezzarsi */
  NOMI:/(?:Hostel\s+)?Compass\s*3|Meerim(?:\s+Guest\s*House)?|Guest\s*house\s+SONO|Hotel\s+Usmoon|Vasiev'?s?(?:\s+Hotel)?|Nomad\s+Guest\s*House/gi,
  /* vie e indirizzi: via del tutto */
  VIE:/,?\s*(?:Derbisheva|Bogidil|Moskovskaya|Shohruh\s+Mirzo|Aubakirova|Тойчубеков|Yakkasaray|Яккасарайский)[^,.;]*/gi,
  /* nulla di tutto questo deve comparire nel risultato */
  VIETATI:[/\b\d{10}\b/,/\bPIN\b/,/78NSHT/,/26RKZH/,/CTPCI4/,/JLKXPM/,/TRPAP/,/14PCLE/,
           /Ciancio/i,/Titaru/i,/Derbisheva/i,/Bogidil/i,/Moskovskaya/i,/Aubakirova/i,
           /Compass/i,/Meerim/i,/Usmoon/i,/Vasiev/i,/\+996|\+998/],

  pulisci(s){
    return typeof s==='string'
      ? s.replace(this.CODICI,'').replace(this.VIE,'').replace(this.NOMI,'la guesthouse')
         .replace(/\s{2,}/g,' ').replace(/\s+([,.;])/g,'$1').replace(/[\s,;·]+$/,'').trim()
      : s;
  },
  eAlloggio(s){ this.NOMI.lastIndex=0; return this.NOMI.test(s||''); },

  /* costruisce il testo di pubblico/dati.js a partire dai dati veri */
  genera(P,LEGS,DAYS,POIS,WAYPTS){
    const pul=s=>this.pulisci(s);
    const legs=LEGS.map(L=>({a:L.a,b:L.b,m:L.m,day:L.day,t:pul(L.t),s:pul(L.s)}));
    const days=DAYS.map(D=>({
      d:D.d,lbl:D.lbl,title:D.title,wx:D.wx,at:D.at,km:D.km,eff:D.eff,clim:D.clim,modes:D.modes,
      lead:pul(D.lead),
      see:(D.see||[]).filter(x=>!this.eAlloggio(x)).map(pul),
      photos:D.photos||[],
    }));
    const pois={};
    Object.entries(POIS).forEach(([d,set])=>{
      const items=set.items
        .filter(p=>!this.eAlloggio(p.n)&&!this.eAlloggio(p.desc))
        .map(p=>({n:p.n,la:p.la,lo:p.lo,src:p.src,note:pul(p.note),desc:pul(p.desc)}));
      if(items.length) pois[d]={city:set.city,z:set.z,items};
    });

    const testo=
      '/* Dati pubblici per la pagina dei cari. Generato da tools/lock.mjs.\n'+
      '   Niente codici, strutture, indirizzi, telefoni o spese: solo il racconto. */\n'+
      'const P='+JSON.stringify(P)+';\n'+
      'const LEGS='+JSON.stringify(legs)+';\n'+
      'const DAYS='+JSON.stringify(days)+';\n'+
      'const POIS='+JSON.stringify(pois)+';\n'+
      'const WAYPTS='+JSON.stringify(WAYPTS)+';\n';

    const trovati=this.VIETATI.filter(r=>r.test(testo)).map(String);
    return {testo,trovati,
            conteggi:{giornate:days.length,tratte:legs.length,
                      luoghi:Object.values(pois).reduce((n,s)=>n+s.items.length,0)}};
  },
};
if(typeof module!=='undefined') module.exports=Sanifica;
