/* ═══════════════════════════════════════════════════════════
   STRUMENTO — la guardia: controlla che nelle pagine pubbliche
   non sia finito niente di riservato.

       node tools/controlla-pubblico.mjs

   Non conosce la password e non ne ha bisogno: guarda soltanto i
   file che finiscono online e cerca le forme delle cose che non
   devono uscire — numeri di telefono, codici di prenotazione, PIN,
   indirizzi — più i file che non devono proprio esistere nel
   repository (i dati in chiaro, la password, i PDF).

   È la rete sotto js/sanifica.js: quella ripulisce prima di
   pubblicare, questa controlla dopo. Se una delle due sbaglia,
   l'altra se ne accorge.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,existsSync,readdirSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname,join,relative} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');

/* ── 1. file che non devono stare nel repository ──
   Si guarda quello che git ha davvero in pancia, non quello che c'è
   sul disco: sul Mac i dati in chiaro ci sono e devono esserci, il
   punto è che non siano mai finiti in un commit. */
const vietati=[];
try{
  const tracciati=execFileSync('git',['ls-files'],{cwd:root,encoding:'utf8'}).split('\n').filter(Boolean);
  for(const rel of tracciati){
    if(/\.pdf$/i.test(rel)) vietati.push([rel,'un PDF in chiaro']);
    if(rel==='.orbit-pw') vietati.push([rel,'la password']);
    if(/^viaggi\/[^/]+\/data\.js$/.test(rel)) vietati.push([rel,'dati di un viaggio in chiaro']);
    if(rel==='viaggi/index.js') vietati.push([rel,'elenco dei viaggi in chiaro']);
  }
}catch(e){ console.warn('Non riesco a chiedere a git quali file ha: salto questo controllo.'); }

/* ── 2. cosa non deve comparire nelle pagine pubbliche ── */
const sospetti=[
  [/\+\d[\d ()./-]{8,}\d/g,           'un numero di telefono'],
  [/\b\d{9,12}\b/g,                    'un codice di prenotazione'],
  [/\bpin\b/gi,                        'un PIN'],
  [/\b(?:street|ulitsa|ko'?chasi|k[öo]chesi|prospekt|straße)\b/gi, 'un indirizzo'],
];

/* i file che vanno online per essere letti da chiunque */
const pubblici=[];
const raccogli=(dir)=>{
  if(!existsSync(dir)) return;
  for(const nome of readdirSync(dir)){
    const p=join(dir,nome);
    if(statSync(p).isDirectory()){ raccogli(p); continue; }
    if(/\.(js|json|html)$/.test(nome)) pubblici.push(p);
  }
};
raccogli(join(root,'pubblico'));

const trovati=[];
for(const f of pubblici){
  const testo=readFileSync(f,'utf8');
  for(const [re,che] of sospetti){
    const m=testo.match(re);
    if(m) trovati.push([relative(root,f),che,[...new Set(m)].slice(0,3).join(', ')]);
  }
}

/* ── il verdetto ── */
if(!vietati.length&&!trovati.length){
  console.log(`Guardia: ${pubblici.length} file pubblici controllati, niente di riservato.`);
  process.exit(0);
}
if(vietati.length){
  console.error('\nFILE CHE NON DEVONO STARE NEL REPOSITORY:');
  vietati.forEach(([f,che])=>console.error(`  ${f} — ${che}`));
}
if(trovati.length){
  console.error('\nNELLE PAGINE PUBBLICHE C\'È QUALCOSA DI RISERVATO:');
  trovati.forEach(([f,che,esempio])=>console.error(`  ${f} — ${che}: ${esempio}`));
}
console.error('\nNiente panico: togliere quello che è uscito, poi "node tools/lock.mjs" e ripubblicare.');
process.exit(1);
