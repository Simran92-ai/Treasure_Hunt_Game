/* sprites2d.js
 * Canvas drawings for every obstacle kind, creature family, hazard and pickup
 * used by the 2D renderer.  Everything is vector drawn (paths, arcs,
 * gradients) - no image files.  All functions draw around (0,0): the caller
 * translates to the tile centre first.
 * Exposes: TH.Sprites2D = { obstacle, creature, hazard, pickup, shadow }
 */
(function(){
  const TAU=Math.PI*2;
  const circ=(c,x,y,r,f)=>{ c.fillStyle=f; c.beginPath(); c.arc(x,y,r,0,TAU); c.fill(); };
  const ell=(c,x,y,rx,ry,f,rot)=>{ c.fillStyle=f; c.beginPath(); c.ellipse(x,y,rx,ry,rot||0,0,TAU); c.fill(); };
  const rect=(c,x,y,w,h,f)=>{ c.fillStyle=f; c.fillRect(x,y,w,h); };
  function polyP(c,pts,f,s){ c.beginPath(); pts.forEach((p,i)=>i?c.lineTo(p[0],p[1]):c.moveTo(p[0],p[1])); c.closePath(); if(f){ c.fillStyle=f; c.fill(); } if(s){ c.strokeStyle=s; c.lineWidth=1; c.stroke(); } }
  const rr=(c,x,y,w,h,r,f)=>{ c.fillStyle=f; c.beginPath(); c.moveTo(x+r,y); c.arcTo(x+w,y,x+w,y+h,r); c.arcTo(x+w,y+h,x,y+h,r); c.arcTo(x,y+h,x,y,r); c.arcTo(x,y,x+w,y,r); c.closePath(); c.fill(); };
  function shadow(c,rx,ry,a){ ell(c,0,rx?ry:14,rx||14,ry||5,'rgba(0,0,0,'+(a||.3)+')'); }

  /* -------- obstacles (tile = 40px, centred) -------- */
  const OB={
    tree(c,t,v){ shadow(c,15,5); rect(c,-3,-2,6,16,'#5a3a1e'); rect(c,-3,-2,2,16,'#6e4826');
      circ(c,0,-10,13,'#1f5a2a'); circ(c,-9,-3,10,'#2a6e32'); circ(c,9,-3,10,'#256a2e'); circ(c,-3,-13,8,'#38863e'); circ(c,5,-8,5,'#4a9a4a'); },
    bush(c,t,v){ shadow(c,14,4); circ(c,-7,2,9,'#2a5a22'); circ(c,7,2,9,'#2f6a26'); circ(c,0,-4,10,'#3a7a2c');
      for(let i=0;i<5;i++) circ(c,Math.cos(i*1.9+v)*8,Math.sin(i*2.3+v)*6-1,1.6,'#d04050'); },
    boulder(c,t,v){ shadow(c,16,5); polyP(c,[[-15,10],[-12,-6],[-2,-13],[10,-9],[16,3],[12,12]],'#7a7e86','#3a3d44'); polyP(c,[[-12,-6],[-2,-13],[10,-9],[2,-2]],'#9aa0aa'); polyP(c,[[-15,10],[-12,-6],[2,-2],[0,12]],'#666a72');
      rect(c,-6,3,5,2,'#4a7a3a'); },
    ruin(c,t,v){ shadow(c,13,5); rect(c,-9,-6,18,20,'#8a8678'); rect(c,-9,-6,5,20,'#a29e8e'); rect(c,4,-6,5,20,'#6a665a');
      polyP(c,[[-11,-6],[11,-6],[8,-14],[2,-10],[-3,-15],[-8,-9]],'#9a9686','#4a463c');
      c.strokeStyle='#4a463c'; c.beginPath(); c.moveTo(-3,-4); c.lineTo(0,3); c.lineTo(-2,10); c.stroke();
      circ(c,-6,4,3,'#4a8a3a'); circ(c,5,-2,2.5,'#3c7a30'); },
    totem(c,t,v){ shadow(c,11,4); rect(c,-8,-14,16,28,'#6a4020'); rect(c,-8,-14,16,9,'#a8442a'); rect(c,-8,-5,16,9,'#d9a030'); rect(c,-8,4,16,9,'#3a7a5a');
      [-9.5,-.5,8.5].forEach((y,i)=>{ circ(c,-3,y+3,1.7,'#111'); circ(c,3,y+3,1.7,'#111'); rect(c,-3,y+6,6,1.5,'#111'); }); polyP(c,[[-8,-14],[0,-20],[8,-14]],'#5a3418'); },
    shelf(c,t,v){ shadow(c,17,4); rect(c,-16,-12,32,24,'#3a2416'); rect(c,-14,-10,28,9,'#24160c'); rect(c,-14,1,28,9,'#24160c');
      const cols=['#a03a3a','#3a5aa0','#c9a23a','#3a8a5a','#7a3a8a'];
      for(let r=0;r<2;r++) for(let i=0;i<9;i++) rect(c,-13+i*3.1,-9+r*11,2.5,7+(i%3),cols[(i+r*2)%5]); },
    table(c,t,v){ shadow(c,18,5); rect(c,-15,6,3,8,'#2a180c'); rect(c,12,6,3,8,'#2a180c'); rr(c,-17,-9,34,18,3,'#5a3820'); rr(c,-15,-7,30,14,2,'#6e4528');
      ell(c,-6,0,4,2.5,'#e8e0d0'); ell(c,7,0,4,2.5,'#e8e0d0'); rect(c,-1,-6,2,6,'#d9d0b0'); circ(c,0,-7,1.8,'#ffb23a'); },
    statue(c,t,v){ shadow(c,12,4); rect(c,-11,6,22,8,'#6a6a72'); rect(c,-9,2,18,5,'#7e7e86'); rect(c,-4,-9,8,12,'#a8a8b4'); circ(c,0,-13,5,'#b8b8c4'); rect(c,-9,-8,5,3,'#a8a8b4'); rect(c,4,-8,5,3,'#a8a8b4'); },
    coffin(c,t,v){ shadow(c,13,5); polyP(c,[[-8,-15],[8,-15],[13,-4],[8,14],[-8,14],[-13,-4]],'#2c1a12','#120a06'); polyP(c,[[-6,-12],[6,-12],[10,-3],[6,11],[-6,11],[-10,-3]],'#3a2418'); rect(c,-1.5,-9,3,16,'#b89a50'); rect(c,-5,-5,10,3,'#b89a50'); },
    candles(c,t,v){ shadow(c,9,3); rect(c,-1.5,-4,3,16,'#b89a50'); rect(c,-8,10,16,3,'#b89a50'); rect(c,-9,-4,18,2,'#b89a50');
      [-8,0,8].forEach((x,i)=>{ rect(c,x-1.5,-12,3,8,'#f0e8d0'); const f=Math.sin(t*9+i*2)*1.2; ell(c,x,-15+f*.3,2.2,3.6+f*.4,'#ffb23a'); ell(c,x,-15,1,2,'#fff2a0'); circ(c,x,-15,9,'rgba(255,170,60,.12)'); }); },
    palm(c,t,v){ shadow(c,13,4); c.strokeStyle='#8a6a3a'; c.lineWidth=5; c.beginPath(); c.moveTo(0,14); c.quadraticCurveTo(5,2,1,-9); c.stroke();
      for(let i=0;i<7;i++){ const a=i/7*TAU+Math.sin(t*1.5)*.06; c.save(); c.translate(1,-10); c.rotate(a); ell(c,10,0,11,3.2,i%2?'#2f8a3a':'#3aa04a'); c.restore(); }
      circ(c,-2,-8,2.4,'#6a4a22'); circ(c,3,-7,2.4,'#6a4a22'); },
    crate(c,t,v){ shadow(c,16,4); rect(c,-14,-13,28,26,'#8a6030'); rect(c,-14,-13,28,3,'#a87a42'); rect(c,-12,-11,24,22,'#9a6c38');
      c.strokeStyle='#5a3a1a'; c.lineWidth=2.5; c.strokeRect(-12,-11,24,22); c.beginPath(); c.moveTo(-12,-11); c.lineTo(12,11); c.moveTo(12,-11); c.lineTo(-12,11); c.stroke(); },
    barrel(c,t,v){ shadow(c,12,4); rr(c,-11,-14,22,28,8,'#7a4a24'); rect(c,-11,-8,22,2.5,'#2a2a30'); rect(c,-11,5,22,2.5,'#2a2a30'); rect(c,-5,-14,2,28,'#9a6334'); ell(c,0,-13,10,4,'#9a6334'); ell(c,0,-13,7,2.5,'#5a3414'); },
    cannon(c,t,v){ shadow(c,17,5); circ(c,-8,8,7,'#4a3018'); circ(c,-8,8,3,'#2a1a0c'); c.save(); c.rotate(-.35); rr(c,-10,-6,28,12,6,'#2a2a32'); rect(c,-10,-6,28,3,'#4a4a56'); rect(c,13,-7,4,14,'#1a1a20'); c.restore(); circ(c,13,-12,2.5,'#111'); },
    rock(c,t,v){ shadow(c,16,5); polyP(c,[[-16,11],[-11,-3],[-3,-11],[9,-8],[16,4],[13,11]],'#6a7078','#2c3036'); polyP(c,[[-11,-3],[-3,-11],[9,-8],[2,0]],'#8a9098'); rect(c,-14,8,28,3,'#3a8a6a'); ell(c,6,10,4,2,'#2a6a4a'); },
    parked(c,t,v){ const col=['#c0392b','#2e86c1','#d4ac0d','#7d3c98','#e5e7e9','#27ae60'][v%6]; shadow(c,18,6);
      rr(c,-18,-9,36,18,5,col); rr(c,-9,-7,18,14,3,'rgba(20,28,40,.8)'); rect(c,-9,-7,18,2,'rgba(255,255,255,.25)'); rect(c,-18,-5,2,3,'#ffee99'); rect(c,-18,3,2,3,'#ffee99'); rect(c,16,-5,2,3,'#d22'); rect(c,16,3,2,3,'#d22');
      [[-11,-10],[10,-10],[-11,9],[10,9]].forEach(p=>rect(c,p[0]-3,p[1]-1,6,3,'#111')); },
    barrier(c,t,v){ shadow(c,16,3); rect(c,-15,-3,30,8,'#eee'); for(let i=-15;i<14;i+=8) polyP(c,[[i,-3],[i+4,-3],[i+8,5],[i+4,5]],'#d22'); rect(c,-14,5,3,8,'#444'); rect(c,11,5,3,8,'#444'); circ(c,0,-7,2.5,(Math.sin(t*6)>0)?'#ff9a2a':'#7a4a10'); },
    dumpster(c,t,v){ shadow(c,17,5); rr(c,-16,-9,32,20,2,'#2f6a44'); rr(c,-17,-12,34,6,2,'#24543a'); rect(c,-16,-1,32,2,'#1d4a30'); circ(c,-12,13,2.5,'#111'); circ(c,12,13,2.5,'#111'); rect(c,-5,-2,10,2,'#c0c8c0'); },
    lamp(c,t,v){ shadow(c,6,3); rect(c,-1.5,-13,3,26,'#3a3e46'); rect(c,-5,12,10,3,'#2a2e36'); polyP(c,[[-7,-14],[7,-14],[4,-19],[-4,-19]],'#2a2e36'); circ(c,0,-12,12,'rgba(255,230,150,.14)'); circ(c,0,-13,3.2,'#fff0b0'); },
    bench(c,t,v){ shadow(c,16,4); rect(c,-15,-3,30,7,'#8a5a2a'); rect(c,-15,-9,30,4,'#6e4620'); rect(c,-13,4,3,8,'#2a2a2a'); rect(c,10,4,3,8,'#2a2a2a'); rect(c,-15,-3,30,1.5,'#a8743a'); },
    cargo(c,t,v){ shadow(c,17,5); rr(c,-16,-12,32,24,4,'#7a8494'); rr(c,-14,-10,28,20,3,'#9aa4b4'); rect(c,-14,-3,28,5,'#e08a2a'); rect(c,-8,-10,2,20,'#6a7484'); rect(c,6,-10,2,20,'#6a7484'); circ(c,0,8,1.8,(Math.sin(t*4+v)>0)?'#4aff8a':'#1a5a30'); },
    reactor(c,t,v){ shadow(c,14,5); rr(c,-13,-6,26,20,3,'#3a4258'); ell(c,0,-6,13,5,'#5a6480'); const g=.55+.35*Math.sin(t*3+v); ell(c,0,-8,9,3.6,'rgba(80,220,255,'+g+')'); rect(c,-5,-22,10,16,'rgba(80,220,255,'+(g*.7)+')'); ell(c,0,-22,5,2.5,'rgba(190,250,255,'+g+')'); circ(c,0,-10,18,'rgba(80,220,255,.07)'); },
    console(c,t,v){ shadow(c,16,4); rr(c,-15,-6,30,19,3,'#262c3c'); polyP(c,[[-15,-6],[15,-6],[12,-14],[-12,-14]],'#323a50'); rect(c,-11,-12,22,6,'#0c2a3a'); rect(c,-9,-10,10,1.5,'#4af'); rect(c,-9,-7,14,1.5,'#4fa');
      ['#f44','#fc3','#4f8','#4af'].forEach((col,i)=>circ(c,-9+i*6,3,1.7,((Math.floor(t*2+i+v)%2)?col:'#333'))); },
    pipe(c,t,v){ shadow(c,17,4); [-8,0,8].forEach((y,i)=>{ rr(c,-16,y-4,32,8,4,['#7a8494','#6a7484','#8a94a4'][i]); rect(c,-16,y-1,32,1.5,'rgba(255,255,255,.25)'); rect(c,-10,y-4,3,8,'#4a5464'); rect(c,8,y-4,3,8,'#4a5464'); }); },
    tank(c,t,v){ shadow(c,13,4); rr(c,-12,-12,24,26,10,'#c8ccd4'); rect(c,-12,-3,24,6,'#e0b020'); for(let i=-12;i<12;i+=6) polyP(c,[[i,-3],[i+3,-3],[i+6,3],[i+3,3]],'#222'); ell(c,0,-11,9,3,'#e4e8ee'); rect(c,-2,-18,4,6,'#6a7484'); },
    crystal(c,t,v){ shadow(c,13,4); const g=.7+.3*Math.sin(t*2+v); polyP(c,[[-10,12],[-12,-2],[-6,-14],[-1,12]],'rgba(110,200,255,'+g+')','#2a6a9a'); polyP(c,[[-2,12],[0,-18],[7,-6],[9,12]],'rgba(160,225,255,'+g+')','#2a6a9a'); polyP(c,[[8,12],[11,-3],[15,10]],'rgba(90,170,240,'+g+')','#2a6a9a'); polyP(c,[[0,-18],[3,-10],[0,-6]],'rgba(255,255,255,.6)'); },
    shard(c,t,v){ shadow(c,9,3); polyP(c,[[-6,13],[-2,-17],[2,-17],[7,13]],'rgba(150,210,255,.85)','#3a7aaa'); polyP(c,[[-2,-17],[2,-17],[1,13],[-1,13]],'rgba(255,255,255,.55)'); },
    orb(c,t,v){ shadow(c,11,4); circ(c,0,-2,12,'rgba(120,190,255,.55)'); circ(c,0,-2,12,'rgba(255,255,255,.08)'); c.strokeStyle='rgba(200,235,255,.9)'; c.lineWidth=1.5; c.beginPath(); c.arc(0,-2,12,0,TAU); c.stroke(); ell(c,-4,-7,4,2.5,'rgba(255,255,255,.7)',-.6); circ(c,0,0,3,'rgba(140,100,255,'+(.5+.4*Math.sin(t*3+v))+')'); },
    monolith(c,t,v){ shadow(c,11,4); polyP(c,[[-9,14],[-7,-16],[7,-16],[9,14]],'#14161f','#3a3f58'); polyP(c,[[-7,-16],[7,-16],[4,-12],[-4,-12]],'#2a2e44'); const g=.5+.4*Math.sin(t*2.5+v);
      c.strokeStyle='rgba(120,200,255,'+g+')'; c.lineWidth=1.6; c.beginPath(); c.arc(0,-3,4.5,0,TAU); c.moveTo(0,-9); c.lineTo(0,3); c.moveTo(-5,6); c.lineTo(5,6); c.stroke(); },
    spire(c,t,v){ shadow(c,14,4); [[-9,12,-6,-9],[0,13,2,-19],[9,12,7,-12]].forEach((p,i)=>polyP(c,[[p[0]-5,p[1]],[p[2],p[3]],[p[0]+5,p[1]]],['#7a4ad0','#9a62f0','#6a3ab8'][i],'#3a1a78')); polyP(c,[[0,-19],[3,-5],[0,10]],'rgba(255,255,255,.25)'); }
  };

  /* -------- hazards (tile floor decals) -------- */
  const HZ={
    thorns(c,t){ c.fillStyle='#3a1a1a'; for(let i=0;i<7;i++){ const a=i/7*TAU; polyP(c,[[Math.cos(a)*5-2,Math.sin(a)*5],[Math.cos(a)*14,Math.sin(a)*14],[Math.cos(a)*5+2,Math.sin(a)*5]],'#7a2a2a','#2a0a0a'); } circ(c,0,0,4,'#2a4a1a'); },
    spikes(c,t){ const up=.55+.45*Math.sin(t*3); rect(c,-14,-14,28,28,'#2a2230'); for(let i=0;i<3;i++) for(let j=0;j<3;j++){ const x=-9+i*9,y=-9+j*9; polyP(c,[[x-3,y+3],[x,y+3-9*up],[x+3,y+3]],'#c8ccd4','#555'); } },
    firepit(c,t){ circ(c,0,0,15,'#2a1a10'); circ(c,0,0,12,'#4a2a14'); for(let i=0;i<4;i++){ const f=Math.sin(t*8+i*1.7); ell(c,Math.cos(i*1.6)*5,Math.sin(i*1.6)*4+2,4,8+f*3,i%2?'#ff9a1a':'#ff5a1a'); } ell(c,0,0,3,5,'#ffe27a'); circ(c,0,0,19,'rgba(255,120,30,.12)'); },
    wires(c,t){ rect(c,-14,-3,28,6,'#222'); c.strokeStyle='#ffe23a'; c.lineWidth=1.8; c.beginPath(); c.moveTo(-14,0); for(let x=-14;x<=14;x+=4) c.lineTo(x,(Math.random()-.5)*10); c.stroke(); circ(c,0,0,15,'rgba(120,200,255,'+(.08+.08*Math.random())+')'); },
    laser(c,t){ rect(c,-14,-14,28,28,'#201418'); const on=Math.sin(t*4)>-.3; c.strokeStyle=on?'#ff2a3a':'#5a1a22'; c.lineWidth=2.4; for(let i=-9;i<=9;i+=9){ c.beginPath(); c.moveTo(-14,i); c.lineTo(14,i); c.stroke(); } if(on) circ(c,0,0,16,'rgba(255,40,60,.12)'); circ(c,-14,0,2.5,'#888'); circ(c,14,0,2.5,'#888'); },
    shards(c,t){ for(let i=0;i<6;i++){ const a=i/6*TAU+.3, r=9+(i%2)*4; polyP(c,[[Math.cos(a)*r-2,Math.sin(a)*r],[Math.cos(a)*(r+8),Math.sin(a)*(r+8)],[Math.cos(a)*r+2,Math.sin(a)*r+2]],'rgba(170,225,255,.9)','#3a7aaa'); } circ(c,0,0,5,'rgba(140,100,255,.5)'); }
  };

  /* -------- pickups -------- */
  const PK={
    coin(c,t,v){ const sx=Math.abs(Math.cos(t*3+v)); circ(c,0,0,10,'rgba(255,215,80,.14)'); c.save(); c.scale(Math.max(.15,sx),1); circ(c,0,0,7,'#c9961a'); circ(c,0,0,5.6,'#ffd84a'); rect(c,-1,-3.5,2,7,'#c9961a'); c.restore(); },
    clue(c,t,v){ const b=Math.sin(t*3)*1.5; circ(c,0,b,14,'rgba(255,255,255,.1)'); c.save(); c.translate(0,b); c.rotate(-.12); rr(c,-8,-10,16,20,2,'#efe4c0'); c.strokeStyle='#9a8a5a'; c.lineWidth=1; for(let i=0;i<4;i++){ c.beginPath(); c.moveTo(-5,-6+i*4); c.lineTo(5,-6+i*4-(i===3?3:0)); c.stroke(); } circ(c,5,7,2.5,'#c0392b'); c.restore(); },
    key(c,t,v){ const b=Math.sin(t*3+1)*1.5; circ(c,0,b,14,'rgba(255,215,90,.16)'); c.save(); c.translate(0,b); c.rotate(.6); c.strokeStyle='#e8b830'; c.lineWidth=3.2; c.beginPath(); c.arc(-6,0,5,0,TAU); c.stroke(); rect(c,-1,-1.6,14,3.2,'#e8b830'); rect(c,8,0,2.5,6,'#e8b830'); rect(c,4,0,2.5,4.5,'#e8b830'); c.restore(); },
    check(c,t,v){ const g=.6+.3*Math.sin(t*3); circ(c,0,0,15,'rgba(74,195,168,'+(g*.25)+')'); polyP(c,[[0,-12],[8,0],[0,12],[-8,0]],'rgba(74,225,190,'+(.55+g*.4)+')','#1a7a66'); polyP(c,[[0,-12],[4,0],[0,3],[-4,0]],'rgba(255,255,255,.35)'); },
    treasure(c,t,v){ const g=.5+.4*Math.sin(t*3); circ(c,0,0,20,'rgba(255,200,60,'+(g*.25)+')'); rr(c,-12,-4,24,15,2,'#7a4a1a'); rr(c,-12,-10,24,9,5,'#9a5e22'); rect(c,-12,-2,24,2.5,'#e8b830'); rect(c,-2.5,-3,5,6,'#ffd84a'); rect(c,-12,-4,2.5,15,'#e8b830'); rect(c,9.5,-4,2.5,15,'#e8b830');
      for(let i=0;i<3;i++){ const a=t*2+i*2.1; circ(c,Math.cos(a)*13,-8+Math.sin(a)*5,1.3,'#fff6b0'); } }
  };

  /* -------- creature families -------- */
  function eyes(c,x,y,gap,r,col,pupil){ circ(c,x-gap,y,r,'#fff'); circ(c,x+gap,y,r,'#fff'); circ(c,x-gap,y,r*.55,col||'#111'); circ(c,x+gap,y,r*.55,col||'#111'); }
  const CR={
    quad(c,k,t,f,mv){ const [b,a,e]=k.col, leg=Math.sin(t*10)*3*mv; c.scale(f,1);
      [[-8,leg],[8,-leg],[-3,-leg],[3,leg]].forEach(p=>rect(c,p[0]-1.8,8,3.6,6+p[1]*.4,b)); ell(c,0,3,14,8,b); ell(c,2,5,9,4.5,a);
      if(k.tail) { c.strokeStyle=b; c.lineWidth=3; c.beginPath(); c.moveTo(-13,0); c.quadraticCurveTo(-20,-6+Math.sin(t*5)*3,-18,-12); c.stroke(); }
      circ(c,13,-3,7,b); polyP(c,[[9,-8],[11,-14],[14,-8]],b); polyP(c,[[13,-8],[16,-13],[18,-6]],b); ell(c,17,-1,3.5,2.6,a);
      circ(c,15,-5,1.8,e); if(k.tusks){ polyP(c,[[16,0],[20,-4],[18,2]],'#f4efe0'); } if(k.arms){ rect(c,6,2,3,8,b); } },
    humanoid(c,k,t,f,mv){ const [b,a,e]=k.col, sw=Math.sin(t*9)*3*mv;
      rect(c,-5,6,4,9+sw*.3,a); rect(c,1,6,4,9-sw*.3,a); rr(c,-7,-6,14,14,3,b); rect(c,-11,-4,4,11+sw*.4,b); rect(c,7,-4,4,11-sw*.4,b);
      circ(c,0,-11,6.5,k.bones?'#e6e0cc':(k.col[0]==='#6f8a5a'?'#7f9a6a':'#e0b890')); if(k.bones){ rect(c,-3,-10,2,3,'#222'); rect(c,1,-10,2,3,'#222'); rect(c,-3,-7,6,1.5,'#222'); rect(c,-6,-2,12,1.3,'#8a826a'); rect(c,-6,2,12,1.3,'#8a826a'); }
      else { eyes(c,0,-12,2.6,1.9,e==='#fff'?'#111':e); if(k.bigeyes){ ell(c,-3,-12,2.8,4,'#000'); ell(c,3,-12,2.8,4,'#000'); } }
      if(k.hat){ rect(c,-9,-17,18,3,'#222'); polyP(c,[[-6,-17],[0,-24],[6,-17]],'#222'); rect(c,-6,-17,12,2,'#c9a23a'); }
      if(k.cap){ rr(c,-7,-18,14,5,2,'#1a2440'); rect(c,-8,-14,16,2,'#1a2440'); }
      if(k.mask){ rect(c,-6,-14,12,5,'#222'); circ(c,-2.5,-12,1.3,'#ff6'); circ(c,2.5,-12,1.3,'#ff6'); }
      if(k.helm){ rr(c,-7,-18,14,10,4,'#c8d8e8'); rect(c,-5,-12,10,2,'#102030'); }
      if(k.robot){ } },
    ghost(c,k,t,f,mv){ const [b,a,e]=k.col, w=Math.sin(t*3)*2; c.translate(0,Math.sin(t*2.5)*2-2);
      if(k.glow) circ(c,0,0,20,'rgba(160,220,255,.16)');
      c.fillStyle=b; c.beginPath(); c.moveTo(-11,12); c.lineTo(-11,-2); c.arc(0,-2,11,Math.PI,0); c.lineTo(11,12);
      for(let i=0;i<4;i++) c.lineTo(11-(i+.5)*5.5, 12+(i%2?-1:5)+w*(i%2?1:-1)); c.closePath(); c.fill();
      ell(c,-3,-6,4,5,'rgba(255,255,255,.25)'); ell(c,-4,-3,2.4,3.4,e); ell(c,4,-3,2.4,3.4,e); ell(c,0,5,2.5,3.4,'rgba(0,0,0,.6)');
      if(k.hat){ rect(c,-10,-15,20,3,'#222'); polyP(c,[[-6,-15],[0,-22],[6,-15]],'#222'); } },
    blob(c,k,t,f,mv){ const [b,a,e]=k.col; c.beginPath(); for(let i=0;i<14;i++){ const ang=i/14*TAU+t*.6, r=(i%2?10:13)+Math.sin(t*4+i)*1.6; const x=Math.cos(ang)*r, y=Math.sin(ang)*r*.9; i?c.lineTo(x,y):c.moveTo(x,y); } c.closePath(); c.fillStyle=b; c.fill(); c.strokeStyle=a; c.lineWidth=2; c.stroke();
      if(k.crystal) polyP(c,[[-3,-12],[0,-20],[3,-12]],a); if(k.horns){ polyP(c,[[-9,-8],[-12,-17],[-4,-11]],a); polyP(c,[[9,-8],[12,-17],[4,-11]],a); }
      if(k.tentacles){ c.strokeStyle=b; c.lineWidth=3; for(let i=0;i<4;i++){ c.beginPath(); c.moveTo(-9+i*6,8); c.quadraticCurveTo(-9+i*6+Math.sin(t*4+i)*5,16,-9+i*6+Math.sin(t*3+i)*7,22); c.stroke(); } }
      circ(c,-4,-2,3.6,'#fff'); circ(c,4,-2,3.6,'#fff'); circ(c,-4,-2,1.8,e==='#fff'?'#111':e); circ(c,4,-2,1.8,e==='#fff'?'#111':e); rect(c,-5,5,10,2,'#200'); },
    spider(c,k,t,f,mv){ const [b,a,e]=k.col; c.strokeStyle=b; c.lineWidth=2.2;
      for(let i=0;i<4;i++) for(const sd of [-1,1]){ const ph=Math.sin(t*12+i*1.3*sd)*2*mv; c.beginPath(); c.moveTo(sd*5,-3+i*3); c.quadraticCurveTo(sd*(14+ph),-8+i*4,sd*(17+ph),i*4+4); c.stroke(); }
      ell(c,0,4,8,10,b); ell(c,0,-6,6,5.5,b); if(k.crystal){ polyP(c,[[-4,-2],[0,-10],[4,-2]],a); } else { circ(c,0,6,3.4,a); }
      circ(c,-2.5,-8,1.5,e); circ(c,2.5,-8,1.5,e); circ(c,-5,-6,1,e); circ(c,5,-6,1,e); },
    serpent(c,k,t,f,mv){ const [b,a,e]=k.col; c.strokeStyle=b; c.lineCap='round'; c.lineWidth=7; c.beginPath(); for(let i=0;i<=10;i++){ const x=-16+i*3.2, y=Math.sin(t*5+i*.7)*5; i?c.lineTo(x*f,y):c.moveTo(x*f,y); } c.stroke();
      c.lineWidth=3; c.strokeStyle=a; c.setLineDash([3,5]); c.beginPath(); for(let i=0;i<=10;i++){ const x=-16+i*3.2, y=Math.sin(t*5+i*.7)*5; i?c.lineTo(x*f,y):c.moveTo(x*f,y); } c.stroke(); c.setLineDash([]); c.lineCap='butt';
      const hx=16*f, hy=Math.sin(t*5+7)*5; circ(c,hx,hy,5,b); circ(c,hx+1.5*f,hy-2,1.4,e); c.strokeStyle='#d22'; c.lineWidth=1; c.beginPath(); c.moveTo(hx+5*f,hy); c.lineTo(hx+9*f,hy+(Math.sin(t*20)>0?2:-2)); c.stroke(); },
    drone(c,k,t,f,mv){ const [b,a,e]=k.col; c.translate(0,Math.sin(t*3)*2-4); ell(c,0,17,10,3,'rgba(0,0,0,.25)');
      for(const sd of [-1,1]){ rect(c,sd*12-1,-1,2,5,'#555'); ell(c,sd*12,-2,8,1.5+Math.abs(Math.sin(t*40))*1.5,'rgba(200,220,255,.5)'); }
      rr(c,-12,-3,24,9,4,b); rr(c,-8,-6,16,7,3,a); circ(c,0,2,3.6,e); circ(c,0,2,7,'rgba(255,60,60,.15)'); },
    vehicle(c,k,t,f,mv){ const [b,a,e]=k.col, L=k.long?21:17; c.scale(f,1); rr(c,-L,-9,L*2,18,5,b); rr(c,-L*.25,-7,L*.8,14,3,a==='#222'?'rgba(20,28,40,.8)':a); rect(c,L-3,-6,3,3,'#ffe'); rect(c,L-3,3,3,3,'#ffe'); rect(c,-L,-6,2,3,'#d22'); rect(c,-L,3,2,3,'#d22');
      [[-L*.6,-10],[L*.55,-10],[-L*.6,9],[L*.55,9]].forEach(p=>rect(c,p[0]-3.5,p[1]-1,7,3,'#111')); circ(c,L+4,0,10,'rgba(255,255,200,.12)'); },
    golem(c,k,t,f,mv){ const [b,a,e]=k.col, sw=Math.sin(t*5)*2*mv;
      rr(c,-9,6,7,9+sw*.3,2,a); rr(c,2,6,7,9-sw*.3,2,a); rr(c,-13,-8,26,18,5,b); rr(c,-19,-6,7,16+sw,3,b); rr(c,12,-6,7,16-sw,3,b); rr(c,-7,-17,14,10,3,a);
      if(k.crystal){ polyP(c,[[-10,-8],[-6,-16],[-2,-8]],'rgba(255,255,255,.5)'); polyP(c,[[2,-8],[7,-18],[11,-8]],'rgba(255,255,255,.4)'); }
      if(k.robot){ rect(c,-9,-3,18,2,'#222'); rect(c,-9,2,18,2,'#222'); } else { circ(c,-8,-3,3,a); circ(c,7,3,2.5,a); }
      circ(c,-3,-12,1.9,e); circ(c,3,-12,1.9,e); circ(c,-3,-12,5,'rgba(255,80,40,.12)'); },
    crab(c,k,t,f,mv){ const [b,a,e]=k.col, sc=Math.sin(t*10)*2*mv;
      for(const sd of [-1,1]){ for(let i=0;i<3;i++){ c.strokeStyle=b; c.lineWidth=2; c.beginPath(); c.moveTo(sd*7,2+i*3); c.lineTo(sd*(14+sc),4+i*4); c.stroke(); }
        c.strokeStyle=b; c.lineWidth=3; c.beginPath(); c.moveTo(sd*8,-4); c.lineTo(sd*13,-10); c.stroke(); circ(c,sd*13,-12,5,a); polyP(c,[[sd*13,-13],[sd*17,-18],[sd*17,-12]],'#000'); circ(c,sd*13,-12,5,b); polyP(c,[[sd*11,-15],[sd*14,-20],[sd*17,-15]],a); }
      ell(c,0,2,11,8,b); ell(c,0,0,8,4,a); circ(c,-3,-6,2,'#fff'); circ(c,3,-6,2,'#fff'); circ(c,-3,-6,1,e); circ(c,3,-6,1,e); },
    bat(c,k,t,f,mv){ const [b,a,e]=k.col, fl=Math.sin(t*14); c.translate(0,Math.sin(t*3)*3-5); ell(c,0,18,7,2.5,'rgba(0,0,0,.25)');
      for(const sd of [-1,1]){ c.fillStyle=b; c.beginPath(); c.moveTo(sd*3,0); c.quadraticCurveTo(sd*16,-12*fl-2,sd*22,-2+fl*6); c.quadraticCurveTo(sd*16,3,sd*12,6); c.quadraticCurveTo(sd*8,2,sd*3,6); c.closePath(); c.fill(); }
      ell(c,0,1,5,7,b); circ(c,0,-6,4.4,b); if(k.beak){ polyP(c,[[-2,-5],[2,-5],[0,0]],a==='#c8c8c8'?'#f0a020':'#f0a020'); } else { polyP(c,[[-4,-9],[-3,-14],[-1,-9]],b); polyP(c,[[1,-9],[3,-14],[4,-9]],b); }
      circ(c,-1.8,-7,1.1,e); circ(c,1.8,-7,1.1,e); }
  };

  function obstacle(c,kind,t,v){ const f=OB[kind]; if(f){ c.save(); f(c,t,v); c.restore(); } }
  function creature(c,k,t,face,moving){ const f=CR[k.family]||CR.blob; c.save(); c.scale(k.s*0.78,k.s*0.78); f(c,k,t,face,moving?1:.2); c.restore(); }
  function hazard(c,kind,t){ const f=HZ[kind]||HZ.thorns; c.save(); f(c,t); c.restore(); }
  function pickup(c,kind,t,v){ const f=PK[kind]; if(f){ c.save(); f(c,t,v); c.restore(); } }

  window.TH=window.TH||{};
  TH.Sprites2D={obstacle,creature,hazard,pickup,shadow,OB,CR};
})();
