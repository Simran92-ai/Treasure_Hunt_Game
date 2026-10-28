/* ui.js
 * Everything DOM-facing outside the game canvas: persisted settings,
 * screen navigation, map cards (now showing best scores), the HUD,
 * and the results overlay.
 * Exposes: TH.UI = { Settings, saveSettings, toggleSetting, initSettingsUI,
 *                     goto, closeOverlay, renderMapCards, selectMap,
 *                     setMode, setDiff, updateHUD, showResults }
 */
(function(){
  const Settings = Object.assign({anim:true, minimap:true, view3d:true, cgPanel:false, infoPanel:true, quality:'medium'}, (function(){ try{ return JSON.parse(localStorage.getItem('th_settings_v2')||'{}'); }catch(e){ return {}; } })());
  function saveSettings(){ try{ localStorage.setItem('th_settings_v2', JSON.stringify(Settings)); }catch(e){} }
  const BOOLS=['anim','minimap','view3d','cgPanel','infoPanel'];
  function refreshToggles(){
    BOOLS.forEach(k=>{ const e=document.getElementById('t_'+k); if(e) e.classList.toggle('on',!!Settings[k]); });
    const q=document.getElementById('qualityBtn'); if(q) q.textContent=Settings.quality.toUpperCase();
  }
  function toggleSetting(k){
    Settings[k]=!Settings[k]; saveSettings(); refreshToggles();
    if(k==='anim') toast(Settings.anim?'Animation ON: water, sway, bobbing, spin, flicker, particles, sky moving':'Animation OFF: map frozen (still water, no sway/bob/spin/flicker/particles)',3200);
    if(k==='view3d' && TH.GameState.State.running){ if(Settings.view3d) TH.Game.enable3D(); else TH.Game.applyView(); }
    if(k==='minimap'||k==='infoPanel') applyPanels();
    if(k==='cgPanel' && TH.CGPanel) TH.CGPanel.refresh();
  }
  function cycleQuality(){
    const q=['low','medium','high']; Settings.quality=q[(q.indexOf(Settings.quality)+1)%3]; saveSettings(); refreshToggles();
    if(TH.GameState.State.running && Settings.view3d && TH.Scene3D && TH.Scene3D.active) TH.Scene3D.ensure();
  }
  function applyPanels(){
    const small=window.innerWidth<=1024;
    if(Settings.hudMin===undefined) Settings.hudMin=small;
    if(Settings.mmMin===undefined) Settings.mmMin=small;
    const hl=document.querySelector('.hud-left'), mm=document.querySelector('.minimap-panel');
    if(hl){ hl.classList.toggle('nopanel',Settings.infoPanel===false); hl.classList.toggle('min',!!Settings.hudMin); const b=document.getElementById('hudMinBtn'); if(b) b.innerHTML=Settings.hudMin?'&#9776; Info':'&minus;'; }
    if(mm){ mm.classList.toggle('off',!Settings.minimap); mm.classList.toggle('min',!!Settings.mmMin); const b=document.getElementById('mmMinBtn'); if(b) b.innerHTML=Settings.mmMin?'+':'&minus;'; }
  }
  function toggleHud(){ Settings.hudMin=!Settings.hudMin; saveSettings(); applyPanels(); }
  function toggleMinimapPanel(){ Settings.mmMin=!Settings.mmMin; saveSettings(); applyPanels(); }
  function initSettingsUI(){ refreshToggles(); applyPanels(); }

  /* ---- toast ---- */
  let toastT=0;
  function toast(msg,ms){
    let t=document.getElementById('toast');
    if(!t){ t=document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
    t.textContent=msg; t.classList.add('show'); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove('show'),ms||2200);
  }

  /* ---- navigation ---- */
  let returnTo=null; // 'pause' when Instructions/Settings were opened from the pause menu
  function goto(name){
    document.querySelectorAll('.screen').forEach(el=>el.classList.remove('active'));
    const map={menu:'menuScreen',mapSelect:'mapSelectScreen',mode:'modeScreen',diff:'diffScreen',
      instructions:'instructionsScreen',settings:'settingsScreen',game:'gameScreen'};
    document.getElementById(map[name]).classList.add('active');
    if(name==='mapSelect') renderMapCards();
    if(name==='settings') refreshToggles();
  }
  // open Instructions / Settings from the pause menu, remembering where to come back to
  function openFromPause(name){ returnTo='pause'; closeOverlay('pauseOverlay'); goto(name); }
  // back button: returns to the pause menu (Resume / Restart) if that is where we came from
  function back(dest){
    if(returnTo==='pause' && TH.GameState.State.running){
      returnTo=null; goto('game'); document.getElementById('pauseOverlay').classList.add('active');
      TH.Game.applyView(); return;
    }
    returnTo=null; goto(dest);
  }
  function clearReturn(){ returnTo=null; }
  function closeOverlay(id){ document.getElementById(id).classList.remove('active'); }

  /* ---- touch controls: visible only while a game is actively running ---- */
  function syncControls(){
    const s=TH.GameState.State, tc=document.getElementById('touchControls'); if(!tc) return;
    const live=!!(s.running && !s.paused && !s.ended && document.getElementById('gameScreen').classList.contains('active'));
    tc.classList.toggle('live',live);
    const wb=document.getElementById('worldSwitchBtn'); if(wb) wb.style.display=(s.map&&s.map.dual)?'flex':'none';
    document.body.classList.toggle('is3d',!!(TH.Scene3D&&TH.Scene3D.active));
  }

  /* ---- selection flow: map -> mode -> difficulty -> start ---- */
  let pendingMode='time';

  function renderMapCards(){
    const el=document.getElementById('mapCards'); el.innerHTML='';
    Object.values(TH.Maps.MAPS).forEach(m=>{
      const best=TH.Score.bestForMap(m.id);
      const col=document.createElement('div'); col.className='col-12 col-sm-6 col-lg-4';
      const c=document.createElement('button'); c.className='card btn';
      c.innerHTML=`<div class="cat">${m.category}</div><h3>${m.name}</h3><p>${m.desc}</p>`+
        `<div class="meta"><span>${m.treasureName}</span><span>3 levels</span></div>`+
        (best!==null ? `<div class="meta"><span>Best Score</span><span>${best}</span></div>` : '');
      c.onclick=()=>selectMap(m.id);
      col.appendChild(c); el.appendChild(col);
    });
    TH.Maps.COMING_SOON.forEach(m=>{
      const col=document.createElement('div'); col.className='col-12 col-sm-6 col-lg-4';
      const c=document.createElement('div'); c.className='card locked';
      c.innerHTML=`<div class="cat">${m.category}</div><h3>${m.name}</h3><p>Coming soon</p><div class="meta"><span>${m.treasureName}</span><span>—</span></div>`;
      col.appendChild(c); el.appendChild(col);
    });
  }
  function selectMap(id){
    TH.GameState.State.currentMapId=id;
    const btn=document.getElementById('competeBtn');
    btn.disabled=!TH.Maps.MAPS[id].compete;
    btn.title = TH.Maps.MAPS[id].compete ? '' : 'Not available on this map';
    goto('mode');
  }
  // m: 'free' (alone, no time limit) | 'time' (alone, timed) | 'compete' (alone vs computer, timed)
  let pendingUntimed=false;
  function setMode(m){
    if(m==='compete' && !TH.Maps.MAPS[TH.GameState.State.currentMapId].compete) return;
    pendingUntimed=(m==='free'); pendingMode=(m==='free')?'time':m;
    document.getElementById('diffFree').style.display=pendingUntimed?'flex':'none';
    document.getElementById('diffTimed').style.display=pendingUntimed?'none':'flex';
    goto('diff');
  }
  function setDiff(d){
    TH.Game.start(TH.GameState.State.currentMapId, pendingMode, d, pendingUntimed);
  }

  /* ---- HUD ---- */
  function updateHUD(){
    const s=TH.GameState.State;
    document.getElementById('hudLives').textContent='♥'.repeat(Math.max(0,s.lives));
    document.getElementById('hudScore').textContent='Score: '+s.score;
    document.getElementById('healthfill').style.width=Math.max(0,s.health)+'%';
    const tEl=document.getElementById('hudTimer');
    tEl.textContent=TH.Timer.format(Math.max(0,s.timeLeft));
    tEl.classList.toggle('warn', isFinite(s.timeLeft) && s.timeLeft<20);
    tEl.classList.toggle('free', !isFinite(s.timeLeft));

    const oEl=document.getElementById('hudObjectives'); oEl.innerHTML='';
    s.map.objectives.forEach((o,i)=>{
      const d=document.createElement('div');
      d.textContent=(s.objectivesDone[i]?'✓ ':'• ')+o;
      if(s.objectivesDone[i]) d.className='done';
      oEl.appendChild(d);
    });

    const invEl=document.getElementById('hudInv'); invEl.innerHTML='';
    if(s.hasKey){ const d=document.createElement('div'); d.className='inv-item'; d.textContent='🔑'; invEl.appendChild(d); }
    if(s.collected.clues>0){ const d=document.createElement('div'); d.className='inv-item'; d.textContent='📜'; invEl.appendChild(d); }
    TH.Hints.updateButtons();
  }

  /* ---- results overlay ---- */
  function row(l,v){ return `<div><span>${l}</span><span>${v}</span></div>`; }

  function showResults(data){
    const {kind,map,mode,diff,collected,playerTime,aiTime,winner,timeBonus,finalScore,bestScore,isNewBest}=data;
    document.getElementById('resultsTitle').textContent =
      kind==='win' ? 'TREASURE FOUND!' :
      kind==='gameover' ? 'GAME OVER' :
      kind==='lose' ? 'THE COMPUTER WON' : 'TIME UP';

    const wsEl=document.getElementById('winScene');
    if(kind==='win'){ wsEl.style.display='block'; TH.Animation.drawWinScene(wsEl.getContext('2d'),wsEl); }
    else { wsEl.style.display='none'; }

    let html='';
    html+=row('Map',map.name);
    html+=row('Mode', mode==='compete'?'Compete with Computer':'Solo Challenge');
    html+=row('Difficulty', diff+(data.untimed?' (no time limit)':''));
    html+=row('Treasure', kind==='win' ? map.treasureName : '—');
    html+=row('Coins',collected.coins); html+=row('Clues',collected.clues);
    html+=row('Keys',collected.keys); html+=row('Checkpoints',collected.checkpoints);
    if(mode==='compete'){
      html+=row('Player Time', playerTime ? TH.Timer.format(playerTime) : '—');
      html+=row('Computer Time', aiTime ? TH.Timer.format(aiTime) : '—');
      html+=row('Winner', winner==='player' ? 'You!' : (winner==='ai' ? 'Computer' : '—'));
    }
    if(kind==='win') html+=row('Time Bonus','+'+timeBonus);
    html+=row('Best Score', bestScore!==null ? bestScore+(isNewBest?' 🏆 New Best!':'') : '—');
    html+='<div class="final">Final Score '+finalScore+'</div>';

    document.getElementById('resultsBody').innerHTML=html;
    const ov=document.getElementById('resultsOverlay');
    ov.classList.add('active');
    ov.scrollTop=0;
  }

  window.TH = window.TH || {};
  TH.UI = {toggleHud, toggleMinimapPanel, Settings, saveSettings, toggleSetting, cycleQuality, refreshToggles, toast, syncControls, openFromPause, back, clearReturn, initSettingsUI, goto, closeOverlay,
    renderMapCards, selectMap, setMode, setDiff, updateHUD, showResults};
})();
