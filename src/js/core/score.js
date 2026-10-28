/* score.js
 * Score add/spend helpers, time-bonus calculation, and (new
 * enhancement) a persistent best-score table keyed by map + mode +
 * difficulty, stored in localStorage so it survives reloads.
 * Exposes: TH.Score = { add, spend, timeBonus,
 *                        getBest, setBestIfHigher, bestForMap }
 */
(function(){
  function add(n){ TH.GameState.State.score += n; }
  function spend(n){ const s=TH.GameState.State; s.score=Math.max(0,s.score-n); }
  function timeBonus(timeLeft){ return Math.max(0,Math.round(timeLeft*2)); }

  function bestKey(mapId,mode,diff){ return 'th_best_'+mapId+'_'+mode+'_'+diff; }

  function getBest(mapId,mode,diff){
    const v=localStorage.getItem(bestKey(mapId,mode,diff));
    return v!==null ? parseInt(v,10) : null;
  }
  function setBestIfHigher(mapId,mode,diff,score){
    const cur=getBest(mapId,mode,diff);
    if(cur===null || score>cur){ localStorage.setItem(bestKey(mapId,mode,diff), String(score)); return true; }
    return false;
  }
  // Highest score recorded for a map across every mode/difficulty - used on the map-select cards.
  function bestForMap(mapId){
    let best=null;
    ['time','compete'].forEach(m=>{
      ['easy','medium','hard'].forEach(d=>{
        const v=getBest(mapId,m,d);
        if(v!==null && (best===null || v>best)) best=v;
      });
    });
    return best;
  }

  window.TH = window.TH || {};
  TH.Score = {add, spend, timeBonus, getBest, setBestIfHigher, bestForMap};
})();
