/* cg.js
 * The computer-graphics algorithms the game really uses, written out by hand
 * (not library calls), plus the live statistics the "CG Concepts" panel shows.
 *
 *  - Cohen-Sutherland region codes + line clipping   (entity / hint-path clipping)
 *  - Liang-Barsky parametric line clipping            (minimap view-window)
 *  - Bresenham line rasterisation on the tile grid    (monster line-of-sight)
 *  - 3x3 homogeneous matrices                         (2D camera transform display)
 *  - 4x4 matrices / frustum planes                    (3D view, see gl3d.js)
 *  - lerp / smoothstep / quadratic Bezier             (camera smoothing, pickups)
 * Exposes: TH.CG
 */
(function(){
  const INSIDE=0, LEFT=1, RIGHT=2, BOTTOM=4, TOP=8;

  function outcode(x,y,r){
    let c=INSIDE;
    if(x<r.x0) c|=LEFT; else if(x>r.x1) c|=RIGHT;
    if(y<r.y0) c|=BOTTOM; else if(y>r.y1) c|=TOP;
    return c;
  }
  function codeStr(c){ return ((c&8)?1:0)+''+((c&4)?1:0)+''+((c&2)?1:0)+''+((c&1)?1:0); }

  // Returns [x0,y0,x1,y1] clipped to rect r={x0,y0,x1,y1}, or null if fully outside.
  function cohenSutherland(x0,y0,x1,y1,r){
    let c0=outcode(x0,y0,r), c1=outcode(x1,y1,r);
    for(let i=0;i<8;i++){
      if(!(c0|c1)) return [x0,y0,x1,y1];       // trivially accept
      if(c0&c1) return null;                     // trivially reject
      const co=c0||c1; let x,y;
      if(co&TOP){ x=x0+(x1-x0)*(r.y1-y0)/(y1-y0); y=r.y1; }
      else if(co&BOTTOM){ x=x0+(x1-x0)*(r.y0-y0)/(y1-y0); y=r.y0; }
      else if(co&RIGHT){ y=y0+(y1-y0)*(r.x1-x0)/(x1-x0); x=r.x1; }
      else { y=y0+(y1-y0)*(r.x0-x0)/(x1-x0); x=r.x0; }
      if(co===c0){ x0=x; y0=y; c0=outcode(x0,y0,r); } else { x1=x; y1=y; c1=outcode(x1,y1,r); }
    }
    return null;
  }

  // Liang-Barsky: parametric clipping, returns [x0,y0,x1,y1] or null
  function liangBarsky(x0,y0,x1,y1,r){
    const dx=x1-x0, dy=y1-y0; let t0=0,t1=1;
    const p=[-dx,dx,-dy,dy], q=[x0-r.x0,r.x1-x0,y0-r.y0,r.y1-y0];
    for(let i=0;i<4;i++){
      if(p[i]===0){ if(q[i]<0) return null; }
      else { const t=q[i]/p[i]; if(p[i]<0){ if(t>t1) return null; if(t>t0) t0=t; } else { if(t<t0) return null; if(t<t1) t1=t; } }
    }
    return [x0+t0*dx,y0+t0*dy,x0+t1*dx,y0+t1*dy];
  }

  // Bresenham on integer grid; cb(x,y) may return false to stop. Returns number of cells visited.
  function bresenham(x0,y0,x1,y1,cb){
    let dx=Math.abs(x1-x0), dy=-Math.abs(y1-y0), sx=x0<x1?1:-1, sy=y0<y1?1:-1, err=dx+dy, n=0;
    for(;;){
      n++;
      if(cb(x0,y0)===false) return n;
      if(x0===x1&&y0===y1) return n;
      const e2=2*err;
      if(e2>=dy){ err+=dy; x0+=sx; }
      if(e2<=dx){ err+=dx; y0+=sy; }
    }
  }
  function hasLOS(grid,w,h,a,b){
    CG.stats.losRays++;
    let ok=true;
    bresenham(a.x,a.y,b.x,b.y,(x,y)=>{
      if(x<0||y<0||x>=w||y>=h){ ok=false; return false; }
      const c=grid[y][x];
      if((x!==a.x||y!==a.y) && (c==='#'||c==='O'||c==='D')){ ok=false; return false; }
    });
    CG.stats.lastLOS=ok;
    return ok;
  }

  const lerp=(a,b,t)=>a+(b-a)*t;
  const smoothstep=(a,b,x)=>{ const t=Math.max(0,Math.min(1,(x-a)/(b-a))); return t*t*(3-2*t); };
  const bezier2=(p0,p1,p2,t)=>{ const u=1-t; return u*u*p0+2*u*t*p1+t*t*p2; };

  // 3x3 row-major homogeneous 2D matrices
  const mat3={
    identity:()=>[1,0,0,0,1,0,0,0,1],
    translate:(x,y)=>[1,0,x,0,1,y,0,0,1],
    scale:(sx,sy)=>[sx,0,0,0,sy,0,0,0,1],
    rotate:a=>{ const c=Math.cos(a),s=Math.sin(a); return [c,-s,0,s,c,0,0,0,1]; },
    mul:(a,b)=>{ const o=new Array(9); for(let r=0;r<3;r++) for(let c=0;c<3;c++) o[r*3+c]=a[r*3]*b[c]+a[r*3+1]*b[3+c]+a[r*3+2]*b[6+c]; return o; }
  };

  const CG={
    INSIDE,LEFT,RIGHT,BOTTOM,TOP,outcode,codeStr,cohenSutherland,liangBarsky,bresenham,hasLOS,
    lerp,smoothstep,bezier2,mat3,
    stats:{}, resetFrame(){
      const s=CG.stats;
      s.losRays=0; s.collTests=0; s.pathsComputed=0; s.entClipped=0; s.entTotal=0; s.pathClipped=0;
    },
    fmt:(v,d)=>(Math.abs(v)<1e-9?0:v).toFixed(d===undefined?2:d)
  };
  CG.stats={losRays:0,collTests:0,pathsComputed:0,entClipped:0,entTotal:0,pathClipped:0,lastLOS:null,
    mode:'2d', fps:0, frameMs:0};

  window.TH=window.TH||{};
  TH.CG=CG;
})();
