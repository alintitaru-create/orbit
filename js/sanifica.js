/* ═══════════════════════════════════════════════════════════
   SETTORE RIPULITURA — decide cosa può vedere chi non è di casa.

   Usato da due parti, di proposito una sola volta:
     · tools/lock.mjs sul computer
     · js/dati.js nel telefono, quando si pubblica dalla pagina
   Due copie della stessa logica potrebbero divergere, e una
   divergenza qui significa dati riservati su una pagina pubblica.

   IMPORTANTE — in questo file non c'è nessun dato riservato.
   Nomi delle strutture, indirizzi, codici e cognomi vengono
   ricavati a ogni giro dai dati privati (che restano cifrati):
   scriverli qui vorrebbe dire pubblicarli, visto che questo file
   è leggibile da chiunque. Qui restano solo forme generiche —
   un numero di dieci cifre, un prefisso telefonico — che non
   dicono nulla di per sé.
   ═══════════════════════════════════════════════════════════ */
const Sanifica={
  /* forme riconoscibili che non rivelano nulla se lette da sole */
  CODICI:/\b(?:conf\.?|PNR|TKT|Ordine)[\s:]*[A-Z0-9-]{5,}\b/gi,
  GENERICI:[/\b\d{10}\b/,/\bPIN\b/,/\+996|\+998/],

  esc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); },

  /* Ricava dai dati privati l'elenco di ciò che non deve uscire.
     Si aggiorna da solo: se domani cambia un albergo, il controllo
     lo sa senza che nessuno debba ricordarsi di aggiornare una lista. */
  riservatiDa(BOOKINGS,LEGS,DAYS,extra){
    const nomi=new Set(), vie=new Set(), codici=new Set();
    const aggiungiCodice=t=>{ if(t&&String(t).length>=4) codici.add(String(t).trim()); };

    (BOOKINGS||[]).forEach(b=>{
      if(b.name) nomi.add(b.name.trim());
      aggiungiCodice(b.conf); aggiungiCodice(b.pin);
      if(b.tel) aggiungiCodice(b.tel.replace(/\s+/g,''));
      if(b.addr) b.addr.split(/[,\d]+/).map(s=>s.trim())
        .filter(s=>s.length>4&&!/^(street|ulitsa|kirghizistan|uzbekistan|bishkek|karakol|tashkent|samarkand|bokonbayevo)$/i.test(s))
        .forEach(s=>vie.add(s));
    });
    /* Nel campo "dove si dorme" non ci sono solo alberghi: ci sono anche
       "Tenda", "Casa", "Nessuna: notte in aeroporto". Prese per nomi
       propri, parole comuni come "casa" bloccherebbero frasi normali.
       Si tiene solo ciò che è davvero il nome di una struttura. */
    const STRUTTURA=/guest\s?house|guesthouse|hostel|ostello|hotel|albergo|b&b|yurta/i;
    [...(LEGS||[]),...(DAYS||[])].forEach(x=>{
      if(x.stay){
        const n=String(x.stay).split(',')[0].replace(/^yurta\s+con\s+/i,'').trim();
        if(n.length>=6&&STRUTTURA.test(n)) nomi.add(n);
      }
      (x.pnr||[]).forEach(p=>String(p).split(/\s+/)
        .forEach(t=>{ if(/^[A-Z0-9]{5,}$/i.test(t)) aggiungiCodice(t); }));
    });
    (extra||[]).forEach(s=>{ if(s) codici.add(String(s).trim()); });

    /* Nei testi la struttura compare anche senza la parte generica:
       "Hotel Tal dei Tali" diventa "il Tal dei Tali". Si aggiunge il
       nocciolo distintivo, saltando però le parole troppo corte o comuni:
       da certe strutture verrebbe fuori un verbo italiano, e cancellerebbe
       mezza pagina. */
    const GENERICHE=/^(?:hostel|hotel|ostello|guest\s?house|guesthouse|b&b)\s+|\s+(?:guest\s?house|guesthouse|hotel|hostel)$/gi;
    const COMUNI=new Set(['sono','casa','tenda','notte','passo','nessuna','camera','centro','piazza']);
    [...nomi].forEach(n=>{
      const nocciolo=n.replace(GENERICHE,'').trim();
      if(nocciolo&&nocciolo!==n&&nocciolo.length>=5&&!COMUNI.has(nocciolo.toLowerCase()))
        nomi.add(nocciolo);
    });

    const pulisciSet=s=>[...s].filter(Boolean).sort((a,b)=>b.length-a.length);
    return {nomi:pulisciSet(nomi),vie:pulisciSet(vie),codici:pulisciSet(codici)};
  },

  /* Costruisce le espressioni a partire dall'elenco ricavato.

     Si cercano parole intere: il nome di una struttura può essere
     contenuto in una parola italiana comune del racconto. Senza
     questo accorgimento il controllo dava falsi allarmi e la ripulitura
     storpiava frasi italiane del tutto innocenti.
     I confini si mettono solo dove la parola comincia o finisce con
     lettere latine: sul cirillico non funzionerebbero. */
  parola(x){
    const e=this.esc(x);
    return (/^[A-Za-z0-9]/.test(x)?'\\b':'')+e+(/[A-Za-z0-9]$/.test(x)?'\\b':'');
  },
  regole(ris){
    const o=a=>a.map(x=>this.parola(x)).join('|');
    return {
      nomi: ris.nomi.length?new RegExp(o(ris.nomi),'gi'):null,
      vie:  ris.vie.length ?new RegExp(',?\\s*(?:'+o(ris.vie)+')[^,.;]*','gi'):null,
      vietati: ris.nomi.concat(ris.vie,ris.codici)
                 .map(x=>new RegExp(this.parola(x),'i')).concat(this.GENERICI),
    };
  },

  pulisci(s,r){
    if(typeof s!=='string') return s;
    let t=s.replace(this.CODICI,'');
    if(r&&r.vie)  t=t.replace(r.vie,'');
    if(r&&r.nomi) t=t.replace(r.nomi,'la guesthouse');
    /* la sostituzione lascia frasi zoppe — "di la guesthouse GH" —
       perché toglie un nome proprio da una frase costruita attorno */
    t=t.replace(/\bla guesthouse\s+(?:GH|G\.H\.)\b/gi,'la guesthouse')
       .replace(/\bdi la guesthouse\b/gi,'della guesthouse')
       .replace(/\ba la guesthouse\b/gi,'alla guesthouse')
       .replace(/\bda la guesthouse\b/gi,'dalla guesthouse')
       .replace(/\bin la guesthouse\b/gi,'nella guesthouse');
    return t.replace(/\s{2,}/g,' ').replace(/\s+([,.;])/g,'$1').replace(/[\s,;·]+$/,'').trim();
  },
  eAlloggio(s,r){ if(!r||!r.nomi) return false; r.nomi.lastIndex=0; return r.nomi.test(s||''); },

  /* costruisce il testo di pubblico/dati.js a partire dai dati veri */
  genera(P,LEGS,DAYS,POIS,WAYPTS,riservati){
    const ris=riservati||{nomi:[],vie:[],codici:[]};
    const r=this.regole(ris);
    const pul=s=>this.pulisci(s,r);

    const legs=LEGS.map(L=>({a:L.a,b:L.b,m:L.m,day:L.day,t:pul(L.t),s:pul(L.s)}));
    const days=DAYS.map(D=>({
      d:D.d,lbl:D.lbl,title:D.title,wx:D.wx,at:D.at,km:D.km,eff:D.eff,clim:D.clim,modes:D.modes,
      lead:pul(D.lead),
      see:(D.see||[]).filter(x=>!this.eAlloggio(x,r)).map(pul),
      /* anche le didascalie delle foto passano dalla ripulitura: sono
         prosa descrittiva, ma non c'è motivo di fare un'eccezione */
      photos:(D.photos||[]).map(p=>({...p,h:pul(p.h),c:pul(p.c)})),
    }));
    const pois={};
    Object.entries(POIS).forEach(([d,set])=>{
      const items=set.items
        .filter(p=>!this.eAlloggio(p.n,r)&&!this.eAlloggio(p.desc,r))
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

    /* ultima rete: se qualcosa di riservato è comunque passato, si dice
       quale, ma solo come indizio — non si ristampa il valore */
    const trovati=r.vietati.filter(x=>x.test(testo))
      .map(x=>{ const s=String(x.source); return s.length>12?s.slice(0,6)+'…':s; });
    return {testo,trovati,
            conteggi:{giornate:days.length,tratte:legs.length,
                      luoghi:Object.values(pois).reduce((n,s)=>n+s.items.length,0)}};
  },
};
if(typeof module!=='undefined') module.exports=Sanifica;
