/* ═══════════════════════════════════════════════════════════
   SETTORE COORDINATE DELLE FOTO — dove è stata scattata.

   Ogni foto fatta col telefono porta dentro, oltre all'immagine,
   una scheda con la posizione: latitudine, longitudine, quota e
   l'ora dello scatto. Si chiama EXIF ed è lì da sempre.

   Va letta PRIMA di rimpicciolire la foto: js/media.js la ridisegna
   su una tela per farla più leggera, e la tela ridisegna solo i
   pixel. Tutto il resto — coordinate comprese — resta indietro.
   Questo settore legge la scheda dal file originale, un attimo
   prima, e si tiene i numeri.

   Legge i JPEG, che è quello che il telefono manda quando si
   sceglie una foto. Se il formato è un altro, o la posizione era
   spenta, non trova niente e non succede nulla: la foto si salva
   lo stesso, semplicemente senza il suo posto.
   ═══════════════════════════════════════════════════════════ */
const Exif={

  /* la scheda sta in testa al file: bastano i primi 256 KB */
  async posizione(file){
    try{
      if(!/jpe?g/i.test(file.type||'')&&!/\.jpe?g$/i.test(file.name||'')) return null;
      const v=new DataView(await file.slice(0,262144).arrayBuffer());
      if(v.getUint16(0)!==0xFFD8) return null;              /* non è un JPEG */
      let off=2;
      while(off+4<v.byteLength){
        if(v.getUint8(off)!==0xFF) return null;
        const marchio=v.getUint8(off+1);
        if(marchio===0xDA||marchio===0xD9) return null;     /* comincia l'immagine */
        const lung=v.getUint16(off+2);
        /* APP1 con la scritta "Exif": è la scheda che cerchiamo */
        if(marchio===0xE1&&off+10<v.byteLength&&v.getUint32(off+4)===0x45786966)
          return this.leggiTiff(v,off+10);
        off+=2+lung;
      }
      return null;
    }catch(e){ return null; }
  },

  /* La scheda è scritta nel formato TIFF: due byte dicono da che
     parte si leggono i numeri, poi un indice di voci. */
  leggiTiff(v,base){
    const le=v.getUint16(base)===0x4949;                    /* "II" = al contrario */
    const u16=o=>v.getUint16(o,le), u32=o=>v.getUint32(o,le);
    if(u16(base+2)!==42) return null;

    const voci=(inizio)=>{
      const n=u16(inizio), out={};
      for(let i=0;i<n;i++){
        const e=inizio+2+i*12;
        out[u16(e)]={tipo:u16(e+2),quante:u32(e+4),dove:e+8};
      }
      return out;
    };
    /* i valori lunghi non stanno nella voce: lì c'è dove trovarli */
    const dati=(c)=>{
      const pesi={1:1,2:1,3:2,4:4,5:8,7:1,9:4,10:8};
      const tot=(pesi[c.tipo]||1)*c.quante;
      return tot>4?base+u32(c.dove):c.dove;
    };
    const frazione=o=>{ const d=u32(o+4); return d?u32(o)/d:0; };
    const testo=(c)=>{ let s=''; const o=dati(c);
      for(let i=0;i<c.quante;i++){ const b=v.getUint8(o+i); if(!b) break; s+=String.fromCharCode(b); }
      return s; };

    const primo=voci(base+u32(base+4));
    if(!primo[0x8825]) return null;                         /* niente posizione */
    const g=voci(base+u32(primo[0x8825].dove));

    /* gradi, primi e secondi → un numero solo */
    const gradi=(c)=>{ if(!c||c.quante<3) return null; const o=dati(c);
      return frazione(o)+frazione(o+8)/60+frazione(o+16)/3600; };

    let lat=gradi(g[2]), lon=gradi(g[4]);
    if(lat==null||lon==null) return null;
    if(/S/i.test(testo(g[1]||{quante:0,dove:0,tipo:2}))) lat=-lat;
    if(/W/i.test(testo(g[3]||{quante:0,dove:0,tipo:2}))) lon=-lon;
    if(!isFinite(lat)||!isFinite(lon)||(lat===0&&lon===0)) return null;
    if(Math.abs(lat)>90||Math.abs(lon)>180) return null;

    const pos={lat:+lat.toFixed(6),lon:+lon.toFixed(6)};

    /* la quota, se c'è: sotto il livello del mare è marcata a parte */
    if(g[6]){
      let q=frazione(dati(g[6]));
      if(g[5]&&v.getUint8(dati(g[5]))===1) q=-q;
      if(isFinite(q)&&Math.abs(q)<10000) pos.alt=Math.round(q);
    }
    return pos;
  },
};

/* anche per tools/ e per i test fuori dal browser */
if(typeof module!=='undefined') module.exports=Exif;
