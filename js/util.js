/* ═══════════════════════════════════════════════════════════
   SETTORE UTILITÀ — icone, formati, funzioni condivise.
   ═══════════════════════════════════════════════════════════ */

/* icone SVG dei mezzi (colore ereditato con currentColor) */
const ICONS={
 air:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z"/></svg>',
 road:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 11l1.5-4.5A2 2 0 0 1 8.4 5h7.2a2 2 0 0 1 1.9 1.5L19 11c1.1 0 2 .9 2 2v4h-2a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H3v-4c0-1.1.9-2 2-2zm2.1 0h9.8l-1-3H8.1z"/></svg>',
 rail:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8 2 4 2.5 4 6v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5V21h12v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm9 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zM18 11H6V6h12z"/></svg>',
 foot:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM9.8 8.9 7 23h2.1l1.8-8 2.1 2v6h2v-7.5l-2.1-2 .6-3A7.3 7.3 0 0 0 19 13v-2a5.4 5.4 0 0 1-4.5-2.5l-1-1.6A2 2 0 0 0 11.8 6c-.3 0-.6.1-.8.2L6 8.3V13h2V9.6z"/></svg>',
 horse:'<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 4 17 7h-2.5L12 3 9 6.5 6.5 5 3 8.5l1 4.5 2 1v7h2v-6l2 1v5h2v-5.5l3.5-1.5L17 21h2l-1-7.5L21 9V4z"/></svg>',
};
const MODE_IT={air:"Aereo",road:"Auto",rail:"Treno",foot:"A piedi",horse:"Cavallo"};
/* colori dei mezzi: nomi delle variabili CSS e valori esadecimali per la mappa */
const MODE_VAR={air:"var(--air)",road:"var(--road)",rail:"var(--rail)",foot:"var(--foot)",horse:"var(--horse)"};
const MODE_HEX={air:"#0a84ff",road:"#ff9f0a",rail:"#ff453a",foot:"#30d158",horse:"#bf5af2"};

function micon(m){ return `<span class="mico" style="color:${MODE_VAR[m]}">${ICONS[m]}</span>`; }

/* copia negli appunti con feedback visivo sulla .pnr */
function bindCopy(root){
  root.querySelectorAll('.pnr').forEach(el=>el.onclick=()=>{
    navigator.clipboard?.writeText(el.dataset.c||el.textContent.trim());
    el.classList.add('ok'); setTimeout(()=>el.classList.remove('ok'),1100);
  });
}
const pnrHtml=p=>`<span class="pnr" data-c="${p.split(' ').pop()}" title="Copia">${p}</span>`;

/* distanza in km fra due [lat,lon] */
const D2R=Math.PI/180;
function hav(a,b){
  const dLa=(b[0]-a[0])*D2R,dLo=(b[1]-a[1])*D2R;
  const x=Math.sin(dLa/2)**2+Math.cos(a[0]*D2R)*Math.cos(b[0]*D2R)*Math.sin(dLo/2)**2;
  return 12742*Math.asin(Math.sqrt(x));
}

/* formato date: "2026-09-14" → "lun 14 set" */
function fmtDay(iso){
  const d=new Date(iso+"T12:00:00");
  return d.toLocaleDateString('it-IT',{weekday:'short',day:'numeric',month:'short'});
}

/* pressione barometrica dalla quota */
const pressure=h=>Math.round(1013.25*Math.pow(1-2.25577e-5*h,5.25588));
