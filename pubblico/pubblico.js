/* ═══════════════════════════════════════════════════════════
   PAGINA PUBBLICA — la logica della pagina per i cari.
   Legge soltanto dati.js, che è già ripulito da codici,
   strutture, indirizzi e spese.
   ═══════════════════════════════════════════════════════════ */

const ICONE={
 air:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
 road:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11c1.1 0 2 .9 2 2v4h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-4c0-1.1.9-2 2-2zm2.1 0h9.8l-1-3H8.1z"/></svg>',
 rail:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 4 2.5 4 6v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5V21h12v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12z"/></svg>',
 foot:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.4 5.4 0 0 1-4.5-2.5l-1-1.6A2 2 0 0 0 11.8 6c-.3 0-.6.1-.8.2L6 8.3V13h2V9.6z"/></svg>',
 horse:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4 17 7h-2.5L12 3 9 6.5 6.5 5 3 8.5l1 4.5 2 1v7h2v-6l2 1v5h2v-5.5l3.5-1.5L17 21h2l-1-7.5L21 9V4z"/></svg>',
};
const NOMI={air:'aereo',road:'strada',rail:'treno',foot:'a piedi',horse:'a cavallo'};
const COL={air:'#0a84ff',road:'#ff9f0a',rail:'#ff453a',foot:'#30d158',horse:'#bf5af2'};
const VAR={air:'var(--air)',road:'var(--road)',rail:'var(--rail)',foot:'var(--foot)',horse:'var(--horse)'};
const ic=m=>`<span class="mico" style="color:${VAR[m]}">${ICONE[m]}</span>`;

/* quale giornata è oggi (o la più vicina se il viaggio non è iniziato/è finito) */
const oggiISO=new Date().toISOString().slice(0,10);
let idx=DAYS.findIndex(D=>D.d===oggiISO);
const prima=oggiISO<DAYS[0].d, dopo=oggiISO>DAYS[DAYS.length-1].d;
if(idx<0) idx=prima?0:DAYS.length-1;

/* ── dove siamo adesso ── */
(function(){
  const D=DAYS[idx], el=document.getElementById('oggiCard');
  const luogo=P[D.wx]?P[D.wx][2]:'';
  let quando='Oggi · '+D.lbl, testo=D.lead;
  if(prima){
    const gg=Math.ceil((new Date(DAYS[0].d)-new Date(oggiISO))/864e5);
    quando=gg===1?'Si parte domani':`Mancano ${gg} giorni`;
  } else if(dopo){
    quando='Viaggio concluso';
    testo='Quindici giorni, cinque mezzi, dodicimila chilometri. Qui sotto resta tutto il racconto.';
  }
  const legs=LEGS.filter(l=>l.day===idx);
  el.innerHTML=`
    <div class="quando">${quando}</div>
    <h2>${D.title}</h2>
    <p class="lead">${testo}</p>
    ${!prima&&!dopo?`<div class="dove"><span class="pt"></span>${luogo}</div>`:''}
    ${legs.length&&!dopo?`<div class="mezzi" style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">${
      legs.map(l=>`<span class="badge">${ic(l.m)} ${l.t}</span>`).join('')}</div>`:''}`;

  /* avanzamento */
  const fatto=prima?0:dopo?DAYS.length:idx+1;
  document.getElementById('avanz').innerHTML=`
    <div class="barra"><i style="width:${Math.round(100*fatto/DAYS.length)}%"></i></div>
    <div class="testo"><span>${prima?'Non ancora partiti':`Giorno ${fatto} di ${DAYS.length}`}</span>
      <span>${DAYS[0].lbl} → ${DAYS[DAYS.length-1].lbl}</span></div>`;
})();

