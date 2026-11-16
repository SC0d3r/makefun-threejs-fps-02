// Pooled transients (tracers, sparks, shells, smoke, blasts) allocated once at boot.
import *as THREE from'three';
import {PALETTE}from'./config.js';
import {mulberry32}from'./util.js';
export function createEffects(scene){
 const rng=mulberry32(31);
 const smokeTexture=radialTexture(64,[
  [0,'rgba(200,214,224,.55)'],[.45,'rgba(140,156,168,.22)'],[1,'rgba(80,94,106,0)'],
 ]);
 const flashTexture=makeFlashTexture();
 const tracers=[];
 const shells=[];
 const smokes=[];
 const blasts=[];
 let tracerIndex=0;
 let shellIndex=0;
 let smokeIndex=0;
 let blastIndex=0;
 for(let i=0;i<24;i++){
  const geometry=new THREE.BufferGeometry();
  const positions=new Float32Array(6);
  geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));
  const material=new THREE.LineBasicMaterial({color:PALETTE.sodium,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const line=new THREE.Line(geometry,material);
  line.frustumCulled=false;
  line.visible=false;
  scene.add(line);
  tracers.push({line,life:0});
 }
 const SPARKS=120;
 const sparkPos=new Float32Array(SPARKS*3);
 const sparkVel=new Float32Array(SPARKS*3);
 const sparkLife=new Float32Array(SPARKS);
 for(let i=0;i<SPARKS;i++)sparkPos[i*3+1]=-100;
 const sparkGeometry=new THREE.BufferGeometry();
 const sparkAttr=new THREE.BufferAttribute(sparkPos,3);
 sparkAttr.setUsage(THREE.DynamicDrawUsage);
 sparkGeometry.setAttribute('position',sparkAttr);
 const sparkMaterial=new THREE.PointsMaterial({
  color:0xe8f2ff,size:.08,transparent:true,opacity:1,
  depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true,
 });
 const sparks=new THREE.Points(sparkGeometry,sparkMaterial);
 sparks.frustumCulled=false;
 scene.add(sparks);
 let sparkIndex=0;
 for(let i=0;i<16;i++){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.035,.035,.07),new THREE.MeshStandardMaterial({color:0xc9a267,metalness:.8,roughness:.3}));
  mesh.visible=false;
  mesh.frustumCulled=false;
  scene.add(mesh);
  shells.push({mesh,life:0,vx:0,vy:0,vz:0});
 }
 for(let i=0;i<14;i++){
  const material=new THREE.SpriteMaterial({map:smokeTexture,transparent:true,opacity:0,depthWrite:false});
  const sprite=new THREE.Sprite(material);
  sprite.visible=false;
  scene.add(sprite);
  smokes.push({sprite,life:0,max:1,rise:0});
 }
 for(let i=0;i<6;i++){
  const material=new THREE.SpriteMaterial({map:flashTexture,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const sprite=new THREE.Sprite(material);
  sprite.visible=false;
  scene.add(sprite);
  blasts.push({sprite,life:0,max:.45});
 }
 const blastLight=new THREE.PointLight(PALETTE.sodium,0,14,2);
 blastLight.position.set(0,0,0);
 scene.add(blastLight);
 // Impact pops. A hit needs one bright frame at the exact point of contact,
 // otherwise a still of a firefight shows no receiving end at all.
 const hitPops=[];
 for(let i=0;i<6;i++){
  const material=new THREE.SpriteMaterial({map:flashTexture,color:0xdff0ff,transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending});
  const sprite=new THREE.Sprite(material);
  sprite.visible=false;
  scene.add(sprite);
  hitPops.push({sprite,life:0,max:.09});
 }
 let hitPopIndex=0;
 let blastLightLife=0;
 function tracerLine(fromX,fromY,fromZ,toX,toY,toZ,color=PALETTE.sodium){
  const item=tracers[tracerIndex];
  tracerIndex=(tracerIndex+1)%tracers.length;
  const attr=item.line.geometry.attributes.position;
  // A tracer is drawn between two real points so the staged still shows the
  // same line live play shows on its first frame.
  attr.setXYZ(0,fromX,fromY,fromZ);
  attr.setXYZ(1,toX,toY,toZ);
  attr.needsUpdate=true;
  item.line.material.color.setHex(color);
  item.line.material.opacity=.9;
  item.line.visible=true;
  item.life=.09;
 }
 function tracer(fromX,fromY,fromZ,dx,dy,dz,color=PALETTE.sodium,length=4.5){
  tracerLine(fromX,fromY,fromZ,fromX+dx*length,fromY+dy*length,fromZ+dz*length,color);
 }
 function impact(x,y,z,dx,dy,dz){
  for(let i=0;i<8;i++){
   const k=sparkIndex;
   sparkIndex=(sparkIndex+1)%SPARKS;
   sparkPos[k*3]=x;
   sparkPos[k*3+1]=y;
   sparkPos[k*3+2]=z;
   const spread=2.0;
   sparkVel[k*3]=-dx*1.3+(rng()-.5)*spread;
   sparkVel[k*3+1]=-dy*1.3+rng()*1.7;
   sparkVel[k*3+2]=-dz*1.3+(rng()-.5)*spread;
   sparkLife[k]=.24+rng()*.2;
  }
  sparkAttr.needsUpdate=true;
  const pop=hitPops[hitPopIndex];
  hitPopIndex=(hitPopIndex+1)%hitPops.length;
  pop.sprite.position.set(x,y,z);
  pop.sprite.scale.setScalar(.17+rng()*.05);
  pop.sprite.material.opacity=.95;
  pop.sprite.visible=true;
  pop.life=.1;
  pop.max=pop.life;
  smoke(x,y,z,.55);
 }
 function smoke(x,y,z,scale=1){
  const item=smokes[smokeIndex];
  smokeIndex=(smokeIndex+1)%smokes.length;
  item.sprite.position.set(x,y,z);
  item.sprite.scale.setScalar(.35*scale);
  item.sprite.material.opacity=.42;
  item.sprite.visible=true;
  item.life=.5+rng()*.35;
  item.max=item.life;
  item.rise=.4+rng()*.5;
 }
 function shell(x,y,z,vx,vy,vz){
  const item=shells[shellIndex];
  shellIndex=(shellIndex+1)%shells.length;
  item.mesh.position.set(x,y,z);
  item.mesh.visible=true;
  item.life=.9;
  item.vx=vx;
  item.vy=vy;
  item.vz=vz;
  item.mesh.rotation.set(rng()*3,rng()*3,rng()*3);
 }
 function explosion(x,y,z){
  const item=blasts[blastIndex];
  blastIndex=(blastIndex+1)%blasts.length;
  item.sprite.position.set(x,y+.5,z);
  item.sprite.scale.setScalar(1.2);
  item.sprite.material.opacity=1;
  item.sprite.visible=true;
  item.life=item.max;
  blastLight.position.set(x,y+1.2,z);
  blastLight.intensity=70;
  blastLightLife=.32;
  for(let i=0;i<10;i++)smoke(x+(rng()-.5)*1.5,y+rng(),z+(rng()-.5)*1.5,1.8);
 }
 function update(dt){
  for(const item of tracers){
   if(item.life<=0)continue;
   item.life-=dt;
   item.line.material.opacity=Math.max(0,item.life/.075)*.55;
   if(item.life<=0)item.line.visible=false;
  }
  for(let i=0;i<SPARKS;i++){
   if(sparkLife[i]<=0)continue;
   sparkLife[i]-=dt;
   sparkVel[i*3+1]-=12*dt;
   sparkPos[i*3]+=sparkVel[i*3]*dt;
   sparkPos[i*3+1]+=sparkVel[i*3+1]*dt;
   sparkPos[i*3+2]+=sparkVel[i*3+2]*dt;
   if(sparkLife[i]<=0)sparkPos[i*3+1]=-100;
  }
  sparkAttr.needsUpdate=true;
  for(const item of shells){
   if(item.life<=0)continue;
   item.life-=dt;
   item.vy-=9*dt;
   item.mesh.position.x+=item.vx*dt;
   item.mesh.position.y+=item.vy*dt;
   item.mesh.position.z+=item.vz*dt;
   if(item.mesh.position.y<.03){
    item.mesh.position.y=.03;
    item.vy*=-.35;
    item.vx*=.6;
    item.vz*=.6;
   }
   item.mesh.rotation.x+=dt*8;
   item.mesh.rotation.z+=dt*5;
   if(item.life<=0)item.mesh.visible=false;
  }
  for(const item of smokes){
   if(item.life<=0)continue;
   item.life-=dt;
   item.sprite.position.y+=item.rise*dt;
   item.sprite.scale.multiplyScalar(1+dt*.7);
   item.sprite.material.opacity=Math.max(0,item.life/item.max)*.42;
   if(item.life<=0)item.sprite.visible=false;
  }
  for(const item of blasts){
   if(item.life<=0)continue;
   item.life-=dt;
   const k=Math.max(0,item.life/item.max);
   item.sprite.material.opacity=k;
   item.sprite.scale.setScalar(1.2+(1-k)*2.6);
   if(item.life<=0)item.sprite.visible=false;
  }
  if(blastLightLife>0){
   blastLightLife-=dt;
   blastLight.intensity=Math.max(0,blastLightLife/.32)*70;
  }
  for(const item of hitPops){
   if(item.life<=0)continue;
   item.life-=dt;
   const k=Math.max(0,item.life/item.max);
   item.sprite.material.opacity=k*.95;
   item.sprite.scale.setScalar(.3+(1-k)*.22);
   if(item.life<=0)item.sprite.visible=false;
  }
 }
 function reset(){
  for(const item of tracers){item.life=0;item.line.visible=false;}
  for(const item of shells){item.life=0;item.mesh.visible=false;}
  for(const item of smokes){item.life=0;item.sprite.visible=false;}
  for(const item of blasts){item.life=0;item.sprite.visible=false;}
  for(const item of hitPops){item.life=0;item.sprite.visible=false;}
  for(let i=0;i<SPARKS;i++){sparkLife[i]=0;sparkPos[i*3+1]=-100;}
  sparkAttr.needsUpdate=true;
  blastLight.intensity=0;
  blastLightLife=0;
 }
 return{tracer,tracerLine,impact,smoke,shell,explosion,update,reset};
}
function radialTexture(size,stops){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=size;
 const c=canvas.getContext('2d');
 const gradient=c.createRadialGradient(size/2,size/2,0,size/2,size/2,size/2);
 for(const[at,color]of stops)gradient.addColorStop(at,color);
 c.fillStyle=gradient;
 c.fillRect(0,0,size,size);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
export function makeFlashTexture(){
 const canvas=document.createElement('canvas');
 canvas.width=canvas.height=64;
 const c=canvas.getContext('2d');
 const gradient=c.createRadialGradient(32,32,0,32,32,31);
 gradient.addColorStop(0,'rgba(255,244,210,1)');
 gradient.addColorStop(.35,'rgba(255,177,92,.9)');
 gradient.addColorStop(.7,'rgba(229,72,60,.5)');
 gradient.addColorStop(1,'rgba(229,72,60,0)');
 c.fillStyle=gradient;
 c.fillRect(0,0,64,64);
 c.fillStyle='rgba(255,220,160,.8)';
 c.fillRect(30,2,4,60);
 c.fillRect(2,30,60,4);
 const texture=new THREE.CanvasTexture(canvas);
 texture.colorSpace=THREE.SRGBColorSpace;
 return texture;
}
