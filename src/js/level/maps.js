/* maps.js
 * Tile constants, map metadata, and the level builder.
 * Levels are generated per (map, difficulty): the structure of each map is
 * themed, then the C++/WASM generator (levelgen.js) scatters obstacles, picks
 * fair clue/key/checkpoint spots with a BFS distance field and finds patrol
 * routes - always keeping the level fully connected and solvable.
 * Exposes: TH.Maps = { T, makeGrid, isSolidChar, MAPS, COMING_SOON, build, validate }
 */
(function(){
  const T={WALL:'#',FLOOR:'.',WATER:'~',OBST:'O',TREASURE:'T',DOOR:'D',KEY:'K',COIN:'C',CLUE:'L',HAZARD:'H',CHECK:'B'};

  function makeGrid(w,h){
    const g=[];
    for(let y=0;y<h;y++){const row=[];for(let x=0;x<w;x++){row.push((x===0||y===0||x===w-1||y===h-1)?T.WALL:T.FLOOR);}g.push(row);}
    return g;
  }
  function isSolidChar(ch,hasKey){
    if(ch===T.WALL||ch===T.OBST||ch===T.WATER) return true;
    if(ch===T.DOOR) return !hasKey;
    return false;
  }

  /* ---- map metadata (shown on the Map Selection cards) ---- */
  const MAPS={
    jungle:{id:'jungle',name:'Lost Jungle',category:'Adventure / Exploration',treasureName:'Ancient Golden Chest',theme:'jungle',compete:true,
      desc:'Cross the river, hack through ruins and unlock the ancient chamber.',
      objectives:['Find the hidden key','Cross the river','Unlock the ancient chamber','Reach the Golden Chest'],objEvents:['key','clue','door','treasure'],
      start:[.07,.10], vault:[.88,.86]},
    mansion:{id:'mansion',name:'Haunted Mansion',category:'Horror / Mystery',treasureName:'Cursed Diamond',theme:'mansion',compete:true,
      desc:'Search dark rooms, dodge the wandering dead, unlock the restricted crypt.',
      objectives:['Find the key','Avoid the ghosts','Unlock the restricted room','Reach the Cursed Diamond'],objEvents:['key','clue','door','treasure'],
      start:[.92,.10], vault:[.10,.84]},
    pirate:{id:'pirate',name:'Pirate Island',category:'Historical / Fantasy',treasureName:'Pirate Gold',theme:'pirate',compete:true,
      desc:'Follow the torn map pieces across beaches and lagoons to the buried gold.',
      objectives:['Find the map piece','Find the cave key','Unlock the cave','Reach the Pirate Gold'],objEvents:['clue','key','door','treasure'],
      start:[.10,.50], vault:[.90,.50]},
    city:{id:'city',name:'City Detective',category:'Modern / Real-World',treasureName:'Stolen Diamond',theme:'city',compete:true,
      desc:'Follow the evidence trail through the streets to recover the stolen diamond.',
      objectives:['Collect the evidence','Find the access key','Unlock the warehouse','Recover the Stolen Diamond'],objEvents:['clue','key','door','treasure'],
      start:[.08,.12], vault:[.88,.55]},
    spacestation:{id:'spacestation',name:'Abandoned Space Station',category:'Sci-Fi',treasureName:'Alien Artifact',theme:'spacestation',compete:true,
      desc:'Restore power, unlock the airlock and recover the alien artifact.',
      objectives:['Find the access card','Restore power','Unlock the airlock','Recover the Alien Artifact'],objEvents:['key','clue','door','treasure'],
      start:[.07,.86], vault:[.88,.16]},
    mirror:{id:'mirror',name:'Mirror World',category:'Creative / Unusual',treasureName:'Mirror Crystal',theme:'mirror',compete:true,dual:true,
      desc:'Two connected worlds - switch dimensions to open new paths, and dodge what drifts between them.',
      objectives:['Cross the first divide (Normal World)','Find the clue','Switch to the Mirror World (press M)','Cross the second divide (Mirror World)','Reach the Mirror Crystal']}
  };
  const COMING_SOON=[];

  /* ---- seeded helpers ---- */
  function hashSeed(str){ let h=2166136261; for(let i=0;i<str.length;i++){ h^=str.charCodeAt(i); h=Math.imul(h,16777619); } return (h>>>0)||1; }
  function mulberry(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

  function findFloorNear(g,w,h,tx,ty){
    tx=clamp(Math.round(tx),2,w-3); ty=clamp(Math.round(ty),2,h-3);
    for(let r=0;r<Math.max(w,h);r++){
      for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
        if(Math.max(Math.abs(dx),Math.abs(dy))!==r) continue;
        const x=tx+dx,y=ty+dy; if(x<2||y<2||x>w-3||y>h-3) continue;
        if(g[y][x]===T.FLOOR) return {x,y};
      }
    }
    return {x:tx,y:ty};
  }
  function clearAround(g,w,h,x,y,r){
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      const nx=x+dx,ny=y+dy; if(nx>0&&ny>0&&nx<w-1&&ny<h-1) g[ny][nx]=T.FLOOR;
    }
  }
  function carveVault(g,w,h,cx,cy){
    cx=clamp(cx,4,w-5); cy=clamp(cy,4,h-5);
    const dirx = Math.abs(cx-w/2)>=Math.abs(cy-h/2) ? (cx>w/2?-1:1) : 0;
    const diry = dirx===0 ? (cy>h/2?-1:1) : 0;
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++){
      g[cy+dy][cx+dx] = (Math.abs(dx)===2||Math.abs(dy)===2) ? T.WALL : T.FLOOR;
    }
    g[cy][cx]=T.TREASURE;
    const door={x:cx+dirx*2,y:cy+diry*2}; g[door.y][door.x]=T.DOOR;
    const out={x:cx+dirx*3,y:cy+diry*3};
    clearAround(g,w,h,out.x,out.y,1);
    return {cx,cy,door,out};
  }

  /* ---- themed structure for each standard map ---- */
  const STRUCT={
    jungle(c){
      const {LG,g,w,h,diff}=c;
      LG.load(g); LG.bsp(7,65,30); LG.store(g);
      const ry=Math.floor(h*0.5), th=diff==='hard'?3:2, nb=diff==='easy'?3:(diff==='medium'?2:1);
      for(let y=ry;y<ry+th;y++) for(let x=1;x<w-1;x++) g[y][x]=T.WATER;
      for(let i=0;i<nb;i++){
        const bx=Math.floor(w*(i+1)/(nb+1))+(i%2);
        for(let y=ry-1;y<=ry+th;y++){ g[y][bx]=T.FLOOR; g[y][bx+1]=T.FLOOR; }
      }
    },
    mansion(c){ const {LG,g,diff}=c; LG.load(g); LG.bsp(4,25,15); LG.addDoors(diff==='easy'?5:diff==='medium'?8:10); LG.store(g); },
    city(c){ const {LG,g,w,h}=c; LG.load(g); LG.bsp(5,45,60); LG.addDoors(4); LG.scatter('#',Math.round(w*h/75),12,3); LG.store(g); },
    spacestation(c){ const {LG,g,diff}=c; LG.load(g); LG.bsp(4,35,45); LG.addDoors(diff==='easy'?5:8); LG.store(g); },
    pirate(c){
      const {LG,g,w,h}=c;
      LG.load(g); LG.bsp(8,70,25); LG.store(g);
      for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ if(Math.min(x,y,w-1-x,h-1-y)<=2) g[y][x]=T.WATER; }
      LG.load(g); LG.scatter('~',Math.round(w*h/140),14,4); LG.store(g);
    }
  };

  const OBST_DENS={mirror:1};

  function labelClusters(g,w,h,ch){
    const comp=[]; for(let y=0;y<h;y++) comp.push(new Array(w).fill(-1));
    let n=0;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(g[y][x]!==ch||comp[y][x]!==-1) continue;
      const st=[[x,y]]; comp[y][x]=n;
      while(st.length){
        const [cx,cy]=st.pop();
        for(let dy=-1;dy<=1;dy++) for(let dx=-1;dx<=1;dx++){
          const nx=cx+dx,ny=cy+dy; if(nx<0||ny<0||nx>=w||ny>=h) continue;
          if(g[ny][nx]===ch&&comp[ny][nx]===-1){ comp[ny][nx]=n; st.push([nx,ny]); }
        }
      }
      n++;
    }
    return {comp,n};
  }
  function assignKinds(g,w,h,list,rng){
    const kinds=[]; for(let y=0;y<h;y++) kinds.push(new Array(w).fill(null));
    const {comp,n}=labelClusters(g,w,h,T.OBST);
    const pick=[]; for(let i=0;i<n;i++) pick.push(list[Math.floor(rng()*list.length)]);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(comp[y][x]>=0) kinds[y][x]=pick[comp[y][x]];
    return kinds;
  }

  function maxDist(LG,w,h){ let m=1; for(let y=0;y<h;y++) for(let x=0;x<w;x++){ const d=LG.distAt(x,y); if(d>m) m=d; } return m; }
  function pickOne(LG,minD,maxD,minSep,tries){
    for(let i=0;i<(tries||6);i++){ const p=LG.pick(1,minD,maxD,minSep); if(p.length) return p[0]; minD=Math.max(0,minD-3); maxD+=4; }
    return null;
  }

  function unionGrid(gs,w,h){
    const u=makeGrid(w,h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      let solid=false; for(const g of gs){ if(isSolidChar(g[y][x],false)) solid=true; }
      u[y][x]=solid?T.WALL:T.FLOOR;
    }
    return u;
  }

  function makePatrols(pairs,gUnion,w,h,diff,theme,rng,spawnList){
    const R=TH.Themes.DIFF_RULES[diff], kinds=TH.Themes.THEMES[theme].mons[diff];
    const out=[];
    pairs.forEach((p,i)=>{
      const route=TH.Pathfinding.astar(gUnion,w,h,p.a,p.b,false);
      if(!route||route.length<3) return;
      out.push({a:p.a,b:p.b,route});
    });
    // hunters (they chase when they spot you) are the hardest-hitting kinds available at this difficulty
    const byDmg=kinds.slice().sort((a,b)=>TH.Themes.CREATURES[b].dmg-TH.Themes.CREATURES[a].dmg);
    const hunters=byDmg.filter(k=>TH.Themes.CREATURES[k].hunter).concat(byDmg).slice(0,Math.max(1,Math.min(2,byDmg.length)));
    const off=Math.floor(rng()*kinds.length);
    out.forEach((d,i)=>{
      const wantHunter=i<R.hunters;
      const kind = wantHunter ? hunters[i%hunters.length] : kinds[(i+off)%kinds.length];
      const cr=TH.Themes.CREATURES[kind];
      d.kind=kind; d.label=kind; d.color=cr.col[0]; d.family=cr.family;
      d.hunter=wantHunter;
      d.speed=Math.round(cr.spd*R.speed);
      d.dmg=Math.round(cr.dmg*R.dmg);
    });
    return out;
  }

  /* ---- standard (single-world) maps ---- */
  function buildStandard(id,diff,attempt){
    const meta=MAPS[id], R=TH.Themes.DIFF_RULES[diff], LG=TH.LevelGen, TD=TH.Themes.THEMES[meta.theme];
    const w=R.w,h=R.h, area=w*h;
    const seed=hashSeed(id+':'+diff)+attempt*7919;
    const rng=mulberry(seed^0x9e3779b9);
    const g=makeGrid(w,h);
    LG.seed(seed);
    STRUCT[id]({LG,g,w,h,diff,rng});

    // player start + treasure vault (JS edits), then hand over to C++
    const start=findFloorNear(g,w,h,meta.start[0]*w,meta.start[1]*h);
    clearAround(g,w,h,start.x,start.y,1);
    const vault=carveVault(g,w,h,Math.round(meta.vault[0]*w),Math.round(meta.vault[1]*h));
    LG.load(g);
    LG.reserve(start.x,start.y,2);
    for(let dy=-2;dy<=2;dy++) for(let dx=-2;dx<=2;dx++) LG.reserve(vault.cx+dx,vault.cy+dy,0);
    LG.reserve(vault.out.x,vault.out.y,1);
    LG.ensureConnected();
    LG.bfsStart(start.x,start.y);
    const D=maxDist(LG,w,h);

    // clue / key / checkpoints / coins at fair BFS distances
    const clue=pickOne(LG,Math.round(D*.22),Math.round(D*.5),1);
    if(!clue) return null;
    LG.reserve(clue.x,clue.y,1);
    let key=null;
    for(let t=0;t<12&&!key;t++){
      const k=pickOne(LG,Math.round(D*.4),Math.round(D*.78),1);
      if(k && Math.abs(k.x-clue.x)+Math.abs(k.y-clue.y)>=Math.round(w/4)) key=k;
    }
    if(!key) return null;
    LG.reserve(key.x,key.y,1);
    const checks=LG.pick(R.checks,Math.round(D*.15),Math.round(D*.85),Math.round(w/3));
    checks.forEach(p=>LG.reserve(p.x,p.y,0));
    const coins=LG.pick(R.coins,3,D,4);
    coins.forEach(p=>LG.reserve(p.x,p.y,0));

    // obstacles (themed clusters; connectivity is guaranteed by the generator)
    const clusters=Math.round(area*R.clusterK);
    LG.scatter('O',clusters,R.cluster,1);

    // hazards: scattered as impassable first (so no chokepoint is ever a hazard), converted after
    LG.store(g);
    const before=g.map(r=>r.slice());
    LG.scatter('~',R.hazards,2,2);
    LG.store(g);
    const hazards=[];
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) if(g[y][x]===T.WATER && before[y][x]!==T.WATER) hazards.push({x,y});

    // patrols
    const patrolPairs=LG.patrols(R.monsters,Math.round(w/4),Math.round(w*.75),Math.round(D*.12),start.x,start.y);
    LG.bfsStart(start.x,start.y);
    // computer opponent starts a few tiles from the player
    const cs=[]; for(let y=1;y<h-1;y++) for(let x=1;x<w-1;x++){ const d=LG.distAt(x,y); if(d>=4&&d<=9&&g[y][x]===T.FLOOR&&!(x===start.x&&y===start.y)) cs.push({x,y}); }
    const computerStart=cs.length?cs[Math.floor(rng()*cs.length)]:{x:start.x+1,y:start.y};

    // apply pickups / hazards
    hazards.forEach(p=>g[p.y][p.x]=T.HAZARD);
    g[clue.y][clue.x]=T.CLUE; g[key.y][key.x]=T.KEY;
    checks.forEach(p=>g[p.y][p.x]=T.CHECK);
    coins.forEach(p=>g[p.y][p.x]=T.COIN);

    const obstKinds=assignKinds(g,w,h,TD.obst[diff],rng);
    const patrols=makePatrols(patrolPairs,g,w,h,diff,meta.theme,rng);
    const variant=[]; for(let y=0;y<h;y++){ const r=[]; for(let x=0;x<w;x++) r.push(Math.floor(rng()*4)); variant.push(r); }

    return Object.assign({},meta,{
      grid:g,w,h,seed,diffKey:diff,difficulty:R.label,hasDoor:true,
      playerStart:start,computerStart,vault,treasure:{x:vault.cx,y:vault.cy},clue,key,
      obstKinds,variant,patrols,dual:false
    });
  }

  /* ---- Mirror World (two grids that share pickups) ---- */
  function buildMirror(diff,attempt){
    const meta=MAPS.mirror, R=TH.Themes.DIFF_RULES[diff], LG=TH.LevelGen, TD=TH.Themes.THEMES.mirror;
    const w=R.w,h=R.h, area=w*h;
    const seed=hashSeed('mirror:'+diff)+attempt*7919, rng=mulberry(seed^0x9e3779b9);
    LG.seed(seed);
    const x1=Math.round(w/3), x2=Math.round(2*w/3), gapW=diff==='hard'?1:2;
    const gy1=2+Math.floor(rng()*(h-4-gapW)), gy2=2+Math.floor(rng()*(h-4-gapW));
    const gN=makeGrid(w,h), gM=makeGrid(w,h);
    for(let y=1;y<h-1;y++){ gN[y][x1]=T.WALL; gM[y][x1]=T.WALL; gN[y][x2]=T.WALL; gM[y][x2]=T.WALL; }
    for(let k=0;k<gapW;k++){ gN[gy1+k][x1]=T.FLOOR; gM[gy2+k][x2]=T.FLOOR; }
    const start={x:2,y:Math.floor(h/2)}, treasure={x:w-4,y:Math.floor(h/2)};
    const gateA={x:x2-1,y:gy2}, gateB={x:x2+1,y:gy2};
    function reserveShared(extra){
      LG.reserve(start.x,start.y,2); LG.reserve(treasure.x,treasure.y,1);
      LG.reserve(x1-1,gy1,1); LG.reserve(x1+1,gy1,1); LG.reserve(gateA.x,gateA.y,1); LG.reserve(gateB.x,gateB.y,1);
      (extra||[]).forEach(p=>LG.reserve(p.x,p.y,p.r||0));
    }
    // pass A: region 3 items, from the mirror side of the second divide
    LG.load(gM); reserveShared(); LG.bfsStart(gateB.x,gateB.y);
    const inR3=p=>p.x>x2+1;
    const coinsB=LG.pick(Math.round(R.coins*.35),2,200,4).filter(inR3);
    const checkB=LG.pick(1,3,200,4).filter(inR3);
    const hazB=LG.pick(Math.round(R.hazards*.3),2,200,3).filter(inR3);
    // pass B: regions 1-2 from the normal side
    const used=[...coinsB,...checkB,...hazB];
    LG.load(gN); reserveShared(used); LG.bfsStart(start.x,start.y);
    let clue=null;
    for(let t=0;t<30&&!clue;t++){ const p=pickOne(LG,4,200,1,2); if(p&&p.x>x1+2&&p.x<x2-2) clue=p; }
    if(!clue) return null;
    LG.reserve(clue.x,clue.y,1);
    const inA=p=>p.x<x2-1&&p.x>1;
    const coinsA=LG.pick(Math.round(R.coins*.65),3,200,4).filter(inA);
    coinsA.forEach(p=>LG.reserve(p.x,p.y,0));
    const checksA=LG.pick(R.checks-1,6,200,Math.round(w/4)).filter(inA);
    checksA.forEach(p=>LG.reserve(p.x,p.y,0));
    const hazA=LG.pick(Math.round(R.hazards*.7),6,200,3).filter(p=>inA(p)&&p.x>3);
    hazA.forEach(p=>LG.reserve(p.x,p.y,0));
    const shared=[...used,clue,...coinsA,...checksA,...hazA];
    LG.scatter('O',Math.round(area*R.clusterK),R.cluster,1);
    LG.store(gN);
    // pass C: mirror world obstacles
    LG.load(gM); reserveShared(shared.map(p=>({x:p.x,y:p.y,r:p===clue?1:0})));
    LG.scatter('O',Math.round(area*R.clusterK),R.cluster,1);
    LG.store(gM);
    // patrols per region (union of both worlds so routes are legal everywhere)
    const gU=unionGrid([gN,gM],w,h);
    LG.load(gU);
    const m=R.monsters, pairs=[];
    [[start,Math.ceil(m*.3),8],[{x:x1+1,y:gy1},Math.ceil(m*.4),0],[{x:x2+1,y:gy2},m-Math.ceil(m*.3)-Math.ceil(m*.4),0]].forEach(([s,n,ms])=>{
      if(n<=0||gU[s.y][s.x]!==T.FLOOR) return;
      LG.patrols(n,5,Math.round(w*.4),ms,s.x,s.y).forEach(p=>pairs.push(p));
    });
    const patrols=makePatrols(pairs,gU,w,h,diff,'mirror',rng);
    // AI start
    LG.load(gN); LG.bfsStart(start.x,start.y);
    const cs=[]; for(let y=1;y<h-1;y++) for(let x=1;x<x1;x++){ const d=LG.distAt(x,y); if(d>=3&&d<=8&&gN[y][x]===T.FLOOR&&gM[y][x]===T.FLOOR) cs.push({x,y}); }
    const computerStart=cs.length?cs[Math.floor(rng()*cs.length)]:{x:start.x,y:start.y+1};

    for(const g of [gN,gM]){
      shared.forEach(p=>g[p.y][p.x]=T.FLOOR);
      hazA.concat(hazB).forEach(p=>g[p.y][p.x]=T.HAZARD);
      coinsA.concat(coinsB).forEach(p=>g[p.y][p.x]=T.COIN);
      checksA.concat(checkB).forEach(p=>g[p.y][p.x]=T.CHECK);
      g[clue.y][clue.x]=T.CLUE; g[treasure.y][treasure.x]=T.TREASURE;
    }
    const obstKinds=assignKinds(gN,w,h,TD.obst[diff],rng), obstKindsM=assignKinds(gM,w,h,TD.obst[diff],rng);
    const variant=[]; for(let y=0;y<h;y++){ const r=[]; for(let x=0;x<w;x++) r.push(Math.floor(rng()*4)); variant.push(r); }
    return Object.assign({},meta,{
      grid:gN,mirrorGrid:gM,w,h,seed,diffKey:diff,difficulty:R.label,hasDoor:false,
      playerStart:start,computerStart,treasure,clue,obstKinds,obstKindsM,variant,patrols,dual:true,
      divs:{x1,x2,gy1,gy2,gapW},gate:gateA
    });
  }

  /* ---- solvability check (BFS) ---- */
  function bfsReach(g,w,h,s,hasKey){
    const seen=new Set([s.x+','+s.y]), q=[s];
    while(q.length){
      const c=q.pop();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(([dx,dy])=>{
        const nx=c.x+dx,ny=c.y+dy,k=nx+','+ny;
        if(nx<0||ny<0||nx>=w||ny>=h||seen.has(k)||isSolidChar(g[ny][nx],hasKey)) return;
        seen.add(k); q.push({x:nx,y:ny});
      });
    }
    return seen;
  }
  function validate(m){
    const has=(set,p)=>set.has(p.x+','+p.y);
    if(m.dual){
      const a=bfsReach(m.grid,m.w,m.h,m.playerStart,false);
      if(!has(a,m.clue)||!has(a,m.gate)) return false;
      const gB={x:m.divs.x2+1,y:m.divs.gy2};
      const b=bfsReach(m.mirrorGrid,m.w,m.h,m.gate,false);
      return has(b,m.treasure)&&has(b,gB);
    }
    const noKey=bfsReach(m.grid,m.w,m.h,m.playerStart,false);
    if(!has(noKey,m.clue)||!has(noKey,m.key)) return false;
    const withKey=bfsReach(m.grid,m.w,m.h,m.playerStart,true);
    return has(withKey,m.treasure);
  }

  function build(id,diff){
    for(let attempt=0;attempt<12;attempt++){
      const m = id==='mirror' ? buildMirror(diff,attempt) : buildStandard(id,diff,attempt);
      if(m && validate(m)) return m;
    }
    throw new Error('Could not build a solvable level for '+id+'/'+diff);
  }

  window.TH = window.TH || {};
  TH.Maps = {T, makeGrid, isSolidChar, MAPS, COMING_SOON, build, validate, bfsReach};
})();
