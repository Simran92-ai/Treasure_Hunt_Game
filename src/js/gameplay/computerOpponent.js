/* computerOpponent.js
 * The AI racer. It follows A* paths, respects walls/doors, and does
 * not know where the key/treasure are until it has found the clue
 * itself - exactly like the player. Never teleports or cheats.
 * Exposes: TH.AI = { create, currentGoal, update }
 */
(function(){
  function create(startTile){
    const TS=TH.GameState.TS;
    return {px:startTile.x*TS+8, py:startTile.y*TS+8, w:24, h:24, dir:'down', moving:false, anim:0};
  }

  function currentGoal(){
    const s=TH.GameState.State; const T=TH.Maps.T; const g=TH.GameState.gridFor(s.aiWorld);
    // fairness: no knowledge of key/treasure until the clue is found
    if(!s.aiHasClue){
      for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++) if(g[y][x]===T.CLUE) return {x,y};
      return null;
    }
    if(s.map.hasDoor && !s.aiHasKey){
      for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++) if(g[y][x]===T.KEY) return {x,y};
    }
    for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++) if(g[y][x]===T.TREASURE) return {x,y};
    return null;
  }

  function update(dt){
    const s=TH.GameState.State; const T=TH.Maps.T; const TS=TH.GameState.TS;
    if(!s.ai || s.aiFinishTime!==null) return;
    if(s.aiStartDelay>0){ s.aiStartDelay-=dt*1000; s.ai.moving=false; return; } // "scanning" before committing to a route
    s.aiTimer-=dt*1000;
    let g=TH.GameState.gridFor(s.aiWorld);
    const goal=currentGoal(); s.aiGoal=goal;

    if(s.aiPath.length===0 || s.aiTimer<=0){
      const start=TH.GameState.tileAt(s.ai.px+s.ai.w/2, s.ai.py+s.ai.h/2);
      let target=goal;
      if(!target){
        // nothing to chase - wander rather than freeze
        let tries=0,tx,ty;
        do{ tx=1+Math.floor(Math.random()*(s.gw-2)); ty=1+Math.floor(Math.random()*(s.gh-2)); tries++; }
        while(TH.Maps.isSolidChar(g[ty][tx],s.aiHasKey) && tries<20);
        target={x:tx,y:ty};
      }
      let p=TH.Pathfinding.astar(g,s.gw,s.gh,start,target,s.aiHasKey); TH.CG.stats.pathsComputed++;
      if(!p && goal && s.map.dual){
        // no route in this dimension - try the other one (the AI "switches world" like the player must)
        const other=s.aiWorld==='normal'?'mirror':'normal', og=TH.GameState.gridFor(other);
        const q=TH.Pathfinding.astar(og,s.gw,s.gh,start,target,s.aiHasKey);
        if(q){ p=q; s.aiWorld=other; g=og; TH.Collision.nudge(s.ai,s.gw,s.gh,g,s.aiHasKey); }
      }
      if(p){
        s.aiPath=p; s.aiPathIdx=0;
        if(goal && s.cfg.aiWander>0 && Math.random()<s.cfg.aiWander && s.aiPath.length>2){
          s.aiPath.splice(1,0,s.aiPath[1]); // small "imperfection" for easier difficulties
        }
      } else {
        s.aiPath=[]; // no valid route right now (locked door / divide open only in the other world) - retry next interval
      }
      s.aiTimer=s.cfg.aiRecalc;
    }

    if(s.aiPath.length && s.aiPathIdx<s.aiPath.length){
      const wp=s.aiPath[s.aiPathIdx];
      const tx=wp.x*TS+8, ty=wp.y*TS+8;
      const dx=tx-s.ai.px, dy=ty-s.ai.py;
      const dist=Math.hypot(dx,dy);
      s.ai.moving=dist>2;
      if(dist<4){ s.aiPathIdx++; }
      else TH.Collision.moveEntity(s.ai,dx,dy,dt,s.cfg.aiSpeed,s.gw,s.gh,g,s.aiHasKey);
      if(dx!==0||dy!==0) s.ai.dir = Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up');
    } else {
      s.ai.moving=false;
    }

    // AI pickups (the clue is only "discovered", never removed, so the player can still find it)
    const t=TH.GameState.tileAt(s.ai.px+s.ai.w/2, s.ai.py+s.ai.h/2);
    if(t.y>=0&&t.y<s.gh&&t.x>=0&&t.x<s.gw){
      const cell=g[t.y][t.x];
      if(cell===T.CLUE && !s.aiHasClue){ s.aiHasClue=true; }
      else if(cell===T.KEY && s.aiHasClue){ g[t.y][t.x]=T.FLOOR; s.aiHasKey=true; }
      else if(cell===T.TREASURE && s.aiHasClue){
        TH.Game.finishAI();
        if(s.winner==='ai' && s.mode==='compete' && !s.ended) TH.Game.endGame('lose');
      }
    }
    s.ai.anim += s.ai.moving ? dt*8 : 0;
  }

  window.TH = window.TH || {};
  TH.AI = {create, currentGoal, update};
})();
