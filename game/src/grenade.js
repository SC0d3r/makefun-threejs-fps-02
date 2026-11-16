// Frag and flash charges: selection, throw arc, bounce, fuse and blast falloff.
import *as THREE from'three';
import {PALETTE,PLAYER}from'./config.js';
export function createGrenades(state,scene,map,bots,player,effects,audio,hud){
 function eyeHeight(){return state.player.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand;}
 function select(kind){
  if(kind==='frag'&&state.grenades.frag<=0)return;
  if(kind==='flash'&&state.grenades.flash<=0)return;
  state.grenade=kind;
  state.reload=0;
  state.switchTimer=.12;
 }
 function throwCharge(){
  if(state.mode!=='live'&&state.mode!=='planted')return;
  if(!state.alive||!state.grenade)return;
  if(state.grenades[state.grenade]<=0)return;
  const kind=state.grenade;
  const item=projectiles.find((p)=>!p.active);
  if(!item)return;
  state.grenades[kind]-=1;
  const pitch=state.pitch;
  const yaw=state.yaw;
  const cp=Math.cos(pitch);
  const fx=-Math.sin(yaw)*cp;
  const fy=Math.sin(pitch)+.18;
  const fz=-Math.cos(yaw)*cp;
  item.active=true;
  item.kind=kind;
  item.x=state.player.x+fx*.35;
  item.y=state.player.y+eyeHeight()-.08;
  item.z=state.player.z+fz*.35;
  item.vx=fx*9;
  item.vy=fy*9;
  item.vz=fz*9;
  item.fuse=kind==='frag'?.9:1.2;
  item.mesh.visible=true;
  item.mesh.position.set(item.x,item.y,item.z);
  item.mesh.material=kind==='frag'?fragMaterial:flashMaterialSolid;
  state.grenade=null;
  audio.toss();
  hud.setPrompt(kind==='frag'?'FRAG OUT':'FLASH OUT',.5);
 }
 const fragMaterial=new THREE.MeshStandardMaterial({color:0x2c343b,roughness:.6,metalness:.3});
 const flashMaterialSolid=new THREE.MeshStandardMaterial({color:0x9aa6ae,roughness:.4,metalness:.5,emissive:PALETTE.cyan,emissiveIntensity:.25});
 const projectiles=[];
 for(let i=0;i<4;i++){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(.11,.13,.11),fragMaterial);
  mesh.visible=false;
  scene.add(mesh);
  projectiles.push({mesh,active:false,kind:'frag',x:0,y:0,z:0,vx:0,vy:0,vz:0,fuse:0});
 }
 function detonate(item){
  item.active=false;
  item.mesh.visible=false;
  if(item.kind==='frag'){
   effects.explosion(item.x,.1,item.z);
   audio.explosion();
   state.shake=Math.min(.8,state.shake+.6);
   for(const bot of bots.squad){
    if(!bot.alive)continue;
    const bx=bot.x;
    const by=bot.y+1.15;
    const bz=bot.z;
    const dx=bx-item.x;
    const dy=by-item.y;
    const dz=bz-item.z;
    const distance=Math.hypot(dx,dy,dz);
    if(distance>5.2)continue;
    const len=distance||1;
    if(map.blocked(item.x,item.y,item.z,dx/len,dy/len,dz/len,distance))continue;
    const amount=130-(Math.min(distance,5)/5)*120;
    bots.damage(bot,amount,'body');
   }
   const pdx=state.player.x-item.x;
   const pdz=state.player.z-item.z;
   const pd=Math.hypot(pdx,pdz);
   if(pd<5&&!map.blocked(item.x,item.y+.1,item.z,pdx/(pd||1),0,pdz/(pd||1),pd)){
    player.damage(40-pd*5);
   }
  }else{
   effects.explosion(item.x,.1,item.z);
   audio.flash();
   bots.flash(item.x,item.z,9,2.5);
   const fx=-Math.sin(state.yaw);
   const fz=-Math.cos(state.yaw);
   const dx=item.x-state.player.x;
   const dz=item.z-state.player.z;
   const distance=Math.hypot(dx,dz)||1;
   if(distance<12&&(fx*dx+fz*dz)/distance>.15&&!map.blocked(state.player.x,state.player.y+1.55,state.player.z,dx/distance,0,dz/distance,distance)){
    state.flash=1;
   }
  }
 }
 function update(dt){
  for(const item of projectiles){
   if(!item.active)continue;
   item.fuse-=dt;
   const px=item.x;
   const py=item.y;
   const pz=item.z;
   item.vy-=20*dt;
   item.x+=item.vx*dt;
   item.y+=item.vy*dt;
   item.z+=item.vz*dt;
   if(item.y<.12){
    item.y=.12;
    item.vy=Math.abs(item.vy)*.38;
    item.vx*=.7;
    item.vz*=.7;
   }
   const dx=item.x-px;
   const dy=item.y-py;
   const dz=item.z-pz;
   const distance=Math.hypot(dx,dy,dz);
   if(distance>.0001){
    const hit=map.raycast(px,py,pz,dx/distance,dy/distance,dz/distance);
    if(hit.t<distance-.02){
     item.x=px+(dx/distance)*Math.max(0,hit.t-.06);
     item.y=py+(dy/distance)*Math.max(0,hit.t-.06);
     item.z=pz+(dz/distance)*Math.max(0,hit.t-.06);
     item.vx*=-.35;
     item.vz*=-.35;
     item.vy*=.3;
    }
   }
   item.mesh.position.set(item.x,item.y,item.z);
   item.mesh.rotation.x+=dt*7;
   item.mesh.rotation.z+=dt*5;
   if(item.fuse<=0)detonate(item);
  }
 }
 function reset(){
  for(const item of projectiles){item.active=false;item.mesh.visible=false;}
 }
 return{select,throwCharge,update,reset};
}
