/* ═══════════════════════════════════════════════════════════
   SETTORE INTRO CINEMATOGRAFICA
   Quattro tempi:
   1. il titolo: nome del viaggio e i suoi numeri, mentre la firma
      del percorso si disegna — è lei la barra di caricamento
   2. la corsa: il mezzo percorre ogni tratta, la scia si accende
      del colore del mezzo, il contachilometri sale, la riga in
      basso avanza giornata per giornata
   3. il finale: la camera si allarga su tutto il percorso fatto
   4. la dissolvenza sulla pagina
   Si salta con il bottone o con ESC.

   Niente di un viaggio in particolare è scritto qui: nomi, date,
   numeri e colori arrivano dai dati del viaggio aperto.

   Tecnica: una sola linea per tutta la scia, rivelata e colorata
   con line-gradient su line-progress — nessun aggiornamento di
   geometria a ogni fotogramma.
   ═══════════════════════════════════════════════════════════ */
const Cinematic={
  playing:false, anim:null, veh:null, baseBefore:0, nascosti:[],

  $(id){ return document.getElementById(id); },
  attesa(ms){ return new Promise(r=>setTimeout(r,ms)); },

  /* i numeri piccoli si scrivono in lettere, come in un libro */
  parole(n){
    const p=['zero','un','due','tre','quattro','cinque','sei','sette','otto','nove','dieci',
      'undici','dodici','tredici','quattordici','quindici','sedici','diciassette','diciotto','diciannove','venti'];
    return p[n]||String(n);
  },

  /* ── 1. il titolo, preso dal viaggio aperto ── */
  titolo(){
    const v=Viaggio.meta||{}, s=Viaggi.stat(Viaggio.id);
    const giorni=s.giorni||Viaggi.durata(v)||DAYS.length;
    const mezzi=new Set(LEGS.map(l=>l.m)).size;
    const km=s.km||0;
    const numeri=[
      giorni?`${this.parole(giorni)} giorni`:'',
      mezzi>1?`${this.parole(mezzi)} mezzi`:'',
      km?`${km.toLocaleString('it')} chilometri`:'',
    ].filter(Boolean).join(', ');
    this.$('introNome').textContent=v.nome||'Orbit';
    this.$('introSotto').textContent=[v.sotto,Viaggi.periodo(v)].filter(Boolean).join('. ')+(v.sotto||Viaggi.periodo(v)?'.':'');
    this.$('introNumeri').textContent=numeri?numeri.charAt(0).toUpperCase()+numeri.slice(1)+'.':'';

    /* la firma del percorso, la stessa della card sullo scaffale */
    const svg=this.$('introFirma'), f=s.firma;
    svg.hidden=!f;
    if(f){
      svg.setAttribute('viewBox',`-3 -3 106 ${(s.firmaH||0)+6}`);
      svg.querySelector('polyline').setAttribute('points',f);
      svg.style.setProperty('--tinta',v.colore||'var(--steppe)');
    }
  },
  progresso(p,txt){
    this.$('introFirma').style.setProperty('--p',Math.max(0,Math.min(1,p)));
    if(txt) this.$('introLbl').textContent=txt;
  },

  /* ── costruisce la scia unica e il segnalino del mezzo ── */
  build(){
    const map=OrbitMap.map;
    this.FULL=[]; this.MCUM=[0];
    LEGS.forEach(Lg=>{
      Lg._f0=this.FULL.length;
      this.FULL.push(...Lg._pts.map(p=>[p[1],p[0]]));
      Lg._f1=this.FULL.length-1;
      /* lunghezza in km della tratta, per il contachilometri */
      let km=0; for(let i=1;i<Lg._pts.length;i++) km+=hav(Lg._pts[i-1],Lg._pts[i]);
      Lg._len=km;
    });
    const merc=this.FULL.map(c=>{const m=maplibregl.MercatorCoordinate.fromLngLat(c);return [m.x,m.y];});
    for(let i=1;i<merc.length;i++)
      this.MCUM.push(this.MCUM[i-1]+Math.hypot(merc[i][0]-merc[i-1][0],merc[i][1]-merc[i-1][1]));
    this.MTOT=this.MCUM[this.MCUM.length-1]||1;
    LEGS.forEach(Lg=>{ Lg._p0=this.MCUM[Lg._f0]/this.MTOT; Lg._p1=this.MCUM[Lg._f1]/this.MTOT; });

    map.addSource('trail',{type:'geojson',lineMetrics:true,
      data:{type:'Feature',geometry:{type:'LineString',coordinates:this.FULL}}});
    /* tre strati: alone colorato, filo bianco sotto, colore del mezzo sopra.
       Il filo bianco stacca la scia da qualunque fondo, mare compreso. */
    const linea={'line-cap':'round','line-join':'round'};
    map.addLayer({id:'trailGlow',type:'line',source:'trail',layout:linea,
      paint:{'line-width':16,'line-opacity':.35,'line-blur':8}});
    map.addLayer({id:'trailCase',type:'line',source:'trail',layout:linea,
      paint:{'line-width':7}});
    map.addLayer({id:'trail',type:'line',source:'trail',layout:linea,
      paint:{'line-width':4}});
    this.reveal(0);

    this.righello();

    const d=document.createElement('div'); d.className='veh';
    this.veh=new maplibregl.Marker({element:d,anchor:'center',pitchAlignment:'viewport',rotationAlignment:'viewport'})
      .setLngLat(this.FULL[0]).addTo(map);
    this.vehMode=null;
    this.setVeh(LEGS[0].m,0);
  },

  /* ── i livelli del piano restano spenti durante l'intro ──
     Tratte previste, fermate, percorsi registrati e punti di interesse
     racconterebbero il viaggio prima del tempo: la scia deve scoprirlo. */
  nascondiPiano(){
    const map=OrbitMap.map;
    this.nascosti=map.getStyle().layers.map(l=>l.id)
      .filter(id=>/^(legs|stops|tracce|poi)/.test(id)&&map.getLayoutProperty(id,'visibility')!=='none');
    this.nascosti.forEach(id=>map.setLayoutProperty(id,'visibility','none'));
  },
  mostraPiano(){
    const map=OrbitMap.map;
    this.nascosti.forEach(id=>{ if(map.getLayer(id)) map.setLayoutProperty(id,'visibility','visible'); });
    this.nascosti=[];
  },

  /* accende la scia fino a frac (frazione del percorso totale),
     ogni tratta del colore del suo mezzo */
  reveal(frac){
    const b=Math.max(1e-5,Math.min(1,frac)), vuoto='rgba(0,0,0,0)';
    const colori=['step',['line-progress'],MODE_HEX[LEGS[0].m]];
    const bianco=['step',['line-progress'],'#ffffff'];
    let ultimo=0;
    LEGS.forEach((Lg,i)=>{
      if(!i||Lg._p0<=ultimo||Lg._p0>=b) return;
      colori.push(Lg._p0,MODE_HEX[Lg.m]); ultimo=Lg._p0;
    });
    colori.push(b,vuoto); bianco.push(b,vuoto);
    const map=OrbitMap.map;
    if(map.getLayer('trail')) map.setPaintProperty('trail','line-gradient',colori);
    if(map.getLayer('trailGlow')) map.setPaintProperty('trailGlow','line-gradient',colori);
    if(map.getLayer('trailCase')) map.setPaintProperty('trailCase','line-gradient',bianco);
    this.$('rottaFill').style.width=(b*100)+'%';
  },
  STRATI:['trail','trailCase','trailGlow'],
  hideTrail(){ this.STRATI.forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.setLayoutProperty(id,'visibility','none'); }); },

  /* la riga in basso: una tacca dove comincia ogni giornata */
  righello(){
    const box=this.$('rotta');
    box.querySelectorAll('b').forEach(b=>b.remove());
    let giorno=-1;
    LEGS.forEach(Lg=>{
      if(Lg.day===giorno) return; giorno=Lg.day;
      if(Lg._p0<=0) return;
      const t=document.createElement('b'); t.style.left=(Lg._p0*100)+'%'; box.append(t);
    });
  },

  /* posizione e direzione a una certa frazione del percorso */
  pointAt(frac){
    const d=Math.max(0,Math.min(1,frac))*this.MTOT;
    let lo=1,hi=this.MCUM.length-1;
    while(lo<hi){ const m=(lo+hi)>>1; if(this.MCUM[m]<d) lo=m+1; else hi=m; }
    const s=this.MCUM[lo]-this.MCUM[lo-1]||1, t=(d-this.MCUM[lo-1])/s;
    const a=this.FULL[lo-1], b=this.FULL[lo];
    const p=[a[0]+(b[0]-a[0])*t, a[1]+(b[1]-a[1])*t];
    const y=Math.sin((b[0]-a[0])*Math.PI/180)*Math.cos(b[1]*Math.PI/180);
    const x=Math.cos(a[1]*Math.PI/180)*Math.sin(b[1]*Math.PI/180)-Math.sin(a[1]*Math.PI/180)*Math.cos(b[1]*Math.PI/180)*Math.cos((b[0]-a[0])*Math.PI/180);
    return {p,h:(Math.atan2(y,x)*180/Math.PI+360)%360};
  },

  setVeh(m,h){
    const el=this.veh.getElement();
    if(m!==this.vehMode){ el.innerHTML=ICONS[m]; el.style.color=MODE_HEX[m]; this.vehMode=m; }
    if(m==='air'){ el.classList.remove('flip'); this.veh.setRotation(h-OrbitMap.map.getBearing()); }
    else { this.veh.setRotation(0); el.classList.toggle('flip',h>180); }
  },

  /* zoom e inclinazione della camera per tipo di mezzo */
  camZoom(Lg){
    if(Lg.m==='air') return Lg._len>1500?4.2:Lg._len>500?6.2:8.2;
    return Lg.m==='rail'?9.4:Lg.m==='road'?10.2:Lg.m==='horse'?12:11.8;
  },

  /* "Giorno 3 di 15": dove siamo nel viaggio */
  giorno(Lg){ return `Giorno ${Lg.day+1} di ${DAYS.length}`; },

  /* ── 2. percorre una tratta ── */
  runLeg(i,then,speed){
    const Lg=LEGS[i], map=OrbitMap.map;
    const dur=Math.min(9000,Math.max(2600,Lg._len*{air:2.0,rail:40,road:48,foot:360,horse:440}[Lg.m]))/speed;
    const tz=this.camZoom(Lg);
    const odo=this.$('odo'), city=this.$('cityCard');
    odo.classList.add('show');
    this.$('odoMode').innerHTML=ICONS[Lg.m];
    this.$('odoMode').style.color=MODE_HEX[Lg.m];
    this.$('odoLbl').textContent=MODE_IT[Lg.m];
    this.card(P[Lg.a][2], Lg.t+' · '+Lg.s.split(',')[0], '', this.giorno(Lg));
    city.classList.add('show');

    /* è una vera tappa? (ci si dorme, cambia la giornata, o è la fine) */
    const tappa=!!Lg.stay || i===LEGS.length-1 || (LEGS[i+1]&&LEGS[i+1].day!==Lg.day);

    /* cubica: parte dolce e soprattutto si posa dolce sull'arrivo */
    const ease=f=>f<.5?4*f*f*f:1-Math.pow(-2*f+2,3)/2;
    let t0=null;
    const step=ts=>{
      if(!this.playing) return;
      if(!t0) t0=ts;
      const f=Math.min(1,(ts-t0)/dur), e=ease(f);
      if(f>0.10) city.classList.remove('show');
      const frac=Lg._p0+(Lg._p1-Lg._p0)*e;
      const {p,h}=this.pointAt(frac);
      this.veh.setLngLat(p);
      this.setVeh(Lg.m,h);
      /* negli ultimi tratti la camera insegue più piano e scende di quota:
         è quello che dà la sensazione di atterrare sulla destinazione */
      const avvicina=Math.max(0,(f-0.72)/0.28);
      const segui=0.22-0.14*avvicina;
      const c=map.getCenter(), z=map.getZoom();
      map.jumpTo({center:[c.lng+(p[0]-c.lng)*segui, c.lat+(p[1]-c.lat)*segui],
                  zoom:z+((tz+1.1*avvicina)-z)*0.05, pitch:42-6*avvicina, bearing:0});
      this.reveal(frac);
      this.$('odoKm').textContent=Math.round(this.totKm(i,e)).toLocaleString('it');
      if(f<1){ this.anim=requestAnimationFrame(step); return; }

      /* ── arrivo: cartello con i dettagli e pausa per leggere ── */
      const D=DAYS[Lg.day];
      const sotto=tappa?D.title:Lg.t;
      /* solo il nome della struttura: indirizzi e codici di conferma
         qui non servono e allungherebbero la pausa per nulla */
      const extra=tappa?(Lg.stay?'Dormite: '+Lg.stay.split(',')[0]:(Lg.warn||'')):'';
      this.card(P[Lg.b][2],sotto,extra,tappa?D.lbl:this.giorno(Lg));
      city.classList.add('show');
      map.easeTo({center:this.pointAt(Lg._p1).p,zoom:tz+1.2,pitch:34,duration:1500});
      this.anim=null;
      /* la pausa cresce con il testo da leggere, entro limiti sensati */
      const pausa=tappa
        ? Math.min(2600,1400+(P[Lg.b][2].length+sotto.length+extra.length)*12)
        : 800;
      this.holdT=setTimeout(()=>{ if(this.playing&&then) then(); },pausa);
    };
    this.anim=requestAnimationFrame(step);
  },

  /* riempie il cartello della città */
  card(nome,sotto,extra,giorno){
    this.$('cityDay').textContent=giorno||'';
    this.$('cityName').textContent=nome;
    this.$('citySub').textContent=sotto||'';
    const e=this.$('cityExtra');
    e.textContent=extra||''; e.hidden=!extra;
  },
  /* chilometri percorsi dall'inizio fino alla tratta i, frazione e */
  /* Le linee disegnate sono un po' più lunghe o più corte della strada
     vera: si riportano in scala, così il contatore finisce esattamente
     sui chilometri scritti nel resto della pagina. */
  totKm(i,e){
    let km=0; for(let k=0;k<i;k++) km+=LEGS[k]._len;
    km+=LEGS[i]._len*e;
    const vero=Viaggi.stat(Viaggio.id).km, disegnato=LEGS.reduce((n,l)=>n+l._len,0);
    return vero&&disegnato?km*vero/disegnato:km;
  },

  /* ── sequenza completa ── */
  playAll(speed,onEnd){
    let i=0;
    const next=()=>{
      if(!this.playing) return;
      if(i>=LEGS.length){ if(onEnd) onEnd(); return; }
      this.runLeg(i++,next,speed);
    };
    next();
  },

  /* ── 3. il finale: tutto il percorso in un colpo d'occhio ── */
  async finale(){
    const map=OrbitMap.map, v=Viaggio.meta||{}, city=this.$('cityCard');
    city.classList.remove('show');
    this.$('odo').classList.remove('show');
    if(this.veh){ this.veh.remove(); this.veh=null; }
    await this.attesa(500);
    if(!this.playing) return;

    const b=new maplibregl.LngLatBounds(this.FULL[0],this.FULL[0]);
    this.FULL.forEach(c=>b.extend(c));
    const alto=innerHeight*.24, basso=innerHeight*.14;
    const cam=map.cameraForBounds(b,{padding:{top:alto,bottom:basso,left:40,right:40}});
    if(cam) map.easeTo({...cam,pitch:0,bearing:0,duration:2800,easing:t=>1-Math.pow(1-t,3)});
    this.reveal(1);

    const km=Math.round(this.totKm(LEGS.length-1,1));
    this.card(v.nome||'Il viaggio', Viaggi.periodo(v),
      `${km.toLocaleString('it')} km, ${this.parole(DAYS.length)} giorni`, 'Tutto il viaggio');
    city.classList.add('fine','show');
    await this.attesa(4200);
    if(this.playing) this.chiudi();
  },

  /* ── avvio dell'intro ── */
  async start(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.finish(true); return; }
    this.playing=true;
    document.body.classList.add('cine');
    this.titolo();
    const t=this.$('introTitle');
    this.progresso(0,'Preparo la mappa…');
    void t.offsetWidth;                        /* così la dissolvenza parte da zero */
    t.classList.add('show');
    /* il titolo resta almeno il tempo di leggerlo, anche se la mappa
       è già pronta dalla cache */
    const leggibile=this.attesa(4200);

    /* aspetta che la mappa sia pronta (rotte calcolate) */
    await this.attesa(300);
    this.progresso(.15);
    await new Promise(r=>{ const k=()=>OrbitMap.ready?r():setTimeout(k,150); k(); });
    if(!this.playing) return;
    this.progresso(.45,'Calcolo il percorso…');

    const map=OrbitMap.map;
    map.resize();
    this.baseBefore=OrbitMap.baseIdx;
    OrbitMap.setBase(2);                       /* satellite: più cinematografico */
    this.nascondiPiano();
    this.build();
    this.progresso(.7,'Carico il satellite…');

    /* inquadra la partenza e aspetta le prime mattonelle */
    const p0=this.pointAt(0).p;
    map.jumpTo({center:p0,zoom:this.camZoom(LEGS[0]),pitch:42,bearing:0});
    await new Promise(res=>{
      let to=null;
      const done=()=>{ clearTimeout(to); map.off('idle',done); res(); };
      to=setTimeout(done,4000);
      map.on('idle',done);
    });
    if(!this.playing) return;
    this.progresso(1,'Si parte');
    await leggibile;
    await this.attesa(700);
    if(!this.playing) return;

    t.classList.remove('show');
    document.body.classList.add('bars');
    await this.attesa(700);
    if(!this.playing) return;
    this.playAll(2.2,()=>this.finale());
  },

  /* ── 4. dissolvenza: un velo copre il cambio di scena ── */
  async chiudi(){
    if(!this.playing) return;
    const velo=this.$('introVelo');
    velo.classList.add('on');
    await this.attesa(550);
    this.finish();
    setTimeout(()=>velo.classList.remove('on'),60);
  },

  /* ── chiusura: torna alla pagina normale ── */
  finish(subito){
    /* ESC arriva qui anche a intro finita (chiude pure i documenti):
       se l'intro non c'è, non c'è niente da rimettere a posto */
    if(!this.playing&&!document.body.classList.contains('cine')){
      if(subito) try{ sessionStorage.setItem('orbit_intro','1'); }catch(e){}
      return;
    }
    if(this.anim) cancelAnimationFrame(this.anim);
    if(this.holdT) clearTimeout(this.holdT);
    this.anim=null; this.holdT=null; this.playing=false;
    try{ sessionStorage.setItem('orbit_intro','1'); }catch(e){}
    document.body.classList.remove('cine','bars');
    this.$('introTitle')?.classList.remove('show');
    this.$('odo')?.classList.remove('show');
    this.$('cityCard')?.classList.remove('show','fine');
    if(OrbitMap.ready){
      if(this.veh){ this.veh.remove(); this.veh=null; }
      this.hideTrail();
      this.mostraPiano();
      OrbitMap.setBase(this.baseBefore||0);
      setTimeout(()=>{ OrbitMap.map.resize(); OrbitMap.showDay(Days.cur); },80);
    }
    if(!subito) scrollTo({top:0,behavior:'instant'});
  },

  /* da rigiocare a richiesta */
  replay(){
    if(!OrbitMap.ready) return;
    if(this.veh){ this.veh.remove(); this.veh=null; }
    this.STRATI.forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.removeLayer(id); });
    if(OrbitMap.map.getSource('trail')) OrbitMap.map.removeSource('trail');
    scrollTo({top:0,behavior:'instant'});
    this.start();
  },

  /* decide se mostrarla all'apertura */
  shouldPlay(){
    try{ return sessionStorage.getItem('orbit_intro')!=='1'; }catch(e){ return true; }
  },
};
