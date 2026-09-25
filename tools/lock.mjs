/* ═══════════════════════════════════════════════════════════
   STRUMENTO — prepara la versione pubblicabile, cifrata.

       node tools/lock.mjs                   (password salvata in .orbit-pw)
       node tools/lock.mjs "nuova password"
       node tools/lock.mjs --viaggio kg2026  (solo quel viaggio)
       node tools/lock.mjs --solo-pubblico   (solo la pagina dei cari)

   Produce:
     viaggi/index.enc.js        elenco viaggi, idee e statistiche, cifrato
     viaggi/<id>/data.enc.js    i dati di ogni viaggio, cifrati
     viaggi/<id>/docs/*.bin     i PDF delle prenotazioni, cifrati
     pubblico/dati.js           la pagina dei cari, ripulita

   Cifratura: PBKDF2-SHA256 (310.000 giri) + AES-256-GCM.
   La chiave è una sola: il sale sta in testa a viaggi/index.enc.js,
   tutto il resto riusa la stessa chiave con un vettore diverso, così
   il telefono la calcola una volta e apre tutto all'istante.

   Non ricifra quello che non è cambiato: prima apre il file che c'è
   e confronta. Ricifrare a vuoto cambierebbe ogni byte (vettore
   nuovo) e produrrebbe commit enormi che non dicono niente.
   ═══════════════════════════════════════════════════════════ */
import {readFileSync,writeFileSync,existsSync,mkdirSync,readdirSync,unlinkSync} from 'node:fs';
import {randomBytes,pbkdf2Sync,createCipheriv,createDecipheriv} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';

const root=join(dirname(fileURLToPath(import.meta.url)),'..');
const pwFile=join(root,'.orbit-pw');
const indexJs=join(root,'viaggi/index.js');
const indexEnc=join(root,'viaggi/index.enc.js');

const flag=a=>process.argv.includes(a);
const opt=a=>{ const i=process.argv.indexOf(a); return i>=0?process.argv[i+1]:null; };
const soloPubblico=flag('--solo-pubblico');
const soloViaggio=opt('--viaggio');

/* la password: il primo argomento che non è un'opzione né il nome di un viaggio */
const pwNuova=process.argv.slice(2).find(a=>!a.startsWith('--')&&a!==soloViaggio);
const pwPrec=existsSync(pwFile)?readFileSync(pwFile,'utf8').trim():null;
const pw=pwNuova||pwPrec;
if(!pw){ console.error('Serve una password: node tools/lock.mjs "la password"'); process.exit(1); }
if(!existsSync(indexJs)){
  console.error('Manca viaggi/index.js. Se riparti da un clone: node tools/unlock.mjs "la password"');
  process.exit(1);
}

/* ── la chiave ──
   Il sale si riusa da viaggi/index.enc.js, così la chiave resta la
   stessa e i file già cifrati restano validi. Cambiando password si
   riparte da un sale nuovo e si rifà tutto. */
const saltVecchio=()=>{
  try{ const m=readFileSync(indexEnc,'utf8').match(/"([A-Za-z0-9+/=]+)"/);
       return m?Buffer.from(m[1],'base64').subarray(0,16):null; }catch(e){ return null; }
};
const cambioPw=!!pwNuova&&pwNuova!==pwPrec;
const vecchio=cambioPw?null:saltVecchio();
const salt=vecchio||randomBytes(16);
const daCapo=!vecchio;                       /* niente da confrontare: si cifra tutto */
const key=pbkdf2Sync(pw,salt,310000,32,'sha256');

const cifra=buf=>{ const iv=randomBytes(12); const c=createCipheriv('aes-256-gcm',key,iv);
  return Buffer.concat([iv,c.update(buf),c.final(),c.getAuthTag()]); };
const decifra=raw=>{ const d=createDecipheriv('aes-256-gcm',key,raw.subarray(0,12));
  d.setAuthTag(raw.subarray(raw.length-16));
  return Buffer.concat([d.update(raw.subarray(12,raw.length-16)),d.final()]); };

