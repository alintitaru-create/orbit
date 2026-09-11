/* ═══════════════════════════════════════════════════════════
   STRUMENTO — prepara la versione pubblicabile, cifrata.

       node tools/lock.mjs                 (password salvata in .orbit-pw)
       node tools/lock.mjs "nuova password"

   Produce:
     js/data.enc.js    i dati del viaggio cifrati
     docs/*.bin        i PDF delle prenotazioni cifrati
     docs/index.json   l'elenco dei documenti (senza dati sensibili)

   Cifratura: PBKDF2-SHA256 (310.000 giri) + AES-256-GCM.
   La chiave è una sola: il sale sta in testa a data.enc.js e i
   documenti riusano la stessa chiave con un vettore diverso, così
   il telefono la calcola una volta e apre tutto all'istante.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
import {randomBytes,pbkdf2Sync,createCipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pwFile=join(root,'.orbit-pw');

let pw=process.argv[2];
if(!pw&&existsSync(pwFile)) pw=readFileSync(pwFile,'utf8').trim();
if(!pw){ console.error('Serve una password: node tools/lock.mjs "la password"'); process.exit(1); }

/* ── 1. i dati ── */
let plain=readFileSync(join(root,'js/data.js'),'utf8');
const names=[...plain.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
if(!names.length){ console.error('Nessuna costante trovata in js/data.js.'); process.exit(1); }
plain+=`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\nObject.assign(globalThis,{${names.join(',')}});\n`;

const salt=randomBytes(16);
const key=pbkdf2Sync(pw,salt,310000,32,'sha256');
const enc=(buf)=>{ const iv=randomBytes(12); const c=createCipheriv('aes-256-gcm',key,iv);
  return {iv,body:Buffer.concat([c.update(buf),c.final(),c.getAuthTag()])}; };

const d=enc(Buffer.from(plain,'utf8'));
writeFileSync(join(root,'js/data.enc.js'),
  '/* Dati del viaggio cifrati (AES-256-GCM). Generato da tools/lock.mjs — non modificare a mano. */\n'+
  'const ORBIT_ENC="'+Buffer.concat([salt,d.iv,d.body]).toString('base64')+'";\n');
console.log(`js/data.enc.js — ${plain.length} caratteri cifrati.`);

/* ── 2. i documenti ── */
const scope={};
new Function('g','with(g){'+readFileSync(join(root,'js/data.js'),'utf8')+
  ';Object.assign(g,{DOCS,DOCS_BASE})}')(scope);
const base=fileURLToPath(scope.DOCS_BASE);
const outDir=join(root,'docs');
mkdirSync(outDir,{recursive:true});

/* Su un computer dove i PDF originali non ci sono (ripartenza da un
   clone), non si tocca nulla: cancellare i .bin già cifrati per
   rigenerarli da niente vorrebbe dire perderli. */
const sorgenti=scope.DOCS.filter(d=>existsSync(join(base,d.f))).length;
const saltaDocs=sorgenti===0;
if(saltaDocs){
  console.log(`docs/ — i PDF originali non sono in ${base}: lascio intatti quelli già cifrati.`);
} else {
  readdirSync(outDir).forEach(f=>{ if(f.endsWith('.bin')||f==='index.json') unlinkSync(join(outDir,f)); });
}

/* nomi neutri (d01.bin, d02.bin…): anche il nome del file direbbe
   troppo su hotel, compagnie e persone */
const nome=i=>'d'+String(i+1).padStart(2,'0')+'.bin';

/* Nel manifest pubblico NON finiscono titoli né descrizioni: contengono
   codici di prenotazione. Si salva solo la posizione dentro DOCS, e i
   testi il browser li legge dai dati cifrati dopo lo sblocco. */
const manifest=[]; let mancanti=0, totale=0;
if(!saltaDocs) scope.DOCS.forEach((doc,i)=>{
  const src=join(base,doc.f);
  if(!existsSync(src)){ console.warn('  manca:',doc.f); mancanti++; return; }
  const raw=readFileSync(src);
  const e=enc(raw);
  const name=nome(i);
  writeFileSync(join(outDir,name),Buffer.concat([e.iv,e.body]));
  manifest.push({i,f:name,kb:Math.round(raw.length/1024)});
  totale+=raw.length;
});
if(!saltaDocs){
  writeFileSync(join(outDir,'index.json'),JSON.stringify(manifest,null,1));
  console.log(`docs/ — ${manifest.length} documenti cifrati (${Math.round(totale/1024)} KB)${mancanti?`, ${mancanti} non trovati`:''}.`);
}

/* ── 3. i dati per la pagina pubblica (quella dei cari) ──
   Qui non deve finire nulla di riservato. Si tiene il racconto —
   giornate, luoghi, cosa si va a vedere — e si buttano via codici di
   prenotazione, strutture dove si dorme, indirizzi, telefoni e spese. */
const CODICI=/\b(?:conf\.?|PNR|TKT|Ordine|Trip\.com|BRB|TRPAP)[\s:]*[A-Z0-9-]{5,}\b/gi;
/* i nomi propri delle strutture: spariscono, sostituiti da una parola
   generica, così la frase resta leggibile */
const NOMI=/(?:Hostel\s+)?Compass\s*3|Meerim(?:\s+Guest\s*House)?|Guest\s*house\s+SONO|Hotel\s+Usmoon|Vasiev'?s?(?:\s+Hotel)?|Nomad\s+Guest\s*House/gi;
/* indirizzi e vie: spariscono e basta */
const VIE=/,?\s*(?:Derbisheva|Bogidil|Moskovskaya|Shohruh\s+Mirzo|Aubakirova|Тойчубеков|Yakkasaray|Яккасарайский)[^,.;]*/gi;

const pulisci=s=>typeof s==='string'
  ? s.replace(CODICI,'').replace(VIE,'').replace(NOMI,'la guesthouse')
     .replace(/\s{2,}/g,' ').replace(/\s+([,.;])/g,'$1').replace(/[\s,;·]+$/,'').trim()
  : s;
/* per decidere se un elemento va tolto del tutto (POI degli alloggi) */
const eAlloggio=s=>{ NOMI.lastIndex=0; return NOMI.test(s||''); };

const pubDir=join(root,'pubblico');
mkdirSync(pubDir,{recursive:true});
const g2={};
new Function('g','with(g){'+readFileSync(join(root,'js/data.js'),'utf8')+
  ';Object.assign(g,{P,LEGS,DAYS,POIS,WAYPTS})}')(g2);

const pubLegs=g2.LEGS.map(L=>({a:L.a,b:L.b,m:L.m,day:L.day,t:pulisci(L.t),s:pulisci(L.s)}));
const pubDays=g2.DAYS.map(D=>({
  d:D.d,lbl:D.lbl,title:D.title,wx:D.wx,at:D.at,km:D.km,eff:D.eff,clim:D.clim,modes:D.modes,
  lead:pulisci(D.lead),
  see:(D.see||[]).filter(x=>!eAlloggio(x)).map(pulisci),
  photos:D.photos||[],
}));
const pubPois={};
Object.entries(g2.POIS).forEach(([d,set])=>{
  const items=set.items
    .filter(p=>!eAlloggio(p.n)&&!eAlloggio(p.desc))   /* via i luoghi dove si dorme */
    .map(p=>({n:p.n,la:p.la,lo:p.lo,src:p.src,note:pulisci(p.note),desc:pulisci(p.desc)}));
  if(items.length) pubPois[d]={city:set.city,z:set.z,items};
});

writeFileSync(join(pubDir,'dati.js'),
  '/* Dati pubblici per la pagina dei cari. Generato da tools/lock.mjs.\n'+
  '   Niente codici, strutture, indirizzi, telefoni o spese: solo il racconto. */\n'+
  'const P='+JSON.stringify(g2.P)+';\n'+
  'const LEGS='+JSON.stringify(pubLegs)+';\n'+
  'const DAYS='+JSON.stringify(pubDays)+';\n'+
  'const POIS='+JSON.stringify(pubPois)+';\n'+
  'const WAYPTS='+JSON.stringify(g2.WAYPTS)+';\n');

/* controllo di sicurezza: se qualcosa di riservato è sfuggito, ci si ferma */
const testo=readFileSync(join(pubDir,'dati.js'),'utf8');
const vietati=[/\b\d{10}\b/,/\bPIN\b/,/78NSHT/,/26RKZH/,/CTPCI4/,/JLKXPM/,/TRPAP/,/14PCLE/,
               /Ciancio/i,/Titaru/i,/Derbisheva/i,/Bogidil/i,/Moskovskaya/i,/Aubakirova/i,
               /Compass/i,/Meerim/i,/Usmoon/i,/Vasiev/i,/\+996|\+998/];
const trovati=vietati.filter(r=>r.test(testo));
if(trovati.length){
  console.error('FERMO: nella pagina pubblica è finito qualcosa di riservato →',trovati.map(String).join(', '));
  process.exit(1);
}
console.log(`pubblico/dati.js — ${pubDays.length} giornate, ${pubLegs.length} tratte, `+
            `${Object.values(pubPois).reduce((n,s)=>n+s.items.length,0)} luoghi, nessun dato riservato.`);

writeFileSync(pwFile,pw+'\n');
