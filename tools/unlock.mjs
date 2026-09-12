/* ═══════════════════════════════════════════════════════════
   STRUMENTO — ricostruisce js/data.js dal file cifrato.

   Serve se si riparte da zero: computer nuovo, computer perso,
   cartella cancellata. Bastano il repository (che è pubblico) e
   la password:

       git clone https://github.com/alintitaru-create/orbit
       cd orbit
       node tools/unlock.mjs "la password"

   e la copia di lavoro torna completa.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {pbkdf2Sync,createDecipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pwFile=join(root,'.orbit-pw');
const dest=join(root,'js/data.js');

let pw=process.argv.slice(2).find(a=>!a.startsWith('--'));
if(!pw&&existsSync(pwFile)) pw=readFileSync(pwFile,'utf8').trim();
if(!pw){ console.error('Serve la password: node tools/unlock.mjs "la password"'); process.exit(1); }

if(existsSync(dest)&&!process.argv.includes('--forza')){
  console.error('js/data.js esiste già: non lo sovrascrivo.\n'+
                'Se vuoi davvero rifarlo dal file cifrato, aggiungi --forza');
  process.exit(1);
}

const src=readFileSync(join(root,'js/data.enc.js'),'utf8');
const m=src.match(/"([A-Za-z0-9+/=]+)"/);
if(!m){ console.error('js/data.enc.js non contiene il blocco cifrato.'); process.exit(1); }

const raw=Buffer.from(m[1],'base64');
const salt=raw.subarray(0,16), iv=raw.subarray(16,28);
const tag=raw.subarray(raw.length-16), corpo=raw.subarray(28,raw.length-16);
const key=pbkdf2Sync(pw,salt,310000,32,'sha256');

let testo;
try{
  const d=createDecipheriv('aes-256-gcm',key,iv); d.setAuthTag(tag);
  testo=Buffer.concat([d.update(corpo),d.final()]).toString('utf8');
}catch(e){ console.error('Password sbagliata: il file non si apre.'); process.exit(1); }

/* via la riga che tools/lock.mjs aggiunge in coda per il browser */
testo=testo.replace(/\n\/\* esposizione globale[\s\S]*$/,'\n');

writeFileSync(dest,testo);
writeFileSync(pwFile,pw+'\n');
console.log(`js/data.js ricostruito — ${testo.length} caratteri.`);
console.log('Ora "node tools/lock.mjs" funziona di nuovo come prima.');