/* Scrive solo se il contenuto è davvero cambiato. Restituisce true
   se ha scritto, false se ha lasciato stare.

   Tre formati, per tre usi diversi:
     indice  → viaggi/index.enc.js: è il primo file che si apre, e
               porta in testa il sale da cui nasce la chiave
     viaggio → viaggi/<id>/data.enc.js: si carica con un tag <script>,
               così la pagina funziona anche col doppio clic, dove il
               browser non lascia leggere file
     bin     → i PDF: si scaricano e si decifrano al volo

   I due file JavaScript portano nomi diversi perché la stessa pagina
   li carica tutti e due: con lo stesso nome il secondo non partirebbe. */
const NOME={indice:'ORBIT_INDICE',viaggio:'ORBIT_DATI'};
function cifraSeCambiato(dest,buf,formato='bin'){
  const js=formato!=='bin', conSalt=formato==='indice';
  if(!daCapo&&existsSync(dest)){
    try{
      let raw=js?Buffer.from(readFileSync(dest,'utf8').match(/"([A-Za-z0-9+/=]+)"/)[1],'base64')
                :readFileSync(dest);
      if(conSalt) raw=raw.subarray(16);
      if(decifra(raw).equals(buf)) return false;
    }catch(e){ /* non si apre (password diversa, file rotto): si rifà */ }
  }
  const corpo=cifra(buf);
  if(js) writeFileSync(dest,
    '/* Cifrato con AES-256-GCM. Generato da tools/lock.mjs — non modificare a mano. */\n'+
    'globalThis.'+NOME[formato]+'="'+(conSalt?Buffer.concat([salt,corpo]):corpo).toString('base64')+'";\n');
  else writeFileSync(dest,corpo);
  return true;
}

/* legge un file di dati in chiaro e ne estrae le costanti richieste */
function leggi(percorso,nomi){
  const g={};
  new Function('g','with(g){'+readFileSync(percorso,'utf8')+';Object.assign(g,{'+nomi.join(',')+'})}')(g);
  return g;
}

/* ── 1. l'elenco dei viaggi ── */
const idx=leggi(indexJs,['VIAGGI','IDEE','STATS']);
const viaggi=idx.VIAGGI||[];
if(!viaggi.length){ console.error('viaggi/index.js non contiene nessun viaggio.'); process.exit(1); }
if(soloViaggio&&!viaggi.some(v=>v.id===soloViaggio)){
  console.error(`Il viaggio "${soloViaggio}" non è nell'elenco.`); process.exit(1);
}

/* ── 2. ogni viaggio: dati, documenti, statistiche ── */
const R=6371, rad=x=>x*Math.PI/180;
const distanza=(a,b)=>{ const [la1,lo1]=a,[la2,lo2]=b;
  const dla=rad(la2-la1), dlo=rad(lo2-lo1);
  const h=Math.sin(dla/2)**2+Math.cos(rad(la1))*Math.cos(rad(la2))*Math.sin(dlo/2)**2;
  return 2*R*Math.asin(Math.min(1,Math.sqrt(h))); };

/* La firma del viaggio: il percorso ridotto a una linea larga 100,
   così lo scaffale disegna la forma di ogni viaggio senza doverli
   aprire tutti. L'altezza esce dalla geografia vera e viene salvata
   con lei: un viaggio lungo e piatto resta lungo e piatto, uno
   raccolto in una valle resta raccolto. Nessuna deformazione.

   La longitudine si stringe col coseno della latitudine, altrimenti
   alle nostre latitudini le distanze est-ovest sembrano il doppio. */
