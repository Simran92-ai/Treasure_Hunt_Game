(function(){
  function bindHold(el,onDown,onUp){
    el.addEventListener('pointerdown', e=>{ e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); onDown(); });
    el.addEventListener('pointerup',   e=>{ e.preventDefault(); onUp(); });
    el.addEventListener('pointercancel', onUp);
    el.addEventListener('pointerleave',  onUp);
  }
  function releaseAll(){
    const keys=TH.Game.keys;
    ['w','a','s','d','q','e'].forEach(k=>{ keys[k]=false; });
  }
  function init(){
    const keys=TH.Game.keys;
    document.querySelectorAll('.dbtn[data-key]').forEach(btn=>{
      const k=btn.getAttribute('data-key');
      bindHold(btn, ()=>{ keys[k]=true; }, ()=>{ keys[k]=false; });
    });
    const worldBtn=document.getElementById('worldSwitchBtn');
    if(worldBtn) worldBtn.addEventListener('click', ()=>{ const s=TH.GameState.State; if(s.running&&!s.paused&&!s.ended&&s.map&&s.map.dual) TH.Game.switchWorld(); });
    document.querySelectorAll('.rotbtn[data-key]').forEach(btn=>{ const k=btn.getAttribute('data-key'); bindHold(btn,()=>{ keys[k]=true; },()=>{ keys[k]=false; }); });
    document.addEventListener('visibilitychange', ()=>{ if(document.hidden) releaseAll(); });
  }
  window.TH = window.TH || {};
  TH.TouchControls = {init, releaseAll};
})();