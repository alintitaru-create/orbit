/* ═══════════════════════════════════════════════════════════
   SETTORE IDEE — la lavagna dei posti, prima che siano viaggi.

   Un'idea non ha date: ha un posto, una stagione buona e il motivo
   per cui ci si vuole andare. Quando le date arrivano, il bottone
   "Diventa un viaggio" la porta di là e la toglie dalla lavagna.

   Stanno dentro viaggi/index.enc.js, cifrate come tutto il resto:
   anche i desideri sono fatti nostri.
   ═══════════════════════════════════════════════════════════ */
const Idee={

  esc(s){ return String(s||'').replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c])); },

  card(i){
    const righe=[];
    if(i.stagione) righe.push(`Quando: ${this.esc(i.stagione)}`);
    if(i.giorni)   righe.push(`${this.esc(i.giorni)} giorni`);
    if(i.costo)    righe.push(this.esc(i.costo));
    return `<article class="idea" data-id="${i.id}">
      <header>
        <h3>${this.esc(i.posto)}</h3>
        ${i.paese?`<span class="paese">${this.esc(i.paese)}</span>`:''}
      </header>
      ${i.perche?`<p class="perche">${this.esc(i.perche)}</p>`:''}
      ${righe.length?`<p class="dettagli">${righe.join(' · ')}</p>`:''}
      ${i.link?`<p class="collegamento"><a href="${this.esc(i.link)}" target="_blank" rel="noopener">Guarda</a></p>`:''}
      <div class="azioni">
        <button class="lnk promuovi">Diventa un viaggio</button>
        <button class="lnk togli">Togli</button>
      </div>
    </article>`;
  },

  render(){
    const box=document.getElementById('lavagna');
    const lista=Viaggi.idee();
    box.innerHTML=(lista.length
      ? `<div class="griglia-idee">${lista.map(i=>this.card(i)).join('')}</div>`
      : `<p class="vuoto">La lavagna è vuota. Il prossimo viaggio comincia qui: un posto,
         la stagione giusta, e il resto viene dopo.</p>`)+
      `<form id="ideaForm">
        <label>Dove<input name="posto" placeholder="Svaneti" required maxlength="60"></label>
        <label>Paese<input name="paese" placeholder="Georgia" maxlength="40"></label>
        <label>Perché<input name="perche" placeholder="Torri di pietra e ghiacciai, senza strade" maxlength="140"></label>
        <div class="tre">
          <label>Quando<input name="stagione" placeholder="giugno–settembre" maxlength="30"></label>
          <label>Giorni<input name="giorni" type="number" min="1" max="120" placeholder="10"></label>
          <label>Quanto<input name="costo" placeholder="~900 € in due" maxlength="30"></label>
        </div>
        <label>Un collegamento<input name="link" type="url" placeholder="https://…" maxlength="300"></label>
        <div class="azioni">
          <button class="pill on" type="submit">Aggiungi alla lavagna</button>
          <span class="stato"></span>
        </div>
      </form>`;
    this.lega();
  },

  lega(){
    const box=document.getElementById('lavagna');
    const form=box.querySelector('#ideaForm');
    const stato=form.querySelector('.stato');

    form.onsubmit=async e=>{
      e.preventDefault();
      const idea={
        id:Date.now().toString(36),
        posto:form.posto.value.trim(), paese:form.paese.value.trim(),
        perche:form.perche.value.trim(), stagione:form.stagione.value.trim(),
        giorni:form.giorni.value?+form.giorni.value:null, costo:form.costo.value.trim(),
        link:form.link.value.trim(),
      };
      if(!idea.posto) return;
      await this.scrivi(()=>IDEE.push(idea),`Idea: ${idea.posto}`,stato);
    };

    box.querySelectorAll('.idea').forEach(el=>{
      const id=el.dataset.id;
      el.querySelector('.togli').onclick=async()=>{
        const i=Viaggi.idee().find(x=>x.id===id);
        if(!i||!confirm(`Tolgo "${i.posto}" dalla lavagna?`)) return;
        await this.scrivi(()=>IDEE.splice(IDEE.indexOf(i),1),`Tolta l'idea: ${i.posto}`,stato);
      };
      el.querySelector('.promuovi').onclick=()=>{
        const i=Viaggi.idee().find(x=>x.id===id);
        if(i) Scaffale.daIdea(i);
      };
    });
  },

  /* cambia la lavagna e la rimanda su GitHub; se non si può, lo dice */
  async scrivi(cambia,messaggio,stato){
    if(!Chiave.key||typeof Pubblica==='undefined'||!Pubblica.token()){
      stato.innerHTML=!Chiave.key
        ? 'Qui non posso salvare: la lavagna si aggiorna dalla pagina online, con la password.'
        : 'Serve prima la chiave di GitHub: si prende una volta sola, dalla scheda <b>Diario</b> di una giornata.';
      return;
    }
    const prima=JSON.parse(JSON.stringify(IDEE));
    cambia();
    stato.textContent='Salvo…';
    try{
      await Viaggi.salva(messaggio);
      stato.textContent='';
      this.render();
    }catch(e){
      IDEE.length=0; prima.forEach(x=>IDEE.push(x));   /* si rimette com'era */
      stato.textContent='Non ha funzionato: '+e.message;
    }
  },
};