function firma(P,LEGS){
  const pts=[]; LEGS.forEach((l,i)=>{ if(!i&&P[l.a]) pts.push(P[l.a].slice(0,2)); if(P[l.b]) pts.push(P[l.b].slice(0,2)); });
  if(pts.length<2) return {d:'',h:0};
  const lat=pts.map(p=>p[0]), latM=(Math.min(...lat)+Math.max(...lat))/2;
  const xy=pts.map(p=>[p[1]*Math.cos(rad(latM)),p[0]]);
  const xs=xy.map(p=>p[0]), ys=xy.map(p=>p[1]);
  const x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
  const w=Math.max(x1-x0,1e-6), h=Math.max(y1-y0,1e-6), s=100/w;
  return {d:xy.map(p=>`${((p[0]-x0)*s).toFixed(1)},${((y1-p[1])*s).toFixed(1)}`).join(' '),
          h:+(h*s).toFixed(1)};
}

const stats={}; let cifrati=0, invariati=0;
for(const v of viaggi){
  const dir=join(root,'viaggi',v.id);
  const src=join(dir,'data.js');
  if(!existsSync(src)){ console.warn(`  ${v.id}: manca viaggi/${v.id}/data.js, lo salto.`); continue; }

  const d=leggi(src,['P','LEGS','DAYS','POIS','BOOKINGS','DOCS','DOCS_BASE']);
  stats[v.id]={
    giorni:d.DAYS.length, tratte:d.LEGS.length, luoghi:Object.keys(d.P).length,
    punti:Object.values(d.POIS||{}).reduce((n,g)=>n+(g.items?.length||0),0),
    notti:(d.BOOKINGS||[]).length, documenti:(d.DOCS||[]).length,
    km:Math.round(d.LEGS.reduce((t,l)=>t+(d.P[l.a]&&d.P[l.b]?distanza(d.P[l.a],d.P[l.b]):0),0)),
    kmPiedi:d.DAYS.reduce((t,g)=>t+(g.km||0),0),
    quota:Math.max(...d.DAYS.map(g=>g.at||0)),
    spesa:d.DAYS.reduce((t,g)=>t+(g.eur||0),0),
    ...(f=>({firma:f.d,firmaH:f.h}))(firma(d.P,d.LEGS)),
  };

  if(soloPubblico||(soloViaggio&&soloViaggio!==v.id)) continue;

  /* i dati, con la riga che porta le costanti nello spazio globale */
  let plain=readFileSync(src,'utf8');
  const nomi=[...plain.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  if(!nomi.length){ console.error(`viaggi/${v.id}/data.js non contiene nessuna costante.`); process.exit(1); }
  plain+=`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\nObject.assign(globalThis,{${nomi.join(',')}});\n`;
  const scritto=cifraSeCambiato(join(dir,'data.enc.js'),Buffer.from(plain,'utf8'),'viaggio');
  scritto?cifrati++:invariati++;
  console.log(`viaggi/${v.id}/data.enc.js — ${scritto?'ricifrato':'invariato'} (${plain.length} caratteri).`);

  /* i documenti: i PDF originali stanno fuori dal repository */
  const outDir=join(dir,'docs');
  mkdirSync(outDir,{recursive:true});
  const base=d.DOCS_BASE?fileURLToPath(d.DOCS_BASE):null;
  const presenti=base?(d.DOCS||[]).filter(x=>existsSync(join(base,x.f))).length:0;
  if(!presenti){
    if(d.DOCS?.length) console.log(`viaggi/${v.id}/docs — i PDF originali non ci sono: lascio intatti quelli già cifrati.`);
  } else {
    /* nomi neutri (d01.bin…): anche il nome direbbe troppo su hotel e persone */
    const manifest=[]; let totale=0, nuovi=0;
    const attesi=new Set();
    (d.DOCS||[]).forEach((doc,i)=>{
      const sorgente=join(base,doc.f);
      if(!existsSync(sorgente)){ console.warn('  manca:',doc.f); return; }
      const raw=readFileSync(sorgente);
      const nome='d'+String(i+1).padStart(2,'0')+'.bin';
      attesi.add(nome);
      if(cifraSeCambiato(join(outDir,nome),raw)) nuovi++;
      manifest.push({i,f:nome,kb:Math.round(raw.length/1024)});
      totale+=raw.length;
    });
    /* via i .bin di documenti non più in elenco */
    readdirSync(outDir).forEach(f=>{ if(f.endsWith('.bin')&&!attesi.has(f)) unlinkSync(join(outDir,f)); });
    writeFileSync(join(outDir,'index.json'),JSON.stringify(manifest,null,1));
    console.log(`viaggi/${v.id}/docs — ${manifest.length} documenti (${Math.round(totale/1024)} KB), `+
                `${nuovi?nuovi+' ricifrati':'nessuno cambiato'}.`);
  }
}

/* ── 3. l'elenco cifrato, con le statistiche aggiornate ──
   STATS si riscrive anche nella copia in chiaro: è calcolato, non
   scritto a mano, e così le due copie non divergono mai. */
if(!soloPubblico){
  const testo=readFileSync(indexJs,'utf8')
    .replace(/const STATS=[\s\S]*?;\s*$/,'const STATS='+JSON.stringify(stats,null,1)+';\n');
  writeFileSync(indexJs,testo);
  const nomi=[...testo.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
  const completo=testo+`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\n`+
                 `Object.assign(globalThis,{${nomi.join(',')}});\n`;
  const scritto=cifraSeCambiato(indexEnc,Buffer.from(completo,'utf8'),'indice');
  console.log(`viaggi/index.enc.js — ${scritto?'ricifrato':'invariato'}, ${viaggi.length} viagg${viaggi.length===1?'io':'i'}, `+
              `${(idx.IDEE||[]).length} idee.`);
}

/* ── 4. i dati per la pagina dei cari ──
   Va online il viaggio marcato pubblicato; se sono più di uno, il più
   recente. La ripulitura vive in js/sanifica.js, un file solo usato
   anche dal telefono: due copie della stessa logica potrebbero
   divergere, e qui una divergenza vorrebbe dire dati riservati su una
   pagina pubblica. */
const daPubblicare=viaggi.filter(v=>v.pubblicato).sort((a,b)=>(b.dal||'').localeCompare(a.dal||''))[0];
if(!daPubblicare){
  console.log('pubblico/dati.js — nessun viaggio marcato "pubblicato": lascio la pagina dei cari com\'è.');
} else {
  const Sanifica=new Function(readFileSync(join(root,'js/sanifica.js'),'utf8')
    .replace(/if\(typeof module[\s\S]*$/,'')+';return Sanifica')();
  const g=leggi(join(root,'viaggi',daPubblicare.id,'data.js'),
    ['P','LEGS','DAYS','POIS','WAYPTS','BOOKINGS','RISERVATI_EXTRA']);
  const ris=Sanifica.riservatiDa(g.BOOKINGS,g.LEGS,g.DAYS,g.RISERVATI_EXTRA);
  if(!ris.nomi.length){ console.error('FERMO: non ho ricavato nessun nome da proteggere.'); process.exit(1); }
  const esito=Sanifica.genera(g.P,g.LEGS,g.DAYS,g.POIS,g.WAYPTS,ris);
  if(esito.trovati.length){
    console.error('FERMO: nella pagina dei cari è finito qualcosa di riservato →',esito.trovati.join(', '));
    process.exit(1);
  }
  /* la pagina dei cari deve sapere di che viaggio sono le foto del diario */
  const testo=esito.testo+`\nconst VIAGGIO_ID=${JSON.stringify(daPubblicare.id)};\n`+
    `const VIAGGIO_NOME=${JSON.stringify(daPubblicare.nome)};\n`;
  writeFileSync(join(root,'pubblico/dati.js'),testo);
  console.log(`pubblico/dati.js — ${daPubblicare.nome}: ${esito.conteggi.giornate} giornate, `+
              `${esito.conteggi.tratte} tratte, ${esito.conteggi.luoghi} luoghi, nessun dato riservato.`);
}

writeFileSync(pwFile,pw+'\n');
if(cifrati||invariati) console.log(`\n${cifrati} file ricifrati, ${invariati} lasciati com'erano.`);
