/* ═══════════════════════════════════════════════════════════
   STRUMENTO — cifra js/data.js in js/data.enc.js.

   Da rilanciare ogni volta che si modificano i dati del viaggio,
   prima di pubblicare:

       node tools/lock.mjs                 (password salvata in .orbit-pw)
       node tools/lock.mjs "nuova password"

   Cifratura: PBKDF2-SHA256 (310.000 giri) + AES-256-GCM.
   Il file prodotto contiene solo un blocco illeggibile: senza la
   password non se ne ricava nulla.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {randomBytes,pbkdf2Sync,createCipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pwFile=join(root,'.orbit-pw');

let pw=process.argv[2];
if(!pw&&existsSync(pwFile)) pw=readFileSync(pwFile,'utf8').trim();
if(!pw){ console.error('Serve una password: node tools/lock.mjs "la password"'); process.exit(1); }

let plain=readFileSync(join(root,'js/data.js'),'utf8');

/* Le costanti dichiarate dentro eval() vivono solo lì dentro: in coda
   al file le ricopiamo nello spazio globale, così gli altri settori le
   vedono esattamente come quando data.js è caricato in chiaro. */
const names=[...plain.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
if(!names.length){ console.error('Nessuna costante trovata in js/data.js.'); process.exit(1); }
plain+=`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\nObject.assign(globalThis,{${names.join(',')}});\n`;

const salt=randomBytes(16), iv=randomBytes(12);
const key=pbkdf2Sync(pw,salt,310000,32,'sha256');
const c=createCipheriv('aes-256-gcm',key,iv);
const blob=Buffer.concat([salt,iv,c.update(plain,'utf8'),c.final(),c.getAuthTag()]);

writeFileSync(join(root,'js/data.enc.js'),
  '/* Dati del viaggio cifrati (AES-256-GCM). Generato da tools/lock.mjs — non modificare a mano. */\n'+
  'const ORBIT_ENC="'+blob.toString('base64')+'";\n');
writeFileSync(pwFile,pw+'\n');

console.log(`js/data.enc.js aggiornato — ${plain.length} caratteri cifrati in ${blob.length}.`);
