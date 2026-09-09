/* ═══════════════════════════════════════════════════════════
   SETTORE GIORNATE — selettore delle 15 giornate e scheda di
   dettaglio con tre viste: Programma, Luoghi e storie,
   Notte e soldi. Le foto arrivano da Wikipedia (gratuito).
   ═══════════════════════════════════════════════════════════ */
const Days={
  cur:0,
  tab:'prog',

  init(){
    document.getElementById('dayChips').onclick=e=>{
      const c=e.target.closest('.chip'); if(c) this.select(+c.dataset.i,true);
    };
    /* all'apertura: se siamo dentro le date del viaggio, parte dalla giornata di oggi */
    const today=new Date().toISOString().slice(0,10);
    const i=DAYS.findIndex(D=>D.d===today);
    this.select(i>=0?i:0,false);
  },

  select(i,moveMap){
    this.cur=i;
    this.renderChips();
    this.renderDetail();
    /* OrbitMap è una costante: non diventa una proprietà di window,
       quindi si controlla con typeof, non con window.OrbitMap */
    if(moveMap&&typeof OrbitMap!=='undefined') OrbitMap.showDay(i);
  },

  renderChips(){
    const box=document.getElementById('dayChips');
    box.innerHTML=DAYS.map((D,i)=>{
      const wx=Weather.of(D);
      return `<button class="chip ${i===this.cur?'on':''}" data-i="${i}">
        <small>${D.lbl} · ${Math.round(wx.min)}°/${Math.round(wx.max)}°</small>
        <b>${D.title.split(',')[0]}</b>
      </button>`;
    }).join('');
    /* porta in vista la giornata scelta muovendo SOLO la striscia:
       scrollIntoView farebbe scorrere anche la pagina, nascondendo
       il titolo sotto la barra in alto */
    const on=box.querySelector('.chip.on');
    if(on) box.scrollLeft=Math.max(0,on.offsetLeft-box.offsetLeft-16);
  },

  renderDetail(){
    const D=DAYS[this.cur], wx=Weather.of(D), el=document.getElementById('giorno-dettaglio');
    el.innerHTML=`
      <div class="today-date" style="font-size:13px;font-weight:600;color:var(--blue);text-transform:uppercase;letter-spacing:.06em">${D.lbl}</div>
      <h3 style="font-size:clamp(22px,3vw,30px);letter-spacing:-.02em;margin:4px 0 0">${D.title}</h3>
      <p class="lead">${D.lead}</p>
      <div class="statgrid">
        <div class="stat ${wx.live?'live':''}">Temperatura<b>${Math.round(wx.min)}° / ${Math.round(wx.max)}°</b></div>
        ${wx.pp!=null?`<div class="stat ${wx.pp>=40?'cold':''}">Pioggia<b>${Math.round(wx.pp)}%${wx.pr>0.2?` · ${wx.pr.toFixed(1)} mm`:''}</b></div>`:''}
        <div class="stat ${D.at>=3000?'cold':''}">Quota max<b>${D.at.toLocaleString('it')} m</b></div>
        <div class="stat">A piedi<b>${D.km} km</b></div>
        <div class="stat gold">Da spendere<b>~${D.eur} €</b></div>
        <div class="stat">Fatica<div class="effort">${[1,2,3,4,5].map(n=>`<i class="${n<=D.eff?'f':''}"></i>`).join('')}</div></div>
      </div>
      <div class="seg" role="tablist">
        <button data-t="prog" role="tab">Programma</button>
        <button data-t="foto" role="tab">Luoghi e storie</button>
        <button data-t="notte" role="tab">Notte e soldi</button>
        <button data-t="diario" role="tab">Diario</button>
      </div>
      <div class="pane" data-t="prog"><ul class="see">${(D.see||[]).map((x,k)=>{
        const p=this.findPoi(D,x);
        return `<li class="${p?'link':''}" data-k="${k}" ${p?'tabindex="0" role="button" title="Apri sulla mappa"':''}>${x}</li>`;
      }).join('')}</ul></div>
      <div class="pane" data-t="foto"><div class="gallery">${(D.photos||[]).map((ph,k)=>
        `<figure><div class="img" data-k="${k}">…</div><figcaption><h4>${ph.h}</h4><p>${ph.c}</p></figcaption></figure>`
      ).join('')}</div></div>
      <div class="pane" data-t="notte">${this.notteHtml(D)}</div>
      <div class="pane" data-t="diario">
        <textarea class="diary" placeholder="Com'è andata oggi? La nota resta salvata in questo browser." rows="8"></textarea>
        <div class="muted" style="font-size:12.5px;margin-top:6px" data-diary-state></div>
      </div>`;

    /* diario: carica e salva mentre si scrive */
    const ta=el.querySelector('.diary'), ds=el.querySelector('[data-diary-state]');
    try{ ta.value=localStorage.getItem('orbit_diary_'+D.d)||''; }catch(e){}
    let dt=null;
    ta.oninput=()=>{ ds.textContent='…'; clearTimeout(dt); dt=setTimeout(()=>{
      try{ localStorage.setItem('orbit_diary_'+D.d,ta.value); ds.textContent='Salvato'; }
      catch(e){ ds.textContent='Spazio esaurito nel browser'; }
      setTimeout(()=>ds.textContent='',1500);
    },500); };

    /* viste */
    const seg=el.querySelector('.seg');
    const setTab=t=>{ this.tab=t;
      seg.querySelectorAll('button').forEach(b=>b.classList.toggle('on',b.dataset.t===t));
      el.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.dataset.t===t));
      if(t==='foto') this.loadPhotos(D,el);
    };
    seg.onclick=e=>{ const b=e.target.closest('button'); if(b) setTab(b.dataset.t); };
    setTab(this.tab);

    /* clic su una voce del programma → vola sul punto in mappa */
    const seeEl=el.querySelector('.see');
    const go=k=>{ const p=this.findPoi(D,D.see[k]); if(p&&typeof OrbitMap!=='undefined'){ OrbitMap.showDay(this.cur,p); document.getElementById('mappa').scrollIntoView({behavior:'smooth'}); } };
    seeEl.onclick=e=>{ const li=e.target.closest('li.link'); if(li) go(+li.dataset.k); };
    seeEl.onkeydown=e=>{ const li=e.target.closest('li.link'); if(li&&(e.key==='Enter'||e.key===' ')){ e.preventDefault(); go(+li.dataset.k); } };

    bindCopy(el);
  },

  notteHtml(D){
    const i=this.cur, legs=LEGS.filter(l=>l.day===i);
    const pn=[...new Set(legs.flatMap(l=>l.pnr||[]))];
    const warns=legs.filter(l=>l.warn).map(l=>l.warn);
    return `<div class="notte">
      <div class="nbox"><small>Dove dormite</small><b>${D.stay||'—'}</b>${D.pay?`<p>Pagamento: ${D.pay}</p>`:''}</div>
      <div class="nbox"><small>Spesa prevista, in due</small><b>~${D.eur} €</b><p>Pasti, trasporti, ingressi e struttura dove non già pagata. Voli e gita Ala Kul esclusi perché già pagati.</p></div>
      ${pn.length||warns.length?`<div class="nbox"><small>Codici e avvisi</small>${pn.map(pnrHtml).join('')}${warns.map(w=>`<div class="warn">${w}</div>`).join('')}</div>`:''}
    </div>`;
  },

  /* abbina una voce del programma a un punto di interesse della giornata */
  findPoi(D,text){
    const set=POIS[D.d]; if(!set) return null;
    const norm=s=>s.toLowerCase().replace(/<[^>]+>/g,' ').replace(/[^a-zà-ü0-9 ]/g,' ');
    const skip=['dalla','della','delle','dello','sulla','verso','tutta','tutto','entro','prima','dopo','alla','alle','anche','giorno'];
    const words=norm(text.replace(/<small>.*<\/small>/,'')).split(/\s+/).filter(w=>w.length>=4&&!skip.includes(w));
    let best=null,score=0;
    set.items.forEach(p=>{ const pn=norm(p.n); const s=words.filter(w=>pn.includes(w)).length; if(s>score){score=s;best=p;} });
    return score?best:null;
  },

  /* foto da Wikipedia, caricate solo quando si apre la vista */
  _wiki:{},
  async wikiImage(titles){
    const list=Array.isArray(titles)?titles:[titles], key=list.join('|');
    if(this._wiki[key]) return this._wiki[key];
    for(const t of list){
      try{
        const u=`https://en.wikipedia.org/w/api.php?action=query&format=json&origin=*&redirects=1&prop=pageimages|info&inprop=url&piprop=thumbnail&pithumbsize=1000&titles=${encodeURIComponent(t.replace(/_/g,' '))}`;
        const j=await (await fetch(u,{signal:AbortSignal.timeout(9000)})).json();
        const pg=Object.values(j.query?.pages||{})[0];
        if(pg?.thumbnail) return this._wiki[key]={img:pg.thumbnail.source,page:pg.fullurl||'#'};
      }catch(e){}
    }
    throw 0;
  },
  loadPhotos(D,root){
    root.querySelectorAll('.gallery .img[data-k]').forEach(async el=>{
      if(el.dataset.done) return; el.dataset.done=1;
      try{
        const r=await this.wikiImage(D.photos[+el.dataset.k].w);
        el.style.backgroundImage=`url(${r.img})`; el.textContent='';
        el.innerHTML=`<a class="src" href="${r.page}" target="_blank" rel="noopener">Wikipedia</a>`;
      }catch(e){ el.textContent='Foto non disponibile'; }
    });
  },
};
