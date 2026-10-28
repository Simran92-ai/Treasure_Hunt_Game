/* renderer.js
 * 2D canvas renderer + minimap.  Reads state, never mutates gameplay.
 * CG techniques on show here: 2D affine transforms (translate / scale /
 * rotate / reflect), window-to-viewport mapping, Cohen-Sutherland clipping,
 * painter's-algorithm depth sorting, alpha blending, HSL colour animation,
 * radial-gradient lighting and offscreen tile atlases.
 * Exposes: TH.Renderer = { init, resizeCanvas, render, resetAtlas }
 */
(function(){
  let canvas, ctx, mmCanvas, mmCtx, atlas=null, atlasKey='', lightCanvas=null, lightCtx=null;
  const TAU=Math.PI*2;

  /* ---------- deterministic noise for atlas painting ---------- */
  function rng(seed){ let a=seed|0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  function mk(w,h){ const c=document.createElement('canvas'); c.width=w; c.height=h; return c; }

  const FLOOR_PAINT={
    jungle(c,v,r){ const base=['#2a4a26','#2d4f28','#274622','#5a4630'][v]; c.fillStyle=base; c.fillRect(0,0,40,40);
      for(let i=0;i<14;i++){ c.fillStyle=['#33582d','#234220','#3b6232'][i%3]; c.globalAlpha=.55; c.beginPath(); c.arc(r()*40,r()*40,3+r()*5,0,TAU); c.fill(); } c.globalAlpha=1;
      if(v<3){ c.strokeStyle='#4a7a3a'; c.lineWidth=1; for(let i=0;i<10;i++){ const x=r()*40,y=r()*40; c.beginPath(); c.moveTo(x,y); c.lineTo(x+(r()-.5)*3,y-3-r()*3); c.stroke(); } if(r()<.3){ c.fillStyle=['#e8d34a','#e87a9a','#f4f4f4'][(r()*3)|0]; c.beginPath(); c.arc(r()*36+2,r()*36+2,1.4,0,TAU); c.fill(); } }
      else { for(let i=0;i<8;i++){ c.fillStyle='#7a6648'; c.beginPath(); c.arc(r()*40,r()*40,1+r()*1.6,0,TAU); c.fill(); } } },
    mansion(c,v,r){ if(v<2){ c.fillStyle=v?'#3a2616':'#42291a'; c.fillRect(0,0,40,40); for(let i=0;i<4;i++){ c.fillStyle='rgba(0,0,0,.38)'; c.fillRect(0,i*10,40,1.2); c.fillStyle='rgba(255,200,140,.06)'; c.fillRect(0,i*10+1.5,40,2); c.fillStyle='rgba(0,0,0,.35)'; c.fillRect(((i*13+v*7)%40),i*10,1.2,10); } for(let i=0;i<10;i++){ c.strokeStyle='rgba(0,0,0,.14)'; c.beginPath(); const y=r()*40; c.moveTo(0,y); c.bezierCurveTo(12,y+2,24,y-2,40,y+1); c.stroke(); } }
      else { c.fillStyle='#4a1a24'; c.fillRect(0,0,40,40); c.strokeStyle='#c9a23a'; c.lineWidth=1.2; c.strokeRect(3,3,34,34); c.strokeStyle='rgba(201,162,58,.5)'; c.beginPath(); c.moveTo(20,6); c.lineTo(34,20); c.lineTo(20,34); c.lineTo(6,20); c.closePath(); c.stroke(); c.fillStyle='rgba(0,0,0,.2)'; c.fillRect(0,0,40,40); c.globalAlpha=.2; for(let i=0;i<30;i++){ c.fillStyle='#000'; c.fillRect(r()*40,r()*40,1,1);} c.globalAlpha=1; } },
    pirate(c,v,r){ c.fillStyle=v===3?'#c4ae70':'#d8c58a'; c.fillRect(0,0,40,40); for(let i=0;i<40;i++){ c.fillStyle=['#c9b377','#e6d49c','#b9a468'][i%3]; c.fillRect(r()*40,r()*40,1.4,1.4); }
      c.strokeStyle='rgba(150,120,60,.22)'; c.lineWidth=1.4; for(let i=0;i<2;i++){ const y=8+i*18+r()*6; c.beginPath(); c.moveTo(0,y); c.bezierCurveTo(10,y-3,26,y+3,40,y); c.stroke(); }
      if(v===1&&r()<.6){ c.fillStyle='#f0e0e0'; c.beginPath(); c.ellipse(10+r()*20,10+r()*20,3,2,r()*3,0,TAU); c.fill(); } },
    city(c,v,r){ if(v===2){ c.fillStyle='#8c8e92'; c.fillRect(0,0,40,40); c.strokeStyle='rgba(0,0,0,.3)'; c.lineWidth=1; c.strokeRect(.5,.5,39,39); c.beginPath(); c.moveTo(20,0); c.lineTo(20,40); c.stroke(); for(let i=0;i<20;i++){ c.fillStyle='rgba(0,0,0,.08)'; c.fillRect(r()*40,r()*40,2,2);} }
      else { c.fillStyle='#3a3d42'; c.fillRect(0,0,40,40); for(let i=0;i<60;i++){ c.fillStyle=['#44474d','#303338','#4a4d54'][i%3]; c.fillRect(r()*40,r()*40,1.5,1.5); } if(v===3){ c.fillStyle='#e8c34a'; c.fillRect(0,18,18,3); c.fillRect(24,18,16,3); } else if(r()<.15){ c.strokeStyle='rgba(0,0,0,.4)'; c.beginPath(); c.moveTo(r()*40,0); c.lineTo(r()*40,40); c.stroke(); } } },
    spacestation(c,v,r){ c.fillStyle='#1c2234'; c.fillRect(0,0,40,40); c.fillStyle='#232b42'; c.fillRect(2,2,36,36); c.strokeStyle='rgba(0,0,0,.5)'; c.lineWidth=1.2; c.strokeRect(1.5,1.5,37,37);
      [[5,5],[35,5],[5,35],[35,35]].forEach(p=>{ c.fillStyle='#3a4560'; c.beginPath(); c.arc(p[0],p[1],1.5,0,TAU); c.fill(); });
      if(v===3){ c.fillStyle='rgba(74,200,255,.5)'; c.fillRect(6,19,28,2); c.fillStyle='rgba(74,200,255,.15)'; c.fillRect(6,16,28,8); } else if(v===2){ c.strokeStyle='rgba(224,176,32,.5)'; c.lineWidth=3; for(let i=-40;i<40;i+=10){ c.beginPath(); c.moveTo(i,40); c.lineTo(i+40,0); c.stroke(); } c.fillStyle='rgba(20,24,40,.6)'; c.fillRect(4,4,32,32); } else { c.fillStyle='rgba(255,255,255,.03)'; c.fillRect(2,2,36,10); } },
    mirror(c,v,r){ const g=c.createLinearGradient(0,0,40,40); g.addColorStop(0,'#173052'); g.addColorStop(1,'#0e1c34'); c.fillStyle=g; c.fillRect(0,0,40,40); c.strokeStyle='rgba(120,190,255,.25)'; c.lineWidth=1; c.strokeRect(.5,.5,39,39);
      c.fillStyle='rgba(180,225,255,.07)'; c.beginPath(); c.moveTo(0,40); c.lineTo(22,0); c.lineTo(32,0); c.lineTo(10,40); c.fill(); if(v===3){ c.strokeStyle='rgba(190,230,255,.35)'; c.beginPath(); c.moveTo(8,2); c.lineTo(18,16); c.lineTo(14,24); c.lineTo(26,38); c.stroke(); } }
  };
  const WALL_PAINT={
    ruinwall:{ top(c,v,r){ c.fillStyle='#6e6a5c'; c.fillRect(0,0,40,40); for(let j=0;j<3;j++) for(let i=0;i<2;i++){ c.fillStyle=['#7a7668','#605c50','#847f70'][(i+j+v)%3]; c.fillRect(i*20+(j%2?-10:0)+1,j*13+1,19,12); } c.strokeStyle='#3a382e'; c.strokeRect(.5,.5,39,39); for(let i=0;i<7;i++){ c.fillStyle='rgba(60,120,48,.7)'; c.beginPath(); c.arc(r()*40,r()*40,2+r()*5,0,TAU); c.fill(); } },
      front(c,v,r){ c.fillStyle='#4a473d'; c.fillRect(0,0,40,12); c.strokeStyle='#2a281f'; c.strokeRect(.5,.5,39,11); c.beginPath(); c.moveTo(14,0); c.lineTo(14,12); c.moveTo(30,0); c.lineTo(30,12); c.stroke(); c.fillStyle='rgba(60,120,48,.6)'; c.fillRect(r()*30,6,8,6); } },
    wallpaper:{ top(c,v,r){ c.fillStyle='#2a1a12'; c.fillRect(0,0,40,40); c.fillStyle='#3a2416'; c.fillRect(2,2,36,36); c.strokeStyle='#120a06'; c.strokeRect(.5,.5,39,39); },
      front(c,v,r){ c.fillStyle='#5a1a28'; c.fillRect(0,0,40,12); for(let i=0;i<40;i+=5){ c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(i,0,2,12); } c.fillStyle='#c9a23a'; c.fillRect(0,0,40,1.6); c.fillStyle='#2a1a12'; c.fillRect(0,10,40,2); if(v===1){ c.fillStyle='#8a6a2a'; c.fillRect(14,2,12,7); c.fillStyle='#2a3a4a'; c.fillRect(15,3,10,5); } } },
    cliff:{ top(c,v,r){ c.fillStyle='#8a7048'; c.fillRect(0,0,40,40); for(let i=0;i<10;i++){ c.fillStyle=['#9a805a','#76603c','#a88c62'][i%3]; c.beginPath(); c.moveTo(r()*40,r()*40); c.lineTo(r()*40,r()*40); c.lineTo(r()*40,r()*40); c.fill(); } c.strokeStyle='#4a3a20'; c.strokeRect(.5,.5,39,39); },
      front(c,v,r){ c.fillStyle='#5a4628'; c.fillRect(0,0,40,12); for(let i=0;i<4;i++){ c.fillStyle='rgba(0,0,0,.25)'; c.fillRect(0,i*3,40,1); } c.fillStyle='#3a8a4a'; c.fillRect(0,0,40,2); } },
    building:{ top(c,v,r){ c.fillStyle=['#5a5e66','#666a72','#4e5258','#6a6e76'][v]; c.fillRect(0,0,40,40); c.fillStyle='rgba(0,0,0,.3)'; c.fillRect(0,0,40,2); c.fillRect(0,0,2,40); c.fillStyle=['#8a8e96','#7a7e86'][v&1]; c.fillRect(8,8,12,10); if(v===2){ c.fillStyle='#c0392b'; c.beginPath(); c.arc(28,28,5,0,TAU); c.fill(); } c.strokeStyle='#2a2c30'; c.strokeRect(.5,.5,39,39); },
      front(c,v,r){ c.fillStyle='#34383f'; c.fillRect(0,0,40,12); for(let i=0;i<4;i++){ c.fillStyle=r()<.55?'#ffd98a':'#222a38'; c.fillRect(3+i*9.5,2.5,6,6); } c.fillStyle='rgba(0,0,0,.4)'; c.fillRect(0,10,40,2); } },
    hull:{ top(c,v,r){ c.fillStyle='#3a4a62'; c.fillRect(0,0,40,40); c.fillStyle='#46587a'; c.fillRect(3,3,34,34); c.strokeStyle='#1a2236'; c.lineWidth=1.5; c.strokeRect(1,1,38,38); c.fillStyle='rgba(74,200,255,.35)'; c.fillRect(8,19,24,2); [[6,6],[34,6],[6,34],[34,34]].forEach(p=>{ c.fillStyle='#2a3450'; c.beginPath(); c.arc(p[0],p[1],1.6,0,TAU); c.fill(); }); },
      front(c,v,r){ c.fillStyle='#232c42'; c.fillRect(0,0,40,12); c.fillStyle='rgba(74,200,255,.7)'; c.fillRect(4,4,32,2); c.fillStyle='#10162a'; c.fillRect(0,10,40,2); if(v===0){ c.fillStyle='#e06b6b'; c.fillRect(34,2,3,3); } } },
    crystalwall:{ top(c,v,r){ const g=c.createLinearGradient(0,0,40,40); g.addColorStop(0,'#2a5a8a'); g.addColorStop(1,'#16304e'); c.fillStyle=g; c.fillRect(0,0,40,40); for(let i=0;i<6;i++){ c.fillStyle='rgba(180,230,255,'+(.06+r()*.14)+')'; c.beginPath(); c.moveTo(r()*40,r()*40); c.lineTo(r()*40,r()*40); c.lineTo(r()*40,r()*40); c.fill(); } c.strokeStyle='rgba(160,220,255,.5)'; c.strokeRect(.5,.5,39,39); },
      front(c,v,r){ const g=c.createLinearGradient(0,0,0,12); g.addColorStop(0,'#5aa0d0'); g.addColorStop(1,'#1a3a5a'); c.fillStyle=g; c.fillRect(0,0,40,12); c.fillStyle='rgba(255,255,255,.35)'; c.fillRect(6,1,3,10); c.fillRect(24,1,2,10); } }
  };

  function buildAtlas(){
    const m=TH.GameState.State.map, theme=m.theme, wallKind=TH.Themes.THEMES[theme].wall;
    const key=m.id+':'+m.diffKey; if(atlas&&atlasKey===key) return; atlasKey=key;
    atlas={floor:[],wallTop:[],wallFront:[]};
    for(let v=0;v<4;v++){
      const f=mk(40,40); FLOOR_PAINT[theme](f.getContext('2d'),v,rng(1000+v*77)); atlas.floor.push(f);
      const wt=mk(40,40), wf=mk(40,12);
      WALL_PAINT[wallKind].top(wt.getContext('2d'),v,rng(2000+v*31)); WALL_PAINT[wallKind].front(wf.getContext('2d'),v,rng(3000+v*17));
      atlas.wallTop.push(wt); atlas.wallFront.push(wf);
    }
  }
  function resetAtlas(){ atlas=null; atlasKey=''; }

  function init(){
    canvas=document.getElementById('gameCanvas'); ctx=canvas.getContext('2d');
    mmCanvas=document.getElementById('minimapCanvas'); mmCtx=mmCanvas.getContext('2d');
    lightCanvas=mk(16,16); lightCtx=lightCanvas.getContext('2d');
  }

  function resizeCanvas(){
    const wrap=document.getElementById('gameWrap');
    const vw=Math.min(wrap.clientWidth,1500), vh=Math.min(wrap.clientHeight,950);
    canvas.width=Math.max(320,vw); canvas.height=Math.max(240,vh);
    canvas.style.width=canvas.width+'px'; canvas.style.height=canvas.height+'px';
    lightCanvas.width=canvas.width; lightCanvas.height=canvas.height;
    const g3=document.getElementById('gl3d');
    if(g3){ const dpr=Math.min(window.devicePixelRatio||1,TH.UI.Settings.quality==='high'?2:1.5);
      g3.style.width=canvas.width+'px'; g3.style.height=canvas.height+'px';
      g3.width=Math.round(canvas.width*dpr); g3.height=Math.round(canvas.height*dpr);
      if(TH.Scene3D&&TH.Scene3D.resize) TH.Scene3D.resize(g3.width,g3.height); }
  }

  /* player / computer explorer sprite */
  function drawExplorer(e,main,accent,hatCol,time){
    const on=TH.UI.Settings.anim!==false, bob=on?TH.Animation.bobOffset(e.anim):0, cx=e.px+e.w/2, cy=e.py+e.h/2+bob;
    const sw=(on&&e.moving)?Math.sin(e.anim*1.2)*3.4:0;
    ctx.save(); ctx.translate(cx,cy);
    ctx.fillStyle='rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0,13-bob,10,4,0,0,TAU); ctx.fill();
    ctx.fillStyle='#2a2a38'; ctx.fillRect(-5,5,4.2,8+sw*.4); ctx.fillRect(1,5,4.2,8-sw*.4);
    ctx.fillStyle='#4a3020'; ctx.fillRect(-5.4,11+sw*.4,5,2.4); ctx.fillRect(.6,11-sw*.4,5,2.4);
    const back=e.dir==='up', side=(e.dir==='left'||e.dir==='right');
    if(back){ ctx.fillStyle=accent; ctx.beginPath(); ctx.roundRect?ctx.roundRect(-6,-5,12,12,3):ctx.rect(-6,-5,12,12); ctx.fill(); }
    ctx.fillStyle=main; ctx.beginPath(); ctx.roundRect?ctx.roundRect(-7,-6,14,13,4):ctx.rect(-7,-6,14,13); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,.14)'; ctx.fillRect(-6,-5,5,11);
    if(!back){ ctx.fillStyle=accent; ctx.fillRect(side?(e.dir==='left'?5:-8):-8,0,3,8); if(!side) ctx.fillRect(5,0,3,8); }
    ctx.fillStyle=main; ctx.fillRect(-10.5,-4,3.6,10+sw*.5); ctx.fillRect(6.9,-4,3.6,10-sw*.5);
    ctx.fillStyle='#e8c09a'; ctx.beginPath(); ctx.arc(0,-11,6,0,TAU); ctx.fill();
    ctx.fillStyle=hatCol; ctx.fillRect(-9,-14,18,2.8); ctx.beginPath(); ctx.arc(0,-14,5.6,Math.PI,0); ctx.fill(); ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(-5.6,-15,11.2,1.6);
    if(!back){ ctx.fillStyle='#222'; const ex=e.dir==='left'?-2:(e.dir==='right'?2:0); ctx.fillRect(-3+ex,-11,1.8,2.4); ctx.fillRect(1.4+ex,-11,1.8,2.4); }
    ctx.restore();
  }

  function render(dt){
    dt=dt||0.016;
    const s=TH.GameState.State, g=TH.GameState.activeGrid(), T=TH.Maps.T, TS=TH.GameState.TS;
    const theme=s.map.theme, animOn=TH.UI.Settings.anim, CG=TH.CG;
    buildAtlas();
    const rt=performance.now()/1000; const time=animOn?rt:0; /* ANIMATION SETTING: off = frozen clock for every sprite/effect; rt = real clock for gameplay feedback only */
    const zoom=Math.max(.8,Math.min(2.3,canvas.height/430)); s.zoom=zoom;

    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle='#000'; ctx.fillRect(0,0,canvas.width,canvas.height);

    // --- camera: target window (centre on player, clamp to map) + smooth follow (lerp) ---
    const cam=TH.Camera.compute({px:s.player.px+s.player.w/2,py:s.player.py+s.player.h/2},0,0,canvas.width,canvas.height,zoom,s.gw*TS,s.gh*TS);
    if(s.camInit!==s.runId){ s.camX=cam.camX; s.camY=cam.camY; s.camInit=s.runId; }
    const k=1-Math.pow(.0005,dt); s.camX=CG.lerp(s.camX,cam.camX,k); s.camY=CG.lerp(s.camY,cam.camY,k);
    let camX=s.camX, camY=s.camY;
    const sh=s.shake>0?s.shake*14:0; const shx=sh?(Math.random()-.5)*sh:0, shy=sh?(Math.random()-.5)*sh:0;
    const viewW=cam.viewW, viewH=cam.viewH;

    ctx.save();
    ctx.scale(zoom,zoom); ctx.translate(-camX+shx/zoom,-camY+shy/zoom);
    const M=ctx.getTransform();
    const win={x0:camX,y0:camY,x1:camX+viewW,y1:camY+viewH};
    const x0=Math.max(0,Math.floor(camX/TS)), x1=Math.min(s.gw,Math.ceil((camX+viewW)/TS));
    const y0=Math.max(0,Math.floor(camY/TS)), y1=Math.min(s.gh,Math.ceil((camY+viewH)/TS));
    const hz=TH.Themes.THEMES[theme].hazard;
    const items=[]; let tilesDrawn=0, swayDeg=0;

    // ---- pass 1: floors, water, decals, pickups ----
    for(let y=y0;y<y1;y++){
      for(let x=x0;x<x1;x++){
        const cell=g[y][x]; tilesDrawn++;
        const v=s.map.variant[y][x];
        const px=x*TS, py=y*TS;
        if(cell===T.WALL){ items.push({y:y*TS+TS,t:'wall',x,yy:y,v}); continue; }
        if(cell===T.WATER){
          ctx.fillStyle = animOn ? TH.Animation.shimmerColor(time,x,y) : '#1e5f8a'; ctx.fillRect(px,py,TS,TS);
          if(animOn){ ctx.strokeStyle='rgba(200,235,255,.28)'; ctx.lineWidth=1; ctx.beginPath(); const o=Math.sin(time*2+x*1.3+y*.7)*5; ctx.moveTo(px+4,py+14+o*.3); ctx.quadraticCurveTo(px+14,py+10+o,px+22,py+14); ctx.quadraticCurveTo(px+30,py+18-o,px+36,py+14); ctx.stroke();
            if(((x*31+y*17)&7)===0){ ctx.fillStyle='rgba(255,255,255,'+(.25+.25*Math.sin(time*4+x)).toFixed(2)+')'; ctx.fillRect(px+12,py+24,2,2); } }
          const edge=(yy,xx)=>yy>=0&&xx>=0&&yy<s.gh&&xx<s.gw&&g[yy][xx]!==T.WATER&&g[yy][xx]!==T.WALL;
          ctx.fillStyle='rgba(255,255,255,.35)';
          if(edge(y-1,x)) ctx.fillRect(px,py,TS,2.5); if(edge(y+1,x)) ctx.fillRect(px,py+TS-2.5,TS,2.5); if(edge(y,x-1)) ctx.fillRect(px,py,2.5,TS); if(edge(y,x+1)) ctx.fillRect(px+TS-2.5,py,2.5,TS);
          continue;
        }
        const fv = v===3 && ((x*7+y*13)%4===0) ? 3 : v%3;
        ctx.drawImage(atlas.floor[fv],px,py);
        if(cell===T.OBST){ items.push({y:y*TS+TS-4,t:'obst',x,yy:y,v}); }
        else if(cell===T.DOOR){ items.push({y:y*TS+TS-2,t:'door',x,yy:y,v}); }
        else {
          ctx.save(); ctx.translate(px+TS/2,py+TS/2);
          if(cell===T.HAZARD) TH.Sprites2D.hazard(ctx,hz,time);
          else if(cell===T.COIN) TH.Sprites2D.pickup(ctx,'coin',time,x+y);
          else if(cell===T.CLUE) TH.Sprites2D.pickup(ctx,'clue',time,0);
          else if(cell===T.KEY && s.collected.clues>0) TH.Sprites2D.pickup(ctx,'key',time,0);
          else if(cell===T.CHECK) TH.Sprites2D.pickup(ctx,'check',time,0);
          else if(cell===T.TREASURE){ if(TH.GameState.treasureVisible()) TH.Sprites2D.pickup(ctx,'treasure',time,0); }
          ctx.restore();
        }
      }
    }

    // hint path: polyline clipped to the window with Cohen-Sutherland
    if(s.hintFlashT>0 && s.hintFlashPath.length>1){
      ctx.strokeStyle='rgba(255,215,107,.9)'; ctx.lineWidth=5; ctx.lineCap='round'; ctx.setLineDash([10,8]); ctx.lineDashOffset=-rt*30; ctx.beginPath();
      for(let i=1;i<s.hintFlashPath.length;i++){
        const a=s.hintFlashPath[i-1], b=s.hintFlashPath[i];
        const seg=CG.cohenSutherland(a.x*TS+TS/2,a.y*TS+TS/2,b.x*TS+TS/2,b.y*TS+TS/2,win);
        if(seg){ ctx.moveTo(seg[0],seg[1]); ctx.lineTo(seg[2],seg[3]); } else CG.stats.pathClipped++;
      }
      ctx.stroke(); ctx.setLineDash([]); ctx.lineCap='butt';
    }

    // ---- gather entities (with outcode clipping of off-window monsters) ----
    let nearest=null, nearD=1e9;
    s.patrolStates.forEach(ps=>{
      CG.stats.entTotal++;
      const oc=CG.outcode(ps.x,ps.y,{x0:win.x0-30,y0:win.y0-30,x1:win.x1+30,y1:win.y1+30});
      const d=Math.hypot(ps.x-(camX+viewW/2),ps.y-(camY+viewH/2));
      if(d<nearD){ nearD=d; nearest=CG.outcode(ps.x,ps.y,win); }
      if(oc){ CG.stats.entClipped++; return; }
      items.push({y:ps.y+10,t:'mon',ps});
    });
    if(s.ai) items.push({y:s.ai.py+s.ai.h,t:'ai'});
    items.push({y:s.player.py+s.player.h,t:'player'});
    items.sort((a,b)=>a.y-b.y); // painter's algorithm: far (small y) first

    // ---- pass 2: depth-sorted objects ----
    const kindsN=s.worldMode==='mirror'?s.map.obstKindsM:s.map.obstKinds, wallKind=TH.Themes.THEMES[theme].wall;
    for(const it of items){
      if(it.t==='wall'){
        const px=it.x*TS, py=it.yy*TS, v=it.v;
        ctx.drawImage(atlas.wallTop[v],px,py);
        const below=it.yy+1<s.gh?g[it.yy+1][it.x]:T.WALL;
        if(below!==T.WALL){ ctx.drawImage(atlas.wallFront[v],px,py+TS-12); ctx.fillStyle='rgba(0,0,0,.25)'; ctx.fillRect(px,py+TS,TS,5); }
        if(s.map.dual&&s.worldMode==='mirror'){ ctx.fillStyle='rgba(120,190,255,.10)'; ctx.fillRect(px,py,TS,TS); }
      } else if(it.t==='obst'){
        ctx.save(); ctx.translate(it.x*TS+TS/2,it.yy*TS+TS/2);
        if(animOn){ const a=Math.sin(time*1.5+it.x+it.yy)*.04; ctx.rotate(a); swayDeg=a*180/Math.PI; }
        TH.Sprites2D.obstacle(ctx,(kindsN[it.yy][it.x]||'boulder'),time,it.v);
        ctx.restore();
      } else if(it.t==='door'){
        const px=it.x*TS, py=it.yy*TS, open=s.hasKey;
        const col={jungle:['#6a6a58','#8a8a74'],mansion:['#4a2a16','#6a3e22'],pirate:['#5a3a1a','#7a5228'],city:['#6a6e76','#8a8e96'],spacestation:['#3a4660','#5a6a8a'],mirror:['#3a6a9a','#7ac0f0']}[theme];
        ctx.fillStyle='rgba(0,0,0,.3)'; ctx.fillRect(px,py+TS-4,TS,6);
        ctx.fillStyle=col[0]; ctx.fillRect(px+1,py+1,TS-2,TS-2); ctx.fillStyle=col[1]; ctx.fillRect(px+4,py+4,TS-8,TS-8);
        ctx.strokeStyle='rgba(0,0,0,.5)'; ctx.lineWidth=1.5; ctx.strokeRect(px+4,py+4,TS-8,TS-8); ctx.beginPath(); ctx.moveTo(px+TS/2,py+4); ctx.lineTo(px+TS/2,py+TS-4); ctx.stroke();
        ctx.fillStyle=open?'#4aff8a':'#ff4a4a'; ctx.beginPath(); ctx.arc(px+TS/2,py+TS/2,4.2,0,TAU); ctx.fill(); ctx.fillStyle='rgba(255,255,255,.5)'; ctx.fillRect(px+TS/2-1,py+TS/2-1,2,2);
        if(open){ ctx.fillStyle='rgba(74,255,138,.12)'; ctx.fillRect(px,py,TS,TS); }
      } else if(it.t==='mon'){
        const ps=it.ps, cr=TH.Themes.creature(ps.def.kind);
        ctx.save(); ctx.translate(ps.x,ps.y);
        ctx.fillStyle='rgba(0,0,0,.26)'; ctx.beginPath(); ctx.ellipse(0,12*cr.s*.8,11*cr.s*.8,4,0,0,TAU); ctx.fill();
        ctx.globalAlpha=cr.alpha?cr.alpha+Math.sin(time*4+ps.phase)*.12:1;
        TH.Sprites2D.creature(ctx,cr,animOn?ps.anim:0,ps.face,animOn&&ps.speedNow>0);
        ctx.globalAlpha=1;
        if(ps.mode==='chase'){ ctx.fillStyle='#ff3a3a'; ctx.font='bold 14px sans-serif'; ctx.textAlign='center'; ctx.fillText('!',0,-24*cr.s*.8-2); }
        ctx.restore();
      } else if(it.t==='ai'){
        const e=s.ai; ctx.globalAlpha=(s.map.dual&&s.aiWorld!==s.worldMode)?.4:1; drawExplorer(e,'#d9503a','#8a2a1a','#5a1a10',time); ctx.globalAlpha=1;
      } else if(it.t==='player'){
        const p=s.player;
        if(animOn){ // reflection: scale(1,-1) about the feet
          ctx.save(); ctx.globalAlpha=.22; ctx.translate(0,p.py+p.h+14); ctx.scale(1,-1); ctx.translate(0,-(p.py+p.h+14)+0); ctx.translate(0,-(p.py+p.h)*0);
          drawExplorer({px:p.px,py:p.py+p.h-4,w:p.w,h:p.h,dir:p.dir,anim:p.anim,moving:p.moving},'#2a88aa','#1a5a70','#124050',time); ctx.restore(); }
        ctx.globalAlpha=p.invuln>0?.55+.45*Math.sin(rt*30):1; drawExplorer(p,'#3aa0d0','#2a6a8a','#a07030',time); ctx.globalAlpha=1;
      }
    }

    // mirror-world tint inside the window
    if(s.map.dual && s.worldMode==='mirror'){ ctx.fillStyle='rgba(60,120,220,.10)'; ctx.fillRect(camX,camY,viewW,viewH); }
    ctx.restore();
    ctx.setTransform(1,0,0,1,0,0);

    // ---- screen-space lighting / atmosphere ----
    const W=canvas.width,H=canvas.height;
    const pcx=(s.player.px+s.player.w/2-camX)*zoom, pcy=(s.player.py+s.player.h/2-camY)*zoom;
    if(theme==='mansion'){
      const lc=lightCtx; lc.globalCompositeOperation='source-over'; lc.clearRect(0,0,W,H); lc.fillStyle='rgba(4,2,10,.82)'; lc.fillRect(0,0,W,H);
      lc.globalCompositeOperation='destination-out'; const fl=animOn?Math.sin(time*13)*6+Math.sin(time*7.3)*5:0, R=210*zoom/1.9+fl;
      const gr=lc.createRadialGradient(pcx,pcy,R*.15,pcx,pcy,R); gr.addColorStop(0,'rgba(0,0,0,1)'); gr.addColorStop(.6,'rgba(0,0,0,.65)'); gr.addColorStop(1,'rgba(0,0,0,0)'); lc.fillStyle=gr; lc.fillRect(0,0,W,H);
      // candles / lit objects glow stays visible through the darkness
      ctx.drawImage(lightCanvas,0,0);
    } else {
      const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.35,W/2,H/2,Math.max(W,H)*.75);
      const tint={jungle:'rgba(6,30,10,.5)',pirate:'rgba(60,30,0,.32)',city:'rgba(10,12,30,.5)',spacestation:'rgba(0,4,20,.58)',mirror:'rgba(10,20,60,.5)'}[theme];
      gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,tint); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H);
      if(theme==='spacestation'&&animOn){ ctx.fillStyle='rgba(255,60,40,'+(0.02+0.03*Math.sin(time*3)**2)+')'; ctx.fillRect(0,0,W,H); }
      if(theme==='jungle'&&animOn){ ctx.fillStyle='rgba(255,240,150,.045)'; for(let i=0;i<4;i++){ const x=((time*12+i*W/4)%(W+200))-100; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+60,0); ctx.lineTo(x-80,H); ctx.lineTo(x-140,H); ctx.fill(); } }
    }
    if(s.hitFlash>0){ const gr=ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.25,W/2,H/2,Math.max(W,H)*.7); gr.addColorStop(0,'rgba(200,0,0,0)'); gr.addColorStop(1,'rgba(220,20,20,'+Math.min(.7,s.hitFlash*1.6)+')'); ctx.fillStyle=gr; ctx.fillRect(0,0,W,H); }
    if(s.worldFlash>0){ ctx.fillStyle='rgba(160,210,255,'+(s.worldFlash*.7)+')'; ctx.fillRect(0,0,W,H); }

    // ---- statistics for the CG panel ----
    const st=CG.stats;
    st.mode='2d'; st.zoom=zoom; st.camX=camX; st.camY=camY; st.winW=viewW; st.winH=viewH; st.vpW=canvas.width; st.vpH=canvas.height;
    st.tilesDrawn=tilesDrawn; st.tilesTotal=s.gw*s.gh; st.swayDeg=swayDeg; st.matrix=[M.a,M.c,M.e,M.b,M.d,M.f,0,0,1];
    st.nearestCode=nearest===null?null:CG.codeStr(nearest); st.reflect=animOn; st.animOn=animOn; st.alphaOn=true;
    st.px=s.player.px+s.player.w/2; st.py=s.player.py+s.player.h/2; st.bob=animOn?TH.Animation.bobOffset(s.player.anim):0;
    st.hue=(200); st.itemsSorted=items.length;

    renderMinimap(win);
  }

  function renderMinimap(win){
    const s=TH.GameState.State; const T=TH.Maps.T; const TS=TH.GameState.TS;
    if(!TH.UI.Settings.minimap){ mmCanvas.style.display='none'; return; }
    mmCanvas.style.display='block';
    mmCtx.fillStyle='#161a24'; mmCtx.fillRect(0,0,mmCanvas.width,mmCanvas.height);
    const sx=mmCanvas.width/s.gw, sy=mmCanvas.height/s.gh;
    const g=TH.GameState.activeGrid();
    for(let y=0;y<s.gh;y++){
      for(let x=0;x<s.gw;x++){
        const cell=g[y][x];
        const seen=s.visited.has(x+','+y);
        let color;
        if(cell===T.WALL) color = seen?'#5a6178':'#2a2f3c';
        else if(cell===T.WATER) color = seen?'#3a93c4':'#1e3a4d';
        else if(cell===T.OBST) color = seen?'#6a8a5a':'#2c3a26';
        else if(cell===T.DOOR) color = seen?(s.hasKey?'#c9a24a':'#a06a2a'):'#4a3620';
        else if(seen && cell===T.HAZARD) color='#a03a3a';
        else color = seen?'#454c60':'#232838';
        mmCtx.fillStyle=color;
        mmCtx.fillRect(Math.floor(x*sx),Math.floor(y*sy),Math.ceil(sx+1),Math.ceil(sy+1));
      }
    }
    // objective markers appear progressively: clue found -> key, key found -> treasure
    const mark=(x,y,col)=>{ const cx=(x+.5)*sx, cy=(y+.5)*sy, r=Math.max(3.5,sx*.9); mmCtx.fillStyle='#0a0d12'; mmCtx.beginPath(); mmCtx.arc(cx,cy,r+1.5,0,7); mmCtx.fill(); mmCtx.fillStyle=col; mmCtx.beginPath(); mmCtx.arc(cx,cy,r,0,7); mmCtx.fill(); };
    const GS=TH.GameState;
    if(GS.keyVisible()||GS.treasureVisible()) for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++){ const c=g[y][x]; if(c===T.KEY&&GS.keyVisible()) mark(x,y,'#ffd23f'); else if(c===T.TREASURE&&GS.treasureVisible()) mark(x,y,'#ff7bd5'); }
    // view window rectangle: each edge clipped to the minimap with Liang-Barsky
    const clipR={x0:0,y0:0,x1:mmCanvas.width,y1:mmCanvas.height};
    const wx0=win.x0/TS*sx, wy0=win.y0/TS*sy, wx1=win.x1/TS*sx, wy1=win.y1/TS*sy;
    mmCtx.strokeStyle='rgba(255,255,255,.7)'; mmCtx.lineWidth=1; mmCtx.beginPath();
    [[wx0,wy0,wx1,wy0],[wx1,wy0,wx1,wy1],[wx1,wy1,wx0,wy1],[wx0,wy1,wx0,wy0]].forEach(e=>{ const c=TH.CG.liangBarsky(e[0],e[1],e[2],e[3],clipR); if(c){ mmCtx.moveTo(c[0],c[1]); mmCtx.lineTo(c[2],c[3]); } });
    mmCtx.stroke();
    const ppx=s.player.px/TS*sx, ppy=s.player.py/TS*sy;
    mmCtx.fillStyle='#0a0d12'; mmCtx.beginPath(); mmCtx.arc(ppx,ppy,4.5,0,7); mmCtx.fill();
    mmCtx.fillStyle='#5ac0e0'; mmCtx.beginPath(); mmCtx.arc(ppx,ppy,3,0,7); mmCtx.fill();
    if(s.ai){
      const apx=s.ai.px/TS*sx, apy=s.ai.py/TS*sy;
      mmCtx.fillStyle='#0a0d12'; mmCtx.beginPath(); mmCtx.arc(apx,apy,4.5,0,7); mmCtx.fill();
      mmCtx.fillStyle='#e0705a'; mmCtx.beginPath(); mmCtx.arc(apx,apy,3,0,7); mmCtx.fill();
    }
    // monsters flash on the minimap only inside the explored area
    s.patrolStates.forEach(ps=>{ const t=TH.GameState.tileAt(ps.x,ps.y); if(s.visited.has(t.x+','+t.y)){ mmCtx.fillStyle=ps.def.hunter?'#ff4a4a':'#d9a030'; mmCtx.fillRect(ps.x/TS*sx-1.5,ps.y/TS*sy-1.5,3,3); } });
  }

  function minimap3D(cx,cy,r){ renderMinimap({x0:cx-r*1.3,y0:cy-r,x1:cx+r*1.3,y1:cy+r}); }
  window.TH = window.TH || {};
  TH.Renderer = {init, resizeCanvas, render, resetAtlas, minimap3D};
})();
