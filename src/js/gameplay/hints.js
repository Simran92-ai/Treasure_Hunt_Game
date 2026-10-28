/* hints.js
 * Builds the in-HUD hint buttons and implements the four hint tiers
 * (basic direction, key/clue location, and path-preview flashes).
 * Exposes: TH.Hints = { buildPanel, use, updateButtons }
 */
(function(){
  let hintTimer=0;
  function buildPanel(){
    clearTimeout(hintTimer); document.getElementById('hintMsg').textContent='';
    const p=document.getElementById('hintPanel'); p.innerHTML='';
    const defs=[['basic','Basic Direction (-50)'],['nav','Navigation (-100)'],['adv','Advanced Path (-150)'],['key','Key/Clue Location (-100)']];
    defs.forEach(([k,label])=>{
      const b=document.createElement('button'); b.className='hintbtn'; b.textContent=label; b.id='hb_'+k;
      b.onclick=()=>use(k); p.appendChild(b);
    });
  }

  function goalForHint(){
    const s=TH.GameState.State; const T=TH.Maps.T;
    if(s.map.hasDoor && !s.hasKey){
      const g=TH.GameState.activeGrid();
      for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++) if(g[y][x]===T.KEY) return {x,y};
    }
    const g=TH.GameState.activeGrid();
    for(let y=0;y<s.gh;y++) for(let x=0;x<s.gw;x++) if(g[y][x]===T.TREASURE) return {x,y};
    return null;
  }

  function use(kind){
    const s=TH.GameState.State;
    const HINT_COSTS=TH.GameState.HINT_COSTS;
    if(s.hintCooldown>0) return;
    const cost=HINT_COSTS[kind];
    if(s.score<cost) return;
    TH.Score.spend(cost);
    const goal=goalForHint();
    const pt=TH.GameState.tileAt(s.player.px+s.player.w/2, s.player.py+s.player.h/2);
    if(!goal){
      document.getElementById('hintMsg').textContent='No objective found.';
    } else if(kind==='basic'){
      const dx=goal.x-pt.x, dy=goal.y-pt.y;
      let txt='The way lies ';
      txt+= (Math.abs(dy)>Math.abs(dx)? (dy<0?'to the north':'to the south') : (dx<0?'to the west':'to the east'));
      document.getElementById('hintMsg').textContent=txt+'.';
    } else if(kind==='key'){
      const dx=goal.x-pt.x, dy=goal.y-pt.y;
      const ns=dy<0?'north':'south', ew=dx<0?'west':'east';
      document.getElementById('hintMsg').textContent='It rests somewhere to the '+ns+'-'+ew+'.';
    } else {
      const p=TH.Pathfinding.astar(TH.GameState.activeGrid(), s.gw, s.gh, pt, goal, s.hasKey);
      if(p){
        s.hintFlashPath=p.slice(0, kind==='adv'?14:5); s.hintFlashT=3.5;
        document.getElementById('hintMsg').textContent='Path revealed on the map.';
      }
    }
    s.hintCooldown=8000; s.hintFlashPath=kind==='basic'||kind==='key'?[]:s.hintFlashPath;
    updateButtons();
    clearTimeout(hintTimer); hintTimer=setTimeout(()=>{ s.hintCooldown=0; updateButtons(); },8000);
  }

  function updateButtons(){
    const s=TH.GameState.State; const HINT_COSTS=TH.GameState.HINT_COSTS;
    ['basic','nav','adv','key'].forEach(k=>{
      const b=document.getElementById('hb_'+k);
      if(!b) return;
      b.disabled = s.hintCooldown>0 || s.score<HINT_COSTS[k];
    });
  }

  window.TH = window.TH || {};
  TH.Hints = {buildPanel, use, updateButtons};
})();
