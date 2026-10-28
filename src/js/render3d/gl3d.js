/* gl3d.js
 * A small hand-written WebGL2 renderer (no 3D library) - this is the engine
 * behind the "Enhanced 3D view".  Implemented from scratch:
 *   - 4x4 matrix maths (perspective / ortho / look-at / invert / normal matrix)
 *   - indexed triangle meshes, primitive generators, static-batch merging
 *   - PBR-style shading (Cook-Torrance GGX + Fresnel), normal mapping via a
 *     screen-space cotangent frame, hemispheric ambient, analytic sky reflection
 *   - directional-light shadow mapping with hardware PCF
 *   - up to 4 point lights, exp2 fog, animated water shader, procedural sky
 *   - MSAA render target, bloom (bright pass + separable gaussian), ACES tone map
 *   - frustum culling of static chunks against 6 extracted frustum planes
 * Exposes: TH.GL
 */
(function(){
  /* ================= matrices (column-major, like OpenGL) ================= */
  const m4={
    create(){ return new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]); },
    identity(o){ o.fill(0); o[0]=o[5]=o[10]=o[15]=1; return o; },
    mul(o,a,b){
      const r=m4._t;
      for(let c=0;c<4;c++) for(let rr=0;rr<4;rr++)
        r[c*4+rr]=a[rr]*b[c*4]+a[4+rr]*b[c*4+1]+a[8+rr]*b[c*4+2]+a[12+rr]*b[c*4+3];
      for(let i=0;i<16;i++) o[i]=r[i]; return o;
    },
    persp(o,fovy,asp,n,f){
      const t=1/Math.tan(fovy/2); o.fill(0);
      o[0]=t/asp; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o;
    },
    ortho(o,l,r,b,t,n,f){
      o.fill(0); o[0]=2/(r-l); o[5]=2/(t-b); o[10]=2/(n-f);
      o[12]=(l+r)/(l-r); o[13]=(b+t)/(b-t); o[14]=(f+n)/(n-f); o[15]=1; return o;
    },
    lookAt(o,e,c,u){
      let zx=e[0]-c[0], zy=e[1]-c[1], zz=e[2]-c[2]; let l=Math.hypot(zx,zy,zz)||1; zx/=l; zy/=l; zz/=l;
      let xx=u[1]*zz-u[2]*zy, xy=u[2]*zx-u[0]*zz, xz=u[0]*zy-u[1]*zx; l=Math.hypot(xx,xy,xz)||1; xx/=l; xy/=l; xz/=l;
      const yx=zy*xz-zz*xy, yy=zz*xx-zx*xz, yz=zx*xy-zy*xx;
      o[0]=xx; o[1]=yx; o[2]=zx; o[3]=0; o[4]=xy; o[5]=yy; o[6]=zy; o[7]=0; o[8]=xz; o[9]=yz; o[10]=zz; o[11]=0;
      o[12]=-(xx*e[0]+xy*e[1]+xz*e[2]); o[13]=-(yx*e[0]+yy*e[1]+yz*e[2]); o[14]=-(zx*e[0]+zy*e[1]+zz*e[2]); o[15]=1; return o;
    },
    // M = T * Ry * Rx * Rz * S
    parts(o,tx,ty,tz,rx,ry,rz,sx,sy,sz){
      const cx=Math.cos(rx),sxn=Math.sin(rx),cy=Math.cos(ry),sy_=Math.sin(ry),cz=Math.cos(rz),sz_=Math.sin(rz);
      // Rz
      // R = Ry * Rx * Rz
      const r00=cy*cz+sy_*sxn*sz_, r01=-cy*sz_+sy_*sxn*cz, r02=sy_*cx;
      const r10=cx*sz_, r11=cx*cz, r12=-sxn;
      const r20=-sy_*cz+cy*sxn*sz_, r21=sy_*sz_+cy*sxn*cz, r22=cy*cx;
      o[0]=r00*sx; o[1]=r10*sx; o[2]=r20*sx; o[3]=0;
      o[4]=r01*sy; o[5]=r11*sy; o[6]=r21*sy; o[7]=0;
      o[8]=r02*sz; o[9]=r12*sz; o[10]=r22*sz; o[11]=0;
      o[12]=tx; o[13]=ty; o[14]=tz; o[15]=1; return o;
    },
    invert(o,a){
      const a00=a[0],a01=a[1],a02=a[2],a03=a[3],a10=a[4],a11=a[5],a12=a[6],a13=a[7],a20=a[8],a21=a[9],a22=a[10],a23=a[11],a30=a[12],a31=a[13],a32=a[14],a33=a[15];
      const b00=a00*a11-a01*a10,b01=a00*a12-a02*a10,b02=a00*a13-a03*a10,b03=a01*a12-a02*a11,b04=a01*a13-a03*a11,b05=a02*a13-a03*a12,
            b06=a20*a31-a21*a30,b07=a20*a32-a22*a30,b08=a20*a33-a23*a30,b09=a21*a32-a22*a31,b10=a21*a33-a23*a31,b11=a22*a33-a23*a32;
      let d=b00*b11-b01*b10+b02*b09+b03*b08-b04*b07+b05*b06; if(!d) return o; d=1/d;
      o[0]=(a11*b11-a12*b10+a13*b09)*d; o[1]=(a02*b10-a01*b11-a03*b09)*d; o[2]=(a31*b05-a32*b04+a33*b03)*d; o[3]=(a22*b04-a21*b05-a23*b03)*d;
      o[4]=(a12*b08-a10*b11-a13*b07)*d; o[5]=(a00*b11-a02*b08+a03*b07)*d; o[6]=(a32*b02-a30*b05-a33*b01)*d; o[7]=(a20*b05-a22*b02+a23*b01)*d;
      o[8]=(a10*b10-a11*b08+a13*b06)*d; o[9]=(a01*b08-a00*b10-a03*b06)*d; o[10]=(a30*b04-a31*b02+a33*b00)*d; o[11]=(a21*b02-a20*b04-a23*b00)*d;
      o[12]=(a11*b07-a10*b09-a12*b06)*d; o[13]=(a00*b09-a01*b07+a02*b06)*d; o[14]=(a31*b01-a30*b03-a32*b00)*d; o[15]=(a20*b03-a21*b01+a22*b00)*d; return o;
    },
    // inverse-transpose of the upper 3x3 (for normals)
    normal(o,m){
      const a=m[0],b=m[1],c=m[2],d=m[4],e=m[5],f=m[6],g=m[8],h=m[9],i=m[10];
      const A=e*i-f*h, B=f*g-d*i, C=d*h-e*g; let det=a*A+b*B+c*C; det=det?1/det:1;
      o[0]=A*det; o[1]=B*det; o[2]=C*det;
      o[3]=(c*h-b*i)*det; o[4]=(a*i-c*g)*det; o[5]=(b*g-a*h)*det;
      o[6]=(b*f-c*e)*det; o[7]=(c*d-a*f)*det; o[8]=(a*e-b*d)*det; return o;
    },
    xformPoint(m,x,y,z){ return [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]]; },
    // six frustum planes (Gribb/Hartmann) from a view-projection matrix; each plane [a,b,c,d] normalised
    frustum(m){
      const P=[]; const row=(i)=>[m[i],m[4+i],m[8+i],m[12+i]];
      const r0=row(0),r1=row(1),r2=row(2),r3=row(3);
      const add=(a,s)=>{ const p=[r3[0]+s*a[0],r3[1]+s*a[1],r3[2]+s*a[2],r3[3]+s*a[3]]; const l=Math.hypot(p[0],p[1],p[2])||1; P.push([p[0]/l,p[1]/l,p[2]/l,p[3]/l]); };
      add(r0,1); add(r0,-1); add(r1,1); add(r1,-1); add(r2,1); add(r2,-1); return P;
    },
    aabbInFrustum(P,mn,mx){
      for(const p of P){
        const x=p[0]>=0?mx[0]:mn[0], y=p[1]>=0?mx[1]:mn[1], z=p[2]>=0?mx[2]:mn[2];
        if(p[0]*x+p[1]*y+p[2]*z+p[3]<0) return false;
      } return true;
    }
  };
  m4._t=new Float32Array(16);

  /* ================= geometry ================= */
  // geometry = {p:[], n:[], uv:[], c:[], i:[]}  (plain arrays; c = rgba per vertex)
  const G={
    empty(){ return {p:[],n:[],uv:[],c:[],i:[]}; },
    box(sx,sy,sz,uvs){
      const g=G.empty(), hx=sx/2,hy=sy/2,hz=sz/2; uvs=uvs||1;
      const face=(n,pts,uvw,uvh)=>{
        const b=g.p.length/3;
        for(let k=0;k<4;k++){ g.p.push(...pts[k]); g.n.push(...n); g.c.push(1,1,1,1); }
        g.uv.push(0,0, uvw/uvs,0, uvw/uvs,uvh/uvs, 0,uvh/uvs); g.i.push(b,b+1,b+2,b,b+2,b+3);
      };
      face([0,0,1],[[-hx,-hy,hz],[hx,-hy,hz],[hx,hy,hz],[-hx,hy,hz]],sx,sy);
      face([0,0,-1],[[hx,-hy,-hz],[-hx,-hy,-hz],[-hx,hy,-hz],[hx,hy,-hz]],sx,sy);
      face([1,0,0],[[hx,-hy,hz],[hx,-hy,-hz],[hx,hy,-hz],[hx,hy,hz]],sz,sy);
      face([-1,0,0],[[-hx,-hy,-hz],[-hx,-hy,hz],[-hx,hy,hz],[-hx,hy,-hz]],sz,sy);
      face([0,1,0],[[-hx,hy,hz],[hx,hy,hz],[hx,hy,-hz],[-hx,hy,-hz]],sx,sz);
      face([0,-1,0],[[-hx,-hy,-hz],[hx,-hy,-hz],[hx,-hy,hz],[-hx,-hy,hz]],sx,sz);
      return g;
    },
    // single wall/ground face helper used by static builders: quad from 4 points with normal
    quad(p0,p1,p2,p3,n,uvw,uvh,col){
      const g=G.empty(); col=col||[1,1,1,1];
      [p0,p1,p2,p3].forEach(p=>{ g.p.push(...p); g.n.push(...n); g.c.push(...col); });
      g.uv.push(0,0,uvw,0,uvw,uvh,0,uvh); g.i.push(0,1,2,0,2,3); return g;
    },
    cyl(rt,rb,h,seg,capT,capB){
      const g=G.empty(); seg=seg||12; capT=capT!==false; capB=capB!==false; const hh=h/2;
      const slope=(rb-rt)/h;
      for(let i=0;i<=seg;i++){
        const a=i/seg*Math.PI*2, c=Math.cos(a), s=Math.sin(a);
        const nl=Math.hypot(1,slope), nx=c/nl, ny=slope/nl, nz=s/nl;
        g.p.push(c*rt,hh,s*rt, c*rb,-hh,s*rb); g.n.push(nx,ny,nz,nx,ny,nz); g.uv.push(i/seg*Math.PI*(rt+rb)/1,0,i/seg*Math.PI*(rt+rb)/1,h); g.c.push(1,1,1,1,1,1,1,1);
      }
      for(let i=0;i<seg;i++){ const a=i*2; g.i.push(a,a+1,a+3,a,a+3,a+2); }
      const cap=(y,r,ny)=>{
        const b=g.p.length/3; g.p.push(0,y,0); g.n.push(0,ny,0); g.uv.push(.5,.5); g.c.push(1,1,1,1);
        for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2; g.p.push(Math.cos(a)*r,y,Math.sin(a)*r); g.n.push(0,ny,0); g.uv.push(.5+Math.cos(a)*.5,.5+Math.sin(a)*.5); g.c.push(1,1,1,1); }
        for(let i=0;i<seg;i++){ if(ny>0) g.i.push(b,b+2+i,b+1+i); else g.i.push(b,b+1+i,b+2+i); }
      };
      if(capT&&rt>0) cap(hh,rt,1); if(capB&&rb>0) cap(-hh,rb,-1);
      return g;
    },
    sphere(r,seg,rings){
      const g=G.empty(); seg=seg||14; rings=rings||10;
      for(let y=0;y<=rings;y++){ const v=y/rings, th=v*Math.PI;
        for(let x=0;x<=seg;x++){ const u=x/seg, ph=u*Math.PI*2;
          const nx=Math.cos(ph)*Math.sin(th), ny=Math.cos(th), nz=Math.sin(ph)*Math.sin(th);
          g.p.push(nx*r,ny*r,nz*r); g.n.push(nx,ny,nz); g.uv.push(u*2*Math.PI*r,v*Math.PI*r); g.c.push(1,1,1,1); } }
      for(let y=0;y<rings;y++) for(let x=0;x<seg;x++){ const a=y*(seg+1)+x, b=a+seg+1; g.i.push(a,b,a+1,b,b+1,a+1); }
      return g;
    },
    cone(r,h,seg){ return G.cyl(0,r,h,seg||12,false,true); },
    torus(R,r,seg,sides){
      const g=G.empty(); seg=seg||16; sides=sides||8;
      for(let i=0;i<=seg;i++){ const a=i/seg*Math.PI*2;
        for(let j=0;j<=sides;j++){ const b=j/sides*Math.PI*2;
          const cx=Math.cos(a)*R, cz=Math.sin(a)*R;
          const nx=Math.cos(a)*Math.cos(b), ny=Math.sin(b), nz=Math.sin(a)*Math.cos(b);
          g.p.push(cx+nx*r,ny*r,cz+nz*r); g.n.push(nx,ny,nz); g.uv.push(i/seg,j/sides); g.c.push(1,1,1,1); } }
      for(let i=0;i<seg;i++) for(let j=0;j<sides;j++){ const a=i*(sides+1)+j, b=a+sides+1; g.i.push(a,b,a+1,b,b+1,a+1); }
      return g;
    },
    plane(w,d,uvw,uvh,y){
      const g=G.empty(); y=y||0; const hw=w/2,hd=d/2;
      g.p.push(-hw,y,hd, hw,y,hd, hw,y,-hd, -hw,y,-hd); for(let k=0;k<4;k++){ g.n.push(0,1,0); g.c.push(1,1,1,1); }
      g.uv.push(0,0,uvw||w,0,uvw||w,uvh||d,0,uvh||d); g.i.push(0,1,2,0,2,3); return g;
    },
    // flat octahedron-ish gem
    gem(r,h){
      const g=G.empty(); const top=[0,h,0], bot=[0,-h,0], ring=[]; for(let i=0;i<6;i++){ const a=i/6*Math.PI*2; ring.push([Math.cos(a)*r,0,Math.sin(a)*r]); }
      const tri=(a,b,c)=>{ const u=[b[0]-a[0],b[1]-a[1],b[2]-a[2]], v=[c[0]-a[0],c[1]-a[1],c[2]-a[2]]; let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]; const l=Math.hypot(...n)||1; n=n.map(x=>x/l); const b0=g.p.length/3; [a,b,c].forEach(p=>{ g.p.push(...p); g.n.push(...n); g.c.push(1,1,1,1); g.uv.push(0,0); }); g.i.push(b0,b0+1,b0+2); };
      for(let i=0;i<6;i++){ const a=ring[i], b=ring[(i+1)%6]; tri(top,b,a); tri(bot,a,b); }
      return g;
    },
    xf(g,m){
      const o=G.empty(), nm=new Float32Array(9); m4.normal(nm,m);
      for(let i=0;i<g.p.length;i+=3){ const p=m4.xformPoint(m,g.p[i],g.p[i+1],g.p[i+2]); o.p.push(p[0],p[1],p[2]);
        const nx=g.n[i],ny=g.n[i+1],nz=g.n[i+2]; let x=nm[0]*nx+nm[3]*ny+nm[6]*nz, y=nm[1]*nx+nm[4]*ny+nm[7]*nz, z=nm[2]*nx+nm[5]*ny+nm[8]*nz; const l=Math.hypot(x,y,z)||1; o.n.push(x/l,y/l,z/l); }
      o.uv=g.uv.slice(); o.c=g.c.slice(); o.i=g.i.slice(); return o;
    },
    tint(g,r,gg,b,a){ for(let i=0;i<g.c.length;i+=4){ g.c[i]*=r; g.c[i+1]*=gg; g.c[i+2]*=b; if(a!==undefined) g.c[i+3]*=a; } return g; },
    // darken vertices toward the ground: ao = lerp(lo,1,y/h)
    gradAO(g,h,lo){ for(let k=0;k<g.p.length/3;k++){ const y=Math.max(0,Math.min(1,g.p[k*3+1]/h)); const a=lo+(1-lo)*y; g.c[k*4+3]*=a; } return g; },
    append(dst,src){ const b=dst.p.length/3; for(let i=0;i<src.p.length;i++) dst.p.push(src.p[i]); for(let i=0;i<src.n.length;i++) dst.n.push(src.n[i]); for(let i=0;i<src.uv.length;i++) dst.uv.push(src.uv[i]); for(let i=0;i<src.c.length;i++) dst.c.push(src.c[i]); for(let i=0;i<src.i.length;i++) dst.i.push(src.i[i]+b); return dst; }
  };

  /* ================= shaders ================= */
  const VS_MAIN=`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec3 aNor; layout(location=2) in vec2 aUV; layout(location=3) in vec4 aCol;
uniform mat4 uModel; uniform mat4 uVP; uniform mat3 uNMat; uniform mat4 uLightVP; uniform float uTime; uniform float uSway;
out vec3 vWorld; out vec3 vN; out vec2 vUV; out vec4 vCol; out vec4 vShadow;
void main(){
  vec4 w=uModel*vec4(aPos,1.0);
  if(uSway>0.0){ float h=max(w.y,0.0); float ph=w.x*0.9+w.z*0.7;
    w.x+=(sin(uTime*1.6+ph)*0.12+sin(uTime*3.1+ph*2.0)*0.04)*uSway*h; w.z+=cos(uTime*1.3+ph)*0.09*uSway*h; }
  vWorld=w.xyz; vN=normalize(uNMat*aNor); vUV=aUV; vCol=aCol; vShadow=uLightVP*w; gl_Position=uVP*w;
}`;
  const FS_MAIN=`#version 300 es
precision highp float; precision highp sampler2DShadow;
in vec3 vWorld; in vec3 vN; in vec2 vUV; in vec4 vCol; in vec4 vShadow;
uniform vec3 uCam; uniform vec3 uColor; uniform float uRough; uniform float uMetal; uniform float uAlpha; uniform vec3 uEmissive;
uniform sampler2D uTex; uniform sampler2D uNrm; uniform sampler2D uEmi; uniform int uHasTex; uniform int uHasNrm; uniform int uHasEmi;
uniform vec2 uUVScale; uniform float uNrmStr; uniform float uRim; uniform float uUnlit; uniform float uAmbMul; uniform float uTwoSided;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uGround;
uniform vec3 uFogCol; uniform float uFogDen; uniform float uFogH;
uniform sampler2DShadow uShadow; uniform float uShadowOn; uniform float uShadowTexel; uniform vec3 uShadowC; uniform float uShadowR;
uniform vec3 uPLPos[4]; uniform vec3 uPLCol[4]; uniform float uPLRad[4]; uniform int uPLN;
uniform int uHDR; uniform float uTime; uniform vec3 uOccP; uniform float uOccOn; uniform float uOccApply;
out vec4 oColor;
const float PI=3.14159265;
vec3 skyEnv(vec3 d){
  float h=d.y; vec3 c=mix(uSkyHor,uSkyTop,smoothstep(0.0,0.75,h)); c=mix(c,uGround*0.8,smoothstep(0.0,-0.35,h));
  float s=max(dot(d,uSunDir),0.0); c+=uSunCol*(pow(s,48.0)*0.9+pow(s,6.0)*0.12); return c;
}
mat3 cotFrame(vec3 N,vec3 p,vec2 uv){
  vec3 dp1=dFdx(p),dp2=dFdy(p); vec2 du1=dFdx(uv),du2=dFdy(uv);
  vec3 d2p=cross(dp2,N),d1p=cross(N,dp1); vec3 T=d2p*du1.x+d1p*du2.x; vec3 B=d2p*du1.y+d1p*du2.y;
  float im=inversesqrt(max(max(dot(T,T),dot(B,B)),1e-12)); return mat3(T*im,B*im,N);
}
float DGGX(float NdH,float a){ float a2=a*a; float d=NdH*NdH*(a2-1.0)+1.0; return a2/(PI*d*d+1e-5); }
float GSmith(float NdV,float NdL,float r){ float k=(r+1.0)*(r+1.0)/8.0; return (NdV/(NdV*(1.0-k)+k))*(NdL/(NdL*(1.0-k)+k)); }
vec3 brdf(vec3 N,vec3 V,vec3 L,vec3 rad,vec3 albedo,vec3 F0,float rough,float metal){
  float NdL=max(dot(N,L),0.0); if(NdL<=0.0) return vec3(0.0);
  vec3 H=normalize(V+L); float NdV=max(dot(N,V),1e-3), NdH=max(dot(N,H),0.0), VdH=max(dot(V,H),0.0);
  float a=max(rough*rough,0.02); float D=DGGX(NdH,a); float Gv=GSmith(NdV,NdL,rough);
  vec3 F=F0+(1.0-F0)*pow(1.0-VdH,5.0);
  vec3 spec=D*Gv*F/(4.0*NdV*NdL+1e-4); vec3 kd=(1.0-F)*(1.0-metal);
  return (kd*albedo/PI+spec)*rad*NdL;
}
float shadowAt(vec3 N,vec3 L){
  if(uShadowOn<0.5) return 1.0;
  vec3 sc=vShadow.xyz/vShadow.w*0.5+0.5;
  if(sc.x<0.0||sc.x>1.0||sc.y<0.0||sc.y>1.0||sc.z>1.0) return 1.0;
  float NdL=max(dot(N,L),0.0); float bias=max(0.0022*(1.0-NdL),0.0006);
  float s=0.0; float t=uShadowTexel;
  for(int x=-1;x<=1;x++) for(int y=-1;y<=1;y++) s+=texture(uShadow,vec3(sc.xy+vec2(float(x),float(y))*t,sc.z-bias));
  s/=9.0;
  float fade=smoothstep(uShadowR*0.7,uShadowR,length(vWorld.xz-uShadowC.xz));
  return mix(s,1.0,fade);
}
void main(){
  if(uOccOn*uOccApply>0.5 && vWorld.y>0.4){ // see-through hole for scenery between camera and player
    vec3 ab=uCam-uOccP; float t=clamp(dot(vWorld-uOccP,ab)/dot(ab,ab),0.0,1.0); float d=length(vWorld-(uOccP+ab*t));
    float nz=fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453);
    float fade=smoothstep(0.85,0.3,d); // soft, body-sized see-through zone (about 70% transparent in the core)
    if(t>0.0 && nz<fade*0.93) discard; }
  vec2 uv=vUV*uUVScale;
  vec4 tex=(uHasTex==1)?texture(uTex,uv):vec4(1.0);
  vec3 albedo=uColor*tex.rgb*vCol.rgb; float ao=vCol.a;
  vec3 N=normalize(vN);
  vec3 V=normalize(uCam-vWorld);
  if(uTwoSided>0.5 && dot(N,V)<0.0) N=-N;
  if(uHasNrm==1){ vec3 nm=texture(uNrm,uv).xyz*2.0-1.0; nm.xy*=uNrmStr; N=normalize(cotFrame(N,vWorld,uv)*normalize(nm)); }
  vec3 emi=uEmissive; if(uHasEmi==1) emi+=texture(uEmi,uv).rgb*max(uEmissive,vec3(0.0)).r*0.0+texture(uEmi,uv).rgb;
  float rough=clamp(uRough,0.04,1.0), metal=uMetal;
  vec3 col;
  if(uUnlit>0.5){ col=albedo+emi; }
  else {
    vec3 F0=mix(vec3(0.04),albedo,metal);
    float sh=shadowAt(N,uSunDir);
    col=brdf(N,V,uSunDir,uSunCol*sh,albedo,F0,rough,metal);
    for(int i=0;i<4;i++){ if(i>=uPLN) break; vec3 Lv=uPLPos[i]-vWorld; float d=length(Lv); float att=clamp(1.0-d/uPLRad[i],0.0,1.0); att*=att;
      col+=brdf(N,V,Lv/d,uPLCol[i]*att*3.0,albedo,F0,rough,metal); }
    vec3 amb=mix(uGround,uSkyTop*0.9+uSkyHor*0.4,N.y*0.5+0.5)*albedo*(1.0-metal)*ao*uAmbMul;
    vec3 R=reflect(-V,N); float fr=pow(1.0-max(dot(N,V),0.0),5.0);
    vec3 Fr=F0+(max(vec3(1.0-rough),F0)-F0)*fr;
    vec3 envSpec=skyEnv(R)*Fr*(1.0-rough*0.7)*ao*(0.35+0.65*sh);
    col+=amb+envSpec+emi;
    col+=uRim*pow(1.0-max(dot(N,V),0.0),2.5)*uSkyHor*1.4;
  }
  float dist=length(uCam-vWorld);
  float fog=1.0-exp(-pow(dist*uFogDen,2.0)); fog=max(fog,0.0)*(1.0-clamp(vWorld.y*uFogH,0.0,0.6));
  col=mix(col,uFogCol,clamp(fog,0.0,1.0));
  float alpha=uAlpha*tex.a;
  if(uHDR==1) oColor=vec4(col,alpha);
  else { col=col/(col+vec3(0.9)); oColor=vec4(pow(col,vec3(1.0/2.2)),alpha); }
}`;
  const VS_DEPTH=`#version 300 es
layout(location=0) in vec3 aPos; uniform mat4 uModel; uniform mat4 uLightVP; uniform float uTime; uniform float uSway;
void main(){ vec4 w=uModel*vec4(aPos,1.0);
  if(uSway>0.0){ float h=max(w.y,0.0); float ph=w.x*0.9+w.z*0.7; w.x+=(sin(uTime*1.6+ph)*0.12+sin(uTime*3.1+ph*2.0)*0.04)*uSway*h; w.z+=cos(uTime*1.3+ph)*0.09*uSway*h; }
  gl_Position=uLightVP*w; }`;
  const FS_DEPTH=`#version 300 es
precision mediump float; void main(){}`;

  const VS_FULL=`#version 300 es
out vec2 vUV; void main(){ vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2); vUV=p; gl_Position=vec4(p*2.0-1.0,0.0,1.0); }`;

  const FS_SKY=`#version 300 es
precision highp float; in vec2 vUV; uniform mat4 uInvVP; uniform vec3 uCam;
uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uGround; uniform vec3 uSunDir; uniform vec3 uSunCol; uniform float uStars; uniform float uClouds; uniform float uTime; uniform float uAurora; uniform vec3 uAuroraCol;
out vec4 oColor;
float hash(vec2 p){ p=fract(p*vec2(123.34,456.21)); p+=dot(p,p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y); }
float fbm(vec2 p){ float a=0.5,s=0.0; for(int i=0;i<5;i++){ s+=a*noise(p); p*=2.03; a*=0.5; } return s; }
void main(){
  vec4 q=uInvVP*vec4(vUV*2.0-1.0,1.0,1.0); vec3 d=normalize(q.xyz/q.w-uCam);
  float h=d.y; vec3 c=mix(uSkyHor,uSkyTop,pow(clamp(h,0.0,1.0),0.55)); c=mix(c,uGround,smoothstep(0.0,-0.18,h));
  float s=max(dot(d,uSunDir),0.0); c+=uSunCol*(pow(s,700.0)*6.0+pow(s,40.0)*0.55+pow(s,5.0)*0.14);
  if(uStars>0.0&&h>0.0){ vec2 sp=d.xz/(d.y+0.35)*60.0; float st=hash(floor(sp)); float tw=0.6+0.4*sin(uTime*2.0+st*40.0); c+=vec3(1.0)*step(0.992,st)*tw*uStars*smoothstep(0.0,0.3,h); }
  if(uClouds>0.0&&h>0.02){ vec2 cp=d.xz/(d.y+0.15)*1.6+vec2(uTime*0.01,0.0); float cl=fbm(cp); cl=smoothstep(0.48,0.8,cl); vec3 cc=mix(uSkyHor*1.2,uSunCol*0.8+vec3(0.3),0.4); c=mix(c,cc,cl*uClouds*smoothstep(0.02,0.25,h)); }
  if(uAurora>0.0&&h>0.05){ vec2 ap=d.xz/(d.y+0.3)*2.0; float b=sin(ap.x*3.0+fbm(ap+uTime*0.05)*6.0+uTime*0.3); float band=smoothstep(0.55,1.0,b*0.5+0.5)*smoothstep(0.05,0.4,h)*(1.0-smoothstep(0.5,0.9,h)); c+=uAuroraCol*band*uAurora; }
  oColor=vec4(c,1.0);
}`;

  const FS_WATER=`#version 300 es
precision highp float;
in vec3 vWorld; in vec3 vN; in vec2 vUV; in vec4 vCol; in vec4 vShadow;
uniform vec3 uCam; uniform sampler2D uNrm; uniform float uTime;
uniform vec3 uSunDir; uniform vec3 uSunCol; uniform vec3 uSkyTop; uniform vec3 uSkyHor; uniform vec3 uGround;
uniform vec3 uFogCol; uniform float uFogDen; uniform vec3 uWDeep; uniform vec3 uWShallow; uniform int uHDR;
out vec4 oColor;
vec3 skyEnv(vec3 d){ float h=d.y; vec3 c=mix(uSkyHor,uSkyTop,smoothstep(0.0,0.75,h)); c=mix(c,uGround*0.8,smoothstep(0.0,-0.35,h)); float s=max(dot(d,uSunDir),0.0); c+=uSunCol*(pow(s,48.0)*0.9+pow(s,6.0)*0.12); return c; }
void main(){
  vec2 p=vWorld.xz;
  vec3 n1=texture(uNrm,p*0.22+vec2(uTime*0.03,uTime*0.02)).xyz*2.0-1.0;
  vec3 n2=texture(uNrm,p*0.41-vec2(uTime*0.025,-uTime*0.035)).xyz*2.0-1.0;
  vec3 N=normalize(vec3((n1.x+n2.x)*0.55+sin(p.x*2.1+uTime*1.3)*0.05,1.0,(n1.y+n2.y)*0.55+cos(p.y*1.9+uTime*1.1)*0.05));
  vec3 V=normalize(uCam-vWorld); float ndv=max(dot(N,V),0.0);
  float fres=0.03+0.97*pow(1.0-ndv,4.0);
  vec3 refl=skyEnv(reflect(-V,N));
  float shore=vCol.a;
  vec3 base=mix(uWDeep,uWShallow,clamp(shore*1.2+0.15,0.0,1.0));
  vec3 col=mix(base,refl,clamp(fres*0.9+0.05,0.0,1.0));
  vec3 H=normalize(V+uSunDir); col+=uSunCol*pow(max(dot(N,H),0.0),220.0)*5.0;
  float foamN=texture(uNrm,p*0.9+vec2(uTime*0.05,0.0)).z;
  float foam=smoothstep(0.5,1.0,shore)*(0.55+0.45*sin(uTime*2.0+p.x*3.0+p.y*2.0))*smoothstep(0.3,0.9,foamN*0.5+0.5);
  col=mix(col,vec3(0.92,0.97,1.0),clamp(foam,0.0,1.0)*0.85);
  float dist=length(uCam-vWorld); float fog=1.0-exp(-pow(dist*uFogDen,2.0)); col=mix(col,uFogCol,clamp(fog,0.0,1.0));
  float alpha=mix(0.78,0.96,fres)+foam*0.1;
  if(uHDR==1) oColor=vec4(col,alpha); else { col=col/(col+vec3(0.9)); oColor=vec4(pow(col,vec3(1.0/2.2)),alpha); }
}`;

  const VS_PART=`#version 300 es
layout(location=0) in vec3 aPos; layout(location=1) in vec4 aInfo; // size, alpha, phase, kind
uniform mat4 uVP; uniform vec3 uCam; uniform float uScale; uniform float uTime;
out float vA; out float vK;
void main(){ vec4 p=uVP*vec4(aPos,1.0); gl_Position=p; float d=max(length(uCam-aPos),0.5);
  gl_PointSize=clamp(aInfo.x*uScale/d,1.0,64.0); vA=aInfo.y*(0.65+0.35*sin(uTime*3.0+aInfo.z*6.28)); vK=aInfo.w; }`;
  const FS_PART=`#version 300 es
precision mediump float; in float vA; in float vK; uniform vec3 uColor; uniform float uHDR; out vec4 oColor;
void main(){ vec2 q=gl_PointCoord-0.5; float r=length(q)*2.0; float a=smoothstep(1.0,0.0,r); a*=a; oColor=vec4(uColor*(1.0+vK*0.0),a*vA); }`;

  const FS_BRIGHT=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform float uThresh; out vec4 oColor;