/* ── linea del tempo, con quello che hanno pubblicato ── */
(async function(){
  /* il diario: foto e note mandate dal viaggio. Se non c'è ancora
     niente il file non esiste, e la pagina resta com'è. */
  let diario={};
  try{
    const r=await fetch('diario/index.json',{cache:'no-cache'});
    if(r.ok) diario=await r.json();
  }catch(e){}

  const esc=s=>String(s||'').replace(/[<>&]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]));
  const mediaHtml=f=>f.tipo==='video'
    ? `<video src="diario/${f.f}" controls playsinline preload="metadata"></video>`
    : `<a href="diario/${f.f}" target="_blank" rel="noopener"><img src="diario/${f.f}" alt="${esc(f.cap)}" loading="lazy"></a>`;

  document.getElementById('timeline').innerHTML=DAYS.map((D,i)=>{
    const stato=D.d<oggiISO?'passato':(i===idx&&!prima&&!dopo?'oggi':'');
    const legs=LEGS.filter(l=>l.day===i);
    const pub=diario[D.d];
    return `<div class="gg ${stato}${pub?' conRacconto':''}">
      <div class="card">
        <div class="data">${D.lbl}${stato==='oggi'?' · oggi':''}</div>
        <h3>${D.title}</h3>
        <p class="lead">${D.lead}</p>
        ${legs.length?`<div class="mezzi">${legs.map(l=>
          `<span class="badge">${ic(l.m)} ${l.t}</span>`).join('')}</div>`:''}
        ${pub&&pub.nota?`<blockquote class="nota">${esc(pub.nota)}</blockquote>`:''}
        ${pub&&pub.foto&&pub.foto.length?`<div class="scatti">${pub.foto.map(f=>
          `<figure>${mediaHtml(f)}${f.cap?`<figcaption>${esc(f.cap)}</figcaption>`:''}</figure>`).join('')}</div>`:''}
        ${D.see&&D.see.length?`<details><summary>Cosa vediamo</summary>
          <ul class="see">${D.see.map(x=>`<li>${x}</li>`).join('')}</ul></details>`:''}
      </div></div>`;
  }).join('');

  /* gli ultimi scatti, in cima alla pagina */
  const ultimi=Object.entries(diario)
    .sort((a,b)=>String(b[0]).localeCompare(String(a[0])))
    .flatMap(([d,v])=>(v.foto||[]).map(f=>({...f,d})))
    .slice(0,6);
  if(ultimi.length){
    const s=document.getElementById('ultimi');
    s.hidden=false;
    s.querySelector('.scatti').innerHTML=ultimi.map(f=>
      `<figure>${mediaHtml(f)}<figcaption>${esc(f.cap||'')}</figcaption></figure>`).join('');
  }
})();

