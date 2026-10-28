/* scene3d.js
 * Builds and renders the realistic 3D version of the current level with the
 * hand-written WebGL2 engine (gl3d.js): themed PBR materials, merged static
 * level geometry in frustum-culled chunks, animated water, cascade-free
 * shadow map following the player, dynamic lights, particles, post-process.
 * Exposes: TH.Scene3D = { supported, ensure, invalidate, resize, render,
 *                          rotate, onWorldSwitch, active }
 */
(function(){
  const E=TH.GL, G=E.G, M=E.m4, CG=()=>TH.CG;
  const TAU=Math.PI*2, CHUNK=8;
  const S3={ active:false, built:null, yaw:0, pitch:1.0, dist:8.4, ready:false };
  let supportedCache=null, pendingSize=null, gl=null, prims=null, mats=null, themeBuilt='';
  const cam={ target:[0,0,0], init:false };
  const hex=TH.Rigs3D.hex;

  S3.supported=function(){
    if(supportedCache!==null) return supportedCache;
    try{ const c=document.createElement('canvas'); supportedCache=!!c.getContext('webgl2'); }catch(e){ supportedCache=false; }
    return supportedCache;
  };

  /* ---------------- environments (per theme: lighting, sky, fog, post) ---------------- */
  const norm=v=>{ const l=Math.hypot(...v); return v.map(x=>x/l); };
  const ENV={
    jungle:{ sunDir:norm([-.5,.62,.6]), sunCol:[3.4,2.7,1.8], skyTop:[.14,.36,.78], skyHor:[.95,.78,.52], ground:[.07,.12,.05], fogCol:[.42,.55,.4], fogDen:.034, clouds:.55, stars:0, ambMul:1.0,
      post:{exposure:1.05,tint:[1.02,1.02,.96],sat:1.14,bloom:.45,vig:.5}, lantern:null, particle:{color:[.8,1,.35],n:120,size:70,type:'firefly'}, moods:'afternoon' },
    mansion:{ sunDir:norm([.45,.55,-.55]), sunCol:[.5,.62,1.35], skyTop:[.008,.012,.045], skyHor:[.06,.07,.16], ground:[.01,.01,.02], fogCol:[.035,.035,.07], fogDen:.075, clouds:0, stars:.9, ambMul:.55,
      post:{exposure:1.15,tint:[.94,.96,1.06],sat:.95,bloom:.7,vig:.75}, lantern:{col:[1,.66,.3],rad:8.5}, particle:{color:[1,.9,.7],n:150,size:40,type:'dust'} },
    pirate:{ sunDir:norm([.8,.3,.4]), sunCol:[4.4,2.4,1.1], skyTop:[.16,.26,.58], skyHor:[1.05,.55,.3], ground:[.1,.08,.05], fogCol:[.78,.5,.38], fogDen:.024, clouds:.75, stars:0, ambMul:1.0,
      waterDeep:[.015,.1,.2], waterShallow:[.12,.5,.55], post:{exposure:1.0,tint:[1.04,1,.94],sat:1.15,bloom:.55,vig:.5}, lantern:null, particle:{color:[1,.9,.7],n:90,size:34,type:'spray'} },
    city:{ sunDir:norm([.35,.5,.75]), sunCol:[.6,.7,1.3], skyTop:[.03,.05,.14], skyHor:[.42,.22,.24], ground:[.03,.03,.04], fogCol:[.11,.1,.17], fogDen:.04, clouds:.2, stars:.45, ambMul:.75,
      post:{exposure:1.15,tint:[1,.98,1.04],sat:1.05,bloom:.65,vig:.65}, lantern:{col:[1,.85,.6],rad:6}, particle:{color:[1,.7,.4],n:100,size:34,type:'ember'} },
    spacestation:{ sunDir:norm([.25,.85,.4]), sunCol:[.9,1.0,1.5], skyTop:[.004,.006,.02], skyHor:[.02,.03,.08], ground:[.005,.007,.015], fogCol:[.012,.018,.045], fogDen:.04, clouds:0, stars:1, ambMul:.6,
      post:{exposure:1.2,tint:[.96,1,1.08],sat:1.05,bloom:.8,vig:.7}, lantern:{col:[.5,.8,1],rad:7}, particle:{color:[.5,.9,1],n:110,size:30,type:'spark'} },
    mirror:{ sunDir:norm([-.35,.55,.65]), sunCol:[1.3,.95,2.1], skyTop:[.05,.04,.2], skyHor:[.55,.26,.6], ground:[.02,.02,.06], fogCol:[.18,.12,.32], fogDen:.032, clouds:.25, stars:.6, aurora:.9, auroraCol:[.2,.9,.7], ambMul:.9,
      post:{exposure:1.1,tint:[1,.98,1.08],sat:1.12,bloom:.8,vig:.6}, lantern:{col:[.7,.6,1],rad:7}, particle:{color:[.7,.85,1],n:130,size:36,type:'mote'} }
  };

  /* ---------------- materials ---------------- */
  function buildMaterials(theme){
    const T3=TH.Tex3D;
    const tm=(name,o)=>{ const t=T3.get(name); return Object.assign({tex:t.albedo,nrm:t.normal,emi:t.emi,uv:[.5,.5]},o||{}); };
    const m={
      paint:{rough:.55}, paintMetal:{rough:.35,metal:.85}, paintGloss:{rough:.16}, paintRough:{rough:.92},
      glow:{unlit:1}, glass:{alpha:.4,rough:.05,color:[.7,.85,1],blend:true}, glassC:{alpha:.38,rough:.04,color:[.6,.85,1],emissive:[.02,.07,.12],blend:true},
      gold:{color:[1,.76,.28],rough:.28,metal:.95}
    };
    m.bark=tm('bark',{uv:[1.2,.8],rough:.9}); m.foliage=tm('foliage',{uv:[1.4,1.4],rough:.72,sway:.8,twoSided:1,nrmStr:.8});
    m.woodM=tm('wood',{uv:[1,1],rough:.62}); m.woodDark=tm('wood',{uv:[1,1],rough:.68,color:[.5,.38,.32]});
    m.rock=tm('rock',{uv:[.9,.9],rough:.85}); m.moss=tm('moss',{uv:[.7,.7],rough:.9}); m.stoneM=tm('stone',{uv:[.8,.8],rough:.85});
    m.metalM=tm('brushed',{uv:[1,1],rough:.38,metal:.8}); m.brushedM=m.metalM;
    m.crystalM=tm('crystal',{uv:[1,1],rough:.1,metal:.2,emissive:[.03,.07,.12],nrmStr:1.5});
    m.crystalP=tm('crystal',{uv:[1,1],rough:.1,metal:.2,color:[1.5,.7,1.9],emissive:[.07,.02,.12]});
    // level surfaces
    const fl=(n,o)=>tm(n,Object.assign({uv:[.34,.34],rough:.8},o||{}));
    const floors={ jungle:[fl('grass'),fl('grass'),fl('grass'),fl('grass',{color:[.82,.74,.6]})],
      mansion:[fl('planks',{rough:.45}),fl('planks',{rough:.45}),fl('carpet',{rough:.95,uv:[.5,.5]}),fl('planks',{rough:.45,color:[.8,.75,.7]})],
      pirate:[fl('sand',{rough:.95}),fl('sand',{rough:.95}),fl('sand',{rough:.95}),fl('sand',{rough:.95,color:[.8,.72,.6]})],
      city:[fl('asphalt',{rough:.75}),fl('asphalt',{rough:.75}),fl('concrete',{rough:.85}),fl('asphalt',{rough:.5,color:[.85,.85,.9]})],
      spacestation:[fl('metal',{rough:.4,metal:.7,uv:[.5,.5]}),fl('metal',{rough:.4,metal:.7,uv:[.5,.5]}),fl('metal',{rough:.4,metal:.7,uv:[.5,.5],color:[.85,.9,1]}),fl('hull',{rough:.35,metal:.7,uv:[.5,.5]})],
      mirror:[fl('glass',{rough:.12,metal:.3,uv:[.3,.3]}),fl('glass',{rough:.12,metal:.3,uv:[.3,.3]}),fl('glass',{rough:.1,metal:.35,uv:[.3,.3],color:[1.2,1.1,1.4]}),fl('glass',{rough:.12,metal:.3,uv:[.3,.3]})] }[theme];
    m.floors=floors;
    const walls={ jungle:{side:tm('moss',{uv:[.5,.5],rough:.9}),top:tm('moss',{uv:[.6,.6],rough:.9})},
      mansion:{side:tm('wallpaper',{uv:[.5,.45],rough:.85}),top:tm('wood',{uv:[1,1],rough:.6,color:[.4,.3,.25]})},
      pirate:{side:tm('cliff',{uv:[.5,.5],rough:.9}),top:tm('cliff',{uv:[.7,.7],rough:.9,color:[1.15,1.1,1]})},
      city:{side:tm('facade',{uv:[.5,.4],rough:.55,metal:.1}),top:tm('concrete',{uv:[.5,.5],rough:.9,color:[.6,.6,.64]})},
      spacestation:{side:tm('hull',{uv:[.5,.5],rough:.35,metal:.75}),top:tm('metal',{uv:[.5,.5],rough:.4,metal:.7})},
      mirror:{side:tm('crystal',{uv:[.45,.45],rough:.12,metal:.25,emissive:[.02,.05,.1]}),top:tm('crystal',{uv:[.6,.6],rough:.1,metal:.25,color:[1.2,1.2,1.3]})} }[theme];
    m.wallSide=walls.side; m.wallTop=walls.top;
    m.water={water:true,nrm:T3.get('waterN').normal};
    m.ground=tm(theme==='city'?'asphalt':theme==='mansion'?'planks':theme==='spacestation'?'metal':theme==='pirate'?'sand':theme==='mirror'?'glass':'grass',{uv:[.2,.2],rough:.9,color:[.55,.55,.55]});
    m.door=tm({jungle:'stone',mansion:'wood',pirate:'wood',city:'brushed',spacestation:'hull',mirror:'crystal'}[theme],{uv:[1,1],rough:.5,metal:theme==='city'||theme==='spacestation'?.7:0});
    return m;
  }

  /* ---------------- helpers ---------------- */
  const rngMake=seed=>{ let a=seed|0; return ()=>{ a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; };
  const _m=new Float32Array(16), _a=new Float32Array(16), _b=new Float32Array(16);
  function hash3(x,y,z){ let h=(Math.floor(x)*374761393+Math.floor(y)*668265263+Math.floor(z)*2147483647)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
  function noise3(x,y,z){ const xi=Math.floor(x),yi=Math.floor(y),zi=Math.floor(z),fx=x-xi,fy=y-yi,fz=z-zi,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),sz=fz*fz*(3-2*fz); const L=(a,b,t)=>a+(b-a)*t;
    return L(L(L(hash3(xi,yi,zi),hash3(xi+1,yi,zi),sx),L(hash3(xi,yi+1,zi),hash3(xi+1,yi+1,zi),sx),sy),L(L(hash3(xi,yi,zi+1),hash3(xi+1,yi,zi+1),sx),L(hash3(xi,yi+1,zi+1),hash3(xi+1,yi+1,zi+1),sx),sy),sz); }

  /* chunked static batcher */
  function Batch(){ this.chunks=new Map(); this.lights=[]; }
  Batch.prototype.add=function(key,g,cx,cz){
    const ci=Math.floor(cx/CHUNK), cj=Math.floor(cz/CHUNK), id=ci+','+cj;
    let ch=this.chunks.get(id); if(!ch){ ch={ci,cj,mats:new Map()}; this.chunks.set(id,ch); }
    let acc=ch.mats.get(key); if(!acc){ acc=G.empty(); ch.mats.set(key,acc); }
    G.append(acc,g);
  };
  Batch.prototype.finish=function(mats){
    const out=[];
    this.chunks.forEach(ch=>{
      const rec={x0:ch.ci*CHUNK,z0:ch.cj*CHUNK,x1:(ch.ci+1)*CHUNK,z1:(ch.cj+1)*CHUNK,opaque:[],blend:[],minY:0,maxY:6};
      ch.mats.forEach((g,key)=>{ if(!g.i.length) return; const mat=mats[key]||mats.paint; const mesh=E.createMesh(g); (mat.blend||mat.water?rec.blend:rec.opaque).push({mesh,mat,key}); });
      out.push(rec);
    });
    return out;
  };

  // model-part builder for obstacle recipes
  function PartBuilder(batch,cx,cz,ry0,sc0,rng,lights){
    const base=new Float32Array(16); M.parts(base,cx,0,cz,0,ry0,0,sc0,sc0,sc0);
    const place=(g,tx,ty,tz,rx,ry,rz,opt)=>{
      M.parts(_a,tx,ty,tz,rx||0,ry||0,rz||0,1,1,1); M.mul(_b,base,_a);
      const t=opt&&opt.tint; if(t) G.tint(g,t[0],t[1],t[2]);
      return G.xf(g,_b);
    };
    this.rng=rng;
    this.box=(key,w,h,d,x,y,z,o)=>{ o=o||{}; batch.add(key,place(G.box(w,h,d,1),x,y+h/2,z,o.rx,o.ry,o.rz,o),cx,cz); };
    this.cyl=(key,rt,rb,h,x,y,z,o)=>{ o=o||{}; batch.add(key,place(G.cyl(rt,rb,h,o.seg||10),x,y+h/2,z,o.rx,o.ry,o.rz,o),cx,cz); };
    this.cone=(key,r,h,x,y,z,o)=>{ o=o||{}; batch.add(key,place(G.cone(r,h,o.seg||8),x,y+h/2,z,o.rx,o.ry,o.rz,o),cx,cz); };
    this.sph=(key,r,x,y,z,o)=>{ o=o||{}; const g=G.sphere(r,o.seg||10,Math.max(5,(o.seg||10)*.7|0));
      if(o.sx||o.sy||o.sz){ for(let i=0;i<g.p.length;i+=3){ g.p[i]*=o.sx||1; g.p[i+1]*=o.sy||1; g.p[i+2]*=o.sz||1; } }
      batch.add(key,place(g,x,y,z,o.rx,o.ry,o.rz,o),cx,cz); };
    this.rock=(key,r,x,y,z,o)=>{ o=o||{}; const g=G.sphere(r,12,9); const seed=o.seed||0;
      for(let i=0;i<g.p.length;i+=3){ const nx=g.n[i],ny=g.n[i+1],nz=g.n[i+2]; const d=(noise3(g.p[i]*3+seed,g.p[i+1]*3,g.p[i+2]*3)-.5)*2*(o.amp||.12);
        g.p[i]=(g.p[i]+nx*d)*(o.sx||1); g.p[i+1]=(g.p[i+1]+ny*d)*(o.sy||1); if(g.p[i+1]<-r*.4*(o.sy||1)) g.p[i+1]=-r*.4*(o.sy||1); g.p[i+2]=(g.p[i+2]+nz*d)*(o.sz||1); }
      batch.add(key,place(g,x,y,z,0,rng()*TAU,0,o),cx,cz); };
    this.gem=(key,r,h,x,y,z,o)=>{ o=o||{}; const g=G.gem(r,h); if(o.sy) for(let i=1;i<g.p.length;i+=3) g.p[i]*=o.sy; batch.add(key,place(g,x,y,z,o.rx,o.ry,o.rz,o),cx,cz); };
    this.light=(x,y,z,col,rad)=>{ const p=M.xformPoint(base,x,y,z); lights.push({pos:p,col,rad,flick:0.15}); };
  }

  /* ---------------- level construction ---------------- */
  const WALL_H={ ruinwall:[1.9,2.7], wallpaper:[2.5,2.5], cliff:[1.7,2.7], building:[2.4,4.4], hull:[2.5,2.5], crystalwall:[1.8,3.1] };
  const ROTATABLE=new Set(['tree','bush','boulder','ruin','totem','palm','rock','crystal','statue','spire','shard','orb','tank','reactor','barrel','candles','lamp']);

  function buildWorld(grid,kinds,map,mats,seedAdd){
    const s=TH.GameState.State, T=TH.Maps.T, w=map.w, h=map.h, theme=map.theme, wallKind=TH.Themes.THEMES[theme].wall;
    const rng=rngMake(map.seed+seedAdd), batch=new Batch(), lights=[];
    const solid=(x,y)=>x<0||y<0||x>=w||y>=h||grid[y][x]===T.WALL||grid[y][x]===T.OBST;
    const isW=(x,y)=>x<0||y<0||x>=w||y>=h||grid[y][x]===T.WALL;
    const water=(x,y)=>x>=0&&y>=0&&x<w&&y<h&&grid[y][x]===T.WATER;
    const [wh0,wh1]=WALL_H[wallKind];
    // face helper (4 points CCW from outside, uv given)
    const face=(pts,n,uvs,cols)=>{ const g=G.empty(); pts.forEach((p,i)=>{ g.p.push(...p); g.n.push(...n); g.uv.push(...uvs[i]); g.c.push(...cols[i]); }); g.i.push(0,1,2,0,2,3); return g; };
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      const c=grid[y][x], v=map.variant[y][x];
      if(c===T.WALL){
        const hh=wh0+(wh1-wh0)*(((v*7+x*3+y*5)%5)/4), x0=x,x1=x+1,z0=y,z1=y+1;
        const br=.82+((v*31+x*17+y*13)%9)/9*.3;
        const bot=[br,br,br,.5], top=[br,br,br,1];
        let fSide=wallKind==='building'?'wallSide':'wallSide';
        // side faces only where the neighbour is not a wall
        if(!isW(x,y-1)) batch.add('wallSide',face([[x1,0,z0],[x0,0,z0],[x0,hh,z0],[x1,hh,z0]],[0,0,-1],[[x1,0],[x0,0],[x0,hh],[x1,hh]],[bot,bot,top,top]),x,y);
        if(!isW(x,y+1)) batch.add('wallSide',face([[x0,0,z1],[x1,0,z1],[x1,hh,z1],[x0,hh,z1]],[0,0,1],[[x0,0],[x1,0],[x1,hh],[x0,hh]],[bot,bot,top,top]),x,y);
        if(!isW(x+1,y)) batch.add('wallSide',face([[x1,0,z1],[x1,0,z0],[x1,hh,z0],[x1,hh,z1]],[1,0,0],[[z1,0],[z0,0],[z0,hh],[z1,hh]],[bot,bot,top,top]),x,y);
        if(!isW(x-1,y)) batch.add('wallSide',face([[x0,0,z0],[x0,0,z1],[x0,hh,z1],[x0,hh,z0]],[-1,0,0],[[z0,0],[z1,0],[z1,hh],[z0,hh]],[bot,bot,top,top]),x,y);
        batch.add('wallTop',face([[x0,hh,z1],[x1,hh,z1],[x1,hh,z0],[x0,hh,z0]],[0,1,0],[[x0,z1],[x1,z1],[x1,z0],[x0,z0]],[top,top,top,top]),x,y);
        // roof / top details
        const pb=new PartBuilder(batch,x+.5,y+.5,rng()*TAU,1,rng,lights);
        const base=new Float32Array(16);
        if(wallKind==='building'&&(v+x)%3===0){ const bx=new PartBuilder(batch,x+.5,y+.5,0,1,rng,lights); bx.box('metalM',.4,.22,.4,.1,hh,-.1,{ry:v}); bx.cyl('metalM',.1,.1,.18,-.2,hh,.2,{seg:8}); }
        if(wallKind==='ruinwall'&&v%2===0){ pb.sph('foliage',.3,0,hh+.05,0,{sy:.5,seg:7,tint:[.5+rng()*.3,.8,.4]}); if(v===1){ pb.cyl('moss',.12,.14,.5,.2,hh,.1,{seg:6}); } }
        if(wallKind==='hull'&&v%2===1){ pb.box('glow',.5,.03,.05,0,hh,.3,{tint:[.4,2.2,3]}); }
        if(wallKind==='crystalwall'&&v!==2){ pb.gem('crystalM',.12,.35+rng()*.3,(rng()-.5)*.4,hh+.3,(rng()-.5)*.4,{rz:(rng()-.5)*.4}); }
        if(wallKind==='cliff'&&v%2===0){ pb.rock('rock',.34,0,hh,0,{amp:.1,sy:.6,seed:v}); }
        if(wallKind==='wallpaper'&&(x+y)%5===0&&!isW(x,y+1)){ pb.box('gold',.3,.2,.02,0,hh*.45,.52,{tint:[1,1,1]}); }
        continue;
      }
      // ---- floor (everything except water & walls)
      if(c===T.WATER){
        const cc=(cx,cz)=>{ let land=0; for(const [dx,dz] of [[-1,-1],[0,-1],[-1,0],[0,0]]){ const tx=cx+dx, tz=cz+dz; if(tx<0||tz<0||tx>=w||tz>=h) {land++;continue;} const q=grid[tz][tx]; if(q!==T.WATER) land++; } return land/4; };
        const x0=x,x1=x+1,z0=y,z1=y+1, a=cc(x0,z1),b=cc(x1,z1),cq=cc(x1,z0),d=cc(x0,z0);
        batch.add('water',face([[x0,-.1,z1],[x1,-.1,z1],[x1,-.1,z0],[x0,-.1,z0]],[0,1,0],[[x0,z1],[x1,z1],[x1,z0],[x0,z0]],[[1,1,1,a],[1,1,1,b],[1,1,1,cq],[1,1,1,d]]),x,y);
        batch.add('paint',face([[x0,-.55,z1],[x1,-.55,z1],[x1,-.55,z0],[x0,-.55,z0]],[0,1,0],[[0,0],[1,0],[1,1],[0,1]],[[.04,.1,.12,1],[.04,.1,.12,1],[.04,.1,.12,1],[.04,.1,.12,1]]),x,y);
        // sand lip on the shore edges
        if(!water(x,y-1)&&!isW(x,y-1)) batch.add('paint',face([[x1,-.55,z0],[x0,-.55,z0],[x0,0,z0],[x1,0,z0]],[0,0,1],[[0,0],[1,0],[1,1],[0,1]],[[.1,.1,.08,1],[.1,.1,.08,1],[.3,.28,.22,1],[.3,.28,.22,1]]),x,y);
        if(!water(x,y+1)&&!isW(x,y+1)) batch.add('paint',face([[x0,-.55,z1],[x1,-.55,z1],[x1,0,z1],[x0,0,z1]],[0,0,-1],[[0,0],[1,0],[1,1],[0,1]],[[.1,.1,.08,1],[.1,.1,.08,1],[.3,.28,.22,1],[.3,.28,.22,1]]),x,y);
        continue;
      }
      const fv = v===3 && ((x*7+y*13)%4===0) ? 3 : v%3, tintK=.92+rng()*.16;
      const ao=(cx,cz)=>{ // corner ambient occlusion from the three neighbouring tiles
        const e1=solid(cx,cz)?1:0; return 0; };
      const corner=(sx,sz)=>{ // sx,sz in {-1,1}: which corner of the tile
        const nx=x+sx, nz=y+sz; const e1=solid(nx,y)?1:0, e2=solid(x,nz)?1:0, dg=solid(nx,nz)?1:0;
        return 1-.34*(e1+e2)-.18*dg*(e1||e2?0:1); };
      const a0=corner(-1,1),a1=corner(1,1),a2=corner(1,-1),a3=corner(-1,-1);
      const k=tintK;
      batch.add('floor'+fv,face([[x,0,y+1],[x+1,0,y+1],[x+1,0,y],[x,0,y]],[0,1,0],[[x,y+1],[x+1,y+1],[x+1,y],[x,y]],[[k,k,k,a0],[k,k,k,a1],[k,k,k,a2],[k,k,k,a3]]),x,y);
      if(c===T.OBST){
        const kind=(kinds&&kinds[y][x])||'boulder';
        const ry0=ROTATABLE.has(kind)?rng()*TAU:0, sc0=.92+rng()*.2;
        const pb=new PartBuilder(batch,x+.5,y+.5,ry0,sc0,rng,lights);
        TH.Rigs3D.obstacle(kind,pb,v,rng);
      }
    }
    return {chunks:batch.finish(mats),lights};
  }

  /* ---------------- scene construction / lifecycle ---------------- */
  S3.invalidate=function(){ S3.built=null; };
  function disposeBuilt(){
    const b=S3.built; if(!b) return;
    ['normal','mirror'].forEach(k=>{ if(b.worlds[k]) b.worlds[k].chunks.forEach(c=>{ c.opaque.concat(c.blend).forEach(p=>E.freeMesh(p.mesh)); }); });
    if(b.ground) E.freeMesh(b.ground);
  }

  S3.ensure=function(){
    if(!E.ok){ if(!E.init(document.getElementById('gl3d'),TH.UI.Settings.quality)){ TH.UI.toast('3D could not start (WebGL2 error)'); supportedCache=false; TH.Game.applyView(); return; } gl=E.gl; makePrims(); if(pendingSize) E.resize(pendingSize[0],pendingSize[1]); bindInput(); }
    const s=TH.GameState.State;
    if(E.quality!==TH.UI.Settings.quality){ E.quality=TH.UI.Settings.quality; const c=document.getElementById('gl3d'); E.resize(c.width,c.height); }
    if(S3.built&&S3.built.runId===s.runId) return;
    TH.UI.toast('Building 3D world...',1200);
    disposeBuilt();
    const map=s.map, theme=map.theme;
    if(themeBuilt!==theme){ matCache.clear(); themeBuilt=theme; }
    mats=buildMaterials(theme);
    // material key resolution for batches
    const resolved=Object.assign({},mats);
    for(let i=0;i<4;i++) resolved['floor'+i]=mats.floors[i];
    Object.keys(resolved).forEach(k=>{ const v=resolved[k]; if(v&&!Array.isArray(v)&&typeof v==='object'&&!v.water) v.occl=true; }); mats.floors.forEach(f=>{ f.occl=true; });
    resolved.wallSide=mats.wallSide; resolved.wallTop=mats.wallTop; resolved.water=mats.water;
    const worlds={};
    worlds.normal=buildWorld(s.grid,map.obstKinds,map,resolved,1);
    if(map.dual) worlds.mirror=buildWorld(s.mirrorGridLive,map.obstKindsM,map,resolved,2);
    // large ground plane so nothing but the level is ever seen
    const gp=G.plane(300,300,300,300,-.03); for(let i=0;i<gp.p.length;i+=3){ gp.p[i]+=map.w/2; gp.p[i+2]+=map.h/2; } gp.uv=[]; for(let i=0;i<4;i++){ gp.uv.push(gp.p[i*3],gp.p[i*3+2]); }
    G.tint(gp,.7,.7,.7);
    S3.built={runId:s.runId,worlds,ground:E.createMesh(gp),mats:resolved,theme,doorAnim:s.hasKey?1:0};
    S3.env=Object.assign({},ENV[theme]); E.env=S3.env;
    makeParticles(theme);
    cam.init=false; S3.yaw=0; S3.pitch=1.0; S3.dist=theme==='city'?9:8.4;
    creatureRigs=new Map(); playerRig=TH.Rigs3D.explorer('player'); aiRig=TH.Rigs3D.explorer('ai');
    S3.ready=true;
  };

  S3.resize=function(w,h){ pendingSize=[w,h]; if(E.ok) E.resize(w,h); };
  S3.rotate=function(d){ S3.yaw+=d; };
  S3.onWorldSwitch=function(){};

  /* ---------------- primitives & dynamic drawing ---------------- */
  function makePrims(){
    prims={ box:E.createMesh(G.box(1,1,1,1)), sph:E.createMesh(G.sphere(.5,14,10)), cyl:E.createMesh(G.cyl(.5,.5,1,14)), cone:E.createMesh(G.cone(.5,1,12)),
      gem:E.createMesh(G.gem(.5,.5)), torus:E.createMesh(G.torus(.5,.08,18,8)), disc:E.createMesh(G.cyl(.5,.5,1,18)) };
  }
  const matCache=new Map();
  function cmat(n){
    const base=(mats&&mats[n.mat])||(mats&&mats.paint)||{};
    const key=[n.mat,n.col.join(','),n.rough,n.metal,n.em&&n.em.join(','),n.alpha,n.unlit,n.rim,n.twoSided].join('|');
    let m=matCache.get(key); if(m) return m;
    m=Object.assign({},base,{color:n.col.slice(),rough:n.rough!=null?n.rough:(base.rough!=null?base.rough:.6),metal:n.metal!=null?n.metal:(base.metal||0),
      emissive:n.em||base.emissive||[0,0,0],alpha:n.alpha<1?n.alpha:(base.alpha||1),unlit:n.unlit||base.unlit||0,rim:n.rim||0,twoSided:n.twoSided||0,tex:null,nrm:null,emi:null,occl:false});
    if(n.alpha<1||base.blend) m.blend=true; matCache.set(key,m); return m;
  }
  const rigS={ drawPrim:(name,mat,model)=>{ E.draw(prims[name],mat,model); }, cmat };
  const simple=(name,col,opt,model)=>{ const key='s|'+name+col.join(',')+JSON.stringify(opt||{}); let m=matCache.get(key); if(!m){ m=Object.assign({color:col,rough:.5},opt||{}); matCache.set(key,m); } E.draw(prims[name],m,model); };
  function model(tx,ty,tz,rx,ry,rz,sx,sy,sz){ return M.parts(new Float32Array(16),tx,ty,tz,rx,ry,rz,sx,sy,sz); }
  const _M=new Float32Array(16);
  function sprim(pass,name,col,opt,tx,ty,tz,rx,ry,rz,sx,sy,sz){
    M.parts(_M,tx,ty,tz,rx,ry,rz,sx,sy,sz);
    if(pass==='shadow'){ if(opt&&(opt.unlit||opt.alpha<1)) return; E.draw(prims[name],null,_M); return; }
    const isB=opt&&(opt.alpha<1||opt.blend); if(pass==='opaque'&&isB) return; if(pass==='blend'&&!isB) return;
    simple(name,col,opt,_M);
  }

  let creatureRigs=new Map(), playerRig=null, aiRig=null, dynLights=[];
  const heading=new WeakMap();

  /* ---------------- particles ---------------- */
  let part=null;
  function makeParticles(theme){
    const cfg=ENV[theme].particle; const n=cfg.n; part={n,cfg,data:new Float32Array(n*7),vel:new Float32Array(n*3),ph:new Float32Array(n)};
    for(let i=0;i<n;i++){ part.ph[i]=Math.random(); part.data[i*7]=(Math.random()-.5)*26; part.data[i*7+1]=Math.random()*6; part.data[i*7+2]=(Math.random()-.5)*26; part.vel[i*3]=(Math.random()-.5)*.3; part.vel[i*3+1]=(Math.random()-.3)*.3; part.vel[i*3+2]=(Math.random()-.5)*.3; part.data[i*7+3]=cfg.size*(.5+Math.random()); part.data[i*7+4]=.4+Math.random()*.6; part.data[i*7+5]=Math.random(); part.data[i*7+6]=0; }
    part.init=false;
  }
  function updateParticles(dt,px,pz){
    const p=part, d=p.data, v=p.vel, t=E.time, type=p.cfg.type;
    for(let i=0;i<p.n;i++){
      const o=i*7; if(!p.init){ d[o]=px+(Math.random()-.5)*26; d[o+2]=pz+(Math.random()-.5)*26; }
      let vx=v[i*3],vy=v[i*3+1],vz=v[i*3+2];
      if(type==='firefly'){ vx+=Math.sin(t*1.3+p.ph[i]*20)*.01; vz+=Math.cos(t*1.1+p.ph[i]*17)*.01; vy+=Math.sin(t*.9+p.ph[i]*9)*.006; }
      if(type==='ember'||type==='spark'){ vy+=.004; }
      d[o]+=vx*dt; d[o+1]+=vy*dt; d[o+2]+=vz*dt;
      if(d[o+1]>6.5) d[o+1]=.1; if(d[o+1]<.05) d[o+1]=6;
      if(d[o]-px>13) d[o]-=26; else if(d[o]-px<-13) d[o]+=26; if(d[o+2]-pz>13) d[o+2]-=26; else if(d[o+2]-pz<-13) d[o+2]+=26;
    }
    p.init=true;
  }

  /* ---------------- input (drag to orbit, wheel to zoom) ---------------- */
  let inputBound=false;
  function bindInput(){
    if(inputBound) return; inputBound=true; const c=document.getElementById('gl3d'); let drag=null;
    c.addEventListener('pointerdown',e=>{ drag={x:e.clientX,y:e.clientY}; c.setPointerCapture&&c.setPointerCapture(e.pointerId); });
    c.addEventListener('pointermove',e=>{ if(!drag) return; S3.yaw-=(e.clientX-drag.x)*.008; S3.pitch=Math.max(.55,Math.min(1.35,S3.pitch+(e.clientY-drag.y)*.005)); drag={x:e.clientX,y:e.clientY}; });
    const up=()=>{ drag=null; }; c.addEventListener('pointerup',up); c.addEventListener('pointercancel',up);
    c.addEventListener('wheel',e=>{ e.preventDefault(); S3.dist=Math.max(5,Math.min(14,S3.dist+e.deltaY*.005)); },{passive:false});
  }

  /* ---------------- per-frame ---------------- */
  const vtmp=new Float32Array(16);
  function drawChunks(list,which,cullPlanes,shadowC,shadowR){
    let n=0;
    for(const ch of list){
      if(shadowC){ const dx=(ch.x0+ch.x1)/2-shadowC[0], dz=(ch.z0+ch.z1)/2-shadowC[2]; if(Math.hypot(dx,dz)>shadowR+7) continue; }
      else { E.stats.chunksTotal++; if(cullPlanes&&!M.aabbInFrustum(cullPlanes,[ch.x0,-1,ch.z0],[ch.x1,6,ch.z1])) continue; E.stats.chunksDrawn++; }
      for(const p of ch[which]){ if(shadowC&&(p.mat.unlit||p.mat.blend||p.mat.water)) continue; E.draw(p.mesh,p.mat,null); n++; }
    }
    return n;
  }

  function dynamicPass(pass,s,tt,cx,cz){
    const TS=TH.GameState.TS, T=TH.Maps.T, g=TH.GameState.activeGrid(), theme=s.map.theme, hz=TH.Themes.THEMES[theme].hazard;
    // ---- characters
    const px=(s.player.px+s.player.w/2)/TS, pz=(s.player.py+s.player.h/2)/TS;
    const drawChar=(rig,x,z,mv,hd,alpha)=>{
      rig.anim(tt,TH.UI.Settings.anim!==false?mv:0,rig.phase);
      M.parts(vtmp,x,0,z,0,hd,0,rig.scale,rig.scale,rig.scale);
      if(alpha<1&&pass==='opaque') return;
      TH.Rigs3D.drawRig(rig,vtmp,pass,rigS);
    };
    if(S3._pHd===undefined) S3._pHd=0;
    const blink=s.player.invuln>0&&Math.floor(performance.now()/1000*14)%2===0; /* damage blink is gameplay feedback, stays on */
    if(!blink) drawChar(playerRig,px,pz,s.player.moving?1:0,S3._pHd,1);
    if(s.ai){ const ax=(s.ai.px+s.ai.w/2)/TS, az=(s.ai.py+s.ai.h/2)/TS; if(S3._aHd===undefined) S3._aHd=0; drawChar(aiRig,ax,az,s.ai.moving?1:0,S3._aHd,1); }
    s.patrolStates.forEach((ps,i)=>{
      let rig=creatureRigs.get(i); if(!rig){ rig=TH.Rigs3D.creature(ps.def.kind); creatureRigs.set(i,rig); }
      const x=ps.x/TS, z=ps.y/TS; const dx=x-(rig._lx===undefined?x:rig._lx), dz=z-(rig._lz===undefined?z:rig._lz);
      if(Math.hypot(dx,dz)>.0008){ const target=Math.atan2(dx,dz); let d=target-(rig._hd||0); while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; rig._hd=(rig._hd||0)+d*.25; }
      if(pass==='opaque'||pass==='shadow'){ rig._lx=x; rig._lz=z; }
      const hd=rig._hd||0; const dist=Math.hypot(x-cx,z-cz); if(dist>22) return;
      rig.anim(tt,TH.UI.Settings.anim!==false?(ps.speedNow>0?1:0.2):0,rig.phase);
      M.parts(vtmp,x,0,z,0,hd,0,rig.scale,rig.scale,rig.scale);
      TH.Rigs3D.drawRig(rig,vtmp,pass,rigS);
      if(pass==='opaque'&&ps.mode==='chase') sprim('opaque','sph',[3,.2,.15],{unlit:1},x,1.4*rig.scale+.35,z,0,0,0,.14,.14,.14);
    });
    // ---- pickups, hazards, doors (only near the camera target)
    const R=15, x0=Math.max(0,Math.floor(cx-R)), x1=Math.min(s.gw,Math.ceil(cx+R)), z0=Math.max(0,Math.floor(cz-R)), z1=Math.min(s.gh,Math.ceil(cz+R));
    for(let z=z0;z<z1;z++) for(let x=x0;x<x1;x++){
      const c=g[z][x]; if(c===T.FLOOR||c===T.WALL||c===T.OBST||c===T.WATER) continue;
      const wx=x+.5, wz=z+.5, ph=(x*3+z*5);
      if(c===T.COIN){ const y=.5+Math.sin(tt*2.4+ph)*.07; sprim(pass,'cyl',[1,.8,.22],{rough:.25,metal:.95,emissive:[.35,.22,0]},wx,y,wz,Math.PI/2,tt*3+ph,0,.34,.06,.34); }
      else if(c===T.CLUE){ const y=.62+Math.sin(tt*2.2)*.06; sprim(pass,'cyl',[.93,.88,.7],{rough:.9,emissive:[.12,.1,.05]},wx,y,wz,0,0,Math.PI/2+.3,.2,.52,.2); sprim(pass,'cyl',[.4,.22,.1],{rough:.6},wx+Math.sin(.3)*.26,y+Math.cos(.3)*.0,wz,0,0,Math.PI/2+.3,.24,.06,.24); sprim(pass,'cyl',[.75,.1,.1],{rough:.6,emissive:[.2,0,0]},wx,y,wz,0,0,Math.PI/2+.3,.22,.12,.22); sprim(pass,'sph',[1.4,1.3,1],{unlit:1,alpha:.99},wx,y+.55,wz,0,0,0,.06,.06,.06); }
      else if(c===T.KEY&&s.collected.clues>0){ const y=.6+Math.sin(tt*2.2+1)*.06, r=tt*2; sprim(pass,'torus',[1,.78,.25],{rough:.25,metal:.95,emissive:[.3,.2,0]},wx,y,wz,Math.PI/2,r,0,.3,.3,.3); sprim(pass,'cyl',[1,.78,.25],{rough:.25,metal:.95},wx+Math.cos(r)*.26,y,wz-Math.sin(r)*.26,0,0,Math.PI/2,.06,.34,.06); }
      else if(c===T.CHECK){ const y=.55+Math.sin(tt*2+ph)*.08; sprim(pass,'gem',[.3,1,.8],{rough:.1,metal:.2,emissive:[.1,.7,.55]},wx,y,wz,0,tt*1.5,0,.5,.9,.5); sprim(pass,'torus',[.3,1,.8],{unlit:1,alpha:.7},wx,.12,wz,0,0,0,.9,.9,.9); }
      else if(c===T.TREASURE){ if(!TH.GameState.treasureVisible()) continue; const lit=s.collected.clues>0; sprim(pass,'box',lit?[.5,.3,.12]:[.2,.14,.1],{rough:.6},wx,.2,wz,0,0,0,.62,.4,.4); sprim(pass,'cyl',lit?[.55,.34,.14]:[.22,.15,.1],{rough:.6},wx,.4,wz,0,0,Math.PI/2,.4,.62,.4);
        sprim(pass,'box',[1,.76,.28],{rough:.3,metal:.95},wx,.2,wz,0,0,0,.66,.08,.44); sprim(pass,'box',[1,.76,.28],{rough:.3,metal:.95},wx-.22,.3,wz,0,0,0,.06,.6,.44); sprim(pass,'box',[1,.76,.28],{rough:.3,metal:.95},wx+.22,.3,wz,0,0,0,.06,.6,.44);
        if(lit){ for(let i=0;i<5;i++){ const a=tt*1.5+i*1.3; sprim(pass,'gem',[3,2.4,.8],{unlit:1},wx+Math.cos(a)*.45,.7+Math.sin(tt*2+i)*.15,wz+Math.sin(a)*.45,0,a,0,.14,.2,.14); } sprim(pass,'cyl',[1,.85,.4],{unlit:1,alpha:.14,blend:true},wx,1.8,wz,0,0,0,.7,3.4,.7); } }
      else if(c===T.HAZARD) hazard3d(pass,hz,wx,wz,tt,ph);
      else if(c===T.DOOR){ const open=S3.built.doorAnim; const slide=open*2.3; const dm=S3.built.mats.door;
        if(pass==='shadow'){ E.draw(prims.box,null,model(wx,1.1-slide,wz,0,0,0,1.0,2.2,.5)); } else if(pass==='opaque'){ E.draw(prims.box,dm,model(wx,1.1-slide,wz,0,0,0,1.0,2.2,.5)); E.draw(prims.box,S3.built.mats.metalM,model(wx,1.1-slide,wz,0,0,0,.18,2.0,.6)); sprim('opaque','sph',open>.5?[.3,3,.6]:[3,.3,.3],{unlit:1},wx,1.2-slide*.9,wz+.3,0,0,0,.16,.16,.16);
          if(slide<2.3){ sprim('opaque','box',[.1,.1,.12],{rough:.5,metal:.8},wx,1.25,wz,0,0,0,1.14,2.5,.3); } } }
    }
    return;
  }
  function hazard3d(pass,kind,wx,wz,tt,ph){
    if(kind==='thorns'){ for(let i=0;i<8;i++){ const a=i/8*TAU+ph, r=.12+(i%3)*.1, hgt=.34+(i%2)*.18; sprim(pass,'cone',[.45,.1,.1],{rough:.6},wx+Math.cos(a)*r,hgt/2,wz+Math.sin(a)*r,Math.sin(a)*.4,0,-Math.cos(a)*.4,.08,hgt,.08); } sprim(pass,'sph',[.14,.3,.1],{rough:.9},wx,.12,wz,0,0,0,.5,.2,.5); }
    else if(kind==='spikes'){ sprim(pass,'box',[.12,.1,.14],{rough:.6,metal:.6},wx,.025,wz,0,0,0,.85,.05,.85); const up=.5+.5*Math.sin(tt*3); for(let i=0;i<3;i++) for(let j=0;j<3;j++){ const hgt=.12+up*.42; sprim(pass,'cone',[.78,.8,.86],{rough:.25,metal:.9},wx-.28+i*.28,.05+hgt/2,wz-.28+j*.28,0,0,0,.1,hgt,.1); } }
    else if(kind==='firepit'){ for(let i=0;i<7;i++){ const a=i/7*TAU; sprim(pass,'sph',[.25,.24,.24],{rough:.9},wx+Math.cos(a)*.34,.08,wz+Math.sin(a)*.34,0,0,0,.22,.16,.22); }
      sprim(pass,'cyl',[.1,.06,.03],{rough:.9},wx,.04,wz,0,0,0,.5,.06,.5);
      for(let i=0;i<4;i++){ const f=Math.sin(tt*9+i*1.9+ph), hgt=.5+f*.12+(i===0?.2:0); sprim(pass,'cone',i%2?[4,1.7,.2]:[4.4,.9,.1],{unlit:1,alpha:.9,blend:true},wx+Math.cos(i*1.6)*.1,.08+hgt/2,wz+Math.sin(i*1.6)*.1,0,0,Math.sin(tt*5+i)*.1,.2,hgt,.2); }
      dynLights.push({pos:[wx,.6,wz],col:[1,.5,.18],rad:5.2,flick:.4}); }
    else if(kind==='wires'){ sprim(pass,'cyl',[.1,.1,.12],{rough:.4,metal:.8},wx-.4,.35,wz,0,0,0,.07,.7,.07); sprim(pass,'cyl',[.1,.1,.12],{rough:.4,metal:.8},wx+.4,.35,wz,0,0,0,.07,.7,.07);
      const on=Math.sin(tt*30+ph*7)>-.2; for(let i=0;i<3;i++){ const y=.2+Math.abs(Math.sin(tt*11+i*2+ph))*.35; sprim(pass,'box',on?[2.5,2.8,3.6]:[.3,.3,.4],{unlit:1},wx,y,wz+(Math.sin(tt*40+i)*.12),0,0,Math.sin(tt*50+i)*.3,.85,.015,.015); }
      if(on&&pass==='opaque') dynLights.push({pos:[wx,.5,wz],col:[.5,.7,1],rad:3.4,flick:.6}); }
    else if(kind==='laser'){ [-.4,.4].forEach(x=>sprim(pass,'cyl',[.2,.22,.28],{rough:.4,metal:.8},wx+x,.3,wz,0,0,0,.1,.6,.1)); const on=Math.sin(tt*4)>-.3;
      for(let i=0;i<3;i++) sprim(pass,'box',on?[4,.2,.3]:[.4,.05,.06],{unlit:1},wx,.15+i*.2,wz,0,0,0,.8,.02,.02); if(on) dynLights.push({pos:[wx,.4,wz],col:[1,.15,.2],rad:3.6,flick:.1}); }
    else { for(let i=0;i<6;i++){ const a=i/6*TAU+ph, hgt=.5+(i%3)*.18; sprim(pass,'gem',[.55,.85,1],{rough:.08,metal:.2,emissive:[.08,.2,.3],alpha:.9,blend:true},wx+Math.cos(a)*.22,hgt*.5,wz+Math.sin(a)*.22,Math.sin(a)*.35,0,-Math.cos(a)*.35,.18,hgt*1.1,.18); } sprim(pass,'sph',[.5,.3,1.4],{unlit:1},wx,.15,wz,0,0,0,.15,.15,.15); dynLights.push({pos:[wx,.4,wz],col:[.4,.6,1],rad:3,flick:.2}); }
  }

  S3.render=function(dt){
    if(!S3.built||!E.ok) return;
    const s=TH.GameState.State, TS=TH.GameState.TS, env=S3.env, theme=s.map.theme, st=CG().stats;
    const t0=performance.now();
    const animOn=TH.UI.Settings.anim!==false; /* ANIMATION SETTING: off = frozen clock -> every uTime/tt-driven effect holds one still frame */
    E.time=animOn?performance.now()/1000:0; const tt=E.time;
    if(!s.paused) S3.built.doorAnim=Math.max(0,Math.min(1,S3.built.doorAnim+(s.hasKey?dt:-dt)*.8));
    const px=(s.player.px+s.player.w/2)/TS, pz=(s.player.py+s.player.h/2)/TS;
    // heading from player motion / input
    if(s.player.moving&&s.player.heading!==undefined){ // heading is in screen-relative input space: convert back to world yaw
      const tgt=s.player.heading; let d=tgt-S3._pHd; while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; S3._pHd+=d*Math.min(1,dt*14); }
    if(s.ai){ if(S3._aPx!==undefined){ const dx=s.ai.px-S3._aPx, dy=s.ai.py-S3._aPy; if(Math.hypot(dx,dy)>.05){ const tgt=Math.atan2(dx,dy); let d=tgt-(S3._aHd||0); while(d>Math.PI) d-=TAU; while(d<-Math.PI) d+=TAU; S3._aHd=(S3._aHd||0)+d*.2; } } S3._aPx=s.ai.px; S3._aPy=s.ai.py; }
    s.camYaw=S3.yaw;
    // ---- camera (orbit around a smoothed target)
    if(!cam.init){ cam.target=[px,.5,pz]; cam.init=true; }
    const k=1-Math.pow(.001,dt||.016); cam.target[0]+=(px-cam.target[0])*k; cam.target[2]+=(pz-cam.target[2])*k;
    const shake=s.shake>0?s.shake*.18:0;
    const cp=Math.cos(S3.pitch), sp=Math.sin(S3.pitch);
    const eye=[cam.target[0]+Math.sin(S3.yaw)*cp*S3.dist+(shake?(Math.random()-.5)*shake:0), cam.target[1]+sp*S3.dist, cam.target[2]+Math.cos(S3.yaw)*cp*S3.dist+(shake?(Math.random()-.5)*shake:0)];
    E.cam=eye; const aspect=E.w/E.h, fov=48*Math.PI/180, near=.3, far=90;
    M.lookAt(E.U.view,eye,cam.target,[0,1,0]); M.persp(E.U.proj,fov,aspect,near,far); M.mul(E.U.vp,E.U.proj,E.U.view);
    const planes=M.frustum(E.U.vp);
    // ---- lights: lantern + nearest world lights + dynamic ones
    const world=S3.built.worlds[(s.map.dual&&s.worldMode==='mirror')?'mirror':'normal'];
    dynLights=[];
    // fire/laser lights are gathered while drawing; do a cheap pre-scan so they exist before the first draw call
    const gridA=TH.GameState.activeGrid(), T=TH.Maps.T, hzK=TH.Themes.THEMES[theme].hazard;
    const cand=[];
    world.lights.forEach(l=>{ const d=Math.hypot(l.pos[0]-px,l.pos[2]-pz); if(d<l.rad+10) cand.push({d,l:{pos:l.pos,col:l.col.map(c=>c*(1+Math.sin(tt*9+l.pos[0]*3)*(l.flick||0)*.5)),rad:l.rad}}); });
    for(let z=Math.max(0,Math.floor(pz-9));z<Math.min(s.gh,Math.ceil(pz+9));z++) for(let x=Math.max(0,Math.floor(px-9));x<Math.min(s.gw,Math.ceil(px+9));x++){ if(gridA[z][x]!==T.HAZARD) continue; const wx=x+.5, wz=z+.5, d=Math.hypot(wx-px,wz-pz);
      if(hzK==='firepit') cand.push({d,l:{pos:[wx,.6,wz],col:[1,.5,.18].map(c=>c*(.85+Math.sin(tt*10+x)*.2)),rad:5.2}});
      else if(hzK==='laser'&&Math.sin(tt*4)>-.3) cand.push({d,l:{pos:[wx,.4,wz],col:[1,.15,.2],rad:3.6}});
      else if(hzK==='shards') cand.push({d,l:{pos:[wx,.4,wz],col:[.4,.6,1],rad:3}}); }
    s.patrolStates.forEach((ps,i)=>{ const rig=creatureRigs.get(i); if(rig&&rig.glow){ const d=Math.hypot(ps.x/TS-px,ps.y/TS-pz); if(d<10) cand.push({d,l:{pos:[ps.x/TS,1,ps.y/TS],col:rig.glow.map(c=>c*.9),rad:3.4}}); } });
    cand.sort((a,b)=>a.d-b.d);
    E.lights=[]; const lan=env.lantern;
    if(lan) E.lights.push({pos:[px,1.2,pz],col:lan.col.map(c=>c*(.95+Math.sin(tt*11)*.05)),rad:lan.rad});
    for(let i=0;i<cand.length&&E.lights.length<4;i++) E.lights.push(cand[i].l);
    E.lights=E.lights.slice(0,4);
    // ---- shadow matrix (ortho, texel-snapped, follows the player)
    const R=14, shadowSize=E.targets.shadowSize||2048, texel=2*R/shadowSize;
    E.shadowOn=E.quality!=='low'||true; E.shadowRadius=R*.95;
    let sc=[px,0,pz]; const L=env.sunDir;
    M.lookAt(vtmp,[sc[0]+L[0]*45,sc[1]+L[1]*45,sc[2]+L[2]*45],sc,[0,1,0]);
    const rx=[vtmp[0],vtmp[4],vtmp[8]], ux=[vtmp[1],vtmp[5],vtmp[9]];
    const dx=sc[0]*rx[0]+sc[2]*rx[2], dy=sc[0]*ux[0]+sc[1]*ux[1]+sc[2]*ux[2]; const sx=Math.round(dx/texel)*texel-dx, sy=Math.round(dy/texel)*texel-dy;
    sc=[sc[0]+rx[0]*sx+ux[0]*sy, sc[1]+rx[1]*sx+ux[1]*sy, sc[2]+rx[2]*sx+ux[2]*sy];
    E.shadowCenter=sc;
    const lv=M.lookAt(new Float32Array(16),[sc[0]+L[0]*45,sc[1]+L[1]*45,sc[2]+L[2]*45],sc,[0,1,0]), lp=M.ortho(new Float32Array(16),-R,R,-R,R,1,100); M.mul(E.U.lightVP,lp,lv);

    E.occ=[px,.95,pz];
    E.beginFrame();
    E.env=env;
    // ---- pass 1: shadow map
    E.beginShadow();
    drawChunks(world.chunks,'opaque',null,sc,R);
    S3.shadowDyn=true; dynamicPass('shadow',s,tt,px,pz);
    E.endShadow();
    // ---- pass 2: main scene
    E.beginScene();
    E.drawSky();
    // ground plane
    E.draw(S3.built.ground,S3.built.mats.ground,null);
    drawChunks(world.chunks,'opaque',planes);
    dynamicPass('opaque',s,tt,px,pz);
    // transparent: water + glass chunks (back to front by chunk distance), then blended rig parts
    E.beginBlend(false);
    const sorted=world.chunks.slice().sort((a,b)=>Math.hypot((b.x0+b.x1)/2-eye[0],(b.z0+b.z1)/2-eye[2])-Math.hypot((a.x0+a.x1)/2-eye[0],(a.z0+a.z1)/2-eye[2]));
    drawChunks(sorted,'blend',planes);
    dynamicPass('blend',s,tt,px,pz);
    E.endBlend();
    // particles
    updateParticles(animOn?(dt||.016):0,px,pz); E.drawParticles(part.data,part.n,part.cfg.color,E.h*.55);
    // post
    const post=Object.assign({},env.post); if(s.hitFlash>0){ post.tint=[1+s.hitFlash*1.4,1-s.hitFlash*.7,1-s.hitFlash*.7]; } if(s.worldFlash>0){ post.bloom=(post.bloom||.5)+s.worldFlash*2; post.tint=[1-s.worldFlash*.3,1,1+s.worldFlash*.8]; }
    E.endScene(post);
    // ---- statistics for the CG panel
    st.mode='3d'; st.animOn=animOn; st.fov=48; st.near=near; st.far=far; st.cam=eye.slice(); st.target=cam.target.slice(); st.yaw=S3.yaw; st.pitch=S3.pitch; st.dist=S3.dist;
    st.view=Array.from(E.U.view); st.drawCalls=E.stats.drawCalls; st.tris=Math.round(E.stats.tris); st.chunksDrawn=E.stats.chunksDrawn; st.chunksTotal=E.stats.chunksTotal;
    st.shadowSize=shadowSize; st.shadowCalls=E.stats.shadowCalls; st.lights=E.lights.length; st.exposure=post.exposure; st.hdr=E.hdr; st.msaa=E.targets.samples; st.bloom=E.cfg().bloom; st.fogDen=env.fogDen; st.sun=env.sunDir;
    if(TH.Renderer.minimap3D) TH.Renderer.minimap3D(px*TS,pz*TS,9*TS);
    st.px=px; st.py=pz; st.renderMs=performance.now()-t0; st.aspect=aspect;
  };

  window.TH=window.TH||{};
  TH.Scene3D=S3;
})();
