// Player movement, collision and health; the fixed step owns position and velocity.
import {ECONOMY,MAP,PLAYER}from'./config.js';
import {clamp,damp}from'./util.js';
const SENS=.0022;
export function createPlayer(state,camera,map,input,audio){
 const pos=state.player;
 let eye=PLAYER.eyeStand;
 let stepDistance=0;
 let damageCooldown=0;
 camera.rotation.order='YXZ';
 function overlaps(x,y,z,height){
  const half=PLAYER.half;
  for(let i=0;i<map.colliders.length;i++){
   const c=map.colliders[i];
   if(x+half<=c.minx||x-half>=c.maxx)continue;
   if(z+half<=c.minz||z-half>=c.maxz)continue;
   if(y+height<=c.miny||y>=c.maxy)continue;
   return c;
  }
  return null;
 }
 function tryAxis(axis,amount){
  if(amount===0)return;
  const height=pos.crouch?PLAYER.crouch:PLAYER.stand;
  pos[axis]+=amount;
  let hit=overlaps(pos.x,pos.y,pos.z,height);
  if(!hit)return;
  const rise=hit.maxy-pos.y;
  if(rise>0&&rise<=PLAYER.step){
   const oldY=pos.y;
   pos.y=hit.maxy+.002;
   if(!overlaps(pos.x,pos.y,pos.z,height))return;
   pos.y=oldY;
  }
  if(axis==='x')pos.x=amount>0?hit.minx-PLAYER.half-.001:hit.maxx+PLAYER.half+.001;
  else pos.z=amount>0?hit.minz-PLAYER.half-.001:hit.maxz+PLAYER.half+.001;
  if(axis==='x')pos.vx=0;
  else pos.vz=0;
 }
 function floorAt(prevY){
  let land=0;
  for(let i=0;i<map.colliders.length;i++){
   const c=map.colliders[i];
   if(pos.x+PLAYER.half<=c.minx||pos.x-PLAYER.half>=c.maxx)continue;
   if(pos.z+PLAYER.half<=c.minz||pos.z-PLAYER.half>=c.maxz)continue;
   if(prevY>=c.maxy-.02&&pos.y<=c.maxy&&c.maxy>land)land=c.maxy;
  }
  return land;
 }
 function update(dt){
  const mx=input.mouseX;
  const my=input.mouseY;
  input.consumeMouse();
  if(state.alive){
   state.yaw-=mx*SENS;
   state.pitch=clamp(state.pitch-my*SENS,-1.42,1.42);
  }
  state.recoilPitch=damp(state.recoilPitch,0,16,dt);
  state.recoilYaw=damp(state.recoilYaw,0,16,dt);
  damageCooldown=Math.max(0,damageCooldown-dt);
  if(state.mode!=='live'&&state.mode!=='planted'){
   state.player.speed=0;
   eye=damp(eye,pos.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand,10,dt);
   return;
  }
  const wantCrouch=!!(input.keys.ControlLeft||input.keys.ControlRight);
  const height=pos.crouch?PLAYER.crouch:PLAYER.stand;
  if(wantCrouch&&!pos.crouch){
   pos.crouch=true;
  }else if(!wantCrouch&&pos.crouch){
   if(!overlaps(pos.x,pos.y,pos.z,PLAYER.stand))pos.crouch=false;
  }
  eye=damp(eye,pos.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand,14,dt);
  let forward=0;
  let strafe=0;
  if(input.keys.KeyW)forward+=1;
  if(input.keys.KeyS)forward-=1;
  if(input.keys.KeyD)strafe+=1;
  if(input.keys.KeyA)strafe-=1;
  const length=Math.hypot(forward,strafe);
  if(length>0){
   forward/=length;
   strafe/=length;
  }
  const sin=Math.sin(state.yaw);
  const cos=Math.cos(state.yaw);
  const wishX=-sin*forward+cos*strafe;
  const wishZ=-cos*forward-sin*strafe;
  const target=pos.crouch?PLAYER.crouchSpeed:(input.keys.ShiftLeft||input.keys.ShiftRight)?PLAYER.walk:PLAYER.speed;
  if(pos.onGround){
   if(length>0){
    const rate=PLAYER.accel*dt;
    pos.vx+=clamp(wishX*target-pos.vx,-rate,rate);
    pos.vz+=clamp(wishZ*target-pos.vz,-rate,rate);
   }else{
    const speed=Math.hypot(pos.vx,pos.vz);
    const next=Math.max(0,speed-Math.max(speed,1)*PLAYER.friction*dt);
    const scale=speed>.0001?next/speed:0;
    pos.vx*=scale;
    pos.vz*=scale;
   }
   if(input.pressed.has('Space')){
    pos.vy=PLAYER.jump;
    pos.onGround=false;
   }
  }else{
   const rate=PLAYER.air*dt;
   pos.vx+=clamp(wishX*target-pos.vx,-rate,rate);
   pos.vz+=clamp(wishZ*target-pos.vz,-rate,rate);
  }
  tryAxis('x',pos.vx*dt);
  tryAxis('z',pos.vz*dt);
  pos.speed=Math.hypot(pos.vx,pos.vz);
  const prevY=pos.y;
  pos.vy=Math.max(-42,pos.vy-PLAYER.gravity*dt);
  pos.y+=pos.vy*dt;
  if(pos.vy<=0){
   const land=floorAt(prevY);
   if(pos.y<=land){
    pos.y=land;
    pos.vy=0;
    pos.onGround=true;
   }else{
    pos.onGround=false;
   }
  }else{
   const hit=overlaps(pos.x,pos.y,pos.z,height);
   if(hit){
    pos.y=hit.miny-height-.001;
    pos.vy=0;
   }
   pos.onGround=false;
  }
  state.bobPhase+=pos.speed*dt*2.1;
  if(pos.onGround&&pos.speed>.6){
   stepDistance+=pos.speed*dt;
   if(stepDistance>(pos.crouch?2.8:2.15)){
    stepDistance=0;
    audio.footstep(pos.crouch?.5:1);
   }
  }
 }
 function damage(amount,killer=''){
  if(!state.alive||state.health<=0)return;
  if(damageCooldown>.02)return;
  damageCooldown=.04;
  let left=amount;
  if(state.armor>0){
   const absorbed=Math.min(state.armor,amount*.5);
   state.armor=Math.max(0,state.armor-absorbed);
   left=amount-absorbed;
  }
  state.health=Math.max(0,state.health-left);
  state.damageFlash=Math.min(1,state.damageFlash+.35+amount/120);
  state.shake=Math.min(.6,state.shake+amount/90);
  if(state.health<=0){
   state.alive=false;
   state.reload=0;
   state.grenade=null;
   state.roster[0].d+=1;
   if(killer){
    const row=state.roster.find((r)=>r.name===killer);
    if(row){
     row.k+=1;
     state.pay(killer,ECONOMY.kill);
    }
   }
  }
 }
 function respawn(){
  pos.x=MAP.playerSpawn.x;
  pos.y=0;
  pos.z=MAP.playerSpawn.z;
  pos.vx=0;
  pos.vy=0;
  pos.vz=0;
  pos.onGround=true;
  pos.crouch=false;
  pos.speed=0;
  eye=PLAYER.eyeStand;
  state.health=100;
  state.armor=0;
  state.alive=true;
  state.yaw=0;
  state.pitch=0;
  state.recoilPitch=0;
  state.recoilYaw=0;
  state.damageFlash=0;
  state.shake=0;
  state.reload=0;
  state.grenade=null;
  stepDistance=0;
 }
 function syncEye(){
  eye=pos.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand;
 }
 function applyCamera(){
  const bobScale=Math.min(1,pos.speed/PLAYER.speed);
  const bobY=pos.onGround?Math.sin(state.bobPhase)*.018*bobScale:0;
  const bobX=pos.onGround?Math.cos(state.bobPhase*.5)*.012*bobScale:0;
  const shake=state.shake;
  camera.position.set(
   pos.x+bobX+(shake>0?Math.sin(state.time*71)*shake*.06:0),
   pos.y+eye+bobY+(shake>0?Math.cos(state.time*83)*shake*.05:0),
   pos.z
  );
  camera.rotation.y=state.yaw+state.recoilYaw;
  camera.rotation.x=state.pitch+state.recoilPitch;
  camera.rotation.z=0;
 }
 return{update,damage,respawn,applyCamera,syncEye,overlaps,get eye(){return eye;}};
}
