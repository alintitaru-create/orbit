/* ═══════════════════════════════════════════════════════════
   SETTORE CHECKLIST — valigia e cose da fare, con spunte e
   voci personali salvate nel browser (localStorage).
   ═══════════════════════════════════════════════════════════ */
const Checklist={
  state:{},   /* {chiave:true} per le voci spuntate */
  extra:{},   /* {idLista:[voci aggiunte a mano]} */

  init(){
    try{ this.state=JSON.parse(localStorage.getItem('orbit_chk')||'{}'); }catch(e){}
    try{ this.extra=JSON.parse(localStorage.getItem('orbit_chk_extra')||'{}'); }catch(e){}
    this.render();
  },
  save(){
    try{
      localStorage.setItem('orbit_chk',JSON.stringify(this.state));
      localStorage.setItem('orbit_chk_extra',JSON.stringify(this.extra));
    }catch(e){}
  },
  items(L){ return L.items.concat(this.extra[L.id]||[]); },

  render(){
    const box=document.getElementById('checkGrid');
    box.innerHTML=CHECKLISTS.map(L=>{
      const items=this.items(L);
      const done=items.filter((_,k)=>this.state[L.id+'_'+k]).length;
      return `<div class="card check-card" data-l="${L.id}">
        <div class="top"><h3>${L.title}</h3><span class="badge ${done===items.length?'green':''}">${done}/${items.length}</span></div>
        <p class="muted">${L.sub}</p>
        <div class="check-bar"><i style="width:${items.length?Math.round(100*done/items.length):0}%"></i></div>
        <ul class="check-list">${items.map((t,k)=>{
          const on=!!this.state[L.id+'_'+k];
          const custom=k>=L.items.length;
          return `<li class="${on?'on':''}" data-k="${k}"><span class="box">${on?'✓':''}</span><span class="txt">${t}</span>${custom?`<button class="del" data-k="${k}" title="Rimuovi">×</button>`:''}</li>`;
        }).join('')}</ul>
        <form class="check-add"><input type="text" placeholder="Aggiungi una voce…" maxlength="120"><button class="pill" type="submit">+</button></form>
      </div>`;
    }).join('');

    box.querySelectorAll('.check-card').forEach(card=>{
      const id=card.dataset.l, L=CHECKLISTS.find(x=>x.id===id);
      card.querySelector('.check-list').onclick=e=>{
        const del=e.target.closest('.del');
        if(del){ /* rimuove una voce aggiunta a mano */
          const k=+del.dataset.k, base=L.items.length;
          (this.extra[id]||[]).splice(k-base,1);
          /* le spunte oltre la voce rimossa scalano di uno */
          const items=this.items(L);
          for(let j=k;j<=items.length;j++){ this.state[id+'_'+j]=this.state[id+'_'+(j+1)]; }
          delete this.state[id+'_'+(items.length+1)];
          this.save(); this.render(); return;
        }
        const li=e.target.closest('li'); if(!li) return;
        const key=id+'_'+li.dataset.k;
        this.state[key]=!this.state[key]; if(!this.state[key]) delete this.state[key];
        this.save(); this.render();
      };
      card.querySelector('.check-add').onsubmit=e=>{
        e.preventDefault();
        const inp=e.target.querySelector('input'), v=inp.value.trim();
        if(!v) return;
        (this.extra[id]=this.extra[id]||[]).push(v);
        this.save(); this.render();
      };
    });
  },
};
