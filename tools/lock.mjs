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

const flag=a=>process.argv.includes(a);
/* --solo-pubblico: rigenera soltanto pubblico/dati.js, senza ricifrare
   dati e documenti. Serve all'officina automatica su GitHub, che
   altrimenti riscriverebbe data.enc.js a ogni giro all'infinito. */
const soloPubblico=flag('--solo-pubblico');

let pw=process.argv.slice(2).find(a=>!a.startsWith('--'));
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

if(!soloPubblico){
  const d=enc(Buffer.from(plain,'utf8'));
  writeFileSync(join(root,'js/data.enc.js'),
    '/* Dati del viaggio cifrati (AES-256-GCM). Generato da tools/lock.mjs — non modificare a mano. */\n'+
    'const ORBIT_ENC="'+Buffer.concat([salt,d.iv,d.body]).toString('base64')+'";\n');
  console.log(`js/data.enc.js — ${plain.length} caratteri cifrati.`);
}

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
const saltaDocs=sorgenti===0||soloPubblico;
if(saltaDocs){
  if(!soloPubblico) console.log(`docs/ — i PDF originali non sono in ${base}: lascio intatti quelli già cifrati.`);
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
   La ripulitura vive in js/sanifica.js, un file solo usato anche dal
   telefono: due copie della stessa logica potrebbero divergere, e qui
   una divergenza vorrebbe dire dati riservati su una pagina pubblica. */
const Sanifica=new Function(readFileSync(join(root,'js/sanifica.js'),'utf8')
  .replace(/if\(typeof module[\s\S]*$/,'')+';return Sanifica')();

const pubDir=join(root,'pubblico');
mkdirSync(pubDir,{recursive:true});
const g2={};
new Function('g','with(g){'+readFileSync(join(root,'js/data.js'),'utf8')+
  ';Object.assign(g,{P,LEGS,DAYS,POIS,WAYPTS})}')(g2);

const esito=Sanifica.genera(g2.P,g2.LEGS,g2.DAYS,g2.POIS,g2.WAYPTS);
if(esito.trovati.length){
  console.error('FERMO: nella pagina pubblica è finito qualcosa di riservato →',esito.trovati.join(', '));
  process.exit(1);
}
writeFileSync(join(pubDir,'dati.js'),esito.testo);
console.log(`pubblico/dati.js — ${esito.conteggi.giornate} giornate, ${esito.conteggi.tratte} tratte, `+
            `${esito.conteggi.luoghi} luoghi, nessun dato riservato.`);

writeFileSync(pwFile,pw+'\n');
