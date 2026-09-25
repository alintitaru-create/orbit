/* ═══════════════════════════════════════════════════════════
   SETTORE GPX — il formato con cui tutti si parlano.

   GPX è il modo in cui le tracce escono da Komoot, Strava, Organic
   Maps, AllTrails, Wikiloc, dagli orologi. È un file di testo: si
   legge e si scrive senza librerie e senza chiedere permesso a
   nessuno.

   Serve in tutte e due i versi, e il secondo conta quanto il primo:
   una traccia registrata qui dentro deve poter uscire. Se un giorno
   Orbit non ci fosse più, i percorsi restano file normali che si
   aprono ovunque.
   ═══════════════════════════════════════════════════════════ */
const Gpx={

  /* ── leggere ──
     Di un GPX si prende quello che serve: i punti, con quota e ora
     quando ci sono, e il nome della traccia. Tutto il resto — stili,
     estensioni dei vari produttori — si lascia dov'è. */
  leggi(testo){
    const doc=new DOMParser().parseFromString(testo,'application/xml');
    if(doc.querySelector('parsererror')) throw new Error('il file non si legge: non sembra un GPX');

    const punti=[];
    /* trkpt sono i punti registrati; rtept quelli di un percorso
       pianificato. Vanno bene entrambi, i primi se ci sono. */
    let nodi=doc.getElementsByTagName('trkpt');
    if(!nodi.length) nodi=doc.getElementsByTagName('rtept');
    if(!nodi.length) throw new Error('nel file non ci sono punti');

    for(const n of nodi){
      const la=parseFloat(n.getAttribute('lat')), lo=parseFloat(n.getAttribute('lon'));
      if(!isFinite(la)||!isFinite(lo)) continue;
      const p=[+la.toFixed(6),+lo.toFixed(6)];
      const ele=n.getElementsByTagName('ele')[0];
      const ora=n.getElementsByTagName('time')[0];
      const q=ele?parseFloat(ele.textContent):NaN;
      const t=ora?Date.parse(ora.textContent):NaN;
      p.push(isFinite(q)?Math.round(q):null);
      p.push(isFinite(t)?t:null);
      punti.push(p);
    }
    if(punti.length<2) throw new Error('nel file c\'è un punto solo');

    const nome=(doc.querySelector('trk > name, rte > name, metadata > name')||{}).textContent;
    return {nome:(nome||'').trim(),punti};
  },

  /* ── scrivere ──
     Un GPX che qualsiasi app riapre: niente estensioni nostre. */
  scrivi({nome,punti,tipo}){
    const esc=s=>String(s||'').replace(/[<>&'"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
    const righe=punti.map(([la,lo,q,t])=>
      `   <trkpt lat="${la}" lon="${lo}">`+
      (q!=null?`<ele>${q}</ele>`:'')+
      (t!=null?`<time>${new Date(t).toISOString()}</time>`:'')+
      `</trkpt>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Orbit" xmlns="http://www.topografix.com/GPX/1/1">
 <metadata><name>${esc(nome)}</name></metadata>
 <trk>
  <name>${esc(nome)}</name>
  ${tipo?`<type>${esc(tipo)}</type>`:''}
  <trkseg>
${righe}
  </trkseg>
 </trk>
</gpx>
`;
  },
};

if(typeof module!=='undefined') module.exports=Gpx;
