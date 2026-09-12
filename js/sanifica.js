/* ═══════════════════════════════════════════════════════════
   SETTORE RIPULITURA — decide cosa può vedere chi non è di casa.

   Questo file è usato da due parti diverse:
     · tools/lock.mjs sul computer
     · js/dati.js nel telefono, quando si pubblica dalla pagina
   ed è di proposito uno solo: due copie della stessa logica
   potrebbero divergere, e una divergenza qui significa dati
   riservati finiti su una pagina pubblica.

   Qui dentro c'è soltanto il METODO. I nomi delle strutture, i
   codici, gli indirizzi e i telefoni da togliere NON sono scritti
   qui: si ricavano ogni volta dai dati veri (le prenotazioni, dove
   si dorme ogni notte, i codici delle tratte), che stanno nel file
   cifrato. Questo file invece finisce online in chiaro, e un elenco
   scritto qui sarebbe l'elenco stesso dei segreti.

   Lo stesso elenco serve per due cose: togliere i dati dal testo e
   ricontrollare il risultato. Essendo uno solo non possono più
   divergere — prima i nomi da togliere erano sei e quelli da
   ricontrollare quattro, e una struttura abbreviata è passata in mezzo.

   Alla fine ricontrolla il risultato: se qualcosa è sfuggito, lo
   dice e non si pubblica.
   ═══════════════════════════════════════════════════════════ */
