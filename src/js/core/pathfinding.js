/* pathfinding.js
 * Grid-based A* search (binary-heap open list). Used by the computer
 * opponent, hunting monsters, patrol routes and the hint system.
 * Hazard tiles cost extra so routes avoid them when they can.
 * Exposes: TH.Pathfinding = { astar }
 */
(function(){
  function astar(grid,w,h,start,goal,hasKey,opts){
    opts=opts||{};
    const hazCost = opts.hazardCost===undefined ? 5 : opts.hazardCost;
    const maxIter = opts.maxIter || 40000;
    const N=w*h, gs=new Float32Array(N).fill(1e9), parent=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
    const heap=[]; // [f,idx]
    function push(f,i){ heap.push([f,i]); let c=heap.length-1; while(c>0){ const p=(c-1)>>1; if(heap[p][0]<=heap[c][0]) break; [heap[p],heap[c]]=[heap[c],heap[p]]; c=p; } }
    function pop(){ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let c=0; for(;;){ let l=c*2+1,r=l+1,m=c; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===c) break; [heap[m],heap[c]]=[heap[c],heap[m]]; c=m; } } return top; }
    const si=start.y*w+start.x, gi=goal.y*w+goal.x;
    gs[si]=0; push(Math.abs(start.x-goal.x)+Math.abs(start.y-goal.y),si);
    let it=0;
    while(heap.length && it++<maxIter){
      const [,cur]=pop();
      if(closed[cur]) continue; closed[cur]=1;
      if(cur===gi){
        const path=[]; let n=cur; while(n!==-1){ path.push({x:n%w,y:(n/w)|0}); n=parent[n]; } return path.reverse();
      }
      const cx=cur%w, cy=(cur/w)|0;
      for(let d=0;d<4;d++){
        const nx=cx+(d===0?1:d===1?-1:0), ny=cy+(d===2?1:d===3?-1:0);
        if(nx<0||ny<0||nx>=w||ny>=h) continue;
        const ni=ny*w+nx; if(closed[ni]) continue;
        const ch=grid[ny][nx];
        if(TH.Maps.isSolidChar(ch,hasKey)) continue;
        const ng=gs[cur]+1+(ch==='H'?hazCost:0);
        if(ng<gs[ni]){ gs[ni]=ng; parent[ni]=cur; push(ng+Math.abs(nx-goal.x)+Math.abs(ny-goal.y),ni); }
      }
    }
    return null;
  }

  window.TH = window.TH || {};
  TH.Pathfinding = {astar};
})();
