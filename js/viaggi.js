/* ═══════════════════════════════════════════════════════════
   SETTORE VIAGGI — l'elenco, le fasi, i nomi dei file.

   Due oggetti, due mestieri:
     Viaggi  = lo scaffale: chi c'è, in che fase, con che numeri
     Viaggio = quello aperto adesso, e dove stanno le sue cose

   In che fase sia un viaggio non è scritto da nessuna parte: lo
   dicono le date. Un viaggio senza date è ancora una bozza.
   ═══════════════════════════════════════════════════════════ */
const Viaggi={
  lista(){ return typeof VIAGGI!=='undefined'?VIAGGI:[]; },
  idee(){ return typeof IDEE!=='undefined'?IDEE:[]; },
  stat(id){ return (typeof STATS!=='undefined'&&STATS[id])||{}; },
  trova(id){ return this.lista().find(v=>v.id===id)||null; },

  oggi(){ const d=new Date(); return new Date(d-d.getTimezoneOffset()*6e4).toISOString().slice(0,10); },

  fase(v){
    if(!v.dal||!v.al) return 'bozza';
    const o=this.oggi();
    return o<v.dal?'futuro':o>v.al?'passato':'corso';
  },

  /* giorni di distanza da oggi: negativi nel passato */
  giorniDa(iso){ return Math.round((new Date(iso+'T12:00:00')-new Date(this.oggi()+'T12:00:00'))/864e5); },

  /* "fra tre settimane", "secondo giorno", "l'anno scorso" */
  quando(v){
    const f=this.fase(v);
    if(f==='bozza') return 'senza date';
    if(f==='corso'){
      const n=this.giorniDa(v.dal)*-1+1;
      return n===1?'oggi si parte':`${n}° giorno`;
    }
    const g=f==='futuro'?this.giorniDa(v.dal):-this.giorniDa(v.al);
    if(g===0) return f==='futuro'?'domani':'ieri';
    if(g===1) return f==='futuro'?'domani':'ieri';
    const dopo=f==='futuro';
    if(g<14) return dopo?`fra ${g} giorni`:`${g} giorni fa`;
    if(g<60){ const s=Math.round(g/7); return dopo?`fra ${s} settimane`:`${s} settimane fa`; }
    if(g<330){ const m=Math.round(g/30); return dopo?`fra ${m} mesi`:`${m} mesi fa`; }
    const a=Math.round(g/365);
    return a<=1?(dopo?'fra un anno':'un anno fa'):(dopo?`fra ${a} anni`:`${a} anni fa`);
  },

  /* "9–23 settembre 2026" oppure "28 dicembre 2026 – 4 gennaio 2027" */
  periodo(v){
    if(!v.dal||!v.al) return '';
    const a=new Date(v.dal+'T12:00:00'), b=new Date(v.al+'T12:00:00');
    const mese=d=>d.toLocaleDateString('it-IT',{month:'long'});
    if(a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth())
      return `${a.getDate()}–${b.getDate()} ${mese(b)} ${b.getFullYear()}`;
    if(a.getFullYear()===b.getFullYear())
      return `${a.getDate()} ${mese(a)} – ${b.getDate()} ${mese(b)} ${b.getFullYear()}`;
    return `${a.getDate()} ${mese(a)} ${a.getFullYear()} – ${b.getDate()} ${mese(b)} ${b.getFullYear()}`;
  },

  durata(v){ return v.dal&&v.al?Math.round((new Date(v.al)-new Date(v.dal))/864e5)+1:0; },

  /* i totali di tutti i viaggi messi insieme */
  totali(){
    const fatti=this.lista().filter(v=>this.fase(v)==='passato');
    const paesi=new Set(); fatti.forEach(v=>(v.paesi||[]).forEach(p=>paesi.add(p)));
    return {
      viaggi:fatti.length, paesi:paesi.size,
      giorni:fatti.reduce((n,v)=>n+this.durata(v),0),
      km:fatti.reduce((n,v)=>n+(this.stat(v.id).km||0),0),
    };
  },

  /* l'ordine dello scaffale: prima quello in corso, poi i prossimi
     (il più vicino davanti), poi i ricordi (il più recente davanti) */
  ordinati(){
    const peso={corso:0,futuro:1,bozza:2,passato:3};
    return [...this.lista()].sort((a,b)=>{
      const f=peso[this.fase(a)]-peso[this.fase(b)];
      if(f) return f;
      return this.fase(a)==='passato'?(b.dal||'').localeCompare(a.dal||'')
                                     :(a.dal||'').localeCompare(b.dal||'');
    });
  },

  /* ═══ scrivere ═══
     L'elenco si rigenera per intero dagli oggetti in memoria: niente
     ritocchi al testo, che con le virgole finirebbero male. */
  testo(){
    return `/* ═══════════════════════════════════════════════════════════════
   SETTORE SCAFFALE — l'elenco dei viaggi e la lavagna delle idee.

   Questo file sta solo sul Mac (è in .gitignore). Online va la
   versione cifrata, viaggi/index.enc.js, prodotta da tools/lock.mjs.

   VIAGGI = un viaggio per riga. I dati veri di ciascuno stanno
            nella sua cartella, viaggi/<id>/data.js
   IDEE   = i posti che ci girano in testa, prima che abbiano una data
   STATS  = km, giornate e la firma del percorso: NON si scrivono a
            mano, li ricalcola tools/lock.mjs leggendo ogni viaggio
   ═══════════════════════════════════════════════════════════════ */

const VIAGGI=${JSON.stringify(this.lista(),null,1)};

const IDEE=${JSON.stringify(this.idee(),null,1)};

/* ───────── Ricalcolato da tools/lock.mjs: non modificare a mano ───────── */
const STATS=${JSON.stringify(typeof STATS!=='undefined'?STATS:{},null,1)};
`;
  },

  /* rimanda l'elenco su GitHub, ricifrato con la stessa chiave */
  async salva(messaggio){
    if(typeof Pubblica==='undefined'||!Pubblica.token())
      throw new Error('Serve prima la chiave di GitHub.');
    const b64=await Chiave.cifra(this.testo(),{conSalt:true});
    await Pubblica.scrivi('viaggi/index.enc.js',btoa(Chiave.fileJs(b64,'ORBIT_INDICE')),messaggio||'Scaffale aggiornato');
  },

  /* ═══ un viaggio nuovo ═══
     Il file dei dati nasce già con una giornata per ogni data del
     viaggio: così la pagina si apre e si comincia a riempirla, invece
     di aprirsi vuota e rotta. Tutto il resto è vuoto di proposito. */
  scheletro(v){
    const giorni=[];
    for(let d=new Date(v.dal+'T12:00:00'); d<=new Date(v.al+'T12:00:00'); d.setDate(d.getDate()+1)){
      const iso=d.toISOString().slice(0,10);
      const lbl=d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
      giorni.push(` {d:"${iso}",lbl:"${lbl[0].toUpperCase()+lbl.slice(1)}",title:"Da programmare",`+
                  `wx:"",at:0,km:0,eff:1,eur:0,clim:null,modes:[],lead:"",see:[],photos:[]},`);
    }
    return `/* ═══════════════════════════════════════════════════════════════
   SETTORE DATI — tutto il viaggio: ${v.nome}.
   ${this.periodo(v)}

   Appena creato è vuoto: ci sono solo le giornate, una per data.
   Si riempie da qui, dalla sezione "I dati del viaggio" in fondo
   alla pagina, oppure sul Mac in viaggi/${v.id}/data.js.

   P     = luoghi {codice:[lat,lon,nome]}
   LEGS  = spostamenti (a, b, m=mezzo, day=indice giornata, t, s, info)
   DAYS  = giornate (d=data, lbl, title, wx=punto meteo, at=quota,
           km, eff=fatica 1-5, eur=spesa, clim=[min,max], lead, see)
   POIS  = punti di interesse per data
   ═══════════════════════════════════════════════════════════════ */

const P = {};

/* modo: air | road | rail | foot | horse */
const LEGS = [];

const DAYS = [
${giorni.join('\n')}
];

const POIS={};
const WAYPTS={};
const BOOKINGS=[];
const BUDGET={paid:[],gruppi:[],note:""};
const APPS=[];

/* fusi orari dei luoghi (ore rispetto a UTC) */
const PLACE_TZ={};
const tzOf=code=>PLACE_TZ[code]??0;

/* i PDF delle prenotazioni: restano sul Mac, nel repository vanno cifrati */
const DOCS_BASE="";
const DOCS=[];

const PRATICO={emergenze:[],info:[],frasi:[],note:""};

const CHECKLISTS=[
 {t:"Valigia",items:[]},
 {t:"Prima di partire",items:[]},
];

/* Altre parole che non devono uscire sulla pagina pubblica: cognomi e
   simili. Stanno qui perché questo file è privato e cifrato. */
const RISERVATI_EXTRA=[];
`;
  },

  /* un nome di cartella corto e senza sorprese: "isl2027" */
  nuovoId(nome,dal){
    const base=(nome||'viaggio').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
      .replace(/[^a-z]/g,'').slice(0,4)||'viag';
    const anno=(dal||'').slice(0,4)||new Date().getFullYear();
    let id=base+anno, n=2;
    while(this.trova(id)) id=base+anno+'-'+(n++);
    return id;
  },
};

/* ═══════════════════════════════════════════════════════════
   Il viaggio aperto adesso. Tiene insieme due cose che prima
   erano sparse: dove stanno i suoi file e come si chiamano le
   sue cose salvate nel browser.

   Ogni chiave porta il nome del viaggio: senza, la checklist del
   Kirghizistan comparirebbe nel viaggio dopo.
   ═══════════════════════════════════════════════════════════ */
const Viaggio={
  id:null, meta:null,

  apri(id,meta){ this.id=id; this.meta=meta||Viaggi.trova(id)||{id,nome:'Viaggio'}; },

  fase(){ return this.meta?Viaggi.fase(this.meta):'corso'; },
  nome(){ return this.meta?.nome||'Viaggio'; },

  /* un file dentro la cartella del viaggio */
  file(p){ return `viaggi/${this.id}/${p}`; },
  /* le foto scambiate fra i telefoni, e quelle mandate ai cari */
  cartellaSync(){ return `sync/${this.id}`; },
  cartellaDiario(){ return `pubblico/diario/${this.id}`; },

  /* le cose salvate nel browser */
  chiave(n){ return `orbit_${n}:${this.id}`; },
};
