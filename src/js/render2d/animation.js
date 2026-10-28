/* animation.js
 * Small reusable animation/drawing helpers used by the renderer and
 * the results screen: water shimmer color, character bob offset, the
 * animated "monster" blob shape, and the minimal win-scene trophy icon.
 * Exposes: TH.Animation = { shimmerColor, bobOffset, drawMonsterBlob, drawWinScene }
 */
(function(){
  function shimmerColor(time,x,y){
    const v=(Math.sin(time*2+x*0.7+y)+1)/2;
    const l=20+v*10;
    return `hsl(200,55%,${l}%)`;
  }

  function bobOffset(animVal){ return Math.sin(animVal)*2; }

  function drawMonsterBlob(ctx,x,y,time,color){
    ctx.fillStyle=color;
    ctx.beginPath();
    for(let i=0;i<10;i++){
      const ang=(i/10)*Math.PI*2 + time*3;
      const r = i%2===0 ? 15 : 8;
      const mx=x+4+Math.cos(ang)*r, my=y+4+Math.sin(ang)*r;
      if(i===0) ctx.moveTo(mx,my); else ctx.lineTo(mx,my);
    }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle='#fff';
    ctx.beginPath(); ctx.arc(x-1,y+2,2.4,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(x+9,y+2,2.4,0,7); ctx.fill();
    ctx.fillStyle='#c0202a';
    ctx.beginPath(); ctx.arc(x-1,y+2,1.1,0,7); ctx.fill();
    ctx.beginPath(); ctx.arc(x+9,y+2,1.1,0,7); ctx.fill();
  }

  // Minimal, standard "trophy" win icon (replaces the earlier crowned-player scene).
  function drawWinScene(winCtx,winCanvas){
    if(!winCtx) return;
    const w=winCanvas.width,h=winCanvas.height;
    winCtx.clearRect(0,0,w,h);
    const grad=winCtx.createRadialGradient(w/2,h/2-6,10,w/2,h/2-6,90);
    grad.addColorStop(0,'rgba(217,164,65,.30)'); grad.addColorStop(1,'rgba(217,164,65,0)');
    winCtx.fillStyle=grad; winCtx.fillRect(0,0,w,h);

    const cx=w/2, cy=h/2-6, gold='#ffd76b', goldDark='#c9a24a', line='#a97c22';
    winCtx.strokeStyle=line; winCtx.lineWidth=2; winCtx.lineJoin='round';

    // base
    winCtx.fillStyle=goldDark;
    winCtx.fillRect(cx-22,cy+46,44,8);
    winCtx.strokeRect(cx-22,cy+46,44,8);
    // stem
    winCtx.fillStyle=gold;
    winCtx.fillRect(cx-6,cy+30,12,18);
    winCtx.strokeRect(cx-6,cy+30,12,18);
    // cup bowl
    winCtx.beginPath();
    winCtx.moveTo(cx-24,cy-18);
    winCtx.lineTo(cx+24,cy-18);
    winCtx.lineTo(cx+13,cy+30);
    winCtx.lineTo(cx-13,cy+30);
    winCtx.closePath();
    winCtx.fillStyle=gold; winCtx.fill(); winCtx.stroke();
    // cup rim
    winCtx.fillStyle=goldDark;
    winCtx.fillRect(cx-26,cy-24,52,8);
    winCtx.strokeRect(cx-26,cy-24,52,8);
    // handles
    winCtx.beginPath(); winCtx.arc(cx-30,cy-2,12,Math.PI*0.15,Math.PI*1.6); winCtx.stroke();
    winCtx.beginPath(); winCtx.arc(cx+30,cy-2,12,Math.PI*1.4,Math.PI*2.85); winCtx.stroke();
    // simple star engraving on the cup
    winCtx.fillStyle='rgba(255,255,255,.55)';
    winCtx.save(); winCtx.translate(cx,cy+2);
    winCtx.beginPath();
    for(let i=0;i<5;i++){
      const ang=-Math.PI/2 + i*(Math.PI*2/5);
      const ang2=ang+Math.PI/5;
      winCtx.lineTo(Math.cos(ang)*8,Math.sin(ang)*8);
      winCtx.lineTo(Math.cos(ang2)*3.3,Math.sin(ang2)*3.3);
    }
    winCtx.closePath(); winCtx.fill();
    winCtx.restore();

    // a few minimal sparkles
    winCtx.fillStyle='#fff';
    [[cx-52,cy-30],[cx+56,cy-20],[cx+44,cy+38]].forEach(([sx,sy])=>{
      winCtx.save(); winCtx.translate(sx,sy);
      winCtx.fillRect(-1,-6,2,12); winCtx.fillRect(-6,-1,12,2);
      winCtx.restore();
    });
  }

  window.TH = window.TH || {};
  TH.Animation = {shimmerColor, bobOffset, drawMonsterBlob, drawWinScene};
})();
