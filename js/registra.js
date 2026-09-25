/* ═══════════════════════════════════════════════════════════
   SETTORE REGISTRATORE — il telefono segue il percorso.

   Si tocca "Registra", si cammina, si tocca "Ferma": resta la
   traccia di dove siete passati, coi chilometri e il dislivello
   contati sui punti veri.

   Due cose vanno dette chiare, perché nessuna pagina web può fare
   altrimenti:

   1. Con lo schermo spento o un'altra app davanti, l'iPhone smette
      di dare la posizione. Si chiede al telefono di tenere lo
      schermo acceso (Wake Lock), ma se lo si spegne a mano la
      registrazione si ferma. Per una camminata corta o un giro in
      città va benissimo; per un trekking di sei ore conviene
      registrare con l'app del trekking e poi importare il GPX.
   2. Il consumo di batteria non è trascurabile: il GPS acceso e lo
      schermo acceso si sentono.

   Quello che invece è garantito: **non si perde niente**. I punti
   vengono depositati mentre arrivano, non alla fine. Se la pagina
   si chiude, alla riapertura la registrazione è ancora lì e si può
   riprendere o chiudere.
   ═══════════════════════════════════════════════════════════ */
const Registra={
  PRECISIONE_MAX:50,   /* metri: sopra, il punto è troppo incerto */
  PASSO_MIN:5,         /* metri: sotto, è il GPS che balla, non voi */
  OGNI:10,             /* punti fra un salvataggio e l'altro */

  attiva:null,         /* la registrazione in corso */
  watch:null, schermo:null, tic:null,

  /* ── c'è una registrazione rimasta aperta? ── */
  async rimasta(){
    try{
      const tutte=await Tracce.all(this.giornoOggi());
      return tutte.find(t=>t.aperta)||null;
    }catch(e){ return null; }
  },

  giornoOggi(){
    const oggi=new Date().toISOString().slice(0,10);
    return DAYS.some(d=>d.d===oggi)?oggi:(DAYS[DAYS.length-1]?.d||oggi);
  },

  /* ═══ partire ═══ */
  async parti(day,tipo,nome,disegna){
    if(!navigator.geolocation) throw new Error('Questo telefono non dà la posizione.');
    const rec=await Tracce.salva({day,nome:nome||'Percorso',tipo,punti:[],fonte:'registrata'});
    rec.aperta=true; rec.inizio=Date.now();
    await Tracce.put(rec);
    this.attiva=rec;
    this.daSalvare=0;

    /* si chiede al telefono di non spegnere lo schermo: senza, la
       posizione smette di arrivare dopo pochi secondi */
    try{ this.schermo=await navigator.wakeLock?.request('screen'); }catch(e){ this.schermo=null; }
    document.addEventListener('visibilitychange',this._riprendiSchermo=async()=>{
      if(document.visibilityState==='visible'&&this.attiva&&!this.schermo)
        try{ this.schermo=await navigator.wakeLock?.request('screen'); }catch(e){}
    });

    this.watch=navigator.geolocation.watchPosition(
      p=>this.punto(p,disegna),
      ()=>{},
      {enableHighAccuracy:true,maximumAge:0,timeout:30000});

    this.tic=setInterval(()=>disegna&&disegna(),1000);
    return rec;
  },

  /* ── un punto nuovo ── */
  async punto(p,disegna){
    if(!this.attiva) return;
    const {latitude:la,longitude:lo,altitude:q,accuracy:prec}=p.coords;
    this.precisione=Math.round(prec);
    if(prec>this.PRECISIONE_MAX) return;                 /* troppo incerto */
    const punti=this.attiva.punti;
    const ultimo=punti[punti.length-1];
    if(ultimo&&hav([ultimo[0],ultimo[1]],[la,lo])*1000<this.PASSO_MIN) return;  /* fermi */

    punti.push([+la.toFixed(6),+lo.toFixed(6),q!=null&&isFinite(q)?Math.round(q):null,p.timestamp||Date.now()]);
    Object.assign(this.attiva,Tracce.conti(punti));

    /* si deposita ogni tanto, non a ogni passo: scrivere su disco
       a ogni punto scalderebbe il telefono per niente */
    if(++this.daSalvare>=this.OGNI){ this.daSalvare=0; await Tracce.put(this.attiva); }
    disegna&&disegna();
  },

  /* ═══ fermare ═══ */
  async ferma(){
    if(!this.attiva) return null;
    const rec=this.attiva;
    if(this.watch!=null) navigator.geolocation.clearWatch(this.watch);
    clearInterval(this.tic);
    document.removeEventListener('visibilitychange',this._riprendiSchermo);
    try{ await this.schermo?.release(); }catch(e){}
    this.schermo=null; this.watch=null; this.attiva=null;

    rec.aperta=false; rec.fine=Date.now();
    Object.assign(rec,Tracce.conti(rec.punti));
    /* una registrazione che non ha visto niente non si tiene */
    if(rec.punti.length<2){ await Tracce.del(rec.id); return null; }
    await Tracce.put(rec);
    return rec;
  },

  /* riprende una registrazione rimasta aperta (pagina chiusa per sbaglio) */
  async riprendi(rec,disegna){
    this.attiva=rec; this.daSalvare=0;
    try{ this.schermo=await navigator.wakeLock?.request('screen'); }catch(e){}
    this.watch=navigator.geolocation.watchPosition(
      p=>this.punto(p,disegna),()=>{},
      {enableHighAccuracy:true,maximumAge:0,timeout:30000});
    this.tic=setInterval(()=>disegna&&disegna(),1000);
    return rec;
  },

  /* quanto è durata finora */
  trascorso(){
    if(!this.attiva) return 0;
    const p=this.attiva.punti;
    if(p.length>1&&p[0][3]&&p[p.length-1][3]) return p[p.length-1][3]-p[0][3];
    return this.attiva.inizio?Date.now()-this.attiva.inizio:0;
  },
};
