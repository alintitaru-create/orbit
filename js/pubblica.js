/* ═══════════════════════════════════════════════════════════
   SETTORE PUBBLICAZIONE — manda una giornata ai cari.

   Usa GitHub come magazzino: le foto scelte e la nota del diario
   finiscono in pubblico/diario/, e la pagina pubblica le legge.
   Serve un token personale, chiesto una volta sola e tenuto solo
   su questo dispositivo (non viene mai pubblicato).

   Si pubblica a mano, una giornata per volta: niente parte da solo.
   ═══════════════════════════════════════════════════════════ */
const Pubblica={
  REPO:'alintitaru-create/orbit',
  API:'https://api.github.com',
  KEY:'orbit_gh',

  token(){ try{ return localStorage.getItem(this.KEY)||''; }catch(e){ return ''; } },
  setToken(t){ try{ t?localStorage.setItem(this.KEY,t):localStorage.removeItem(this.KEY); }catch(e){} },

  head(){ return {Authorization:'Bearer '+this.token(),Accept:'application/vnd.github+json',
                  'X-GitHub-Api-Version':'2022-11-28'}; },

  /* base64 di un file, a pezzi per non soffocare su quelli grandi */
  b64(buf){
    const b=new Uint8Array(buf); let s='', C=0x8000;
    for(let i=0;i<b.length;i+=C) s+=String.fromCharCode.apply(null,b.subarray(i,i+C));
    return btoa(s);
  },

  /* scrive (o riscrive) un file nel repository */
  async scrivi(path,contenutoB64,messaggio){
    let sha=null;
    const g=await fetch(`${this.API}/repos/${this.REPO}/contents/${path}`,{headers:this.head()});
    if(g.ok) sha=(await g.json()).sha;
    else if(g.status===401) throw new Error('Il token non è valido o è scaduto.');
    const r=await fetch(`${this.API}/repos/${this.REPO}/contents/${path}`,{
      method:'PUT',headers:{...this.head(),'Content-Type':'application/json'},
      body:JSON.stringify({message:messaggio,content:contenutoB64,...(sha?{sha}:{})})});
    if(!r.ok){
      const t=await r.text();
      throw new Error(r.status===403?'GitHub ha rifiutato: controlla che il token abbia il permesso Contents in scrittura.'
                     :r.status===401?'Il token non è valido o è scaduto.'
                     :'Errore '+r.status+' '+t.slice(0,120));
    }
  },

  async leggiIndice(){
    try{
      const r=await fetch(`${this.API}/repos/${this.REPO}/contents/pubblico/diario/index.json`,{headers:this.head()});
      if(!r.ok) return {};
      const j=await r.json();
      return JSON.parse(decodeURIComponent(escape(atob(j.content.replace(/\n/g,'')))));
    }catch(e){ return {}; }
  },

  /* ── pubblica una giornata ── */
  async giornata(day,opz,avanzamento){
    const say=t=>avanzamento&&avanzamento(t);
    if(!this.token()) throw new Error('Manca il token.');

    const tutti=(await Media.all(day)).sort((a,b)=>a.t-b.t);
    const scelti=tutti.filter(m=>opz.ids.includes(m.id));
    const foto=[];

    for(let i=0;i<scelti.length;i++){
      const m=scelti[i];
      if(m.size>24*1024*1024){ say(`Salto un file troppo grande (${Math.round(m.size/1048576)} MB)`); continue; }
      const est=m.type==='video'?'mp4':'jpg';
      const nome=`f${m.id}.${est}`;
      say(`Carico ${i+1} di ${scelti.length}…`);
      await this.scrivi(`pubblico/diario/${day}/${nome}`,
        this.b64(await m.blob.arrayBuffer()),`Foto del ${day}`);
      foto.push({f:`${day}/${nome}`,cap:m.caption||'',tipo:m.type});
    }

    say('Aggiorno la pagina dei cari…');
    const idx=await this.leggiIndice();
    idx[day]={nota:opz.nota||'',foto,agg:new Date().toISOString()};
    /* l'indice si scrive per ultimo: non punta mai a file non ancora caricati */
    await this.scrivi('pubblico/diario/index.json',
      btoa(unescape(encodeURIComponent(JSON.stringify(idx,null,1)))),
      `Diario del ${day}`);
    return foto.length;
  },

  /* ── pannello dentro la scheda Diario ── */
  mount(day,root){
    const box=root.querySelector('.pub-box'); if(!box) return;
    const ha=!!this.token();

    if(!ha){
      box.innerHTML=`
        <b>Condividi con i cari</b>
        <p class="muted">Per mandare foto e nota alla pagina pubblica serve una chiave di GitHub, da creare una volta sola.</p>
        <ol class="pub-guida">
          <li>Apri <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">questa pagina di GitHub</a></li>
          <li>In <i>Repository access</i> scegli <b>Only select repositories</b> → <b>orbit</b></li>
          <li>In <i>Permissions</i> → <i>Repository permissions</i> → <b>Contents</b> → <b>Read and write</b></li>
          <li>Genera la chiave, copiala e incollala qui sotto</li>
        </ol>
        <form class="pub-tok">
          <input type="password" placeholder="github_pat_…" autocomplete="off">
          <button class="pill on" type="submit">Salva</button>
        </form>
        <p class="muted" style="margin-top:8px">Resta solo su questo dispositivo.</p>`;
      box.querySelector('.pub-tok').onsubmit=e=>{
        e.preventDefault();
        const v=e.target.querySelector('input').value.trim();
        if(v){ this.setToken(v); this.mount(day,root); }
      };
      return;
    }

    Media.all(day).then(items=>{
      items.sort((a,b)=>a.t-b.t);
      const nota=(()=>{ try{ return localStorage.getItem('orbit_diary_'+day)||''; }catch(e){ return ''; } })();
      box.innerHTML=`
        <b>Condividi con i cari</b>
        <p class="muted">Scegli cosa mandare alla pagina pubblica di questa giornata.</p>
        ${items.length?`<div class="pub-scelta">${items.map((m,k)=>
          `<label><input type="checkbox" value="${m.id}" checked> ${m.type==='video'?'video':'foto'} ${k+1}${m.caption?' · '+m.caption.slice(0,26):''}</label>`
        ).join('')}</div>`:'<p class="muted">Nessuna foto in questa giornata: aggiungine qui sopra.</p>'}
        <label class="pub-nota"><input type="checkbox" id="pubNota" ${nota?'checked':''} ${nota?'':'disabled'}>
          Manda anche la nota del diario${nota?'':' (ancora vuota)'}</label>
        <div class="pub-azioni">
          <button class="pill on" id="pubVia" ${!items.length&&!nota?'disabled':''}>Pubblica la giornata</button>
          <button class="pill" id="pubTok">Cambia chiave</button>
        </div>
        <p class="pub-stato muted"></p>`;

      const stato=box.querySelector('.pub-stato');
      box.querySelector('#pubTok').onclick=()=>{ this.setToken(''); this.mount(day,root); };
      box.querySelector('#pubVia').onclick=async ev=>{
        const b=ev.target; b.disabled=true;
        const ids=[...box.querySelectorAll('.pub-scelta input:checked')].map(i=>+i.value);
        const mandaNota=box.querySelector('#pubNota').checked;
        try{
          const n=await this.giornata(day,{ids,nota:mandaNota?nota:''},t=>stato.textContent=t);
          stato.innerHTML=`Fatto: ${n} element${n===1?'o':'i'} pubblicat${n===1?'o':'i'}. `+
            `Compare fra un paio di minuti su <a href="pubblico/" target="_blank">la pagina dei cari</a>.`;
        }catch(e){ stato.textContent='Non ha funzionato: '+e.message; }
        b.disabled=false;
      };
    });
  },
};
