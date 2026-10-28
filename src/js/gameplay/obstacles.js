/* obstacles.js
 * Moving hazards: monsters, animals, vehicles, drones...
 * Every patroller walks an A*-computed route between two points, so they
 * walk around walls and obstacles instead of through them.  "Hunters" also
 * spot the player with a Bresenham line-of-sight test, chase with A*, then
 * give up and walk back to their route.
 * Exposes: TH.Obstacles = { init, update, worldPos }
 */
(function(){
  function init(patrolDefs){
    const TS=TH.GameState.TS;
    return (patrolDefs||[]).map((p,i)=>{
      const r=p.route[0];
      return {x:r.x*TS+TS/2, y:r.y*TS+TS/2, ri:0, dir:1, def:p, mode:'patrol', path:[], pi:0, repath:0, lost:0,
        face:1, anim:Math.random()*6, phase:i*1.7, speedNow:0, alert:0};
    });
  }

  function tileOf(x,y){ const TS=TH.GameState.TS; return {x:Math.floor(x/TS), y:Math.floor(y/TS)}; }

  function follow(ps,path,dt,speed){
    const TS=TH.GameState.TS;
    if(ps.pi>=path.length) return true;
    const wp=path[ps.pi], tx=wp.x*TS+TS/2, ty=wp.y*TS+TS/2;
    const dx=tx-ps.x, dy=ty-ps.y, dist=Math.hypot(dx,dy);
    if(dist<3){ ps.pi++; return ps.pi>=path.length; }
    const step=Math.min(dist,speed*dt);
    ps.x+=dx/dist*step; ps.y+=dy/dist*step;
    if(Math.abs(dx)>1) ps.face=dx>0?1:-1;
    ps.speedNow=speed;
    return false;
  }

  function update(dt){
    const s=TH.GameState.State; const TS=TH.GameState.TS;
    if(!s.patrolStates.length) return;
    const g=TH.GameState.activeGrid();
    const pc={x:s.player.px+s.player.w/2, y:s.player.py+s.player.h/2};
    const ptile=tileOf(pc.x,pc.y);
    if(s.player.invuln>0) s.player.invuln-=dt;

    s.patrolStates.forEach(ps=>{
      const def=ps.def, spd=def.speed||40;
      ps.anim+=dt*(2+ps.speedNow/25); ps.speedNow=0;
      const here=tileOf(ps.x,ps.y);
      const tdist=Math.abs(here.x-ptile.x)+Math.abs(here.y-ptile.y);

      if(def.hunter){
        const aggro=7, giveUp=11;
        if(ps.mode==='patrol' || ps.mode==='return'){
          if(tdist<=aggro && TH.CG.hasLOS(g,s.gw,s.gh,here,ptile)){ ps.mode='chase'; ps.repath=0; ps.lost=0; ps.alert=1; }
        } else if(ps.mode==='chase'){
          const los=tdist<=aggro+2 && TH.CG.hasLOS(g,s.gw,s.gh,here,ptile);
          ps.lost = los ? 0 : ps.lost+dt;
          if(tdist>giveUp || ps.lost>2.5){
            ps.mode='return'; ps.alert=0;
            const tgt=def.route[ps.ri];
            ps.path=TH.Pathfinding.astar(g,s.gw,s.gh,here,tgt,false,{hazardCost:0})||[]; ps.pi=0; TH.CG.stats.pathsComputed++;
          }
        }
      }

      if(ps.mode==='chase'){
        ps.repath-=dt;
        if(ps.repath<=0){
          ps.path=TH.Pathfinding.astar(g,s.gw,s.gh,here,ptile,false,{hazardCost:0,maxIter:6000})||[]; ps.pi=1; ps.repath=.45; TH.CG.stats.pathsComputed++;
        }
        follow(ps,ps.path,dt,spd*1.18);
      } else if(ps.mode==='return'){
        if(follow(ps,ps.path,dt,spd)) ps.mode='patrol';
      } else {
        // ping-pong along the precomputed A* route
        const route=def.route, nxt=route[ps.ri+ps.dir];
        if(!nxt){ ps.dir*=-1; }
        else {
          const tx=nxt.x*TS+TS/2, ty=nxt.y*TS+TS/2, dx=tx-ps.x, dy=ty-ps.y, dist=Math.hypot(dx,dy);
          if(dist<3){ ps.ri+=ps.dir; if(ps.ri>=route.length-1) ps.dir=-1; else if(ps.ri<=0) ps.dir=1; }
          else { const st=Math.min(dist,spd*dt); ps.x+=dx/dist*st; ps.y+=dy/dist*st; ps.speedNow=spd; if(Math.abs(dx)>1) ps.face=dx>0?1:-1; }
        }
      }

      // contact damage
      const cr=TH.Themes.creature(def.kind);
      const reach=11+8*cr.s;
      if(s.player && s.player.invuln<=0 && Math.hypot(pc.x-ps.x, pc.y-ps.y)<reach){
        s.player.invuln=1.0;
        s.health-=def.dmg; s.hitFlash=.45; s.shake=.3;
        TH.Score.spend(25);
        if(s.health<=0) TH.Game.loseLife();
      }
    });
  }

  window.TH = window.TH || {};
  TH.Obstacles = {init, update};
})();
