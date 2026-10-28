/* camera.js
 * Computes the camera's top-left world position for the current
 * frame: centered on the player, zoomed in, clamped to map bounds.
 * Exposes: TH.Camera = { compute }
 */
(function(){
  function compute(player,camLeadX,camLeadY,canvasW,canvasH,zoom,mapWpx,mapHpx){
    const viewW=canvasW/zoom, viewH=canvasH/zoom;
    let camX=player.px+camLeadX-viewW/2, camY=player.py+camLeadY-viewH/2;
    camX=Math.max(0,Math.min(camX,Math.max(0,mapWpx-viewW)));
    camY=Math.max(0,Math.min(camY,Math.max(0,mapHpx-viewH)));
    return {camX,camY,viewW,viewH};
  }

  window.TH = window.TH || {};
  TH.Camera = {compute};
})();
