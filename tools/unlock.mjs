/* ═══════════════════════════════════════════════════════════
   STRUMENTO — ricostruisce i dati in chiaro dai file cifrati.

   Serve se si riparte da zero: computer nuovo, computer perso,
   cartella cancellata. Bastano il repository (che è pubblico) e
   la password:

       git clone https://github.com/alintitaru-create/orbit
       cd orbit
       node tools/unlock.mjs "la password"

   Rimette al loro posto viaggi/index.js e, per ogni viaggio,
   viaggi/<id>/data.js. I PDF originali no: quelli stanno solo
   sul Mac e non entrano mai nel repository.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {pbkdf2Sync,createDecipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pwFile=join(root,'.orbit-pw');
const indexEnc=join(root,'viaggi/index.enc.js');
const forza=process.argv.includes('--forza');

const pw=process.argv.slice(2).find(a=>!a.startsWith('--'))||
         (existsSync(pwFile)?readFileSync(pwFile,'utf8').trim():null);
if(!pw){ console.error('Serve la password: node tools/unlock.mjs "la password"'); process.exit(1); }
if(!existsSync(indexEnc)){ console.error('Manca viaggi/index.enc.js: non c\'è niente da riaprire.'); process.exit(1); }

/* i file cifrati sono JavaScript con dentro un blocco base64, così la
   pagina li carica con un tag <script> anche col doppio clic */
const blocco=percorso=>{
  const b=readFileSync(percorso,'utf8').match(/"([A-Za-z0-9+/=]+)"/);
  if(!b) throw new Error('non contiene il blocco cifrato');
  return Buffer.from(b[1],'base64');
};

/* il sale sta in testa all'elenco; la chiave che ne esce apre tutto il resto */
let testa;
try{ testa=blocco(indexEnc); }
catch(e){ console.error('viaggi/index.enc.js '+e.message+'.'); process.exit(1); }
const key=pbkdf2Sync(pw,testa.subarray(0,16),310000,32,'sha256');

const apri=raw=>{
  const d=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));
  d.setAuthTag(raw.subarray(raw.length-16));
  return Buffer.concat([d.update(raw.subarray(12,raw.length-16)),d.final()]).toString('utf8')
    .replace(/\n\/\* esposizione globale[\s\S]*$/,'').replace(/\n*$/,'\n');
};

/* ── l'elenco ── */
let elenco;
try{ elenco=apri(testa.subarray(16)); }
catch(e){ console.error('Password sbagliata: i file non si aprono.'); process.exit(1); }

const scrivi=(dest,testo,etichetta)=>{
  if(existsSync(dest)&&!forza){
    console.log(`${etichetta} esiste già: non lo tocco. Per rifarlo dal cifrato: --forza`);
    return false;
  }
  mkdirSync(dirname(dest),{recursive:true});
  writeFileSync(dest,testo);
  console.log(`${etichetta} — ${testo.length} caratteri.`);
  return true;
};

scrivi(join(root,'viaggi/index.js'),elenco,'viaggi/index.js');

/* ── ogni viaggio ── */
const g={};
new Function('g','with(g){'+elenco+';Object.assign(g,{VIAGGI})}')(g);
for(const v of g.VIAGGI||[]){
  const enc=join(root,'viaggi',v.id,'data.enc.js');
  if(!existsSync(enc)){ console.warn(`  ${v.id}: manca data.enc.js, lo salto.`); continue; }
  try{ scrivi(join(root,'viaggi',v.id,'data.js'),apri(blocco(enc)),`viaggi/${v.id}/data.js`); }
  catch(e){ console.error(`  ${v.id}: non si apre (${e.message}).`); }
}

writeFileSync(pwFile,pw+'\n');
console.log('\nOra "node tools/lock.mjs" funziona di nuovo come prima.');
