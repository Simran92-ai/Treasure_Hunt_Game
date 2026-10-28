/* main.js
 * Entry point. Boots the renderer and settings UI, exposes the
 * handler names that index.html's inline onclick attributes call, and
 * adds two small quality-of-life behaviors:
 *   - auto-pause when the browser tab is hidden
 *   - canvas resize on window resize
 */
(function(){
  function exposeGlobalHandlers(){
    window.goto          = TH.UI.goto;
    window.closeOverlay  = TH.UI.closeOverlay;
    window.selectMap     = TH.UI.selectMap;
    window.setMode       = TH.UI.setMode;
    window.setDiff       = TH.UI.setDiff;
    window.toggleSetting = TH.UI.toggleSetting;
    window.cycleQuality  = TH.UI.cycleQuality;
    window.goBack        = TH.UI.back;
    window.fromPause     = TH.UI.openFromPause;
    window.toggleView    = TH.Game.toggleView;
    window.toggleHud     = TH.UI.toggleHud;
    window.toggleMapPanel= TH.UI.toggleMinimapPanel;

    window.pauseGame = function(){
      TH.Game.pause();
      document.getElementById('pauseOverlay').classList.add('active');
    };
    window.resumeGame = function(){
      TH.Game.resume();
      TH.UI.closeOverlay('pauseOverlay');
    };
    window.restartMap = function(){
      TH.UI.closeOverlay('pauseOverlay');
      TH.UI.closeOverlay('resultsOverlay');
      TH.Game.restart();
    };
    window.quitToMenu = function(){
      TH.Game.stop();
      TH.UI.closeOverlay('pauseOverlay');
      TH.UI.closeOverlay('resultsOverlay');
      TH.UI.clearReturn();
      TH.UI.goto('menu');
    };
  }

  // Enhancement: don't let the clock, monsters or AI keep running while the tab is in the background.
  function initAutoPause(){
    document.addEventListener('visibilitychange', function(){
      const s=TH.GameState.State;
      if(document.hidden && s.running && !s.paused && !s.ended){
        window.pauseGame();
      }
    });
  }

  function initResizeHandling(){
    window.addEventListener('resize', function(){
      if(TH.GameState.State.running) TH.Renderer.resizeCanvas();
    });
  }

  function boot(){
    TH.Renderer.init();
    TH.UI.initSettingsUI();
    exposeGlobalHandlers();
    initAutoPause();
    initResizeHandling();
    TH.TouchControls.init();
  }

  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.TH = window.TH || {};
  TH.Main = {boot};
})();
