/* ═══════════════════════════════════════════════════════════
   SETTORE METEO — previsioni Open-Meteo (gratuito, senza
   chiave) per il punto di riferimento di ogni giornata.
   Cache di 1 ora in localStorage; se la rete manca o la data
   è troppo lontana restano le medie climatiche (clim).
   ═══════════════════════════════════════════════════════════ */
const Weather={
  async load(){
    try{
      const c=JSON.parse(localStorage.getItem('orbit_wx2')||'null');
      if(c&&Date.now()-c.t<36e5){ c.d.forEach((w,i)=>{ if(w) DAYS[i]._wx=w; }); return; }
    }catch(e){}
    await Promise.all(DAYS.map(async D=>{
      const p=P[D.wx];
      try{
        const u=`https://api.open-meteo.com/v1/forecast?latitude=${p[0]}&longitude=${p[1]}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum&timezone=auto&start_date=${D.d}&end_date=${D.d}`;
        const j=await (await fetch(u,{signal:AbortSignal.timeout(7000)})).json();
        if(j.daily?.temperature_2m_max?.[0]!=null)
          D._wx={min:j.daily.temperature_2m_min[0],max:j.daily.temperature_2m_max[0],
                 pp:j.daily.precipitation_probability_max?.[0],pr:j.daily.precipitation_sum?.[0],live:true};
      }catch(e){}
    }));
    try{ localStorage.setItem('orbit_wx2',JSON.stringify({t:Date.now(),d:DAYS.map(D=>D._wx||null)})); }catch(e){}
  },
  of(D){ return D._wx||{min:D.clim[0],max:D.clim[1],live:false}; }
};
