/* timer.js
 * Countdown tick and mm:ss formatting used by the HUD and results screen.
 * Exposes: TH.Timer = { tick, format }
 */
(function(){
  function tick(dt){
    const s=TH.GameState.State;
    if(s.untimed) return Infinity;
    s.timeLeft-=dt;
    if(s.timeLeft<0) s.timeLeft=0;
    return s.timeLeft;
  }
  function format(sec){
    if(!isFinite(sec)) return '\u221E';
    const m=Math.floor(sec/60), sc=Math.floor(sec%60);
    return (m<10?'0':'')+m+':'+(sc<10?'0':'')+sc;
  }

  window.TH = window.TH || {};
  TH.Timer = {tick, format};
})();
