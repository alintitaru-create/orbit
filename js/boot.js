/* ═══════════════════════════════════════════════════════════
   SETTORE ACCESSO — decide come partire.

   Sul Mac: `js/data.js` esiste in chiaro, la pagina parte subito.
   Online: quel file non viene pubblicato; al suo posto c'è
   `js/data.enc.js`, cifrato con AES-256-GCM. La pagina chiede
   la password una volta sola per dispositivo, decifra tutto nel
   browser e parte. Chi trova l'indirizzo senza password vede
   soltanto la schermata di sblocco.

   Per cambiare la password: node tools/lock.mjs "nuova password"
   ═══════════════════════════════════════════════════════════ */
(function(){
  const KEY='orbit_pw';

  /* dati in chiaro presenti (copia locale sul Mac) → si parte */
  if(typeof P!=='undefined'){ startOrbit(); return; }

  const gate=document.getElementById('gate');
  const form=document.getElementById('gateForm');
  const input=document.getElementById('gatePw');
  const err=document.getElementById('gateErr');
  gate.hidden=false;
  document.body.classList.add('locked');

  const b64=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));

  async function unlock(pw){
    const raw=b64(ORBIT_ENC);
    const salt=raw.slice(0,16), iv=raw.slice(16,28), data=raw.slice(28);
    const base=await crypto.subtle.importKey('raw',new TextEncoder().encode(pw),'PBKDF2',false,['deriveKey']);
    const key=await crypto.subtle.deriveKey(
      {name:'PBKDF2',salt,iterations:310000,hash:'SHA-256'},
      base,{name:'AES-GCM',length:256},false,['decrypt']);
    const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv},key,data);
    /* eval indiretto: le costanti nascono nello spazio globale,
       esattamente come se fosse stato caricato js/data.js */
    (0,eval)(new TextDecoder().decode(plain));
    /* la stessa chiave apre anche i PDF cifrati in docs/ */
    globalThis.ORBIT_KEY=key;
  }

  async function tryPw(pw,silent){
    try{
      await unlock(pw);
      try{ localStorage.setItem(KEY,pw); }catch(e){}
      gate.hidden=true; document.body.classList.remove('locked');
      startOrbit();
      return true;
    }catch(e){
      if(!silent){ err.textContent='Password sbagliata.'; input.select(); }
      try{ localStorage.removeItem(KEY); }catch(e2){}
      return false;
    }
  }

  form.onsubmit=async e=>{
    e.preventDefault();
    err.textContent='Apro…';
    await tryPw(input.value,false);
  };

  /* già sbloccata su questo dispositivo */
  let saved=null; try{ saved=localStorage.getItem(KEY); }catch(e){}
  if(saved) tryPw(saved,true).then(ok=>{ if(!ok) input.focus(); });
  else input.focus();
})();
