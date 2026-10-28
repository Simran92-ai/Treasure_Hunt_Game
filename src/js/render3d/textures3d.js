/* textures3d.js
 * Procedural, seamlessly tiling PBR textures for the 3D view, generated at
 * runtime on <canvas> (no image files): albedo + normal map (+ emissive).
 * Techniques: periodic value-noise fBm, cellular (Voronoi) noise, height-field
 * -> normal-map conversion with central differences, mip-mapped upload.
 * Exposes: TH.Tex3D = { get }
 */
(function(){
  const TAU=Math.PI*2;
  function hash2(x,y,s){ let h=(x*374761393+y*668265263+s*982451653)|0; h=(h^(h>>>13))*1274126177|0; return ((h^(h>>>16))>>>0)/4294967296; }
  const sm=t=>t*t*(3-2*t);
  // periodic value noise: lattice repeats every `per` cells -> tiles seamlessly
  function vn(x,y,per,s){
    const xi=Math.floor(x), yi=Math.floor(y), fx=sm(x-xi), fy=sm(y-yi);
    const x0=((xi%per)+per)%per, x1=(x0+1)%per, y0=((yi%per)+per)%per, y1=(y0+1)%per;
    const a=hash2(x0,y0,s), b=hash2(x1,y0,s), c=hash2(x0,y1,s), d=hash2(x1,y1,s);
    return a+(b-a)*fx+(c-a)*fy+(a-b-c+d)*fx*fy;
  }
  function fbm(u,v,oct,f0,s){ let a=.5,sum=0,f=f0,n=0; for(let o=0;o<oct;o++){ sum+=a*vn(u*f,v*f,f,s+o*7); n+=a; a*=.5; f*=2; } return sum/n; }
  function ridged(u,v,oct,f0,s){ return 1-Math.abs(fbm(u,v,oct,f0,s)*2-1); }
  // cellular noise (F1 distance + cell id)
  function cell(u,v,f,s){
    const x=u*f, y=v*f, xi=Math.floor(x), yi=Math.floor(y); let best=9,id=0;
    for(let j=-1;j<=1;j++) for(let i=-1;i<=1;i++){
      const cx=((xi+i)%f+f)%f, cy=((yi+j)%f+f)%f; const px=xi+i+hash2(cx,cy,s), py=yi+j+hash2(cx,cy,s+3);
      const d=Math.hypot(x-px,y-py); if(d<best){ best=d; id=hash2(cx,cy,s+9); }
    } return [best,id];
  }
  const mix=(a,b,t)=>a+(b-a)*t;
  const mix3=(a,b,t)=>[mix(a[0],b[0],t),mix(a[1],b[1],t),mix(a[2],b[2],t)];
  const clamp=(x,a,b)=>x<a?a:x>b?b:x;

  // fn(u,v,o): fill o=[r,g,b,h,er,eg,eb] (0-255 colour, h 0-1, emissive 0-255)
  function build(size,fn,nStr,wantEmi){
    const al=document.createElement('canvas'); al.width=al.height=size; const ac=al.getContext('2d'); const img=ac.createImageData(size,size);
    const H=new Float32Array(size*size); const o=[0,0,0,0,0,0,0]; let em=null, ei=null;
    if(wantEmi){ em=document.createElement('canvas'); em.width=em.height=size; ei=em.getContext('2d').createImageData(size,size); }
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      o[4]=o[5]=o[6]=0; fn(x/size,y/size,o); const i=(y*size+x)*4;
      img.data[i]=clamp(o[0],0,255); img.data[i+1]=clamp(o[1],0,255); img.data[i+2]=clamp(o[2],0,255); img.data[i+3]=255; H[y*size+x]=o[3];
      if(ei){ ei.data[i]=clamp(o[4],0,255); ei.data[i+1]=clamp(o[5],0,255); ei.data[i+2]=clamp(o[6],0,255); ei.data[i+3]=255; }
    }
    ac.putImageData(img,0,0); if(em) em.getContext('2d').putImageData(ei,0,0);
    const nm=document.createElement('canvas'); nm.width=nm.height=size; const nc=nm.getContext('2d'); const ni=nc.createImageData(size,size);
    const S=nStr||2.5, w=size;
    for(let y=0;y<size;y++) for(let x=0;x<size;x++){
      const l=H[y*w+((x-1+w)%w)], r=H[y*w+((x+1)%w)], u=H[((y-1+w)%w)*w+x], d=H[((y+1)%w)*w+x];
      let nx=(l-r)*S*size/64, ny=(u-d)*S*size/64, nz=1; const L=Math.hypot(nx,ny,nz); nx/=L; ny/=L; nz/=L;
      const i=(y*size+x)*4; ni.data[i]=(nx*.5+.5)*255; ni.data[i+1]=(ny*.5+.5)*255; ni.data[i+2]=(nz*.5+.5)*255; ni.data[i+3]=255;
    }
    nc.putImageData(ni,0,0);
    return {albedo:al,normal:nm,emi:em};
  }

  const DEFS={
    grass:(u,v,o)=>{ const n=fbm(u,v,5,4,1), f=fbm(u,v,3,48,2), p=fbm(u,v,3,3,5); let c=mix3([34,62,28],[92,134,52],n*.8+f*.4);
      if(p>.66){ c=mix3(c,[96,74,46],Math.min(1,(p-.66)*7)); } const bl=vn(u*96,v*10,96,9); c=mix3(c,[120,160,60],bl>.78?.35:0);
      o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=f*.6+n*.4; },
    soil:(u,v,o)=>{ const n=fbm(u,v,5,6,3), f=fbm(u,v,2,64,4); const c=mix3([78,58,40],[124,96,66],n); const peb=cell(u,v,18,2)[0]<.18?1:0; o[0]=c[0]+peb*30; o[1]=c[1]+peb*28; o[2]=c[2]+peb*24; o[3]=n*.5+f*.2+peb*.5; },
    planks:(u,v,o)=>{ const N=6, pv=v*N, pi=Math.floor(pv), lv=pv-pi; const seam=hash2(pi,0,4); let c=mix3([74,44,24],[128,82,46],hash2(pi,1,3)*.8);
      const g=fbm(u*1.0,v*0.25,3,6,7)*.5+Math.sin((u*40+fbm(u,v,3,4,6)*8)*TAU*.5)*.08; c=mix3(c,[40,24,12],g*.7);
      let h=.6+g*.25; if(lv<.045||lv>.97){ c=[20,12,8]; h=0; } const su=((u-seam+1)%1); if(su<.006){ c=[20,12,8]; h=0; }
      o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=h; },
    carpet:(u,v,o)=>{ const n=fbm(u,v,3,96,2); let c=[86,22,36]; const a=Math.abs((u*4%1)-.5)+Math.abs((v*4%1)-.5); if(a>.44&&a<.5) c=[176,140,52]; else if(a<.12) c=[120,40,54];
      const bo=Math.min(u,v,1-u,1-v); o[0]=c[0]*(.85+n*.3); o[1]=c[1]*(.85+n*.3); o[2]=c[2]*(.85+n*.3); o[3]=.5+n*.4; },
    wallpaper:(u,v,o)=>{ const st=Math.abs(Math.sin(u*TAU*6)); let c=mix3([88,22,38],[126,34,52],st*.5); const dm=Math.sin(u*TAU*6)*Math.sin(v*TAU*4+1); if(dm>.55) c=mix3(c,[188,150,70],.45); const n=fbm(u,v,4,8,3); c=mix3(c,[40,20,20],n*.35);
      o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=.5+(dm>.55?.15:0)+n*.2; },
    stone:(u,v,o)=>{ const R=4, rv=v*R, ri=Math.floor(rv), lv=rv-ri; const bu=(u*3+(ri%2)*.5)%1; const bi=Math.floor(u*3+(ri%2)*.5); let c=mix3([92,88,78],[142,136,122],hash2(bi,ri,5)); const n=fbm(u,v,5,6,2); c=mix3(c,[56,54,46],n*.5);
      let h=.65+n*.25; if(lv<.07||bu<.025||bu>.975){ c=[36,34,28]; h=.05; } const cr=ridged(u,v,4,5,8); if(cr>.93){ c=mix3(c,[20,18,14],.6); h*=.6; }
      o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=h; },
    moss:(u,v,o)=>{ DEFS.stone(u,v,o); const m=fbm(u,v,4,5,31)*.7+(1-o[3])*.4; if(m>.5){ const t=Math.min(1,(m-.5)*3); const c=mix3([o[0],o[1],o[2]],[52,96,38],t); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; } },
    sand:(u,v,o)=>{ const n=fbm(u,v,5,8,3), f=fbm(u,v,2,96,5); const rip=Math.sin((u*6+fbm(u,v,3,3,2)*2.5)*TAU)*.5+.5; const c=mix3([196,170,118],[232,212,160],n*.7+f*.4); const k=.93+rip*.07; o[0]=c[0]*k; o[1]=c[1]*k; o[2]=c[2]*k; o[3]=rip*.35+f*.3; },
    cliff:(u,v,o)=>{ const n=fbm(u,v,5,4,2); const band=Math.sin((v*9+n*3)*TAU*.5)*.5+.5; let c=mix3([92,70,46],[168,138,98],band*.7+n*.3); const cr=ridged(u,v,4,6,8); if(cr>.9) c=mix3(c,[30,22,14],.6); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=band*.5+n*.4-(cr>.9?.3:0); },
    asphalt:(u,v,o)=>{ const n=fbm(u,v,4,6,2), f=hash2(Math.floor(u*256),Math.floor(v*256),3); const c=mix3([46,48,54],[72,74,80],n*.6+f*.4); const cr=ridged(u,v,3,4,9); const k=cr>.95?.6:1; o[0]=c[0]*k; o[1]=c[1]*k; o[2]=c[2]*k; o[3]=n*.3+f*.5; },
    concrete:(u,v,o)=>{ const n=fbm(u,v,5,5,4), f=hash2(Math.floor(u*256),Math.floor(v*256),7); let c=mix3([116,118,122],[160,162,166],n*.6+f*.2); let h=.6+n*.2;
      if(Math.abs(u-.5)<.006||Math.abs(v-.5)<.006||u<.006||v<.006){ c=mix3(c,[40,40,44],.8); h=.1; } o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=h; },
    facade:(u,v,o)=>{ const C=4,R=5, cu=u*C, cv=v*R, ci=Math.floor(cu), ri=Math.floor(cv), fu=cu-ci, fv=cv-ri; const n=fbm(u,v,4,6,2); let c=mix3([66,70,80],[96,100,110],n*.7); let h=.6;
      if(fu>.2&&fu<.8&&fv>.2&&fv<.8){ const lit=hash2(ci,ri,7)>.52; c=lit?[255,214,140]:[18,24,38]; h=.15; if(lit){ const gl=.75+.25*hash2(ci,ri,9); o[4]=255*gl; o[5]=200*gl; o[6]=120*gl; } else { c=mix3(c,[60,80,110],fv); } }
      if(fv>.12&&fv<.18){ c=mix3(c,[30,32,38],.5); } o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=h; },
    metal:(u,v,o)=>{ const n=fbm(u,v,4,6,2), sc=vn(u*6,v*160,6,3); let c=mix3([52,62,86],[82,94,124],n*.7+sc*.2); let h=.6+n*.1;
      const pu=(u*2)%1, pv=(v*2)%1; if(pu<.02||pu>.98||pv<.02||pv>.98){ c=[16,20,30]; h=.1; }
      [[.06,.06],[.94,.06],[.06,.94],[.94,.94]].forEach(p=>{ const d=Math.hypot(((u*2)%1)-p[0],((v*2)%1)-p[1]); if(d<.03){ c=[130,140,160]; h=.9; } });
      if(Math.abs(((u*2)%1)-.5)<.0 ) h=h; o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=h; },
    hull:(u,v,o)=>{ DEFS.metal(u,v,o); const s=Math.abs(v-.5)<.025; if(s){ o[0]=90; o[1]=220; o[2]=255; o[4]=70; o[5]=190; o[6]=255; o[3]=.9; } const w=Math.abs(u-.25)<.012&&v>.1&&v<.3; if(w){ o[4]=255; o[5]=90; o[6]=70; o[0]=255; o[1]=120; o[2]=100; } },
    glass:(u,v,o)=>{ const n=fbm(u,v,4,4,3); let c=mix3([14,32,64],[34,72,120],n); const f=cell(u,v,6,4); const edge=f[0]>.42?1:0; c=mix3(c,[120,190,255],edge*.35); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=.5+edge*.2; o[4]=edge*18; o[5]=edge*40; o[6]=edge*70; },
    crystal:(u,v,o)=>{ const f=cell(u,v,5,6); const c=mix3([34,84,140],[110,190,240],f[1]*.8); const edge=f[0]>.38; o[0]=c[0]*(edge?1.3:1); o[1]=c[1]*(edge?1.3:1); o[2]=c[2]*(edge?1.2:1); o[3]=f[1]*.6+(edge?.2:0); o[4]=c[0]*.25; o[5]=c[1]*.3; o[6]=c[2]*.4; },
    wood:(u,v,o)=>{ const g=fbm(u*.3,v,4,6,3); const rings=Math.sin((u*16+g*10)*TAU*.5)*.5+.5; const c=mix3([88,54,28],[148,98,54],rings*.6+g*.3); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=rings*.4+g*.3; },
    bark:(u,v,o)=>{ const n=fbm(u*.25,v,5,8,4), r=ridged(u*.2,v,3,8,9); const c=mix3([46,32,22],[104,76,52],n*.8+r*.3); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=r*.7+n*.3; },
    rock:(u,v,o)=>{ const n=fbm(u,v,5,4,2), r=ridged(u,v,4,5,6); const c=mix3([70,72,78],[148,150,156],n*.6+r*.3); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=r*.6+n*.4; },
    brushed:(u,v,o)=>{ const sc=vn(u*4,v*220,4,3)*.5+vn(u*8,v*100,8,5)*.5; const c=mix3([96,102,114],[160,168,180],sc); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=sc*.3; },
    waterN:(u,v,o)=>{ const a=fbm(u,v,5,6,3), b=fbm(u+.31,v+.17,4,10,8); o[0]=o[1]=o[2]=128; o[3]=a*.6+b*.4; },
    foliage:(u,v,o)=>{ const n=fbm(u,v,5,8,2), l=cell(u,v,10,3); const c=mix3([26,66,30],[82,142,52],n*.7+l[1]*.3); o[0]=c[0]; o[1]=c[1]; o[2]=c[2]; o[3]=n*.5+l[0]*.5; }
  };
  const SIZES={ grass:512, planks:512, sand:512, asphalt:512, metal:512, glass:512, waterN:256, stone:256, moss:256 };
  const STR={ grass:2.2, soil:2.2, planks:2.4, carpet:1.2, wallpaper:1.4, stone:3, moss:3, sand:1.6, cliff:3.5, asphalt:2, concrete:2.4, facade:2, metal:3, hull:3, glass:1.4, crystal:2.6, wood:2, bark:3.2, rock:3.5, brushed:.8, waterN:3.2, foliage:2.5 };
  const cache={};
  let GLlast=null;

  function get(name){
    if(cache[name]) return cache[name];
    const GL=TH.GL, size=SIZES[name]||256;
    const t=build(size,DEFS[name],STR[name]||2,name==='facade'||name==='hull'||name==='glass'||name==='crystal');
    const out={albedo:GL.texture(t.albedo,{srgb:true}), normal:GL.texture(t.normal,{}), emi:t.emi?GL.texture(t.emi,{srgb:true}):null};
    cache[name]=out; return out;
  }
  function clear(){ const gl=TH.GL.gl; Object.values(cache).forEach(t=>{ gl.deleteTexture(t.albedo); gl.deleteTexture(t.normal); if(t.emi) gl.deleteTexture(t.emi); }); for(const k in cache) delete cache[k]; }

  window.TH=window.TH||{};
  TH.Tex3D={get,clear,DEFS,build};
})();
