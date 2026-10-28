/* rigs3d.js
 * 3D content recipes for the WebGL view: static obstacle models (merged into
 * the level batch), skeletal "rigs" for the player / AI / every creature
 * family (hierarchy of joints, each joint = translate * rotate * scale applied
 * to its parent's matrix - classic hierarchical modelling), pickups, hazards.
 * Exposes: TH.Rigs3D = { obstacle, creature, explorer, drawRig, hazardParts }
 */
(function(){
  const TAU=Math.PI*2;
  const hex=h=>{ const n=parseInt(h.slice(1),16); return [((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255]; };
  const sc=(c,k)=>[c[0]*k,c[1]*k,c[2]*k];
  const M=TH.GL.m4;

  /* ============ static obstacle models (builder o provided by scene3d) ============ */
  const OBS={
    tree(o,v,r){ const h=1.35+r()*.4; o.cyl('bark',.09,.16,h,0,0,0,{seg:8});
      for(let i=0;i<4;i++){ const a=i*1.7+v, rr=.28+r()*.12; o.sph('foliage',.5+r()*.15,Math.cos(a)*rr*(i?1:0),h+.2+i*.17,Math.sin(a)*rr*(i?1:0),{sy:.85,tint:[.55+r()*.35,.8+r()*.2,.5+r()*.3],seg:9}); }
      o.cyl('bark',.03,.05,.5,.18,h-.45,0,{rz:-.7}); },
    bush(o,v,r){ for(let i=0;i<5;i++){ const a=i*1.3+v; o.sph('foliage',.26+r()*.1,Math.cos(a)*.22,.2+r()*.15,Math.sin(a)*.22,{sy:.8,tint:[.5+r()*.3,.7+r()*.25,.4]}); }
      for(let i=0;i<6;i++){ const a=r()*TAU; o.sph('paint',.035,Math.cos(a)*.3,.2+r()*.25,Math.sin(a)*.3,{tint:[.85,.12,.18],seg:5}); } for(let i=0;i<5;i++){ const a=i*1.26; o.cone('paint',.025,.2,Math.cos(a)*.4,.1,Math.sin(a)*.4,{rz:Math.cos(a)*.9,rx:Math.sin(a)*.9,tint:[.3,.15,.1],seg:4}); } },
    boulder(o,v,r){ o.rock('rock',.46,0,.28,0,{sx:1.1,sy:.78,sz:1,amp:.14,seed:v}); o.rock('moss',.22,.3,.14,.18,{amp:.08,seed:v+3}); o.sph('foliage',.12,-.15,.55,.05,{sy:.4,tint:[.5,.9,.4],seg:6}); },
    ruin(o,v,r){ o.box('moss',.7,.18,.7,0,0,0); o.cyl('moss',.24,.28,1.1+r()*.5,0,.18,0,{seg:10});
      o.box('moss',.5,.16,.45,.02,1.4+r()*.2,0,{rz:.25,ry:r()}); o.box('moss',.3,.25,.3,.35,0,.2,{ry:.7}); o.cyl('foliage',.015,.015,.8,.2,.5,.2,{tint:[.4,.8,.3],seg:4}); o.sph('foliage',.14,.1,.35,.22,{sy:.6,tint:[.4,.8,.3],seg:6}); },
    totem(o,v,r){ const cols=[[.62,.2,.14],[.85,.62,.16],[.2,.5,.38]]; o.box('woodM',.5,.9,.5,0,0,0,{});
      for(let i=0;i<3;i++){ o.box('paint',.52,.3,.52,0,i*.32,0,{tint:cols[i]}); o.box('paint',.1,.07,.04,-.12,.12+i*.32,.27,{tint:[.02,.02,.02]}); o.box('paint',.1,.07,.04,.12,.12+i*.32,.27,{tint:[.02,.02,.02]}); o.box('paint',.2,.05,.04,0,.04+i*.32,.27,{tint:[.05,.02,.02]}); }
      o.cone('woodM',.34,.45,0,.96,0,{seg:4,ry:.78}); o.box('woodM',.9,.07,.12,0,.66,0,{tint:[1,.7,.5]}); },
    shelf(o,v,r){ o.box('woodDark',.95,1.7,.38,0,0,0); for(let i=0;i<4;i++){ o.box('woodM',.88,.04,.34,0,.3+i*.38,.02); let x=-.4; while(x<.38){ const w=.05+r()*.05, h=.22+r()*.12; o.box('paint',w,h,.26,x+w/2,.34+i*.38,.04,{tint:[.3+r()*.6,.15+r()*.4,.15+r()*.4]}); x+=w+.005; } } },
    table(o,v,r){ o.box('woodM',.95,.07,.6,0,.72,0); [[-.4,-.24],[.4,-.24],[-.4,.24],[.4,.24]].forEach(p=>o.box('woodDark',.07,.72,.07,p[0],0,p[1]));
      o.cyl('paint',.12,.1,.025,-.22,.79,0,{tint:[.92,.9,.85],seg:12}); o.cyl('paint',.12,.1,.025,.22,.79,.05,{tint:[.92,.9,.85],seg:12});
      o.cyl('gold',.02,.025,.22,0,.79,0,{seg:6}); o.sph('glow',.03,0,1.03,0,{tint:[1,.7,.25],seg:6}); o.light(0,1.05,0,[1,.7,.35],3.2); },
    statue(o,v,r){ o.box('stoneM',.62,.3,.62,0,0,0); const mt=[.78,.78,.8]; o.cyl('paint',.17,.22,.62,0,.3,0,{tint:mt,seg:10,rough:.4}); o.sph('paint',.15,0,1.05,0,{tint:mt,seg:10}); o.cyl('paint',.05,.05,.45,.25,.55,0,{rz:.5,tint:mt,seg:6}); o.cyl('paint',.05,.05,.4,-.24,.6,0,{rz:-.4,tint:mt,seg:6}); o.sph('moss',.07,.05,.95,.1,{tint:[.5,.8,.4],seg:5}); },
    coffin(o,v,r){ o.box('woodDark',.5,.34,1.0,0,.12,0,{ry:v*.4}); o.box('woodM',.44,.1,.9,0,.44,0,{ry:v*.4,tint:[.7,.55,.5]}); o.box('gold',.05,.02,.5,0,.54,0,{ry:v*.4}); o.box('gold',.26,.02,.05,0,.54,.12,{ry:v*.4}); [-.3,.3].forEach(z=>o.box('metalM',.06,.12,.06,.22,0,z,{ry:v*.4})); },
    candles(o,v,r){ o.cyl('gold',.18,.2,.06,0,0,0,{seg:10}); o.cyl('gold',.03,.04,.9,0,.06,0,{seg:6}); o.box('gold',.7,.03,.06,0,.95,0);
      [-.33,0,.33].forEach((x,i)=>{ o.cyl('paint',.035,.035,.2,x,.98,0,{tint:[.95,.9,.78],seg:8}); o.cone('glow',.03,.1,x,1.18,0,{tint:[1,.78,.3],seg:6}); }); o.light(0,1.3,0,[1,.65,.3],4.2); },
    palm(o,v,r){ const lean=.16+r()*.1, ang=r()*TAU; for(let i=0;i<6;i++){ const t=i/6; o.cyl('bark',.08-.01*t,.1-.01*t,.34,Math.cos(ang)*lean*t*t*2.4,i*.3,Math.sin(ang)*lean*t*t*2.4,{seg:7,rz:Math.cos(ang)*lean*t*1.1,rx:-Math.sin(ang)*lean*t*1.1}); }
      const tx=Math.cos(ang)*lean*2.4, tz=Math.sin(ang)*lean*2.4, ty=1.85; for(let i=0;i<8;i++){ const a=i/8*TAU; o.box('foliage',.14,.02,.8,tx+Math.cos(a)*.35,ty-.12,tz+Math.sin(a)*.35,{ry:-a+Math.PI/2,rx:.5,tint:[.5+r()*.3,.85,.45]}); }
      for(let i=0;i<3;i++) o.sph('paint',.06,tx+(i-1)*.07,ty-.1,tz+(i%2)*.06,{tint:[.34,.22,.1],seg:6}); },
    crate(o,v,r){ const ry=r()*1.2; o.box('woodM',.72,.72,.72,0,0,0,{ry}); [.34,-.34].forEach(y=>{ [.34,-.34].forEach(x=>o.box('woodDark',.08,.74,.08,x,0,y,{ry,tint:[.8,.7,.6]})); }); o.box('woodDark',.74,.08,.74,0,.32,0,{ry}); o.box('woodDark',.74,.08,.74,0,0,0,{ry});
      if(v%2) o.box('woodM',.5,.5,.5,.1,.72,.05,{ry:ry+.6,tint:[.9,.8,.7]}); },
    barrel(o,v,r){ o.cyl('woodM',.26,.3,.3,0,0,0,{seg:12}); o.cyl('woodM',.3,.3,.3,0,.3,0,{seg:12}); o.cyl('woodM',.3,.26,.3,0,.6,0,{seg:12});
      [.06,.3,.54].forEach(y=>o.cyl('metalM',.315,.315,.04,0,y,0,{seg:12,tint:[.35,.35,.38]})); o.cyl('woodDark',.26,.26,.02,0,.9,0,{seg:12}); },
    cannon(o,v,r){ const ry=v*.8; o.cyl('metalM',.14,.18,.95,0,.38,0,{rx:Math.PI/2-.2,ry,seg:12,tint:[.18,.18,.2]}); o.sph('metalM',.17,Math.sin(ry)*-.42,.3,Math.cos(ry)*-.42,{seg:10,tint:[.18,.18,.2]});
      [[-.3,0],[.3,0]].forEach(p=>o.cyl('woodDark',.26,.26,.07,Math.cos(ry)*p[0],.1,-Math.sin(ry)*p[0]*1,{rz:Math.PI/2,ry,seg:12})); for(let i=0;i<3;i++) o.sph('metalM',.07,.4+i*.1,.07,.3-(i%2)*.1,{tint:[.1,.1,.1],seg:6}); },
    rock(o,v,r){ o.rock('rock',.5,0,.26,0,{sx:1.2,sy:.7,sz:1,amp:.16,seed:v+7}); o.rock('rock',.28,.4,.15,.2,{amp:.1,seed:v+9}); for(let i=0;i<4;i++) o.cyl('foliage',.015,.015,.4,-.3+i*.08,.05,.4,{seg:4,tint:[.15,.5,.3],rx:.3}); },
    parked(o,v,r){ const cols=[[.7,.12,.1],[.12,.35,.7],[.85,.68,.05],[.4,.15,.5],[.88,.9,.92],[.1,.55,.25]], c=cols[v%6], ry=(v%2)*Math.PI/2+(r()-.5)*.2;
      o.box('paintGloss',1.45,.34,.72,0,.2,0,{ry,tint:c}); o.box('glass',.75,.28,.64,-.06,.52,0,{ry,tint:[.12,.16,.2]}); o.box('paintGloss',.72,.04,.66,-.06,.8,0,{ry,tint:c});
      const cs=Math.cos(ry), sn=Math.sin(ry); [[-.46,-.38],[.46,-.38],[-.46,.38],[.46,.38]].forEach(p=>o.cyl('paintRough',.17,.17,.12,p[0]*cs+p[1]*sn*0,.0,-p[0]*sn+p[1]*cs,{rx:Math.PI/2,ry,seg:10,tint:[.04,.04,.05]}));
      o.box('glow',.04,.08,.14,.72*cs,.28,-.72*sn+.2,{ry,tint:[3,3,2.5]}); o.box('glow',.04,.08,.14,.72*cs,.28,-.72*sn-.2,{ry,tint:[3,3,2.5]}); o.box('glow',.03,.08,.14,-.73*cs,.28,.73*sn+.2,{ry,tint:[2.4,.1,.1]}); },
    barrier(o,v,r){ for(let i=0;i<5;i++) o.box('paint',.2,.2,.1,-.4+i*.2,.46,0,{tint:i%2?[.95,.95,.95]:[.85,.1,.1],ry:0}); o.box('metalM',.06,.5,.06,-.4,0,0); o.box('metalM',.06,.5,.06,.4,0,0); o.box('metalM',.06,.06,.36,-.4,0,0); o.box('metalM',.06,.06,.36,.4,0,0); o.sph('glow',.05,0,.64,0,{tint:[3,1.4,.2],seg:6}); o.light(0,.7,0,[1,.6,.2],2.0); },
    dumpster(o,v,r){ o.box('paintMetal',.95,.6,.6,0,.12,0,{tint:[.12,.4,.24]}); o.box('paintMetal',.98,.06,.64,0,.72,.04,{tint:[.1,.32,.2],rx:-.15}); o.box('paintRough',.97,.05,.62,0,.3,0,{tint:[.08,.26,.16]}); [-.4,.4].forEach(x=>o.cyl('paintRough',.06,.06,.05,x,0,.3,{rx:Math.PI/2,tint:[.03,.03,.03],seg:8})); },
    lamp(o,v,r){ o.cyl('metalM',.09,.12,.1,0,0,0,{seg:8,tint:[.2,.22,.25]}); o.cyl('metalM',.035,.05,1.9,0,.1,0,{seg:8,tint:[.2,.22,.25]}); o.box('metalM',.5,.04,.05,.2,1.98,0,{tint:[.2,.22,.25]}); o.box('glow',.22,.05,.12,.4,1.94,0,{tint:[3,2.6,1.6]}); o.light(.4,1.8,0,[1,.82,.5],6.5); },
    bench(o,v,r){ const ry=(v%2)*Math.PI/2; o.box('woodM',.95,.06,.34,0,.4,0,{ry}); o.box('woodM',.95,.3,.05,0,.42,-.15,{ry,rx:-.15}); const cs=Math.cos(ry),sn=Math.sin(ry); [-.4,.4].forEach(x=>o.box('metalM',.05,.4,.3,x*cs,0,-x*sn,{ry,tint:[.15,.15,.17]})); },
    cargo(o,v,r){ const ry=r()*.6; o.box('paintMetal',.9,.62,.7,0,0,0,{ry,tint:[.5,.55,.62]}); o.box('paint',.92,.12,.72,0,.25,0,{ry,tint:[.9,.5,.08]}); [-.3,.3].forEach(x=>o.box('metalM',.04,.64,.72,x,0,0,{ry,tint:[.3,.33,.4]})); o.box('glow',.06,.06,.02,.3*Math.cos(ry),.5,.36,{ry,tint:[.3,3,.8]}); if(v%2) o.box('paintMetal',.6,.5,.5,0,.62,.05,{ry:ry+.4,tint:[.42,.5,.6]}); },
    reactor(o,v,r){ o.cyl('metalM',.42,.46,.3,0,0,0,{seg:16}); o.cyl('glassC',.26,.26,1.1,0,.3,0,{seg:14}); o.cyl('glow',.12,.12,1.0,0,.34,0,{seg:10,tint:[.4,2.2,3]}); [.5,.9,1.3].forEach(y=>o.cyl('metalM',.31,.31,.05,0,y,0,{seg:14})); o.cyl('metalM',.34,.3,.12,0,1.4,0,{seg:14}); o.light(0,.9,0,[.3,.85,1],6.5); },
    console(o,v,r){ const ry=(v%4)*Math.PI/2; o.box('paintMetal',.86,.55,.5,0,0,0,{ry,tint:[.16,.18,.25]}); o.box('paintMetal',.86,.06,.34,0,.6,-.0,{ry,rx:-.5,tint:[.2,.23,.32]}); o.box('glow',.64,.22,.02,0,.68,.0,{ry,rx:-.5,tint:[.1,.9,1.4]});
      for(let i=0;i<4;i++) o.box('glow',.05,.03,.05,-.24+i*.16,.52,.18,{ry,tint:[[2.6,.3,.3],[2.4,2,.3],[.3,2.4,.5],[.3,1.2,2.6]][i]}); o.light(0,.7,0,[.3,.7,1],2.8); },
    pipe(o,v,r){ for(let i=0;i<3;i++) o.cyl('brushedM',.13,.13,.95,0,.13+i*.0,(i-1)*.27,{rz:Math.PI/2,seg:10,ry:0}); o.cyl('brushedM',.13,.13,.95,0,.4,0,{rz:Math.PI/2,seg:10}); [-.35,.35].forEach(x=>{ o.box('metalM',.06,.6,.8,x,0,0,{tint:[.25,.28,.34]}); }); o.cyl('paint',.14,.14,.05,.2,.2,.0,{rz:Math.PI/2,tint:[.9,.7,.1],seg:8}); },
    tank(o,v,r){ o.cyl('paintMetal',.36,.36,.9,0,.1,0,{seg:16,tint:[.85,.87,.9]}); o.sph('paintMetal',.36,0,1.0,0,{sy:.5,tint:[.85,.87,.9],seg:14}); o.cyl('paint',.37,.37,.14,0,.45,0,{seg:16,tint:[.9,.7,.05]}); o.cyl('metalM',.05,.05,.3,.15,1.2,.1,{seg:6}); [-.28,.28].forEach(x=>o.box('metalM',.06,.15,.5,x,0,0,{tint:[.3,.32,.38]})); },
    crystal(o,v,r){ for(let i=0;i<5;i++){ const a=i*1.26+v, d=i?.22:0, h=.7+r()*.8; o.gem('crystalM',.14+r()*.08,h*.5,Math.cos(a)*d,h*.5,Math.sin(a)*d,{rz:Math.cos(a)*.35,rx:Math.sin(a)*.35,sy:1.2}); } o.light(0,.7,0,[.35,.75,1],5.5); },
    shard(o,v,r){ const h=1.4+r()*.5; o.gem('glassC',.15,h*.5,0,h*.5,0,{rz:.12*(v%3-1),rx:.1}); o.gem('crystalM',.06,h*.4,.0,h*.5,0,{rz:.12*(v%3-1),rx:.1,tint:[.7,1.2,1.6]}); o.cyl('metalM',.28,.3,.08,0,0,0,{seg:6,tint:[.2,.25,.4]}); },
    orb(o,v,r){ o.cyl('metalM',.2,.28,.45,0,0,0,{seg:10,tint:[.18,.2,.32]}); o.sph('glassC',.34,0,.76,0,{seg:16}); o.sph('glow',.14,0,.76,0,{tint:[1.2,.6,2.8],seg:10}); o.light(0,.8,0,[.6,.4,1],4.5); },
    monolith(o,v,r){ o.box('paintMetal',.55,1.9,.3,0,0,0,{ry:v*.5,tint:[.05,.06,.1]}); const cs=Math.cos(v*.5),sn=Math.sin(v*.5); o.box('glow',.03,.8,.02,0,.55,.16,{ry:v*.5,tint:[.3,1.4,2.8]}); o.box('glow',.3,.03,.02,0,1.0,.16,{ry:v*.5,tint:[.3,1.4,2.8]}); o.box('glow',.3,.03,.02,0,.7,.16,{ry:v*.5,tint:[.3,1.4,2.8]}); o.light(0,1,.3,[.3,.7,1],3.5); },
    spire(o,v,r){ [[0,0,1.8],[.28,.1,1.2],[-.25,-.12,1.4]].forEach((p,i)=>o.cone('crystalP',.16+i*.01,p[2],p[0],0,p[1],{seg:5,rz:(i-1)*.12})); o.cone('glow',.05,.6,0,1.0,0,{seg:5,tint:[1.6,.7,3]}); o.light(0,1,0,[.6,.3,1],4.5); }
  };
  function obstacle(kind,o,v,r){ (OBS[kind]||OBS.boulder)(o,v,r); }

  /* ============ rigs ============ */
  function R(){ const nodes=[]; return { nodes, add(parent,o){ const n=Object.assign({p:[0,0,0],r:[0,0,0],s:[1,1,1],prim:null,ps:[1,1,1],po:[0,0,0],pr:[0,0,0],mat:'paint',col:[1,1,1],parent:parent?parent.idx:-1,rough:null,metal:null,em:null,alpha:1,unlit:0,rim:0,twoSided:0},o); n.idx=nodes.length; nodes.push(n); return n; } }; }
  const P=(prim,ps,po,col,extra)=>Object.assign({prim,ps,po:po||[0,0,0],col},extra||{});

  function humanoid(rb,k,palette){
    const [body,acc,eye]=k.col.map(hex), skin=palette&&palette.skin?palette.skin:hex('#e6bf98');
    const flags=k, bones=!!k.bones, zomb=!!k.shamble;
    const root=rb.add(null,{p:[0,.52,0]});
    const torso=rb.add(root,P('box',[.36,.4,.22],[0,.2,0],bones?hex('#d8d2bc'):body,{p:[0,0,0]}));
    const hip=rb.add(root,{p:[0,0,0]});
    const legL=rb.add(hip,P('box',[.14,.5,.14],[0,-.25,0],bones?hex('#cfc9b2'):sc(acc,.7),{p:[-.1,0,0]}));
    const legR=rb.add(hip,P('box',[.14,.5,.14],[0,-.25,0],bones?hex('#cfc9b2'):sc(acc,.7),{p:[.1,0,0]}));
    rb.add(legL,P('box',[.15,.07,.22],[0,-.5,.03],[.12,.1,.1]));  rb.add(legR,P('box',[.15,.07,.22],[0,-.5,.03],[.12,.1,.1]));
    const armL=rb.add(root,P('box',[.11,.4,.11],[0,-.18,0],zomb?sc(body,1):body,{p:[-.24,.38,0]}));
    const armR=rb.add(root,P('box',[.11,.4,.11],[0,-.18,0],body,{p:[.24,.38,0]}));
    if(palette&&palette.pack) rb.add(torso,P('box',[.28,.3,.12],[0,.18,-.17],palette.pack));
    const head=rb.add(root,P('sph',[.26,.28,.26],[0,.15,0],bones?hex('#ece6d0'):(zomb?hex('#7f9a6a'):skin),{p:[0,.42,0]}));
    rb.add(head,P('sph',[.05,.05,.05],[-.06,.17,.11],[0,0,0])); rb.add(head,P('sph',[.05,.05,.05],[.06,.17,.11],[0,0,0]));
    if(!bones){ rb.add(head,P('sph',[.035,.035,.035],[-.06,.17,.135],eye,{em:sc(eye,.8)})); rb.add(head,P('sph',[.035,.035,.035],[.06,.17,.135],eye,{em:sc(eye,.8)})); }
    else { rb.add(head,P('box',[.14,.02,.02],[0,.07,.13],[.05,.05,.05])); rb.add(torso,P('box',[.3,.025,.02],[0,.2,.12],[.55,.52,.42])); rb.add(torso,P('box',[.3,.025,.02],[0,.1,.12],[.55,.52,.42])); }
    if(k.bigeyes){ rb.add(head,P('sph',[.09,.12,.04],[-.07,.17,.12],[0,0,0])); rb.add(head,P('sph',[.09,.12,.04],[.07,.17,.12],[0,0,0])); }
    const hat=palette&&palette.hat?palette.hat:(k.hat?acc:null);
    if(k.hat||(palette&&palette.hat)){ const hc=hat||acc; rb.add(head,P('cyl',[.5,.04,.5],[0,.28,0],sc(hc,.8))); rb.add(head,P('cyl',[.3,.14,.3],[0,.35,0],hc)); }
    if(k.cap) rb.add(head,P('cyl',[.32,.1,.32],[0,.3,0],acc));
    if(k.mask) rb.add(head,P('box',[.28,.08,.04],[0,.17,.12],[.05,.05,.05]));
    if(k.helm){ rb.add(head,P('sph',[.32,.3,.32],[0,.2,0],hex('#c8d8e8'),{mat:'paintMetal',metal:.8})); }
    if(k.robot){}
    rb.rim=0;
    return {anim(t,mv,ph){ const w=Math.sin(t*9+ph)*.7*mv; legL.r[0]=w; legR.r[0]=-w; armL.r[0]=zomb?-1.3+w*.1:-w*.8; armR.r[0]=zomb?-1.3-w*.1:w*.8; root.p[1]=.52+Math.abs(Math.sin(t*9+ph))*.05*mv; head.r[1]=Math.sin(t*1.3+ph)*.15*(1-mv); torso.r[2]=Math.sin(t*9+ph)*.04*mv; },height:1.1};
  }
  function quad(rb,k){
    const [body,acc,eye]=k.col.map(hex);
    const bodyN=rb.add(null,P('sph',[.36,.3,.66],[0,0,0],body,{p:[0,.42,0],rough:.7}));
    rb.add(bodyN,P('sph',[.3,.2,.5],[0,-.07,.03],acc,{rough:.8}));
    const head=rb.add(bodyN,P('sph',[.26,.25,.28],[0,0,.1],body,{p:[0,.1,.34]}));
    rb.add(head,P('sph',[.15,.12,.17],[0,-.05,.16],acc,{}));
    rb.add(head,P('cone',[.1,.16,.1],[-.1,.15,-.02],body)); rb.add(head,P('cone',[.1,.16,.1],[.1,.15,-.02],body));
    rb.add(head,P('sph',[.05,.05,.05],[-.09,.05,.16],eye,{em:eye,unlit:0})); rb.add(head,P('sph',[.05,.05,.05],[.09,.05,.16],eye,{em:eye}));
    if(k.tusks){ rb.add(head,P('cone',[.04,.14,.04],[-.08,-.09,.26],hex('#f4efe0'),{pr:[.5,0,0]})); rb.add(head,P('cone',[.04,.14,.04],[.08,-.09,.26],hex('#f4efe0'),{pr:[.5,0,0]})); }
    const legs=[[-.13,.2],[.13,.2],[-.13,-.2],[.13,-.2]].map(p=>{ const j=rb.add(bodyN,{p:[p[0],-.1,p[1]]}); rb.add(j,P('cyl',[.1,.36,.1],[0,-.18,0],body)); return j; });
    const tail=rb.add(bodyN,P('cyl',[.06,.42,.06],[0,-.21,0],body,{p:[0,.05,-.32],r:[-2.2,0,0]}));
    if(k.arms){ legs.forEach(l=>l.p[1]-=0); }
    return {anim(t,mv,ph){ const w=Math.sin(t*11+ph)*.8*mv; legs[0].r[0]=w; legs[3].r[0]=w; legs[1].r[0]=-w; legs[2].r[0]=-w; bodyN.p[1]=.42+Math.abs(Math.sin(t*11+ph))*.04*mv; tail.r[1]=Math.sin(t*5+ph)*.5; tail.r[0]=-2.2+Math.sin(t*3)*.15; head.r[0]=Math.sin(t*2+ph)*.08; },height:.7};
  }
  function ghost(rb,k){
    const [body,acc,eye]=k.col.map(hex); const em=sc(body,.55);
    const root=rb.add(null,{p:[0,.55,0]});
    rb.add(root,P('sph',[.52,.52,.46],[0,.25,0],body,{alpha:k.alpha||.7,em,rim:1,rough:.4}));
    const sk=rb.add(root,P('cone',[.52,.7,.46],[0,-.15,0],body,{alpha:k.alpha||.7,em,rim:1,pr:[Math.PI,0,0]}));
    rb.add(root,P('sph',[.1,.15,.06],[-.12,.32,.2],eye,{unlit:1,col:sc(eye,3)}));
    rb.add(root,P('sph',[.1,.15,.06],[.12,.32,.2],eye,{unlit:1}));
    rb.add(root,P('sph',[.08,.14,.05],[0,.12,.22],[.02,.02,.04],{}));
    const a1=rb.add(root,P('sph',[.12,.12,.34],[0,0,.15],body,{alpha:k.alpha||.7,em,rim:1,p:[-.28,.2,0]})), a2=rb.add(root,P('sph',[.12,.12,.34],[0,0,.15],body,{alpha:k.alpha||.7,em,rim:1,p:[.28,.2,0]}));
    if(k.hat){ rb.add(root,P('cyl',[.6,.05,.6],[0,.76,0],[.08,.08,.1])); rb.add(root,P('cyl',[.34,.2,.34],[0,.86,0],[.08,.08,.1])); }
    return {anim(t,mv,ph){ root.p[1]=.62+Math.sin(t*2.2+ph)*.1; a1.r[1]=Math.sin(t*3+ph)*.4; a2.r[1]=-Math.sin(t*3+ph)*.4; sk.s[0]=1+Math.sin(t*3+ph)*.05; },height:1.2,glow:body};
  }
  function blob(rb,k){
    const [body,acc,eye]=k.col.map(hex); const root=rb.add(null,{p:[0,.4,0]});
    const b=rb.add(root,P('sph',[.7,.62,.66],[0,0,0],body,{rough:.35,em:sc(body,k.crystal?.25:.05),metal:k.crystal?.3:0}));
    for(let i=0;i<9;i++){ const a=i/9*TAU, y=Math.sin(i*2.4)*.2; rb.add(b,P('cone',[.1,.26,.1],[Math.cos(a)*.3,.12+y,Math.sin(a)*.3],acc,{pr:[Math.sin(a)*1.1,0,-Math.cos(a)*1.1],em:k.crystal?sc(acc,.4):null})); }
    rb.add(b,P('sph',[.18,.2,.1],[-.15,.1,.3],[1,1,1])); rb.add(b,P('sph',[.18,.2,.1],[.15,.1,.3],[1,1,1]));
    rb.add(b,P('sph',[.1,.1,.06],[-.15,.1,.34],eye,{em:eye})); rb.add(b,P('sph',[.1,.1,.06],[.15,.1,.34],eye,{em:eye}));
    rb.add(b,P('box',[.26,.05,.04],[0,-.14,.32],[.15,0,0]));
    if(k.horns){ rb.add(b,P('cone',[.1,.3,.1],[-.2,.3,.1],acc,{pr:[0,0,.3]})); rb.add(b,P('cone',[.1,.3,.1],[.2,.3,.1],acc,{pr:[0,0,-.3]})); }
    const tent=[]; if(k.tentacles){ for(let i=0;i<5;i++){ const a=i/5*TAU; const j=rb.add(b,{p:[Math.cos(a)*.22,-.25,Math.sin(a)*.22]}); rb.add(j,P('cyl',[.09,.5,.09],[0,-.25,0],body)); tent.push(j); } }
    return {anim(t,mv,ph){ const sq=1+Math.sin(t*5+ph)*.07; b.s[1]=sq; b.s[0]=1/Math.sqrt(sq); b.s[2]=1/Math.sqrt(sq); root.p[1]=.4+Math.abs(Math.sin(t*5+ph))*.1; tent.forEach((j,i)=>{ j.r[0]=Math.sin(t*4+i+ph)*.5; j.r[2]=Math.cos(t*3+i)*.5; }); },height:.9};
  }
  function spider(rb,k){
    const [body,acc,eye]=k.col.map(hex); const root=rb.add(null,{p:[0,.3,0]});
    const ab=rb.add(root,P('sph',[.42,.36,.5],[0,0,-.22],body,{em:k.crystal?sc(body,.2):null,metal:k.crystal?.4:0,rough:.3}));
    rb.add(ab,P('sph',[.18,.14,.18],[0,.12,-.1],acc,{em:sc(acc,.5)}));
    const ce=rb.add(root,P('sph',[.28,.24,.28],[0,0,.12],body));
    [-.06,.06].forEach(x=>{ rb.add(ce,P('sph',[.05,.05,.05],[x,.08,.12],eye,{em:eye})); rb.add(ce,P('sph',[.03,.03,.03],[x*1.8,.05,.11],eye,{em:eye})); });
    const legs=[]; for(let i=0;i<4;i++) for(const sd of [-1,1]){ const j=rb.add(root,{p:[sd*.1,0,.12-i*.1],r:[0,sd*(.5+i*.35),sd*.9]}); const seg1=rb.add(j,P('cyl',[.04,.4,.04],[0,.2,0],body,{p:[0,0,0],r:[0,0,0]})); const k2=rb.add(seg1,{p:[0,.4,0],r:[0,0,-sd*1.5]}); rb.add(k2,P('cyl',[.035,.45,.035],[0,-.2,0],body)); legs.push({j,sd,i}); }
    return {anim(t,mv,ph){ legs.forEach(l=>{ l.j.r[0]=Math.sin(t*14*(.4+mv)+l.i*1.6+(l.sd>0?0:Math.PI))*.35*(.3+mv); }); root.p[1]=.3+Math.sin(t*8+ph)*.015; },height:.55};
  }
  function serpent(rb,k){
    const [body,acc,eye]=k.col.map(hex); const segs=[]; const root=rb.add(null,{p:[0,.14,0]});
    for(let i=0;i<9;i++){ const s=.17-i*.008; segs.push(rb.add(root,P('sph',[s*2,s*1.8,s*2.3],[0,0,0],i%2?acc:body,{p:[0,0,-i*.14+.4],rough:.35}))); }
    const head=rb.add(root,P('sph',[.2,.16,.26],[0,0,0],body,{p:[0,0,.52]}));
    rb.add(head,P('sph',[.04,.04,.04],[-.07,.05,.08],eye,{em:eye})); rb.add(head,P('sph',[.04,.04,.04],[.07,.05,.08],eye,{em:eye}));
    const tongue=rb.add(head,P('box',[.015,.01,.12],[0,-.03,.2],[.85,.1,.1]));
    return {anim(t,mv,ph){ segs.forEach((s,i)=>{ s.p[0]=Math.sin(t*5+i*.7+ph)*.1*(.4+mv); }); head.p[0]=Math.sin(t*5-.5+ph)*.1*(.4+mv); head.r[1]=Math.cos(t*5+ph)*.3; tongue.s[2]=.6+Math.abs(Math.sin(t*14))*.8; },height:.4};
  }
  function drone(rb,k){
    const [body,acc,eye]=k.col.map(hex); const root=rb.add(null,{p:[0,.8,0]});
    rb.add(root,P('sph',[.5,.26,.5],[0,0,0],body,{mat:'paintMetal',metal:.7,rough:.3})); rb.add(root,P('cyl',[.38,.08,.38],[0,.12,0],acc,{mat:'paintMetal',metal:.6}));
    rb.add(root,P('sph',[.16,.16,.08],[0,-.02,.24],eye,{unlit:1,col:sc(eye,3)}));
    const rot=[]; [[-.35,-.0],[.35,0],[0,-.35],[0,.35]].forEach(p=>{ const a=rb.add(root,{p:[p[0],.1,p[1]]}); rb.add(a,P('cyl',[.05,.1,.05],[0,0,0],[.2,.2,.22])); const r=rb.add(a,P('cyl',[.36,.012,.36],[0,.07,0],[.8,.9,1],{alpha:.35,unlit:0,rough:.2})); rot.push(r); });
    return {anim(t,mv,ph){ root.p[1]=.8+Math.sin(t*3+ph)*.08; root.r[2]=Math.sin(t*1.7+ph)*.08; rot.forEach((r,i)=>{ r.r[1]=t*40+i; }); },height:1,glow:eye};
  }
  function vehicle(rb,k){
    const [body,acc,eye]=k.col.map(hex), L=k.long?1.9:1.6; const root=rb.add(null,{p:[0,.14,0]});
    rb.add(root,P('box',[.78,.34,L],[0,.2,0],body,{mat:'paintGloss',rough:.2}));
    rb.add(root,P('box',[.7,.3,L*.5],[0,.5,-.1],sc(acc,1),{mat:'glass',alpha:.9,rough:.1,col:[.1,.14,.2]})); rb.add(root,P('box',[.74,.05,L*.52],[0,.67,-.1],body,{mat:'paintGloss'}));
    const w=[]; [[-.4,L*.32],[.4,L*.32],[-.4,-L*.32],[.4,-L*.32]].forEach(p=>{ const j=rb.add(root,{p:[p[0],0,p[1]]}); rb.add(j,P('cyl',[.34,.14,.34],[0,0,0],[.04,.04,.05],{pr:[0,0,Math.PI/2]})); w.push(j); });
    rb.add(root,P('box',[.14,.08,.04],[-.25,.26,L/2+.01],[3,3,2.5],{unlit:1})); rb.add(root,P('box',[.14,.08,.04],[.25,.26,L/2+.01],[3,3,2.5],{unlit:1}));
    rb.add(root,P('box',[.14,.08,.04],[-.25,.28,-L/2-.01],[2.4,.1,.1],{unlit:1})); rb.add(root,P('box',[.14,.08,.04],[.25,.28,-L/2-.01],[2.4,.1,.1],{unlit:1}));
    return {anim(t,mv,ph){ w.forEach(j=>{ j.r[0]=t*14; }); root.p[1]=.14+Math.sin(t*20)*.004*mv; },height:.8,glow:[1,.95,.7],hasHeadlights:true};
  }
  function golem(rb,k){
    const [body,acc,eye]=k.col.map(hex); const metal=k.robot, cry=k.crystal; const bm=metal?'paintMetal':'paint';
    const root=rb.add(null,{p:[0,.9,0]});
    const tor=rb.add(root,P('box',[.8,.7,.55],[0,.25,0],body,{mat:bm,metal:metal?.8:cry?.4:0,rough:metal?.35:.8,em:cry?sc(body,.15):null}));
    const head=rb.add(root,P('box',[.4,.32,.36],[0,.12,.02],acc,{mat:bm,metal:metal?.8:0,p:[0,.88,.05]}));
    rb.add(head,P('box',[.3,.07,.04],[0,.04,.19],eye,{unlit:1,col:sc(eye,3)}));
    rb.add(tor,P('sph',[.2,.2,.1],[0,.2,.3],eye,{unlit:1,col:sc(eye,2.2)}));
    if(cry){ for(let i=0;i<4;i++) rb.add(tor,P('gem',[.2,.46,.2],[-.3+i*.2,.45,-.15],[.8,.95,1],{em:[.3,.5,.6],rough:.1,pr:[.2,0,(i-1.5)*.2]})); }
    const aL=rb.add(root,P('box',[.3,.75,.3],[0,-.3,0],body,{mat:bm,metal:metal?.8:0,p:[-.58,.45,0]})), aR=rb.add(root,P('box',[.3,.75,.3],[0,-.3,0],body,{mat:bm,metal:metal?.8:0,p:[.58,.45,0]}));
    rb.add(aL,P('box',[.4,.3,.4],[0,-.72,0],acc,{mat:bm})); rb.add(aR,P('box',[.4,.3,.4],[0,-.72,0],acc,{mat:bm}));
    const lL=rb.add(root,P('box',[.32,.7,.34],[0,-.35,0],acc,{mat:bm,metal:metal?.7:0,p:[-.22,-.1,0]})), lR=rb.add(root,P('box',[.32,.7,.34],[0,-.35,0],acc,{mat:bm,metal:metal?.7:0,p:[.22,-.1,0]}));
    return {anim(t,mv,ph){ const w=Math.sin(t*5+ph)*.5*mv; lL.r[0]=w; lR.r[0]=-w; aL.r[0]=-w*.7; aR.r[0]=w*.7; root.p[1]=.9+Math.abs(Math.sin(t*5+ph))*.04*mv; tor.r[2]=Math.sin(t*5+ph)*.04*mv; },height:1.7,glow:eye};
  }
  function crab(rb,k){
    const [body,acc,eye]=k.col.map(hex); const root=rb.add(null,{p:[0,.22,0]});
    rb.add(root,P('sph',[.62,.28,.46],[0,0,0],body,{rough:.45})); rb.add(root,P('sph',[.5,.14,.36],[0,.1,0],acc,{rough:.5}));
    [-1,1].forEach(sd=>{ rb.add(root,P('cyl',[.025,.14,.025],[sd*.12,.2,.2],[.1,.1,.1])); rb.add(root,P('sph',[.06,.06,.06],[sd*.12,.3,.2],eye,{em:eye})); });
    const legs=[]; for(const sd of [-1,1]) for(let i=0;i<3;i++){ const j=rb.add(root,{p:[sd*.28,-.05,.12-i*.12],r:[0,0,sd*-.7]}); rb.add(j,P('cyl',[.04,.3,.04],[sd*.14,-.05,0],body,{pr:[0,0,sd*1.2]})); legs.push({j,sd,i}); }
    const claws=[-1,1].map(sd=>{ const j=rb.add(root,{p:[sd*.3,.04,.24]}); rb.add(j,P('cyl',[.06,.22,.06],[0,0,.1],body,{pr:[1.4,0,0]})); rb.add(j,P('sph',[.2,.14,.24],[0,0,.28],acc)); rb.add(j,P('cone',[.07,.14,.05],[sd*.05,0,.42],hex('#e8d8c0'),{pr:[1.57,0,0]})); return j; });
    return {anim(t,mv,ph){ legs.forEach(l=>{ l.j.r[2]=l.sd*(-.7+Math.sin(t*16+l.i*1.2+(l.sd>0?0:Math.PI))*.35*(.3+mv)); }); claws.forEach((c,i)=>{ c.r[1]=Math.sin(t*4+i*2)*.4; c.r[0]=-.2+Math.sin(t*6+i)*.1; }); },height:.5};
  }
  function bat(rb,k){
    const [body,acc,eye]=k.col.map(hex); const root=rb.add(null,{p:[0,.85,0]});
    rb.add(root,P('sph',[.24,.26,.4],[0,0,0],body)); const hd=rb.add(root,P('sph',[.2,.2,.2],[0,0,0],body,{p:[0,.1,.22]}));
    if(k.beak) rb.add(hd,P('cone',[.07,.16,.07],[0,-.02,.14],hex('#f0a020'),{pr:[1.57,0,0]})); else { rb.add(hd,P('cone',[.06,.14,.05],[-.07,.13,0],body)); rb.add(hd,P('cone',[.06,.14,.05],[.07,.13,0],body)); }
    rb.add(hd,P('sph',[.04,.04,.04],[-.06,.04,.08],eye,{em:eye})); rb.add(hd,P('sph',[.04,.04,.04],[.06,.04,.08],eye,{em:eye}));
    const wl=rb.add(root,{p:[-.1,.05,0]}), wr=rb.add(root,{p:[.1,.05,0]});
    rb.add(wl,P('box',[.7,.025,.38],[-.35,0,-.02],acc,{twoSided:1,rough:.7})); rb.add(wr,P('box',[.7,.025,.38],[.35,0,-.02],acc,{twoSided:1,rough:.7}));
    return {anim(t,mv,ph){ const f=Math.sin(t*14+ph)*.7; wl.r[2]=f; wr.r[2]=-f; root.p[1]=.85+Math.sin(t*3+ph)*.1+Math.abs(f)*.05; },height:1};
  }
  const FAMILIES={quad,humanoid,ghost,blob,spider,serpent,drone,vehicle,golem,crab,bat};

  let phaseSeed=0;
  function creature(kind){
    const k=TH.Themes.creature(kind), rb=R(); const fam=FAMILIES[k.family]||blob;
    const out=fam(rb,k,null); const ph=(phaseSeed++)*1.7;
    return {nodes:rb.nodes, anim:out.anim, phase:ph, height:out.height||1, glow:out.glow||null, scale:k.s, alpha:k.alpha||1, kind};
  }
  function explorer(variant){
    const k={col:variant==='ai'?['#d9503a','#8a2a1a','#222222']:['#3a8ec0','#2a5a78','#222222'],hat:true};
    const rb=R(); const out=humanoid(rb,k,{pack:variant==='ai'?[.35,.1,.06]:[.3,.2,.12],hat:variant==='ai'?hex('#5a1a10'):hex('#a07030'),skin:hex('#e6bf98')});
    return {nodes:rb.nodes, anim:out.anim, phase:variant==='ai'?1.3:0, height:1.1, scale:1.0, alpha:1};
  }

  // evaluate the joint hierarchy and draw every primitive. pass: 'opaque'|'blend'|'shadow'
  const _l=new Float32Array(16), _p=new Float32Array(16), _m=new Float32Array(16);
  function drawRig(rig,root,pass,S){
    const nodes=rig.nodes;
    if(!rig.W) rig.W=nodes.map(()=>new Float32Array(16));
    for(let i=0;i<nodes.length;i++){
      const n=nodes[i], W=rig.W[i];
      M.parts(_l,n.p[0],n.p[1],n.p[2],n.r[0],n.r[1],n.r[2],n.s[0],n.s[1],n.s[2]);
      if(n.parent<0) M.mul(W,root,_l); else M.mul(W,rig.W[n.parent],_l);
    }
    for(let i=0;i<nodes.length;i++){
      const n=nodes[i]; if(!n.prim) continue;
      const isBlend=n.alpha<1||n.mat==='glass';
      if(pass==='opaque'&&isBlend) continue; if(pass==='blend'&&!isBlend) continue;
      if(pass==='shadow'&&(isBlend||n.unlit)) continue;
      M.parts(_p,n.po[0],n.po[1],n.po[2],n.pr[0],n.pr[1],n.pr[2],n.ps[0],n.ps[1],n.ps[2]);
      M.mul(_m,rig.W[i],_p);
      if(pass==='shadow') S.drawPrim(n.prim,null,_m); else { if(!n._m) n._m=S.cmat(n); S.drawPrim(n.prim,n._m,_m); }
    }
  }

  window.TH=window.TH||{};
  TH.Rigs3D={obstacle,creature,explorer,drawRig,OBS,hex,FAMILIES};
})();