/* ── mappa ── */
(function(){
  if(!window.maplibregl) return;
  const style={version:8,sources:{
    streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap'},
    sat:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Esri, Maxar'}
  },layers:[
    {id:'bg',type:'background',paint:{'background-color':'#0b1a2b'}},
    {id:'streets',type:'raster',source:'streets',paint:{'raster-fade-duration':0}},
    {id:'sat',type:'raster',source:'sat',layout:{visibility:'none'},paint:{'raster-fade-duration':0}}
  ]};
  const touch=matchMedia('(pointer:coarse)').matches;
  const map=new maplibregl.Map({container:'map',style,center:[62,42],zoom:3.4,
    attributionControl:{compact:true},cooperativeGestures:touch,
    locale:{'CooperativeGesturesHandler.MobileHelpText':'Usa due dita per muovere la mappa',
            'CooperativeGesturesHandler.MacHelpText':'⌘ + rotella per lo zoom',
            'CooperativeGesturesHandler.WindowsHelpText':'Ctrl + rotella per lo zoom'}});
  map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');

  /* geometria semplice: arco per i voli, curva morbida per il resto */
  const R=180/Math.PI, Dg=Math.PI/180;
  const arco=(a,b,n=100)=>{
    const la1=a[0]*Dg,lo1=a[1]*Dg,la2=b[0]*Dg,lo2=b[1]*Dg;
    const d=2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
    const o=[];
    for(let i=0;i<=n;i++){const f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
      const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2),
            y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2),
            z=A*Math.sin(la1)+B*Math.sin(la2);
      o.push([Math.atan2(y,x)*R,Math.atan2(z,Math.sqrt(x*x+y*y))*R]);}
    return o;
  };
  const morbida=(pts,k=10)=>{
    if(pts.length<3) return pts.map(p=>[p[1],p[0]]);
    const o=[];
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      for(let j=0;j<k;j++){const t=j/k,t2=t*t,t3=t2*t;
        o.push([.5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3),
                .5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3)]);}
    }
    const u=pts[pts.length-1]; o.push([u[1],u[0]]); return o;
  };

  map.on('load',()=>{
    const feats=LEGS.map((L,i)=>{
      const A=P[L.a].slice(0,2), B=P[L.b].slice(0,2);
      const w=WAYPTS[L.a+'-'+L.b];
      const coords=L.m==='air'?arco(A,B):(w?morbida(w):[[A[1],A[0]],[B[1],B[0]]]);
      return {type:'Feature',properties:{c:COL[L.m],dash:['air','foot','horse'].includes(L.m)?1:0,day:L.day},
              geometry:{type:'LineString',coordinates:coords}};
    });
    map.addSource('legs',{type:'geojson',data:{type:'FeatureCollection',features:feats}});
    map.addLayer({id:'case',type:'line',source:'legs',layout:{'line-cap':'round','line-join':'round'},
      paint:{'line-color':'#fff','line-width':5,'line-opacity':.5}});
    map.addLayer({id:'solid',type:'line',source:'legs',filter:['==',['get','dash'],0],
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':3}});
    map.addLayer({id:'dash',type:'line',source:'legs',filter:['==',['get','dash'],1],
      layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':3,'line-dasharray':[1.4,2.2]}});

    /* fermate */
    map.addSource('stops',{type:'geojson',data:{type:'FeatureCollection',
      features:Object.entries(P).map(([k,[la,lo,n]])=>({type:'Feature',properties:{n},geometry:{type:'Point',coordinates:[lo,la]}}))}});
    map.addLayer({id:'stops',type:'circle',source:'stops',
      paint:{'circle-radius':4.5,'circle-color':'#fff','circle-stroke-color':'#1d1d1f','circle-stroke-width':2}});
    map.on('click','stops',e=>new maplibregl.Popup({offset:10}).setLngLat(e.lngLat)
      .setHTML(`<div class="pop"><h4>${e.features[0].properties.n}</h4></div>`).addTo(map));
    map.on('mouseenter','stops',()=>map.getCanvas().style.cursor='pointer');
    map.on('mouseleave','stops',()=>map.getCanvas().style.cursor='');

    /* dove siamo oggi: puntino d'oro */
    if(!prima&&!dopo&&P[DAYS[idx].wx]){
      const [la,lo]=P[DAYS[idx].wx];
      const d=document.createElement('div');
      d.style.cssText='width:18px;height:18px;border-radius:50%;background:#c9a96e;border:3px solid #fff;box-shadow:0 0 0 7px rgba(201,169,110,.28)';
      new maplibregl.Marker({element:d}).setLngLat([lo,la]).addTo(map);
    }

    /* inquadra tutto il percorso */
    const tutti=feats.flatMap(f=>f.geometry.coordinates);
    const b=tutti.reduce((bb,c)=>bb.extend(c),new maplibregl.LngLatBounds(tutti[0],tutti[0]));
    map.fitBounds(b,{padding:40,duration:0});
  });

  document.getElementById('baseTgl').onclick=function(){
    const sat=map.getLayoutProperty('sat','visibility')!=='none';
    map.setLayoutProperty('sat','visibility',sat?'none':'visible');
    map.setLayoutProperty('streets','visibility',sat?'visible':'none');
    this.textContent=sat?'Satellite':'Strade';
  };
})();