void main(){ vec3 c=texture(uTex,vUV).rgb; float l=dot(c,vec3(0.2126,0.7152,0.0722)); float k=smoothstep(uThresh,uThresh+1.2,l); oColor=vec4(c*k,1.0); }`;
  const FS_BLUR=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uTex; uniform vec2 uDir; out vec4 oColor;
void main(){ vec3 s=texture(uTex,vUV).rgb*0.2270270270;
  s+=texture(uTex,vUV+uDir*1.3846153846).rgb*0.3162162162; s+=texture(uTex,vUV-uDir*1.3846153846).rgb*0.3162162162;
  s+=texture(uTex,vUV+uDir*3.2307692308).rgb*0.0702702703; s+=texture(uTex,vUV-uDir*3.2307692308).rgb*0.0702702703; oColor=vec4(s,1.0); }`;
  const FS_COMP=`#version 300 es
precision highp float; in vec2 vUV; uniform sampler2D uScene; uniform sampler2D uBloom; uniform float uBloomAmt; uniform float uExposure; uniform int uHDR; uniform vec3 uTint; uniform float uVig; uniform vec2 uRes; uniform float uTime; uniform float uSat; out vec4 oColor;
vec3 aces(vec3 x){ return clamp((x*(2.51*x+0.03))/(x*(2.43*x+0.59)+0.14),0.0,1.0); }
float hash(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
void main(){
  vec3 c=texture(uScene,vUV).rgb; vec3 b=texture(uBloom,vUV).rgb; c+=b*uBloomAmt;
  if(uHDR==1){ c=aces(c*uExposure); c=pow(c,vec3(1.0/2.2)); }
  float l=dot(c,vec3(0.299,0.587,0.114)); c=mix(vec3(l),c,uSat); c*=uTint;
  vec2 q=vUV-0.5; float v=1.0-uVig*dot(q,q)*2.2; c*=clamp(v,0.0,1.0);
  c+=(hash(vUV*uRes+uTime)-0.5)/255.0;
  oColor=vec4(c,1.0);
}`;

  /* ================= engine state ================= */
  const E={ ok:false, gl:null, canvas:null, w:1, h:1, hdr:false, quality:'medium', progs:{}, m4, G, stats:{drawCalls:0,tris:0,chunksDrawn:0,chunksTotal:0,shadowCalls:0} };
  let gl, emptyVAO, aniso=null;

  function compile(type,src){ const s=gl.createShader(type); gl.shaderSource(s,src); gl.compileShader(s); if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){ const e=gl.getShaderInfoLog(s); console.error(e,src.split('\n').map((l,i)=>(i+1)+': '+l).join('\n')); throw new Error('shader: '+e); } return s; }
  function program(vs,fs,name){
    const p=gl.createProgram(); gl.attachShader(p,compile(gl.VERTEX_SHADER,vs)); gl.attachShader(p,compile(gl.FRAGMENT_SHADER,fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p,gl.LINK_STATUS)) throw new Error('link '+name+': '+gl.getProgramInfoLog(p));
    const u={}; const n=gl.getProgramParameter(p,gl.ACTIVE_UNIFORMS);
    for(let i=0;i<n;i++){ const info=gl.getActiveUniform(p,i); const nm=info.name.replace(/\[0\]$/,''); u[nm]=gl.getUniformLocation(p,info.name); }
    return {p,u,name};
  }

  E.init=function(canvas,quality){
    try{
      gl=canvas.getContext('webgl2',{antialias:false,alpha:false,depth:true,stencil:false,powerPreference:'high-performance',preserveDrawingBuffer:false});
      if(!gl) return false;
      E.gl=gl; E.canvas=canvas; E.quality=quality||'medium';
      E.hdr=!!gl.getExtension('EXT_color_buffer_float');
      aniso=gl.getExtension('EXT_texture_filter_anisotropic');
      E.progs.main=program(VS_MAIN,FS_MAIN,'main');
      E.progs.water=program(VS_MAIN,FS_WATER,'water');
      E.progs.depth=program(VS_DEPTH,FS_DEPTH,'depth');
      E.progs.sky=program(VS_FULL,FS_SKY,'sky');
      E.progs.part=program(VS_PART,FS_PART,'part');
      E.progs.bright=program(VS_FULL,FS_BRIGHT,'bright');
      E.progs.blur=program(VS_FULL,FS_BLUR,'blur');
      E.progs.comp=program(VS_FULL,FS_COMP,'comp');
      emptyVAO=gl.createVertexArray();
      E.ok=true; return true;
    }catch(err){ console.error('GL init failed',err); E.ok=false; return false; }
  };

  /* ---------- meshes ---------- */
  E.createMesh=function(g){
    const n=g.p.length/3, data=new Float32Array(n*12);
    let mnx=1e9,mny=1e9,mnz=1e9,mxx=-1e9,mxy=-1e9,mxz=-1e9;
    for(let i=0;i<n;i++){
      const x=g.p[i*3],y=g.p[i*3+1],z=g.p[i*3+2];
      data[i*12]=x; data[i*12+1]=y; data[i*12+2]=z; data[i*12+3]=g.n[i*3]; data[i*12+4]=g.n[i*3+1]; data[i*12+5]=g.n[i*3+2];
      data[i*12+6]=g.uv[i*2]||0; data[i*12+7]=g.uv[i*2+1]||0;
      data[i*12+8]=g.c[i*4]; data[i*12+9]=g.c[i*4+1]; data[i*12+10]=g.c[i*4+2]; data[i*12+11]=g.c[i*4+3];
      if(x<mnx)mnx=x; if(y<mny)mny=y; if(z<mnz)mnz=z; if(x>mxx)mxx=x; if(y>mxy)mxy=y; if(z>mxz)mxz=z;
    }
    const vao=gl.createVertexArray(); gl.bindVertexArray(vao);
    const vbo=gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER,vbo); gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
    const stride=48;
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,stride,0);
    gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,3,gl.FLOAT,false,stride,12);
    gl.enableVertexAttribArray(2); gl.vertexAttribPointer(2,2,gl.FLOAT,false,stride,24);
    gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.FLOAT,false,stride,32);
    const ibo=gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER,ibo);
    const big=n>65535; gl.bufferData(gl.ELEMENT_ARRAY_BUFFER,big?new Uint32Array(g.i):new Uint16Array(g.i),gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return {vao,vbo,ibo,count:g.i.length,type:big?gl.UNSIGNED_INT:gl.UNSIGNED_SHORT,min:[mnx,mny,mnz],max:[mxx,mxy,mxz]};
  };
  E.freeMesh=function(m){ gl.deleteBuffer(m.vbo); gl.deleteBuffer(m.ibo); gl.deleteVertexArray(m.vao); };

  /* ---------- textures ---------- */
  E.texture=function(canvas,opts){
    opts=opts||{}; const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);
    const w=canvas.width,h=canvas.height;
    gl.texImage2D(gl.TEXTURE_2D,0,opts.srgb?gl.SRGB8_ALPHA8:gl.RGBA8,w,h,0,gl.RGBA,gl.UNSIGNED_BYTE,canvas);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    const wrap=opts.clamp?gl.CLAMP_TO_EDGE:gl.REPEAT; gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,wrap); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,wrap);
    if(aniso) gl.texParameterf(gl.TEXTURE_2D,aniso.TEXTURE_MAX_ANISOTROPY_EXT,Math.min(E.quality==='high'?16:8,gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    return t;
  };
  E.texCount=0;

  /* ---------- render targets ---------- */
  const T={};   // target textures/fbos
  function colorTex(w,h,hdr){
    const t=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,t);
    gl.texImage2D(gl.TEXTURE_2D,0,hdr?gl.RGBA16F:gl.RGBA8,w,h,0,gl.RGBA,hdr?gl.HALF_FLOAT:gl.UNSIGNED_BYTE,null);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE); return t;
  }
  function fboWith(tex){ const f=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,f); gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,tex,0); return f; }
  function freeTargets(){
    Object.keys(T).forEach(k=>{ const o=T[k]; if(o&&o.constructor===WebGLTexture) gl.deleteTexture(o); else if(o&&o.constructor===WebGLFramebuffer) gl.deleteFramebuffer(o); else if(o&&o.constructor===WebGLRenderbuffer) gl.deleteRenderbuffer(o); delete T[k]; });
  }
  const Q={ low:{shadow:1024,msaa:0,bloom:false}, medium:{shadow:2048,msaa:4,bloom:true}, high:{shadow:4096,msaa:4,bloom:true} };
  E.cfg=()=>Q[E.quality]||Q.medium;

  E.resize=function(w,h){
    if(!E.ok) return; E.w=w; E.h=h; freeTargets();
    const q=E.cfg(), maxS=gl.getParameter(gl.MAX_SAMPLES), samples=Math.min(q.msaa,maxS);
    // scene target (resolved)
    T.sceneTex=colorTex(w,h,E.hdr); T.sceneFbo=fboWith(T.sceneTex);
    // multisampled draw target
    T.msFbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,T.msFbo);
    T.msColor=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,T.msColor);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,E.hdr?gl.RGBA16F:gl.RGBA8,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.RENDERBUFFER,T.msColor);
    T.msDepth=gl.createRenderbuffer(); gl.bindRenderbuffer(gl.RENDERBUFFER,T.msDepth);
    gl.renderbufferStorageMultisample(gl.RENDERBUFFER,samples,gl.DEPTH_COMPONENT24,w,h); gl.framebufferRenderbuffer(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.RENDERBUFFER,T.msDepth);
    T.samples=samples;
    // bloom ping-pong at 1/4 res
    const bw=Math.max(2,w>>2), bh=Math.max(2,h>>2); T.bw=bw; T.bh=bh;
    T.b1=colorTex(bw,bh,E.hdr); T.b1f=fboWith(T.b1); T.b2=colorTex(bw,bh,E.hdr); T.b2f=fboWith(T.b2);
    gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    // shadow map
    if(!T.shadowTex || T.shadowSize!==q.shadow){
      if(T.shadowTex){ gl.deleteTexture(T.shadowTex); gl.deleteFramebuffer(T.shadowFbo); }
      T.shadowSize=q.shadow; T.shadowTex=gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,T.shadowTex);
      gl.texImage2D(gl.TEXTURE_2D,0,gl.DEPTH_COMPONENT24,q.shadow,q.shadow,0,gl.DEPTH_COMPONENT,gl.UNSIGNED_INT,null);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_MODE,gl.COMPARE_REF_TO_TEXTURE); gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_COMPARE_FUNC,gl.LEQUAL);
      T.shadowFbo=gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER,T.shadowFbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.DEPTH_ATTACHMENT,gl.TEXTURE_2D,T.shadowTex,0); gl.drawBuffers([gl.NONE]); gl.readBuffer(gl.NONE);
      gl.bindFramebuffer(gl.FRAMEBUFFER,null);
    }
  };
  E.targets=T;

  /* ---------- per-frame context ---------- */
  const U={ view:m4.create(), proj:m4.create(), vp:m4.create(), invVP:m4.create(), lightVP:m4.create(), nmat:new Float32Array(9), model:m4.create(), ident:m4.create(), identN:new Float32Array([1,0,0,0,1,0,0,0,1]) };
  E.U=U; E.env=null; E.cam=[0,0,0]; E.time=0; E.lights=[]; E.frustum=null; E.shadowOn=false; E.pass='main';
  let curProg=null, lastMat=null;

  function use(p){ if(curProg!==p){ gl.useProgram(p.p); curProg=p; lastMat=null; } return p; }

  // set per-frame (global) uniforms for a program
  function frameUniforms(p){
    const u=p.u, env=E.env, c=E.cam;
    const set3=(n,v)=>{ if(u[n]) gl.uniform3f(u[n],v[0],v[1],v[2]); };
    if(u.uVP) gl.uniformMatrix4fv(u.uVP,false,U.vp);
    if(u.uLightVP) gl.uniformMatrix4fv(u.uLightVP,false,U.lightVP);
    if(u.uCam) gl.uniform3f(u.uCam,c[0],c[1],c[2]);
    if(u.uTime) gl.uniform1f(u.uTime,E.time);
    if(u.uHDR) gl.uniform1i(u.uHDR,E.hdr?1:0);
    if(!env) return;
    set3('uSunDir',env.sunDir); set3('uSunCol',env.sunCol); set3('uSkyTop',env.skyTop); set3('uSkyHor',env.skyHor); set3('uGround',env.ground);
    set3('uFogCol',env.fogCol); if(u.uFogDen) gl.uniform1f(u.uFogDen,env.fogDen); if(u.uFogH) gl.uniform1f(u.uFogH,env.fogH||0.12);
    if(u.uShadowOn) gl.uniform1f(u.uShadowOn,E.shadowOn?1:0);
    if(u.uShadowTexel) gl.uniform1f(u.uShadowTexel,1/(T.shadowSize||2048)*1.3);
    if(u.uShadowC) gl.uniform3f(u.uShadowC,E.shadowCenter[0],0,E.shadowCenter[2]);
    if(u.uShadowR) gl.uniform1f(u.uShadowR,E.shadowRadius);
    if(u.uOccP) gl.uniform3fv(u.uOccP,E.occ||[0,0,0]); if(u.uOccOn) gl.uniform1f(u.uOccOn,E.occ?1:0);
    if(u.uAmbMul) gl.uniform1f(u.uAmbMul,env.ambMul===undefined?1:env.ambMul);
    set3('uWDeep',env.waterDeep||[0.02,0.12,0.2]); set3('uWShallow',env.waterShallow||[0.1,0.42,0.5]);
    if(u.uPLN){
      const L=E.lights, n=Math.min(4,L.length); gl.uniform1i(u.uPLN,n);
      const pos=new Float32Array(12), col=new Float32Array(12), rad=new Float32Array(4);
      for(let i=0;i<n;i++){ pos.set(L[i].pos,i*3); col.set(L[i].col,i*3); rad[i]=L[i].rad; }
      gl.uniform3fv(u['uPLPos'],pos); gl.uniform3fv(u['uPLCol'],col); gl.uniform1fv(u['uPLRad'],rad);
    }
  }
  E.frameUniforms=frameUniforms;

  const defMat={ color:[1,1,1], rough:.8, metal:0, alpha:1, emissive:[0,0,0], tex:null, nrm:null, emi:null, uv:[1,1], nrmStr:1, rim:0, unlit:0, sway:0, twoSided:0 };
  function setMaterial(p,m){
    const u=p.u; m=m||defMat;
    gl.uniform3fv(u.uColor,m.color||defMat.color); gl.uniform1f(u.uRough,m.rough===undefined?.8:m.rough); gl.uniform1f(u.uMetal,m.metal||0);
    gl.uniform1f(u.uAlpha,m.alpha===undefined?1:m.alpha); gl.uniform3fv(u.uEmissive,m.emissive||defMat.emissive);
    gl.uniform2fv(u.uUVScale,m.uv||defMat.uv); gl.uniform1f(u.uNrmStr,m.nrmStr===undefined?1:m.nrmStr);
    gl.uniform1f(u.uRim,m.rim||0); gl.uniform1f(u.uUnlit,m.unlit||0); gl.uniform1f(u.uTwoSided,m.twoSided||0); if(u.uOccApply) gl.uniform1f(u.uOccApply,m.occl?1:0);
    gl.uniform1i(u.uHasTex,m.tex?1:0); gl.uniform1i(u.uHasNrm,m.nrm?1:0); gl.uniform1i(u.uHasEmi,m.emi?1:0);
    gl.uniform1i(u.uTex,0); gl.uniform1i(u.uNrm,1); gl.uniform1i(u.uEmi,2); gl.uniform1i(u.uShadow,3);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,m.tex||null);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,m.nrm||null);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D,m.emi||null);
    gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D,T.shadowTex);
    gl.uniform1f(u.uSway,m.sway||0);
  }
  E.setMaterial=setMaterial;

  // draw a mesh with a material and model matrix (null = identity -> static batches)
  E.draw=function(mesh,mat,model){
    let p;
    if(E.pass==='shadow'){
      p=use(E.progs.depth); if(p!==lastProgFrame.depth){ gl.uniformMatrix4fv(p.u.uLightVP,false,U.lightVP); gl.uniform1f(p.u.uTime,E.time); lastProgFrame.depth=p; }
      gl.uniform1f(p.u.uSway,(mat&&mat.sway)||0);
      gl.uniformMatrix4fv(p.u.uModel,false,model||U.ident);
      E.stats.shadowCalls++;
    } else {
      p=use(mat&&mat.water?E.progs.water:E.progs.main);
      if(lastProgFrame[p.name]!==E.frameId){ frameUniforms(p); lastProgFrame[p.name]=E.frameId; }
      if(mat&&mat.water){
        gl.uniformMatrix4fv(p.u.uModel,false,model||U.ident); gl.uniformMatrix3fv(p.u.uNMat,false,U.identN);
        gl.uniform1i(p.u.uNrm,1); gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,mat.nrm||null);
      } else {
        if(lastMat!==mat){ setMaterial(p,mat); lastMat=mat; }
        gl.uniformMatrix4fv(p.u.uModel,false,model||U.ident);
        if(model){ m4.normal(U.nmat,model); gl.uniformMatrix3fv(p.u.uNMat,false,U.nmat); } else gl.uniformMatrix3fv(p.u.uNMat,false,U.identN);
      }
      E.stats.drawCalls++; E.stats.tris+=mesh.count/3;
    }
    gl.bindVertexArray(mesh.vao); gl.drawElements(gl.TRIANGLES,mesh.count,mesh.type,0);
  };
  const lastProgFrame={}; E.frameId=0;

  E.beginFrame=function(){
    E.frameId++; E.stats.drawCalls=0; E.stats.tris=0; E.stats.shadowCalls=0; E.stats.chunksDrawn=0; E.stats.chunksTotal=0;
    curProg=null; lastMat=null; lastProgFrame.depth=null;
  };

  E.beginShadow=function(){
    E.pass='shadow'; gl.bindFramebuffer(gl.FRAMEBUFFER,T.shadowFbo); gl.viewport(0,0,T.shadowSize,T.shadowSize);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.clear(gl.DEPTH_BUFFER_BIT); gl.colorMask(false,false,false,false);
    gl.enable(gl.CULL_FACE); gl.cullFace(gl.FRONT); gl.enable(gl.POLYGON_OFFSET_FILL); gl.polygonOffset(1.5,3);
    curProg=null; lastMat=null;
  };
  E.endShadow=function(){ gl.disable(gl.POLYGON_OFFSET_FILL); gl.colorMask(true,true,true,true); gl.cullFace(gl.BACK); gl.disable(gl.CULL_FACE); E.pass='main'; curProg=null; lastMat=null; };

  E.beginScene=function(){
    gl.bindFramebuffer(gl.FRAMEBUFFER,T.msFbo); gl.viewport(0,0,E.w,E.h);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.clearColor(0,0,0,1); gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
    E.pass='main'; curProg=null; lastMat=null;
  };
  E.drawSky=function(){
    const p=use(E.progs.sky), u=p.u, env=E.env;
    gl.depthMask(false); gl.disable(gl.DEPTH_TEST);
    m4.invert(U.invVP,U.vp); gl.uniformMatrix4fv(u.uInvVP,false,U.invVP); gl.uniform3fv(u.uCam,E.cam);
    gl.uniform3fv(u.uSkyTop,env.skyTop); gl.uniform3fv(u.uSkyHor,env.skyHor); gl.uniform3fv(u.uGround,env.ground);
    gl.uniform3fv(u.uSunDir,env.sunDir); gl.uniform3fv(u.uSunCol,env.sunCol); gl.uniform1f(u.uStars,env.stars||0); gl.uniform1f(u.uClouds,env.clouds||0);
    gl.uniform1f(u.uTime,E.time); gl.uniform1f(u.uAurora,env.aurora||0); gl.uniform3fv(u.uAuroraCol,env.auroraCol||[0.2,0.8,0.6]);
    gl.bindVertexArray(emptyVAO); gl.drawArrays(gl.TRIANGLES,0,3);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); curProg=null; lastMat=null;
  };
  E.beginBlend=function(depthWrite){ gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(!!depthWrite); curProg=null; lastMat=null; };
  E.endBlend=function(){ gl.disable(gl.BLEND); gl.depthMask(true); curProg=null; lastMat=null; };

  // additive point sprites
  const partBuf={ vbo:null, vao:null, cap:0 };
  E.drawParticles=function(data,count,color,scale){
    if(!count) return;
    if(!partBuf.vbo){ partBuf.vbo=gl.createBuffer(); partBuf.vao=gl.createVertexArray(); gl.bindVertexArray(partBuf.vao); gl.bindBuffer(gl.ARRAY_BUFFER,partBuf.vbo);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0,3,gl.FLOAT,false,28,0); gl.enableVertexAttribArray(1); gl.vertexAttribPointer(1,4,gl.FLOAT,false,28,12); }
    gl.bindVertexArray(partBuf.vao); gl.bindBuffer(gl.ARRAY_BUFFER,partBuf.vbo); gl.bufferData(gl.ARRAY_BUFFER,data,gl.DYNAMIC_DRAW);
    const p=use(E.progs.part), u=p.u; gl.uniformMatrix4fv(u.uVP,false,U.vp); gl.uniform3fv(u.uCam,E.cam); gl.uniform1f(u.uTime,E.time);
    gl.uniform1f(u.uScale,scale||E.h*0.5); gl.uniform3fv(u.uColor,color);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA,gl.ONE); gl.depthMask(false);
    gl.drawArrays(gl.POINTS,0,count);
    gl.disable(gl.BLEND); gl.depthMask(true); curProg=null; lastMat=null;
  };

  // resolve MSAA -> texture, bloom, composite to the canvas
  E.endScene=function(post){
    const q=E.cfg();
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER,T.msFbo); gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER,T.sceneFbo);
    gl.blitFramebuffer(0,0,E.w,E.h,0,0,E.w,E.h,gl.COLOR_BUFFER_BIT,gl.NEAREST);
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND); gl.bindVertexArray(emptyVAO);
    if(q.bloom){
      gl.bindFramebuffer(gl.FRAMEBUFFER,T.b1f); gl.viewport(0,0,T.bw,T.bh);
      let p=use(E.progs.bright); gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,T.sceneTex); gl.uniform1i(p.u.uTex,0); gl.uniform1f(p.u.uThresh,post.bloomThresh===undefined?.9:post.bloomThresh); gl.drawArrays(gl.TRIANGLES,0,3);
      p=use(E.progs.blur); gl.uniform1i(p.u.uTex,0);
      for(let i=0;i<2;i++){
        gl.bindFramebuffer(gl.FRAMEBUFFER,T.b2f); gl.bindTexture(gl.TEXTURE_2D,T.b1); gl.uniform2f(p.u.uDir,1.6/T.bw,0); gl.drawArrays(gl.TRIANGLES,0,3);
        gl.bindFramebuffer(gl.FRAMEBUFFER,T.b1f); gl.bindTexture(gl.TEXTURE_2D,T.b2); gl.uniform2f(p.u.uDir,0,1.6/T.bh); gl.drawArrays(gl.TRIANGLES,0,3);
      }
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER,null); gl.viewport(0,0,E.w,E.h);
    const p=use(E.progs.comp);
    gl.uniform1i(p.u.uScene,0); gl.uniform1i(p.u.uBloom,1);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D,T.sceneTex);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D,q.bloom?T.b1:T.sceneTex);
    gl.uniform1f(p.u.uBloomAmt,q.bloom?(post.bloom===undefined?.55:post.bloom):0); gl.uniform1f(p.u.uExposure,post.exposure||1); gl.uniform1i(p.u.uHDR,E.hdr?1:0);
    gl.uniform3fv(p.u.uTint,post.tint||[1,1,1]); gl.uniform1f(p.u.uVig,post.vig===undefined?.55:post.vig); gl.uniform2f(p.u.uRes,E.w,E.h); gl.uniform1f(p.u.uTime,E.time%10); gl.uniform1f(p.u.uSat,post.sat===undefined?1.08:post.sat);
    gl.drawArrays(gl.TRIANGLES,0,3);
    curProg=null; lastMat=null; gl.enable(gl.DEPTH_TEST);
  };

  window.TH=window.TH||{};
  TH.GL=E;
})();
