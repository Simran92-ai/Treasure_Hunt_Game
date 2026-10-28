/* player.js
 * Player entity factory and per-frame update: keyboard input,
 * collision-aware movement, tile pickups, and explored-tile tracking
 * (used by the minimap).
 * Exposes: TH.Player = { create, update }
 */
(function(){
  function create(startTile){
    const TS=TH.GameState.TS;
    return {px:startTile.x*TS+8, py:startTile.y*TS+8, w:24, h:24, dir:'down', moving:false, anim:0};
  }

  function readInput(keys){
    let dx=0, dy=0;
    if(keys['w']||keys['arrowup']) dy-=1;
    if(keys['s']||keys['arrowdown']) dy+=1;
    if(keys['a']||keys['arrowleft']) dx-=1;
    if(keys['d']||keys['arrowright']) dx+=1;
    return {dx,dy};
  }

  function update(dt,keys){
    const s=TH.GameState.State;
    let {dx,dy}=readInput(keys);
    if(s.camYaw){ // 3D view: movement is relative to the camera heading (2D rotation matrix)
      const c=Math.cos(s.camYaw), sn=Math.sin(s.camYaw);
      const rx=dx*c+dy*sn, ry=-dx*sn+dy*c; dx=Math.abs(rx)<1e-6?0:rx; dy=Math.abs(ry)<1e-6?0:ry;
    }
    s.player.moving = dx!==0||dy!==0;
    if(dx!==0||dy!==0){
      s.player.dir = Math.abs(dx)>Math.abs(dy) ? (dx>0?'right':'left') : (dy>0?'down':'up');
      s.player.heading=Math.atan2(dx,dy); // radians, used by the 3D model
    }
    TH.Collision.moveEntity(s.player,dx,dy,dt,180,s.gw,s.gh,TH.GameState.activeGrid(),s.hasKey);
    s.player.anim += s.player.moving ? dt*8 : 0;
    if(s.player.hazCd>0) s.player.hazCd-=dt;
    TH.Collectibles.playerCollect(s.player);
    TH.Collectibles.updateMirrorObjectives();
    // fog-of-war: reveal a radius of tiles on the minimap
    const pv=TH.GameState.tileAt(s.player.px+s.player.w/2,s.player.py+s.player.h/2);
    for(let oy=-3;oy<=3;oy++) for(let ox=-3;ox<=3;ox++) if(ox*ox+oy*oy<=10) s.visited.add((pv.x+ox)+','+(pv.y+oy));
  }

  window.TH = window.TH || {};
  TH.Player = {create, update};
})();
