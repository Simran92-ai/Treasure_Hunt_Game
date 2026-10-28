/* collectibles.js
 * What happens when the player stands on a tile: coins, clues, keys,
 * checkpoints, hazards, doors and the treasure, plus objective
 * marking (including the Mirror World's position-based objectives).
 * Exposes: TH.Collectibles = { markObjective, markEvent,
 *                               updateMirrorObjectives, playerCollect }
 */
(function(){
  function markObjective(i){
    const s=TH.GameState.State;
    if(i>=0 && !s.objectivesDone[i]) s.objectivesDone[i]=true;
  }
  function markEvent(ev){
    const s=TH.GameState.State;
    if(s.map.objEvents){ const idx=s.map.objEvents.indexOf(ev); if(idx>=0) markObjective(idx); }
  }
  function updateMirrorObjectives(){
    const s=TH.GameState.State;
    if(s.map.id!=='mirror') return;
    const t=TH.GameState.tileAt(s.player.px+s.player.w/2, s.player.py+s.player.h/2);
    const dv=s.map.divs;
    if(t.x>dv.x1) markObjective(0);
    if(s.collected.clues>0) markObjective(1);
    if(s.worldSwitchCount>0) markObjective(2);
    if(t.x>dv.x2) markObjective(3);
  }

  function playerCollect(entity){
    const s=TH.GameState.State; const T=TH.Maps.T;
    const t=TH.GameState.tileAt(entity.px+entity.w/2, entity.py+entity.h/2);
    if(t.y<0||t.y>=s.gh||t.x<0||t.x>=s.gw) return;
    const g=TH.GameState.activeGrid();
    const cell=g[t.y][t.x];
    const other = s.map.dual ? (s.worldMode==='mirror'?s.grid:s.mirrorGridLive) : null;
    function clearBoth(){ g[t.y][t.x]=T.FLOOR; if(other) other[t.y][t.x]=T.FLOOR; }

    if(cell===T.COIN){
      clearBoth(); s.collected.coins++; TH.Score.add(10);
    } else if(cell===T.CLUE){
      clearBoth(); s.collected.clues++; TH.Score.add(50); s.hintFlashMsg=null; markEvent('clue');
    } else if(cell===T.KEY){
      if(s.collected.clues>0){ clearBoth(); s.hasKey=true; s.keyTaken=true; s.collected.keys++; TH.Score.add(100); markEvent('key'); }
    } else if(cell===T.CHECK){
      clearBoth(); s.collected.checkpoints++; TH.Score.add(75); s.lastCheckpoint={x:entity.px,y:entity.py};
    } else if(cell===T.HAZARD){
      if(!(entity.hazCd>0)){
        entity.hazCd=1.2; s.health-=25; TH.Score.spend(25); s.hitFlash=.4; s.shake=.2;
        if(s.health<=0){ TH.Game.loseLife(); }
      }
    } else if(cell===T.DOOR){
      if(s.hasKey) markEvent('door');
    } else if(cell===T.TREASURE){
      if(s.collected.clues>0) TH.Game.finishPlayer();
    }
  }

  window.TH = window.TH || {};
  TH.Collectibles = {markObjective, markEvent, updateMirrorObjectives, playerCollect};
})();
