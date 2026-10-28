/* game.js
 * The orchestrator. Owns the requestAnimationFrame loop, keyboard
 * state, pause/resume/restart, life loss, the 2D <-> 3D view switch and
 * the win/lose/end-game flow.
 * Exposes: TH.Game = { start, stop, pause, resume, restart, loseLife,
 *                       finishPlayer, finishAI, endGame, isRunning,
 *                       switchWorld, toggleView, enable3D, applyView, keys }
 */
(function(){
  let raf=null, lastT=0, fpsAcc=0, fpsN=0;
  const keys={};

  function switchWorld(){
    const s=TH.GameState.State;
    if(!(s.running && !s.paused && !s.ended && s.map && s.map.dual)) return;
    s.worldMode = s.worldMode==='normal' ? 'mirror' : 'normal';
    s.worldSwitchCount++; s.worldFlash=.6;
    s.aiTimer=0; s.aiPath=[];
    TH.Collision.nudge(s.player,s.gw,s.gh,TH.GameState.activeGrid(),s.hasKey); // never leave the player inside a wall
    if(TH.Scene3D && TH.Scene3D.active) TH.Scene3D.onWorldSwitch();
  }

  window.addEventListener('keydown', e=>{
    const k=e.key.toLowerCase();
    keys[k]=true;
    const s=TH.GameState.State;
    if((e.key==='p'||e.key==='P'||e.key==='Escape') && s.running && !s.ended){
      if(!document.getElementById('gameScreen').classList.contains('active')) return;
      e.preventDefault();
      if(s.paused){ window.resumeGame(); } else { window.pauseGame(); }
    }
    if(k==='m' && s.map && s.map.dual) switchWorld();
    if(k==='v' && s.running && !s.ended && document.getElementById('gameScreen').classList.contains('active')) toggleView();
  });
  window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()]=false; });

  function gameScreenActive(){ return document.getElementById('gameScreen').classList.contains('active'); }

  /* ---- 2D / 3D view ---- */
  let in3d=false; // current view while playing (3D is on by default when enabled in Settings)
  function wants3D(){ return !!TH.UI.Settings.view3d && in3d; }
  function applyView(){
    const s=TH.GameState.State;
    const c2=document.getElementById('gameCanvas'), c3=document.getElementById('gl3d');
    let use3d=wants3D();
    const can3d=!!(TH.Scene3D && TH.Scene3D.supported());
    if(use3d && !can3d){ use3d=false; in3d=false; TH.UI.toast('3D needs WebGL2 - not available on this device'); }
    if(use3d){
      TH.Scene3D.ensure(); c3.style.display='block'; c2.style.visibility='hidden'; TH.Scene3D.active=true;
    } else {
      c3.style.display='none'; c2.style.visibility='visible'; if(TH.Scene3D) TH.Scene3D.active=false; s.camYaw=0;
    }
    TH.CG.stats.mode=use3d?'3d':'2d';
    const b=document.getElementById('viewBtn'); if(b){ b.textContent=use3d?'2D View':'3D View'; b.style.display=(TH.UI.Settings.view3d&&can3d)?'':'none'; }
    TH.UI.refreshToggles();
    TH.Renderer.resizeCanvas();
  }
  function enable3D(){ in3d=true; applyView(); }
  function toggleView(){
    if(!TH.UI.Settings.view3d) { TH.UI.toast('Turn on Enhanced 3D View in Settings to switch views'); return; }
    in3d=!in3d; applyView();
  }

  async function start(mapId,mode,diff,untimed){
    await TH.LevelGen.ready;
    try{ TH.GameState.reset(mapId,mode,diff,untimed); }
    catch(err){ console.error(err); TH.UI.toast('Could not build level: '+err.message); return; }
    const s=TH.GameState.State;
    document.getElementById('hudMapName').textContent =
      s.map.name.toUpperCase()+' • '+s.map.difficulty.toUpperCase()+(mode==='compete' ? ' • RACE' : '')+(s.untimed?' • NO TIME LIMIT':'');
    TH.Hints.buildPanel();
    in3d=false;
    TH.UI.goto('game');
    TH.UI.closeOverlay('resultsOverlay');
    TH.UI.closeOverlay('pauseOverlay');
    if(TH.Scene3D) TH.Scene3D.invalidate();
    applyView();
    TH.CGPanel.build();
    lastT=performance.now();
    if(raf) cancelAnimationFrame(raf);
    raf=requestAnimationFrame(loop);
  }
  function stop(){ TH.GameState.State.running=false; if(raf) cancelAnimationFrame(raf); }
  function pause(){ TH.GameState.State.paused=true; }
  function resume(){ TH.GameState.State.paused=false; lastT=performance.now(); }
  function restart(){
    const s=TH.GameState.State;
    start(s.currentMapId, s.mode, s.diff, s.untimed);
  }

  function loseLife(){
    const s=TH.GameState.State;
    s.lives--; s.health=100;
    s.player.px=s.lastCheckpoint.x; s.player.py=s.lastCheckpoint.y;
    s.player.invuln=2; s.camLeadX=0;
    if(s.lives<=0) endGame('gameover');
  }

  function finishPlayer(){
    const s=TH.GameState.State;
    if(s.playerFinishTime!==null) return;
    s.playerFinishTime=(performance.now()-s.startTime)/1000;
    s.objectivesDone=s.objectivesDone.map(()=>true);
    if(s.mode==='compete' && s.ai && s.aiFinishTime===null){
      s.winner='player'; TH.Score.add(200); endGame('win');
    } else if(s.mode==='compete'){
      endGame(s.winner==='ai' ? 'lose' : 'win');
    } else {
      endGame('win');
    }
  }
  function finishAI(){
    const s=TH.GameState.State;
    if(s.aiFinishTime!==null) return;
    s.aiFinishTime=(performance.now()-s.startTime)/1000;
    if(s.playerFinishTime===null) s.winner='ai';
  }

  function endGame(kind){
    const s=TH.GameState.State;
    if(s.ended) return;
    s.ended=true; s.running=false;
    const timeBonus = (kind==='win' && !s.untimed) ? TH.Score.timeBonus(s.timeLeft) : 0;
    const finalScore = Math.max(0, s.score + timeBonus);
    let isNewBest=false;
    if(!s.untimed && kind==='win' && (s.mode!=='compete' || s.winner==='player')){
      isNewBest = TH.Score.setBestIfHigher(s.map.id, s.mode, s.diff, finalScore);
    }
    const bestScore = TH.Score.getBest(s.map.id, s.mode, s.diff);
    TH.UI.syncControls();
    TH.UI.showResults({
      kind, map:s.map, mode:s.mode, diff:s.diff, collected:s.collected,
      playerTime:s.playerFinishTime, aiTime:s.aiFinishTime, winner:s.winner,
      timeBonus, finalScore, bestScore, isNewBest, untimed:s.untimed
    });
  }

  function renderFrame(dt){
    if(!gameScreenActive()) return;
    if(TH.Scene3D && TH.Scene3D.active) TH.Scene3D.render(dt); else TH.Renderer.render(dt);
    TH.CGPanel.update();
  }

  function loop(t){
    const s=TH.GameState.State;
    if(!s.running) return;
    raf=requestAnimationFrame(loop);
    const rawDt=(t-lastT)/1000;
    const dt=Math.min(.05,rawDt); lastT=t;
    fpsAcc+=rawDt; fpsN++; if(fpsAcc>=.5){ TH.CG.stats.fps=fpsN/fpsAcc; TH.CG.stats.frameMs=1000*fpsAcc/fpsN; fpsAcc=0; fpsN=0; }
    TH.CG.resetFrame();
    TH.UI.syncControls();
    if(s.paused||s.ended){ renderFrame(0); return; }
    if(TH.Scene3D && TH.Scene3D.active){ // Q / E rotate the 3D camera
      const rot=(keys['e']?1:0)-(keys['q']?1:0); if(rot) TH.Scene3D.rotate(rot*dt*1.8);
    }
    TH.Player.update(dt,keys);
    TH.AI.update(dt);
    TH.Obstacles.update(dt);
    TH.Timer.tick(dt);
    if(s.hintFlashT>0) s.hintFlashT-=dt;
    s.hitFlash=Math.max(0,s.hitFlash-dt); s.shake=Math.max(0,s.shake-dt); s.worldFlash=Math.max(0,s.worldFlash-dt);
    if(s.timeLeft<=0 && !s.ended){ s.timeLeft=0; endGame('timeup'); }
    renderFrame(dt);
    TH.UI.updateHUD();
  }

  window.TH = window.TH || {};
  TH.Game = {start, stop, pause, resume, restart, loseLife, finishPlayer, finishAI, endGame,
    isRunning:()=>TH.GameState.State.running, switchWorld, toggleView, enable3D, applyView, keys};
})();