const Sanifica={
  /* Parole troppo comuni per identificare da sole una struttura: da
     «Rossi Guest House» il nome vero è «Rossi», non «House».
     Qui stanno anche le parole italiane correnti, e non per pignoleria:
     se una struttura si chiama con una parola comune, prenderla per un
     nome proprio vorrebbe dire cancellarla da tutto il racconto. */
  GENERICHE:new Set([
    'hotel','hostel','hostal','ostello','albergo','guest','guesthouse','house','inn','resort',
    'camp','yurt','yurta','yurte','apartment','apartments','rooms','room','bed','breakfast','the',
    'sono','siamo','siete','essere','stato','stata','anche','ancora','come','dove','quando','molto',
    'poco','tutto','tutta','tutti','tutte','prima','dopo','sotto','sopra','senza','verso','dentro',
    'fuori','ogni','bene','quello','quella','questo','questa','della','delle','dello','degli',
    'nella','nelle','alla','alle','dalla','dalle','sulla','sulle','con','presso','vicino','lungo',
    'casa','notte','giorno','sera','mattina','centro','piazza','strada','stazione','aeroporto',
    'lago','valle','monte','passo','museo','mercato','bazar','parco','treno','taxi','cena','pranzo']),
  /* le stesse parole viste dalla parte del testo: possono stare
     attaccate al nome, prima o dopo, e vanno via insieme a lui */
  ATTORNO:'(?:hotel|hostel|hostal|ostello|albergo|guest\\s*house|guesthouse|gh|camp|yurt\\s*camp)',

  /* etichette che precedono un codice di prenotazione */
  CODICI:/\b(?:conf\.?|PNR|TKT|Ordine|Trip\.com|BRB)[\s:]*[A-Z0-9-]{5,}\b/gi,

  /* controlli che non dipendono dai dati: valgono sempre */
  SEMPRE:[['un PIN',/\bPIN\b/i],
          ['un numero lungo, forse un codice',/\b\d{10}\b/],
          ['un numero di telefono',/\+\d[\d\s.-]{7,}/]],

  fuga(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&').replace(/\s+/g,'\\s+'); },

  /* ── l'elenco dei termini riservati, ricavato dai dati veri ── */
  termini(d){
    const B=d.BOOKINGS||[], L=d.LEGS||[], D=d.DAYS||[];
    const parole=s=>String(s==null?'':s).split(/[^\p{L}\p{N}&']+/u).filter(Boolean);

    /* i nomi dei luoghi non sono segreti, e vanno protetti: «Song Kul»
       è il lago, non la struttura, e toglierlo cancellerebbe il racconto */
    const luoghi=new Set();
    Object.values(d.P||{}).forEach(v=>parole(v&&v[2]).forEach(w=>luoghi.add(w.toLowerCase())));
    Object.values(d.POIS||{}).forEach(s=>parole(s&&s.city).forEach(w=>luoghi.add(w.toLowerCase())));

    const distintiva=w=>{
      const b=w.replace(/['']s?$/i,'');
      return b.length>=4&&!/^\d+$/.test(b)&&
             !this.GENERICHE.has(b.toLowerCase())&&!luoghi.has(b.toLowerCase()) ? b : null;
    };
    const raccogli=(valori,dentro)=>valori.filter(Boolean).forEach(v=>
      parole(v).forEach(w=>{ const b=distintiva(w); if(b) dentro.add(b); }));

    /* strutture: dalle prenotazioni e da dove si dorme ogni notte */
    const frasi=new Set(), nomi=new Set();
    [...B.map(b=>b.name),...D.map(x=>x.stay),...L.map(x=>x.stay)].filter(Boolean).forEach(n=>{
      const frase=String(n).split(',')[0].trim();
      if(frase.length>=4) frasi.add(frase);
    });
    raccogli([...B.map(b=>b.name),...D.map(x=>x.stay),...L.map(x=>x.stay)],nomi);

    /* indirizzi: il nome della via, che poi si porta via il resto */
    const vie=new Set();
    raccogli(B.map(b=>b.addr),vie);

    /* codici di prenotazione e PIN */
    const codici=new Set();
    [...B.map(b=>b.conf),...B.map(b=>b.pin),...L.flatMap(x=>x.pnr||[])]
      .filter(Boolean).forEach(c=>parole(c).forEach(w=>{
        if(/^(?=.*[A-Z])[A-Z0-9-]{5,}$/.test(w)||/^\d{6,}$/.test(w)) codici.add(w);
      }));

    /* telefoni: si tengono le sole cifre, il testo può spaziarle a piacere */
    const tel=new Set();
    B.map(b=>b.tel).filter(Boolean).forEach(t=>{
      const c=String(t).replace(/\D/g,''); if(c.length>=7) tel.add(c);
    });

    /* quello che i dati non possono sapere da soli (cognomi, per esempio)
       si aggiunge in js/data.js con  const RISERVATI=['…','…'] */
    return {frasi:[...frasi],nomi:[...nomi],vie:[...vie],codici:[...codici],tel:[...tel],
            extra:(d.RISERVATI||[]).map(String).filter(Boolean)};
  },

  /* ── da quell'elenco nascono sia le sostituzioni sia i controlli ── */
  regole(T){
    const org=a=>[...new Set(a.filter(Boolean).map(String))].sort((x,y)=>y.length-x.length);
    const bordo='(?![\\p{L}\\p{N}])', prima='(^|[^\\p{L}\\p{N}])';
    const alt=a=>a.map(x=>this.fuga(x)).join('|');
    const flessibile=t=>'\\+?'+t.replace(/\D/g,'').split('').join('[\\s.-]*');

    const frasi=org(T.frasi), soli=org(T.nomi), vie=org(T.vie), codici=org(T.codici);
    const R={};
    if(frasi.length||soli.length){
      /* Prima il nome per intero, poi la singola parola: così «Hostel
         Rossi 3» se ne va tutto insieme invece di lasciare un «3».
         Le parole generiche attaccate al nome, prima o dopo, se ne vanno
         con lui: «Rossi GH» sparisce senza lasciare un «GH» orfano. */
      const corpo='(?:'+[
        frasi.length?alt(frasi):null,
        soli.length?'(?:'+this.ATTORNO+'\\s+)?(?:'+alt(soli)+')(?:\\s+\\d{1,3})?'+
                    '(?:\\s+'+this.ATTORNO+')?':null,
      ].filter(Boolean).join('|')+')';
      R.NOMI=new RegExp(prima+corpo+bordo,'giu');
      R.NOMI_T=new RegExp(prima+corpo+bordo,'iu');
    }
    if(vie.length) R.VIE=new RegExp(',?\\s*(?:'+alt(vie)+')'+bordo+'[^,.;]*','giu');
    const numeri=[...codici.map(x=>this.fuga(x)),...T.tel.map(flessibile)];
    if(numeri.length) R.CODICI=new RegExp(prima+'(?:'+numeri.join('|')+')'+bordo,'giu');

    /* la rete finale: gli stessi termini di sopra, più i controlli fissi */
    R.VIETATI=[...this.SEMPRE,
      ...org([...T.frasi,...T.nomi,...T.vie,...T.codici,...T.extra]).map(x=>
        ['«'+x+'»',new RegExp('(?:^|[^\\p{L}\\p{N}])'+this.fuga(x)+bordo,'iu')]),
      ...T.tel.map(t=>['il telefono di una prenotazione',new RegExp(flessibile(t),'u')])];
    return R;
  },

  pulisci(s,R){
    if(typeof s!=='string') return s;
    let t=s.replace(this.CODICI,'');
    if(R.CODICI) t=t.replace(R.CODICI,'$1');
    if(R.VIE)    t=t.replace(R.VIE,'');
    if(R.NOMI)   t=t.replace(R.NOMI,'$1la guesthouse');
    /* «la vostra yurta è di la guesthouse» non si può leggere: dove la
       sostituzione cade dopo una preposizione, le due parole si uniscono */
    t=t.replace(/\b(di|a|da|in|su) la guesthouse\b/gi,(m,p)=>{
      const u={di:'della',a:'alla',da:'dalla',in:'nella',su:'sulla'}[p.toLowerCase()];
      return (p[0]===p[0].toUpperCase()?u[0].toUpperCase()+u.slice(1):u)+' guesthouse';
    });
    return t.replace(/\s{2,}/g,' ').replace(/\s+([,.;])/g,'$1').replace(/[\s,;·]+$/,'').trim();
  },
  eAlloggio(s,R){ return !!R.NOMI_T&&R.NOMI_T.test(String(s||'')); },

  /* costruisce il testo di pubblico/dati.js a partire dai dati veri */
  genera(d){
    const T=this.termini(d);
    /* senza l'elenco non si sa cosa togliere: meglio non pubblicare
       niente che pubblicare tutto */
    if(!T.frasi.length&&!T.nomi.length)
      return {testo:'',conteggi:{giornate:0,tratte:0,luoghi:0},
              trovati:['dai dati non risulta nessun nome di struttura: '+
                       'senza quell\'elenco non so cosa togliere']};

    const R=this.regole(T);
    const pul=s=>this.pulisci(s,R);
    const P=d.P,DAYS=d.DAYS,POIS=d.POIS,WAYPTS=d.WAYPTS;

    const legs=d.LEGS.map(L=>({a:L.a,b:L.b,m:L.m,day:L.day,t:pul(L.t),s:pul(L.s)}));
    const days=DAYS.map(D=>({
      d:D.d,lbl:D.lbl,title:D.title,wx:D.wx,at:D.at,km:D.km,eff:D.eff,clim:D.clim,modes:D.modes,
      lead:pul(D.lead),
      see:(D.see||[]).filter(x=>!this.eAlloggio(x,R)).map(pul),
      photos:D.photos||[],
    }));
    const pois={};
    Object.entries(POIS).forEach(([g,set])=>{
      const items=set.items
        .filter(p=>!this.eAlloggio(p.n,R)&&!this.eAlloggio(p.desc,R))
        .map(p=>({n:p.n,la:p.la,lo:p.lo,src:p.src,note:pul(p.note),desc:pul(p.desc)}));
      if(items.length) pois[g]={city:set.city,z:set.z,items};
    });

    const testo=
      '/* Dati pubblici per la pagina dei cari. Generato da tools/lock.mjs.\n'+
      '   Niente codici, strutture, indirizzi, telefoni o spese: solo il racconto. */\n'+
      'const P='+JSON.stringify(P)+';\n'+
      'const LEGS='+JSON.stringify(legs)+';\n'+
      'const DAYS='+JSON.stringify(days)+';\n'+
      'const POIS='+JSON.stringify(pois)+';\n'+
      'const WAYPTS='+JSON.stringify(WAYPTS)+';\n';

    const trovati=R.VIETATI.filter(([,re])=>re.test(testo)).map(([che])=>che);
    return {testo,trovati,
            conteggi:{giornate:days.length,tratte:legs.length,
                      luoghi:Object.values(pois).reduce((n,s)=>n+s.items.length,0)}};
  },
};
if(typeof module!=='undefined') module.exports=Sanifica;
