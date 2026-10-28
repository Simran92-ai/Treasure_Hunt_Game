/* cgpanel.js
 * Live "Computer Graphics concepts" box. Shows which CG concepts the
 * current view is using and their real-time values (read from TH.CG.stats).
 * Can be collapsed in-game or hidden completely from Settings.
 * Exposes: TH.CGPanel = { build, update, refresh }
 */
(function(){
  let el=null, body=null, lastT=0, mode='', rows={};
  const f=(v,d)=>(v===undefined||v===null||isNaN(v))?'-':Number(v).toFixed(d===undefined?2:d);
  const mat3=m=>m?`[${f(m[0])} ${f(m[1])} ${f(m[2])}]\n[${f(m[3])} ${f(m[4])} ${f(m[5])}]\n[${f(m[6])} ${f(m[7])} ${f(m[8])}]`:'-';
  const mat4=m=>{ if(!m) return '-'; let o=''; for(let r=0;r<4;r++) o+=`[${f(m[r],2)} ${f(m[4+r],2)} ${f(m[8+r],2)} ${f(m[12+r],2)}]\n`; return o; };

  const C2D=[
    ['Animation (setting)','Settings → Animations ON/OFF drives the time clock of every effect',s=>s.animOn===false?'OFF: clock frozen at t=0 — water, sway, bob, spin, flicker, particles all still':'ON: live clock — water flow, sway, walk/bob, spin, flicker, particles moving'],
    ['Transformations','Translate + scale + rotate: world → screen',s=>`cam (${f(s.camX,0)},${f(s.camY,0)}) zoom ${f(s.zoom)}x\nsway ${f(s.swayDeg,1)}° bob ${f(s.bob)}`],
    ['3×3 Homogeneous Matrix','M = T(view)·S(zoom)·R(sway)',s=>mat3(s.matrix),true],
    ['Windowing → Viewport','World window mapped to screen viewport',s=>`window ${f(s.winW,0)}×${f(s.winH,0)} → viewport ${f(s.vpW,0)}×${f(s.vpH,0)}`],
    ['Clipping (Cohen–Sutherland)','Only tiles inside the window are drawn',s=>`tiles ${s.tilesDrawn||0}/${s.tilesTotal||0}\nnearest outcode ${s.nearestCode===undefined?'-':s.nearestCode}`],
    ['Line clipping (Liang–Barsky)','Minimap view-rectangle + hint paths',s=>`hint/minimap lines clipped to window`],
    ['Bresenham line (LOS)','Monster line-of-sight rays vs walls',s=>`rays/frame ${s.losRays||0}\nlast: ${s.lastLOS===undefined?'-':(s.lastLOS?'visible':'blocked')}`],
    ['Collision (AABB)','Player/monsters vs tiles',s=>`tests/frame ${s.collTests||0}`],
    ['Painter\'s algorithm','Depth-sorted sprites back→front',s=>`sorted ${s.itemsSorted||0} items`],
    ['Reflection','Mirror World mirrors X axis (scale -1)',s=>s.reflect?'ACTIVE: S(-1,1)':'inactive (normal world)'],
    ['Interpolation','Smooth camera = lerp, bob = sine',s=>`lerp k≈0.1  position (${f(s.px,1)},${f(s.py,1)})`],
    ['Alpha blending & lighting','Water, shadows, flashlight radial gradient',s=>`water alpha, shadow ellipses, light radial`],
    ['A* pathfinding','AI + patrol routes on tile graph',s=>`AI paths computed ${s.pathsComputed||0}`]
  ];
  const C3D=[
    ['Animation (setting)','Settings → Animations ON/OFF drives the time clock of every effect',s=>s.animOn===false?'OFF: clock frozen at t=0 — water, sway, bob, spin, flicker, particles all still':'ON: live clock — water flow, sway, walk/bob, spin, flicker, particles moving'],
    ['Perspective projection','View frustum, FOV, near/far clip',s=>`fov ${f(s.fov,0)}° aspect ${f(s.aspect)}\nnear ${f(s.near)} far ${f(s.far,0)}`],
    ['View matrix (4×4)','Camera orbit: lookAt(eye, target, up)',s=>mat4(s.view),true],
    ['Camera transform','Rotation about Y (Q/E, drag), zoom',s=>`yaw ${f(s.yaw*57.3,0)}° pitch ${f(s.pitch*57.3,0)}° dist ${f(s.dist,1)}\neye (${(s.cam||[]).map(v=>f(v,1)).join(', ')})`],
    ['Model transforms','Hierarchical rigs: T·R·S per limb',s=>`draw calls ${s.drawCalls||0}\ntriangles ${(s.tris||0).toLocaleString()}`],
    ['Frustum culling','AABB vs 6 planes, chunk-level',s=>`chunks ${s.chunksDrawn||0}/${s.chunksTotal||0}`],
    ['PBR lighting (GGX)','Diffuse + specular + Fresnel, ${n} point lights',s=>`point lights ${s.lights||0} + sun\nexposure ${f(s.exposure)}`],
    ['Shadow mapping','Depth pass from sun, PCF 3×3 filter',s=>`map ${s.shadowSize||'-'}² · ${s.shadowCalls||0} casters`],
    ['Texture mapping','Procedural tiling, normal maps, mipmaps',s=>`albedo + normal + emissive per surface`],
    ['Fog & atmosphere','Exponential depth fog + sky shader',s=>`density ${f(s.fogDen,3)}`],
    ['Anti-aliasing','MSAA multisample framebuffer',s=>`${s.msaa||0}× samples`],
    ['Bloom & tone mapping','HDR → ACES filmic curve',s=>`${s.hdr?'HDR16f':'LDR'} · bloom ${f(s.bloom)}`],
    ['Hidden surface removal','Z-buffer depth test',s=>`render ${f(s.renderMs,1)} ms`],
    ['Bresenham / A*','Monster LOS & AI pathing (shared logic)',s=>`rays ${s.losRays||0} · paths ${s.pathsComputed||0}`]
  ];

  function build(){
    el=document.getElementById('cgPanel'); if(!el) return;
    el.innerHTML='<div class="cg-head"><b>CG CONCEPTS · LIVE</b><span class="cg-mode" id="cgMode"></span><button class="cg-min" id="cgMin" aria-label="Collapse">&minus;</button></div><div class="cg-body" id="cgBody"></div>';
    body=document.getElementById('cgBody'); mode=''; rows={};
    document.getElementById('cgMin').onclick=()=>{ el.classList.toggle('collapsed'); document.getElementById('cgMin').innerHTML=el.classList.contains('collapsed')?'+':'&minus;'; };
    if(window.innerWidth<=1024) el.classList.add('collapsed');
    refresh();
  }
  function refresh(){
    if(!el) el=document.getElementById('cgPanel'); if(!el) return;
    const on=TH.UI.Settings.cgPanel!==false && TH.GameState.State.running;
    el.style.display=on?'block':'none';
  }
  function layout(m){
    mode=m; rows={}; body.innerHTML='';
    (m==='3d'?C3D:C2D).forEach((c,i)=>{
      const d=document.createElement('div'); d.className='cg-row';
      d.innerHTML=`<div class="cg-t">${c[0]}</div><div class="cg-d">${c[1].replace('${n}','4')}</div><pre class="cg-v"></pre>`;
      body.appendChild(d); rows[i]=d.querySelector('.cg-v');
    });
    document.getElementById('cgMode').textContent=m==='3d'?'3D':'2D';
  }
  function update(){
    if(!el||!body) return; refresh();
    const now=performance.now(); if(now-lastT<160) return; lastT=now;
    if(el.style.display==='none'||el.classList.contains('collapsed')) return;
    const st=TH.CG.stats, m=(TH.Scene3D&&TH.Scene3D.active)?'3d':'2d';
    if(m!==mode) layout(m);
    (m==='3d'?C3D:C2D).forEach((c,i)=>{ try{ const t=c[2](st); if(rows[i].textContent!==t) rows[i].textContent=t; }catch(e){} });
  }
  window.TH=window.TH||{};
  TH.CGPanel={build,update,refresh};
})();
