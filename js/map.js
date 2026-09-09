/* ═══════════════════════════════════════════════════════════
   SETTORE MAPPA — MapLibre GL (gratuito, senza chiavi).
   Basi: strade CARTO Voyager (default) e satellite Esri.
   Disegna le 23 tratte colorate per mezzo, le fermate e i
   punti di interesse della giornata selezionata.
   Le strade vere arrivano da OSRM (demo, con cache locale);
   se la rete manca si usa una curva sui punti intermedi.
   ═══════════════════════════════════════════════════════════ */
const OrbitMap={
  map:null, ready:false, popup:null, me:null, meMarker:null,

  /* le tre basi, nell'ordine in cui gira il bottone */
  bases:[{id:'streets',lbl:'Strade'},{id:'topo',lbl:'Topografica'},{id:'sat',lbl:'Satellite'}],
  baseIdx:0,
  setBase(i){
    this.baseIdx=((i%this.bases.length)+this.bases.length)%this.bases.length;
    this.bases.forEach((b,k)=>this.map.setLayoutProperty(b.id,'visibility',k===this.baseIdx?'visible':'none'));
    /* il bottone mostra la base successiva, cioè cosa ottieni premendolo */
    document.getElementById('baseTgl').textContent=this.bases[(this.baseIdx+1)%this.bases.length].lbl;
  },

  /* ── geometria ── */
  gc(a,b,n=120){ /* rotta aerea: cerchio massimo */
    const R=180/Math.PI,D=Math.PI/180;
    const la1=a[0]*D,lo1=a[1]*D,la2=b[0]*D,lo2=b[1]*D;
    const d=2*Math.asin(Math.sqrt(Math.sin((la2-la1)/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin((lo2-lo1)/2)**2));
    const out=[];
    for(let i=0;i<=n;i++){
      const f=i/n,A=Math.sin((1-f)*d)/Math.sin(d),B=Math.sin(f*d)/Math.sin(d);
      const x=A*Math.cos(la1)*Math.cos(lo1)+B*Math.cos(la2)*Math.cos(lo2),
            y=A*Math.cos(la1)*Math.sin(lo1)+B*Math.cos(la2)*Math.sin(lo2),
            z=A*Math.sin(la1)+B*Math.sin(la2);
      out.push([Math.atan2(z,Math.sqrt(x*x+y*y))*R,Math.atan2(y,x)*R]);
    }
    return out;
  },
  smooth(pts,k=10){ /* curva morbida sui punti intermedi (Catmull-Rom) */
    if(pts.length<3) return pts; const o=[];
    for(let i=0;i<pts.length-1;i++){
      const p0=pts[i-1]||pts[i],p1=pts[i],p2=pts[i+1],p3=pts[i+2]||p2;
      for(let j=0;j<k;j++){const t=j/k,t2=t*t,t3=t2*t;
        o.push([.5*((2*p1[0])+(-p0[0]+p2[0])*t+(2*p0[0]-5*p1[0]+4*p2[0]-p3[0])*t2+(-p0[0]+3*p1[0]-3*p2[0]+p3[0])*t3),
                .5*((2*p1[1])+(-p0[1]+p2[1])*t+(2*p0[1]-5*p1[1]+4*p2[1]-p3[1])*t2+(-p0[1]+3*p1[1]-3*p2[1]+p3[1])*t3)]);}
    }
    o.push(pts[pts.length-1]); return o;
  },
  async osrm(w){ /* strade vere fra i punti intermedi (max 1 richiesta per tratta) */
    const coords=w.map(p=>`${p[1]},${p[0]}`).join(';');
    const u=`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
    const j=await (await fetch(u,{signal:AbortSignal.timeout(8000)})).json();
    if(!j.routes?.[0]) throw 0;
    return j.routes[0].geometry.coordinates.map(c=>[c[1],c[0]]);
  },
  async geometry(Lg){
    const A=P[Lg.a].slice(0,2),B=P[Lg.b].slice(0,2),key=Lg.a+'-'+Lg.b+'-'+Lg.m;
    if(Lg.m==='air') return this.gc(A,B);
    let cache={}; try{ cache=JSON.parse(localStorage.getItem('orbit_geo')||'{}'); }catch(e){}
    if(cache[key]) return cache[key];
    const w=WAYPTS[Lg.a+'-'+Lg.b]||[A,B];
    if(Lg.m==='road'){
      try{
        const out=(await this.osrm(w)).map(p=>[+p[0].toFixed(5),+p[1].toFixed(5)]);
        cache[key]=out; try{ localStorage.setItem('orbit_geo',JSON.stringify(cache)); }catch(e){}
        return out;
      }catch(e){}
    }
    return this.smooth(w); /* treno, piedi, cavallo e fallback: curva sui punti */
  },

  /* ── avvio ── */
  async init(){
    if(!window.maplibregl){
      document.getElementById('map').innerHTML='<div style="padding:36px;color:#a1a1a6;font-size:15px;max-width:52ch;line-height:1.6">La mappa richiede la connessione a internet la prima volta. Riapri la pagina quando sei online.</div>';
      return;
    }
    /* Basi libere e senza chiave API:
       strade  = OpenStreetMap standard
       topo    = OpenTopoMap (curve di livello e sentieri: utile per Ala Kul)
       sat     = Esri World Imagery */
    const style={version:8,sources:{
      streets:{type:'raster',tiles:['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:19,attribution:'© OpenStreetMap'},
      topo:{type:'raster',tiles:['https://a.tile.opentopomap.org/{z}/{x}/{y}.png','https://b.tile.opentopomap.org/{z}/{x}/{y}.png','https://c.tile.opentopomap.org/{z}/{x}/{y}.png'],tileSize:256,maxzoom:17,attribution:'© OpenTopoMap (CC-BY-SA), © OpenStreetMap'},
      sat:{type:'raster',tiles:['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],tileSize:256,maxzoom:17,attribution:'Esri, Maxar'}
    },layers:[
      /* blu profondo: le mattonelle non ancora arrivate si confondono
         con il mare invece di lampeggiare bianche durante l'intro */
      {id:'bg',type:'background',paint:{'background-color':'#0b1a2b'}},
      {id:'streets',type:'raster',source:'streets',paint:{'raster-fade-duration':0}},
      {id:'topo',type:'raster',source:'topo',layout:{visibility:'none'},paint:{'raster-fade-duration':0}},
      {id:'sat',type:'raster',source:'sat',layout:{visibility:'none'},paint:{'raster-fade-duration':0}}
    ]};
    const touch=matchMedia('(pointer:coarse)').matches;
    this.map=new maplibregl.Map({container:'map',style,center:[72,42.3],zoom:4.6,attributionControl:{compact:true},cooperativeGestures:touch,
      locale:{'CooperativeGesturesHandler.MobileHelpText':'Usa due dita per muovere la mappa','CooperativeGesturesHandler.MacHelpText':'⌘ + rotella per lo zoom','CooperativeGesturesHandler.WindowsHelpText':'Ctrl + rotella per lo zoom'}});
    this.map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right');
    await new Promise(r=>this.map.on('load',r));

    /* tratte: calcola le geometrie (in parallelo, max 3 alla volta) */
    const q=[...LEGS.keys()];
    const worker=async()=>{ while(q.length){ const i=q.shift(); LEGS[i]._pts=await this.geometry(LEGS[i]); } };
    await Promise.all([worker(),worker(),worker()]);

    this.map.addSource('legs',{type:'geojson',data:{type:'FeatureCollection',
      features:LEGS.map((Lg,i)=>({type:'Feature',properties:{i,day:Lg.day,c:MODE_HEX[Lg.m],dash:['air','foot','horse'].includes(Lg.m)?1:0},
        geometry:{type:'LineString',coordinates:Lg._pts.map(p=>[p[1],p[0]])}}))}});
    this.map.addLayer({id:'legsCase',type:'line',source:'legs',layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':'#ffffff','line-width':5,'line-opacity':.55}});
    this.map.addLayer({id:'legsSolid',type:'line',source:'legs',filter:['==',['get','dash'],0],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':3}});
    this.map.addLayer({id:'legsDash',type:'line',source:'legs',filter:['==',['get','dash'],1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':3,'line-dasharray':[1.4,2.2]}});
    this.map.addLayer({id:'legsHi',type:'line',source:'legs',filter:['==',['get','day'],-1],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['get','c'],'line-width':6,'line-opacity':1}});

    /* fermate */
    this.map.addSource('stops',{type:'geojson',data:{type:'FeatureCollection',
      features:Object.entries(P).map(([k,[la,lo,n]])=>({type:'Feature',properties:{k,n},geometry:{type:'Point',coordinates:[lo,la]}}))}});
    this.map.addLayer({id:'stops',type:'circle',source:'stops',paint:{'circle-radius':5,'circle-color':'#ffffff','circle-stroke-color':'#1d1d1f','circle-stroke-width':2}});
    this.map.on('click','stops',e=>{
      new maplibregl.Popup({offset:10}).setLngLat(e.lngLat)
        .setHTML(`<div class="pop"><h4>${e.features[0].properties.n}</h4></div>`).addTo(this.map);
    });

    /* punti di interesse della giornata */
    this.map.addSource('poi',{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    this.map.addLayer({id:'poiHalo',type:'circle',source:'poi',paint:{'circle-radius':13,'circle-color':['case',['==',['get','src'],'pdf'],'#0a84ff','#ff9f0a'],'circle-opacity':.22}});
    this.map.addLayer({id:'poi',type:'circle',source:'poi',paint:{'circle-radius':6.5,'circle-color':['case',['==',['get','src'],'pdf'],'#0a84ff','#ff9f0a'],'circle-stroke-color':'#ffffff','circle-stroke-width':2}});
    this.map.on('click','poi',e=>this.openPoi(e.features[0].properties,e.lngLat));
    ['poi','stops'].forEach(l=>{
      this.map.on('mouseenter',l,()=>this.map.getCanvas().style.cursor='pointer');
      this.map.on('mouseleave',l,()=>this.map.getCanvas().style.cursor='');
    });

    /* comandi: il bottone gira fra le tre basi */
    document.getElementById('baseTgl').onclick=()=>this.setBase(this.baseIdx+1);
    document.getElementById('locBtn').onclick=()=>this.locate(true);

    this.setBase(0);
    this.ready=true;
    this.showDay(Days.cur);
  },

  /* mostra tratte e punti della giornata i; se poi è dato, apre il suo popup */
  showDay(i,poi){
    if(!this.ready) return;
    const D=DAYS[i], set=POIS[D.d];
    this.map.setFilter('legsHi',['==',['get','day'],i]);
    this.map.getSource('poi').setData({type:'FeatureCollection',
      features:set?set.items.map(p=>({type:'Feature',properties:p,geometry:{type:'Point',coordinates:[p.lo,p.la]}})):[]});
    if(this.popup) this.popup.remove();
    if(poi){
      this.map.flyTo({center:[poi.lo,poi.la],zoom:Math.max(this.map.getZoom(),14.5),duration:1100});
      this.openPoi(poi);
      return;
    }
    /* inquadra: le tratte del giorno, oppure i POI, oppure il punto della giornata */
    const legs=LEGS.filter(l=>l.day===i&&l._pts);
    let pts=legs.flatMap(l=>l._pts);
    if(!pts.length&&set) pts=set.items.map(p=>[p.la,p.lo]);
    if(!pts.length){ const p=P[D.wx]; pts=[[p[0],p[1]]]; }
    if(pts.length===1){ this.map.flyTo({center:[pts[0][1],pts[0][0]],zoom:12,duration:1300}); return; }
    const b=pts.reduce((bb,p)=>bb.extend([p[1],p[0]]),new maplibregl.LngLatBounds([pts[0][1],pts[0][0]],[pts[0][1],pts[0][0]]));
    this.map.fitBounds(b,{padding:{top:50,bottom:50,left:50,right:50},maxZoom:12.5,duration:1300});
  },

  openPoi(p,lngLat){
    if(this.popup) this.popup.remove();
    const city=(POIS[DAYS[Days.cur].d]||{}).city||'';
    const q=encodeURIComponent(p.n+', '+city);
    const kg=/Bishkek|Kochkor|Song|Bökönbaev|Karakol|Jeti|Ala Kul|Altyn|Valle/.test(city);
    const dist=this.me?`<div class="dist">${this.distTxt(p)}</div>`:'';
    this.popup=new maplibregl.Popup({offset:14,maxWidth:'300px'}).setLngLat(lngLat||[p.lo,p.la]).setHTML(
      `<div class="pop"><span class="tag ${p.src}">${p.src==='pdf'?'dal vostro programma':'consiglio'}</span>
       <h4>${p.n}</h4>${dist}<p>${p.desc||''}</p>${p.note?`<p class="note">${p.note}</p>`:''}
       <div class="links">
         <a href="https://www.google.com/maps/search/?api=1&query=${q}" target="_blank" rel="noopener">Google Maps</a>
         <a href="https://yandex.com/maps/?text=${q}" target="_blank" rel="noopener">Yandex</a>
         <a href="https://2gis.${kg?'kg':'uz'}/search/${q}" target="_blank" rel="noopener">2GIS</a>
         <a href="https://www.google.com/maps/dir/?api=1&destination=${p.la},${p.lo}&travelmode=walking" target="_blank" rel="noopener">A piedi</a>
       </div></div>`).addTo(this.map);
    this.locate(); /* aggiorna la posizione in background per le distanze */
  },

  locate(fly){
    if(!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(g=>{
      this.me=[g.coords.latitude,g.coords.longitude];
      if(!this.meMarker){
        const d=document.createElement('div');
        d.style.cssText='width:16px;height:16px;border-radius:50%;background:#0a84ff;border:3px solid #fff;box-shadow:0 0 0 6px rgba(10,132,255,.25)';
        this.meMarker=new maplibregl.Marker({element:d}).setLngLat([this.me[1],this.me[0]]).addTo(this.map);
      } else this.meMarker.setLngLat([this.me[1],this.me[0]]);
      if(fly) this.map.flyTo({center:[this.me[1],this.me[0]],zoom:13,duration:1200});
    },()=>{},{enableHighAccuracy:true,timeout:8000,maximumAge:60000});
  },
  distTxt(p){
    const km=hav(this.me,[p.la,p.lo]), walk=Math.round(km/4.5*60);
    return km<1?`${Math.round(km*1000)} m da te · ${Math.max(1,walk)} min a piedi`
         :km<12?`${km.toFixed(1)} km da te · ${walk<90?walk+' min a piedi':Math.round(km/40*60)+' min in taxi'}`
         :`${Math.round(km)} km da te`;
  },
};
