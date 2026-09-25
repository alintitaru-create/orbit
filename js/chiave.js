/* ═══════════════════════════════════════════════════════════
   SETTORE ACCESSO — la password, la chiave, i file cifrati.

   Lo usano tutte e due le pagine: lo scaffale (index.html) e il
   viaggio aperto (viaggio.html). La chiave è una sola e nasce una
   volta sola: il sale sta in testa a viaggi/index.enc.js, tutto il
   resto — ogni viaggio, ogni PDF — riusa quella chiave.

   Sul Mac i dati in chiaro ci sono già e non si chiede niente.
   Online c'è solo il cifrato: si chiede la password una volta per
   dispositivo, si decifra nel browser, e chi arriva senza password
   vede soltanto la schermata di sblocco.

   Per cambiare la password: node tools/lock.mjs "nuova password"
   ═══════════════════════════════════════════════════════════ */
const Chiave={
  RICORDO:'orbit_pw',
  key:null, salt:null,

  /* Carica un file JavaScript con un tag <script>.
     Non si usa fetch apposta: aperta col doppio clic dal Finder la
     pagina non può leggere file, ma i tag <script> funzionano. */
  script(src){
    return new Promise(res=>{
      const s=document.createElement('script');
      s.src=src; s.onload=()=>res(true); s.onerror=()=>res(false);
      document.head.appendChild(s);
    });
  },

  b64(s){ return Uint8Array.from(atob(s),c=>c.charCodeAt(0)); },

  /* dalla password alla chiave, con il sale che arriva dall'elenco */
  async deriva(pw,salt){
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
    return crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},
      base,{name:'AES-GCM',length:256},false,['decrypt','encrypt']);
  },

  /* apre un blocco cifrato: vettore (12 byte) + corpo */
  async apri(raw,key){
    const plain=await crypto.subtle.decrypt(
      {name:'AES-GCM',iv:raw.slice(0,12)},key||this.key,raw.slice(12));
    return new TextDecoder().decode(plain);
  },

  /* le costanti nascono nello spazio globale, come se fosse un file
     caricato normalmente; il testo si tiene da parte per chi lo modifica */
  esegui(sorgente){
    (0,eval)(sorgente);
    return sorgente.replace(/\n\/\* esposizione globale[\s\S]*$/,'').replace(/\n*$/,'\n');
  },

  /* ═══ richiudere ═══
     Rifà un file cifrato con la stessa chiave, come tools/lock.mjs sul
     Mac. Il sale va solo in testa all'elenco dei viaggi: è da lì che
     nasce la chiave, e basta una copia.
     Il vettore è nuovo ogni volta: non si riusa mai con la stessa chiave. */
  async cifra(testo,{conSalt=false}={}){
    const nomi=[...testo.matchAll(/^(?:const|let|var|function)\s+([A-Za-z_$][\w$]*)/gm)].map(m=>m[1]);
    const completo=testo+`\n/* esposizione globale (aggiunta da tools/lock.mjs) */\n`+
                   `Object.assign(globalThis,{${nomi.join(',')}});\n`;
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const ct=new Uint8Array(await crypto.subtle.encrypt(
      {name:'AES-GCM',iv},this.key,new TextEncoder().encode(completo)));
    const testa=conSalt?this.salt:new Uint8Array(0);
    const out=new Uint8Array(testa.length+iv.length+ct.length);
    out.set(testa,0); out.set(iv,testa.length); out.set(ct,testa.length+iv.length);
    let s='', C=0x8000;
    for(let i=0;i<out.length;i+=C) s+=String.fromCharCode.apply(null,out.subarray(i,i+C));
    return btoa(s);
  },

  /* il file com'è scritto su disco, identico a quello del Mac.
     Il nome cambia secondo l'uso: ORBIT_INDICE per l'elenco dei
     viaggi, ORBIT_DATI per i dati di un viaggio. La stessa pagina
     li carica tutti e due, e con lo stesso nome il secondo non
     partirebbe. */
  fileJs(b64,nome){
    return '/* Cifrato con AES-256-GCM. Generato da tools/lock.mjs — non modificare a mano. */\n'+
           'globalThis.'+(nome||'ORBIT_DATI')+'="'+b64+'";\n';
  },

  /* ═══ la porta ═══
     chiede la password finché non apre, poi chiama pronto() */
  async porta({salt,prova,pronto}){
    this.salt=salt;
    const gate=document.getElementById('gate');
    const form=document.getElementById('gateForm');
    const input=document.getElementById('gatePw');
    const err=document.getElementById('gateErr');
    gate.hidden=false; document.body.classList.add('locked');

    const tenta=async(pw,zitto)=>{
      try{
        const key=await this.deriva(pw,salt);
        await prova(key);                      /* se la password è sbagliata, qui si rompe */
        this.key=key;
        globalThis.ORBIT_KEY=key; globalThis.ORBIT_SALT=salt;
        try{ localStorage.setItem(this.RICORDO,pw); }catch(e){}
        gate.hidden=true; document.body.classList.remove('locked');
        pronto();
        return true;
      }catch(e){
        if(!zitto){ err.textContent='Password sbagliata.'; input.select(); }
        try{ localStorage.removeItem(this.RICORDO); }catch(e2){}
        return false;
      }
    };

    form.onsubmit=async e=>{ e.preventDefault(); err.textContent='Apro…'; await tenta(input.value,false); };

    let ricordata=null; try{ ricordata=localStorage.getItem(this.RICORDO); }catch(e){}
    if(ricordata) tenta(ricordata,true).then(ok=>{ if(!ok) input.focus(); });
    else input.focus();
  },
};
