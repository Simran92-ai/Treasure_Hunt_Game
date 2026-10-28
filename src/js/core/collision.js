/* collision.js
 * Generic tile-collision check and axis-separated movement helper,
 * shared by the player and the computer opponent.
 * Exposes: TH.Collision = { collides, moveEntity, nudge }
 */
(function(){
  function collides(px,py,w,h,gw,gh,g,keyFlag){
    const TS=TH.GameState.TS;
    TH.CG.stats.collTests++;
    const pts=[[px,py],[px+w,py],[px,py+h],[px+w,py+h]];
    for(const [x,y] of pts){
      const tx=Math.floor(x/TS), ty=Math.floor(y/TS);
      if(tx<0||ty<0||tx>=gw||ty>=gh) return true;
      if(TH.Maps.isSolidChar(g[ty][tx],keyFlag)) return true;
    }
    return false;
  }

  function moveEntity(e,dx,dy,dt,speed,gw,gh,g,keyFlag){
    if(dx===0&&dy===0) return;
    const len=Math.hypot(dx,dy)||1; dx/=len; dy/=len;
    const step=speed*dt;
    let nx=e.px+dx*step, ny=e.py;
    if(!collides(nx,e.py,e.w,e.h,gw,gh,g,keyFlag)) e.px=nx;
    ny=e.py+dy*step;
    if(!collides(e.px,ny,e.w,e.h,gw,gh,g,keyFlag)) e.py=ny;
  }

  // After a world switch the entity may sit inside a wall/obstacle of the other
  // world: move it to the nearest free tile centre (spiral search).
  function nudge(e,gw,gh,g,keyFlag){
    const TS=TH.GameState.TS;
    if(!collides(e.px,e.py,e.w,e.h,gw,gh,g,keyFlag)) return false;
    const cx=Math.floor((e.px+e.w/2)/TS), cy=Math.floor((e.py+e.h/2)/TS);
    for(let r=1;r<Math.max(gw,gh);r++){
      for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
        const tx=cx+dx, ty=cy+dy; if(tx<1||ty<1||tx>=gw-1||ty>=gh-1) continue;
        const nx=tx*TS+(TS-e.w)/2, ny=ty*TS+(TS-e.h)/2;
        if(!collides(nx,ny,e.w,e.h,gw,gh,g,keyFlag)){ e.px=nx; e.py=ny; return true; }
      }
    }
    return false;
  }

  window.TH = window.TH || {};
  TH.Collision = {collides, moveEntity, nudge};
})();
