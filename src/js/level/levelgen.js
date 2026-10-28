/* levelgen.js
 * Bridge to the C++ level generator (cpp/levelgen.cpp, compiled to WebAssembly
 * and embedded in levelgen_wasm.js).  If WebAssembly is unavailable the exact
 * same algorithms run from the JavaScript port below, so the game always works.
 *
 * Exposes: TH.LevelGen = { ready, isWasm, load, store, reserve, seed, bsp,
 *   addDoors, scatter, ensureConnected, components, bfsStart, distAt,
 *   pick, patrols }
 */
(function(){
  const MAXW=64, MAXH=64, MAXN=MAXW*MAXH;
  const DX=[1,-1,0,0], DY=[0,0,1,-1];

  /* ---------- JavaScript port of levelgen.cpp (fallback) ---------- */
  function makeJS(){
    const G=new Uint8Array(MAXN), R=new Uint8Array(MAXN);
    const D=new Int32Array(MAXN), DS=new Int32Array(MAXN), L=new Int32Array(MAXN), Q=new Int32Array(MAXN);
    const OUT=new Int32Array(1024);
    let S=2463534242, W=0, H=0;
    const rnd=()=>{ S^=S<<13; S^=S>>>17; S^=S<<5; S>>>=0; return S; };
    const rint=n=>n<=0?0:(rnd()%n);
    const WALL=35, FLOOR=46, OBST=79, WATER=126;
    const passable=c=>c!==WALL && c!==OBST && c!==WATER;
    const inb=(x,y)=>x>=0&&y>=0&&x<W&&y<H;

    function label(){
      for(let i=0;i<W*H;i++) L[i]=-1;
      let n=0;
      for(let s=0;s<W*H;s++){
        if(L[s]!==-1||!passable(G[s])) continue;
        let qh=0,qt=0; Q[qt++]=s; L[s]=n;
        while(qh<qt){
          const c=Q[qh++], cx=c%W, cy=(c/W)|0;
          for(let d=0;d<4;d++){
            const nx=cx+DX[d], ny=cy+DY[d]; if(!inb(nx,ny)) continue;
            const ni=ny*W+nx; if(L[ni]!==-1||!passable(G[ni])) continue;
            L[ni]=n; Q[qt++]=ni;
          }
        }
        n++;
      }
      return n;
    }
    function bfsInto(dist,sx,sy){
      for(let i=0;i<W*H;i++) dist[i]=-1;
      if(!inb(sx,sy)||!passable(G[sy*W+sx])) return 0;
      let qh=0,qt=0; Q[qt++]=sy*W+sx; dist[sy*W+sx]=0;
      while(qh<qt){
        const c=Q[qh++], cx=c%W, cy=(c/W)|0;
        for(let d=0;d<4;d++){
          const nx=cx+DX[d], ny=cy+DY[d]; if(!inb(nx,ny)) continue;
          const ni=ny*W+nx; if(dist[ni]!==-1||!passable(G[ni])) continue;
          dist[ni]=dist[c]+1; Q[qt++]=ni;
        }
      }
      return qt;
    }
    function ensure_connected(){
      for(let iter=0;iter<400;iter++){
        const comps=label(); if(comps<=1) return comps;
        const total=W*H, off=rint(total); let done=0;
        for(let k=0;k<total&&!done;k++){
          const i=(k+off)%total, x=i%W, y=(i/W)|0;
          if(x<1||y<1||x>=W-1||y>=H-1) continue;
          if(G[i]!==WALL||R[i]) continue;
          const a=L[y*W+x-1], b=L[y*W+x+1], c=L[(y-1)*W+x], d=L[(y+1)*W+x];
          if((a>=0&&b>=0&&a!==b)||(c>=0&&d>=0&&c!==d)){ G[i]=FLOOR; done=1; }
        }
        if(!done) return comps;
      }
      return label();
    }
    function bsp_rooms(minRoom,stopPct,wideDoorPct){
      const st=[]; st.push([1,1,W-2,H-2]);
      while(st.length&&st.length<250){
        const [x0,y0,x1,y1]=st.pop(); const rw=x1-x0+1, rh=y1-y0+1;
        const canV=rw>=2*minRoom+1, canH=rh>=2*minRoom+1;
        if(!canV&&!canH) continue;
        if(rw*rh<minRoom*minRoom*5 && rint(100)<stopPct) continue;
        let vertical;
        if(canV&&canH){ if(rw*10>rh*13) vertical=true; else if(rh*10>rw*13) vertical=false; else vertical=rint(2)===0; }
        else vertical=canV;
        if(vertical){
          const x=x0+minRoom+rint(rw-2*minRoom);
          for(let y=y0;y<=y1;y++) G[y*W+x]=WALL;
          const dy=y0+rint(rh); G[dy*W+x]=FLOOR;
          if(rint(100)<wideDoorPct&&dy+1<=y1) G[(dy+1)*W+x]=FLOOR;
          if(rh>=12){ const d2=y0+rint(rh); G[d2*W+x]=FLOOR; }
          st.push([x0,y0,x-1,y1]); st.push([x+1,y0,x1,y1]);
        } else {
          const y=y0+minRoom+rint(rh-2*minRoom);
          for(let x=x0;x<=x1;x++) G[y*W+x]=WALL;
          const dx=x0+rint(rw); G[y*W+dx]=FLOOR;
          if(rint(100)<wideDoorPct&&dx+1<=x1) G[y*W+dx+1]=FLOOR;
          if(rw>=12){ const d2=x0+rint(rw); G[y*W+d2]=FLOOR; }
          st.push([x0,y0,x1,y-1]); st.push([x0,y+1,x1,y1]);
        }
      }
      ensure_connected();
    }
    function add_doors(count){
      let made=0;
      for(let a=0;a<count*60&&made<count;a++){
        const x=1+rint(W-2), y=1+rint(H-2), i=y*W+x;
        if(G[i]!==WALL||R[i]) continue;
        const h=passable(G[i-1])&&passable(G[i+1])&&G[i-W]===WALL&&G[i+W]===WALL;
        const v=passable(G[i-W])&&passable(G[i+W])&&G[i-1]===WALL&&G[i+1]===WALL;
        if(h||v){ G[i]=FLOOR; made++; }
      }
      return made;
    }
    function scatter(ch,count,maxCluster,spread){
      let placed=0, base=label();
      for(let attempt=0;attempt<count*40&&placed<count;attempt++){
        const x=1+rint(W-2), y=1+rint(H-2), i=y*W+x;
        if(G[i]!==FLOOR||R[i]) continue;
        if(spread>0){
          let near=false;
          for(let dy=-spread;dy<=spread&&!near;dy++) for(let dx=-spread;dx<=spread;dx++){
            const nx=x+dx, ny=y+dy; if(inb(nx,ny)&&G[ny*W+nx]===ch){ near=true; break; }
          }
          if(near) continue;
        }
        const cells=[i]; const want=1+rint(maxCluster>15?15:maxCluster);
        for(let t=0;t<want*4&&cells.length<want;t++){
          const from=cells[rint(cells.length)], d=rint(4);
          const nx=from%W+DX[d], ny=((from/W)|0)+DY[d];
          if(!inb(nx,ny)||nx<1||ny<1||nx>=W-1||ny>=H-1) continue;
          const ni=ny*W+nx; if(G[ni]!==FLOOR||R[ni]) continue;
          if(cells.indexOf(ni)<0) cells.push(ni);
        }
        for(const c of cells) G[c]=ch;
        const now=label();
        if(now>base){ for(const c of cells) G[c]=FLOOR; } else { base=now; placed++; }
      }
      return placed;
    }
    function bfs_start(sx,sy){ const n=bfsInto(D,sx,sy); for(let i=0;i<W*H;i++) DS[i]=D[i]; return n; }
    function pick_points(n,minDist,maxDist,minSep){
      let got=0;
      for(let a=0;a<4000&&got<n;a++){
        const x=1+rint(W-2), y=1+rint(H-2), i=y*W+x;
        if(G[i]!==FLOOR||R[i]) continue;
        if(DS[i]<minDist||DS[i]>maxDist) continue;
        let ok=true;
        for(let k=0;k<got;k++){ if(Math.abs(OUT[2*k]-x)+Math.abs(OUT[2*k+1]-y)<minSep){ ok=false; break; } }
        if(!ok) continue;
        OUT[2*got]=x; OUT[2*got+1]=y; got++;
      }
      return got;
    }
    function patrol_pairs(n,minLen,maxLen,minStartDist,sx,sy){
      bfs_start(sx,sy); let got=0;
      for(let a=0;a<n*300&&got<n;a++){
        const ax=1+rint(W-2), ay=1+rint(H-2), ai=ay*W+ax;
        if(G[ai]!==FLOOR||R[ai]||DS[ai]<minStartDist) continue;
        bfsInto(D,ax,ay);
        for(let t=0;t<120;t++){
          const bx=1+rint(W-2), by=1+rint(H-2), bi=by*W+bx;
          if(G[bi]!==FLOOR||R[bi]||D[bi]<minLen||D[bi]>maxLen) continue;
          OUT[4*got]=ax; OUT[4*got+1]=ay; OUT[4*got+2]=bx; OUT[4*got+3]=by; got++; break;
        }
      }
      return got;
    }
    return {
      grid:G, reserveBuf:R, distBuf:D, out:OUT,
      set_seed(s){ S=s?(s>>>0):2463534242; for(let i=0;i<8;i++) rnd(); },
      next_rand:rnd, set_size(w,h){ W=w; H=h; },
      count_components:label, ensure_connected, bsp_rooms, add_doors, scatter,
      bfs_start, pick_points, patrol_pairs
    };
  }

  /* ---------- wrapper ---------- */
  const LG={ isWasm:false, W:0, H:0 };
  let N=null;           // active backend: wasm exports or JS port
  let G,R,D,OUT;        // typed views

  function bindViews(n,memBuf){
    if(memBuf){
      G=new Uint8Array(memBuf,n.grid_ptr(),MAXN); R=new Uint8Array(memBuf,n.reserve_ptr(),MAXN);
      D=new Int32Array(memBuf,n.dist_ptr(),MAXN); OUT=new Int32Array(memBuf,n.out_ptr(),1024);
    } else { G=n.grid; R=n.reserveBuf; D=n.distBuf; OUT=n.out; }
  }
  function useJS(){ N=makeJS(); LG.isWasm=false; bindViews(N,null); }

  LG.ready=(async function(){
    try{
      if(typeof WebAssembly==='undefined' || !TH.LEVELGEN_WASM_B64) throw new Error('no wasm');
      const bin=Uint8Array.from(atob(TH.LEVELGEN_WASM_B64),c=>c.charCodeAt(0));
      const {instance}=await WebAssembly.instantiate(bin,{});
      const ex=instance.exports;
      N=ex; bindViews(ex,ex.memory.buffer); LG.isWasm=true;
    }catch(e){ console.warn('LevelGen: using JS fallback',e&&e.message); useJS(); }
    return LG;
  })();

  /* grid is an array of rows of 1-char strings (as maps.js uses) */
  LG.load=function(grid){
    const h=grid.length, w=grid[0].length; LG.W=w; LG.H=h;
    N.set_size(w,h); R.fill(0,0,w*h);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) G[y*w+x]=grid[y][x].charCodeAt(0);
  };
  LG.store=function(grid){
    const w=LG.W,h=LG.H;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) grid[y][x]=String.fromCharCode(G[y*w+x]);
  };
  LG.reserve=function(x,y,r){
    r=r||0;
    for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){
      const nx=x+dx, ny=y+dy; if(nx>=0&&ny>=0&&nx<LG.W&&ny<LG.H) R[ny*LG.W+nx]=1;
    }
  };
  LG.seed=s=>N.set_seed(s>>>0);
  LG.bsp=(minRoom,stopPct,widePct)=>N.bsp_rooms(minRoom,stopPct,widePct);
  LG.addDoors=n=>N.add_doors(n);
  LG.scatter=(ch,count,maxCluster,spread)=>N.scatter(ch.charCodeAt(0),count,maxCluster,spread||0);
  LG.ensureConnected=()=>N.ensure_connected();
  LG.components=()=>N.count_components();
  LG.bfsStart=(x,y)=>N.bfs_start(x,y);
  LG.distAt=(x,y)=>D[y*LG.W+x];
  LG.rand=()=>N.next_rand();
  LG.pick=function(n,minD,maxD,minSep){
    const got=N.pick_points(n,minD,maxD,minSep), out=[];
    for(let i=0;i<got;i++) out.push({x:OUT[2*i],y:OUT[2*i+1]});
    return out;
  };
  LG.patrols=function(n,minLen,maxLen,minStart,sx,sy){
    const got=N.patrol_pairs(n,minLen,maxLen,minStart,sx,sy), out=[];
    for(let i=0;i<got;i++) out.push({a:{x:OUT[4*i],y:OUT[4*i+1]},b:{x:OUT[4*i+2],y:OUT[4*i+3]}});
    return out;
  };
  LG._forceJS=function(){ useJS(); };   // used by tests

  window.TH=window.TH||{};
  TH.LevelGen=LG;
})();
