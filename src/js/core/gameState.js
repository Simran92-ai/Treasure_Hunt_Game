/* gameState.js
 * The single source of truth for an in-progress run: score, lives,
 * grids, entities, timers, flags. Every other module reads/writes
 * TH.GameState.State rather than keeping its own copies.
 * Exposes: TH.GameState = { State, TS, ZOOM, LEAD_DIST, DIFF_CFG,
 *                            HINT_COSTS, treasureVisible, keyVisible, activeGrid, gridFor, tileAt, reset }
 */
(function(){
  const TS=40;        // tile size in pixels
  const ZOOM=1.9;      // camera zoom - only the area around the player is visible
  const LEAD_DIST=110; // reserved for a future camera-lead-ahead feature

  const DIFF_CFG={
    easy:{time:900, aiSpeed:55, aiRecalc:2500, aiWander:.22, aiStartDelay:3500},
    medium:{time:600, aiSpeed:85, aiRecalc:1300, aiWander:.10, aiStartDelay:2000},
    hard:{time:300, aiSpeed:112, aiRecalc:600, aiWander:.02, aiStartDelay:900}
  };
  const HINT_COSTS={basic:50,nav:100,adv:150,key:100};

  const State = {
    // selection / session
    currentMapId:null, map:null, mode:'time', diff:'medium', cfg:null,
    // world / grids
    grid:null, gw:0, gh:0, mirrorGridLive:null, worldMode:'normal',
    // entities
    player:null, ai:null,
    // stats
    score:0, lives:3, health:100, timeLeft:0, hintCooldown:0,
    hasKey:false, aiHasKey:false, aiHasClue:false, keyTaken:false, worldSwitchCount:0,
    camLeadX:0, camLeadY:0, aiStartDelay:0, aiWorld:'normal', camYaw:0, runId:0, hitFlash:0, shake:0, worldFlash:0, camX:0, camY:0,
    visited:new Set(), collected:{coins:0,clues:0,keys:0,checkpoints:0},
    objectivesDone:[], lastCheckpoint:null,
    // run flags
    running:false, paused:false, ended:false,
    // race timing
    startTime:0, playerFinishTime:null, aiFinishTime:null, winner:null,
    // AI pathing
    aiPath:[], aiPathIdx:0, aiTimer:0, aiGoal:null,
    // obstacles
    patrolStates:[],
    // hints
    hintFlashPath:[], hintFlashT:0, hintFlashMsg:null
  };

  function activeGrid(){
    return (State.map && State.map.dual && State.worldMode==='mirror') ? State.mirrorGridLive : State.grid;
  }
  function gridFor(world){
    return (State.map && State.map.dual && world==='mirror') ? State.mirrorGridLive : State.grid;
  }
  // treasure appears only after the key is found (Mirror World has no key: after the clue)
  function treasureVisible(){ const s=State; return s.map&&s.map.dual ? s.collected.clues>0 : !!s.hasKey; }
  function keyVisible(){ return State.collected.clues>0 && !State.hasKey; }
  function tileAt(px,py){ return {x:Math.floor(px/TS), y:Math.floor(py/TS)}; }

  function reset(mapId,mode,diff,untimed){
    const s=State;
    s.currentMapId=mapId;
    s.map=TH.Maps.build(mapId,diff);
    s.mode=mode; s.diff=diff; s.cfg=DIFF_CFG[diff];
    s.grid = s.map.grid.map(r=>r.slice());
    s.mirrorGridLive = s.map.dual ? s.map.mirrorGrid.map(r=>r.slice()) : null;
    s.gw=s.map.w; s.gh=s.map.h; s.worldMode='normal'; s.aiWorld='normal'; s.camYaw=0; s.runId++; s.hitFlash=0; s.shake=0; s.worldFlash=0;
    s.score=0; s.lives=3; s.health=100; s.untimed=!!untimed; s.timeLeft=s.untimed?Infinity:s.cfg.time; s.hintCooldown=0;
    s.hasKey=false; s.aiHasKey=false; s.aiHasClue=false; s.keyTaken=false; s.worldSwitchCount=0;
    s.camLeadX=0; s.camLeadY=0; s.aiStartDelay=s.cfg.aiStartDelay;
    s.visited=new Set(); s.collected={coins:0,clues:0,keys:0,checkpoints:0};
    s.objectivesDone = s.map.objectives.map(()=>false);
    s.lastCheckpoint = {x:s.map.playerStart.x*TS+8, y:s.map.playerStart.y*TS+8};
    s.player = TH.Player.create(s.map.playerStart);
    s.ai = (mode==='compete' && s.map.computerStart) ? TH.AI.create(s.map.computerStart) : null;
    s.aiPath=[]; s.aiPathIdx=0; s.aiTimer=0; s.aiGoal=null;
    s.hintFlashPath=[]; s.hintFlashT=0; s.hintFlashMsg=null;
    s.patrolStates = TH.Obstacles.init(s.map.patrols);
    s.startTime=performance.now(); s.playerFinishTime=null; s.aiFinishTime=null; s.winner=null;
    s.running=true; s.paused=false; s.ended=false;
  }

  window.TH = window.TH || {};
  TH.GameState = {State, TS, ZOOM, LEAD_DIST, DIFF_CFG, HINT_COSTS, treasureVisible, keyVisible, activeGrid, gridFor, tileAt, reset};
})();
