/* ═══════════════════════════════════════════════════════════
   SETTORE INTRO CINEMATOGRAFICA
   Mappa a tutto schermo, titolo con barra di caricamento, poi
   la corsa lungo tutto il viaggio: la scia si accende, il mezzo
   la percorre, il contachilometri sale e i cartelli annunciano
   le città. Si salta con il bottone o con ESC.

   Tecnica ripresa dalla versione originale: una sola linea per
   tutta la scia, rivelata con line-gradient su line-progress —
   nessun aggiornamento di geometria a ogni fotogramma.
   ═══════════════════════════════════════════════════════════ */
const Cinematic={
  playing:false, anim:null, veh:null, baseBefore:0,

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
    map.addLayer({id:'trailGlow',type:'line',source:'trail',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#fff','line-width':13,'line-opacity':.28,'line-blur':6}});
    map.addLayer({id:'trail',type:'line',source:'trail',
      layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#fff','line-width':4.5}});
    this.reveal(0,0);

    const d=document.createElement('div'); d.className='veh';
    this.veh=new maplibregl.Marker({element:d,anchor:'center',pitchAlignment:'viewport',rotationAlignment:'viewport'})
      .setLngLat(this.FULL[0]).addTo(map);
    this.vehMode=null;
    this.setVeh(LEGS[0].m,0);
  },

  /* accende la scia da p0 a p1 (frazioni del percorso totale) */
  reveal(p0,p1){
    const a=Math.max(0,Math.min(1,p0)), b=Math.max(a+1e-5,Math.min(1,p1));
    const g=a>0?['step',['line-progress'],'rgba(0,0,0,0)',a,'#ffffff',b,'rgba(0,0,0,0)']
               :['step',['line-progress'],'#ffffff',b,'rgba(0,0,0,0)'];
    ['trail','trailGlow'].forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.setPaintProperty(id,'line-gradient',g); });
  },
  hideTrail(){ ['trail','trailGlow'].forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.setLayoutProperty(id,'visibility','none'); }); },
  showTrail(){ ['trail','trailGlow'].forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.setLayoutProperty(id,'visibility','visible'); }); },

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

  /* ── percorre una tratta ── */
  runLeg(i,then,speed){
    const Lg=LEGS[i], map=OrbitMap.map;
    const dur=Math.min(9000,Math.max(2600,Lg._len*{air:2.0,rail:40,road:48,foot:360,horse:440}[Lg.m]))/speed;
    const tz=this.camZoom(Lg);
    const odo=document.getElementById('odo'), city=document.getElementById('cityCard');
    odo.classList.add('show');
    document.getElementById('odoMode').innerHTML=ICONS[Lg.m];
    document.getElementById('odoMode').style.color=MODE_HEX[Lg.m];
    document.getElementById('odoLbl').textContent=MODE_IT[Lg.m];
    document.getElementById('cityName').textContent=P[Lg.a][2];
    document.getElementById('citySub').textContent=Lg.t+' · '+Lg.s.split(',')[0];
    city.classList.add('show');

    const ease=f=>f<.5?2*f*f:1-Math.pow(-2*f+2,2)/2;
    let t0=null;
    const step=ts=>{
      if(!this.playing) return;
      if(!t0) t0=ts;
      const f=Math.min(1,(ts-t0)/dur), e=ease(f);
      if(f>0.08) city.classList.remove('show');
      const frac=Lg._p0+(Lg._p1-Lg._p0)*e;
      const {p,h}=this.pointAt(frac);
      this.veh.setLngLat(p);
      this.setVeh(Lg.m,h);
      const c=map.getCenter(), z=map.getZoom();
      map.jumpTo({center:[c.lng+(p[0]-c.lng)*.22, c.lat+(p[1]-c.lat)*.22],
                  zoom:z+(tz-z)*.05, pitch:42, bearing:0});
      this.reveal(0,frac);
      document.getElementById('odoKm').textContent=Math.round(this.totKm(i,e)).toLocaleString('it');
      if(f<1){ this.anim=requestAnimationFrame(step); return; }
      document.getElementById('cityName').textContent=P[Lg.b][2];
      document.getElementById('citySub').textContent=Lg.stay?('Dormite: '+Lg.stay):DAYS[Lg.day].title;
      city.classList.add('show');
      this.anim=null;
      setTimeout(()=>{ if(this.playing&&then) then(); }, 520/speed);
    };
    this.anim=requestAnimationFrame(step);
  },
  /* chilometri percorsi dall'inizio fino alla tratta i, frazione e */
  totKm(i,e){
    let km=0; for(let k=0;k<i;k++) km+=LEGS[k]._len;
    return km+LEGS[i]._len*e;
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

  /* ── avvio dell'intro ── */
  async start(){
    if(matchMedia('(prefers-reduced-motion:reduce)').matches){ this.finish(true); return; }
    this.playing=true;
    document.body.classList.add('cine');
    const t=document.getElementById('introTitle'), bar=document.getElementById('introBar'), lbl=document.getElementById('introLbl');
    t.classList.add('show');
    const setP=(p,txt)=>{ bar.style.setProperty('--p',Math.round(p)+'%'); if(txt) lbl.textContent=txt; };

    setP(8,'Preparo la mappa…');
    /* aspetta che la mappa sia pronta (rotte calcolate) */
    await new Promise(r=>{ const k=()=>OrbitMap.ready?r():setTimeout(k,150); k(); });
    if(!this.playing) return;
    setP(45,'Calcolo il percorso…');

    const map=OrbitMap.map;
    map.resize();
    this.baseBefore=OrbitMap.baseIdx;
    OrbitMap.setBase(2);                       /* satellite: più cinematografico */
    this.build();
    map.setLayoutProperty('stops','visibility','none');
    setP(70,'Carico il satellite…');

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
    setP(100,'Si parte');
    await new Promise(r=>setTimeout(r,600));
    if(!this.playing) return;

    t.classList.remove('show');
    await new Promise(r=>setTimeout(r,700));
    if(!this.playing) return;
    document.body.classList.add('bars');
    this.playAll(2.2,()=>this.finish());
  },

  /* ── chiusura: torna alla pagina normale ── */
  finish(subito){
    if(this.anim) cancelAnimationFrame(this.anim);
    this.anim=null; this.playing=false;
    try{ sessionStorage.setItem('orbit_intro','1'); }catch(e){}
    document.body.classList.remove('cine','bars');
    document.getElementById('introTitle')?.classList.remove('show');
    document.getElementById('odo')?.classList.remove('show');
    document.getElementById('cityCard')?.classList.remove('show');
    if(OrbitMap.ready){
      if(this.veh){ this.veh.remove(); this.veh=null; }
      this.hideTrail();
      OrbitMap.map.setLayoutProperty('stops','visibility','visible');
      OrbitMap.setBase(this.baseBefore||0);
      setTimeout(()=>{ OrbitMap.map.resize(); OrbitMap.showDay(Days.cur); },80);
    }
    if(!subito) scrollTo({top:0,behavior:'instant'});
  },

  /* da rigiocare a richiesta */
  replay(){
    if(!OrbitMap.ready) return;
    if(this.veh){ this.veh.remove(); this.veh=null; }
    ['trail','trailGlow'].forEach(id=>{ if(OrbitMap.map.getLayer(id)) OrbitMap.map.removeLayer(id); });
    if(OrbitMap.map.getSource('trail')) OrbitMap.map.removeSource('trail');
    scrollTo({top:0,behavior:'instant'});
    this.start();
  },

  /* decide se mostrarla all'apertura */
  shouldPlay(){
    try{ return sessionStorage.getItem('orbit_intro')!=='1'; }catch(e){ return true; }
  },
};
