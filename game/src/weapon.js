// Weapons own fire, reload, switch, the viewmodel and the plant hands.
import *as THREE from'three';
import {PALETTE,PLAYER,WEAPONS}from'./config.js';
import {clamp,damp,mulberry32}from'./util.js';
import {makeFlashTexture}from'./effects.js';
import {createGrenades}from'./grenade.js';
export function createWeapon(state,scene,vmScene,map,bots,player,effects,audio,hud,input){
 const rng=mulberry32(917);
 const grenades=createGrenades(state,scene,map,bots,player,effects,audio,hud);
 const group=new THREE.Group();
 vmScene.add(group);
 // The flash sprite draws over the barrel instead of being clipped by it.
 const flashMaterial=new THREE.SpriteMaterial({map:makeFlashTexture(),transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending});
 const flash=new THREE.Sprite(flashMaterial);
 flash.scale.set(.15,.15,1);
 flash.renderOrder=4;
 flash.visible=false;
 // Turned across the first, this reads as an eight-point star at 1:1.
 const flashCross=new THREE.Sprite(new THREE.SpriteMaterial({map:flashMaterial.map,transparent:true,opacity:0,depthWrite:false,depthTest:false,blending:THREE.AdditiveBlending}));
 flashCross.scale.set(.085,.085,1);
 flashCross.material.rotation=.62;
 flashCross.renderOrder=4;
 flashCross.visible=false;
 const flashLight=new THREE.PointLight(PALETTE.sodium,0,3,2);
 // Lights the floor and enemy, which the viewmodel scene cannot reach.
 const worldFlash=new THREE.PointLight(PALETTE.sodium,0,12,2);
 scene.add(worldFlash);
 const rim=new THREE.DirectionalLight(PALETTE.cyan,.9);
 rim.position.set(-1.6,.9,-1.2);
 vmScene.add(rim);
 // Dark, cool viewmodel palette; pale materials read as crates on camera.
 const receiverMat=new THREE.MeshStandardMaterial({color:0x2b3238,metalness:.3,roughness:.5});
 const polymerMat=new THREE.MeshStandardMaterial({color:0x3b4237,metalness:.05,roughness:.78});
 const steelMat=new THREE.MeshStandardMaterial({color:0x6c777f,metalness:.55,roughness:.38});
 const darkMetal=new THREE.MeshStandardMaterial({color:0x12171b,metalness:.4,roughness:.52});
 const railMat=new THREE.MeshStandardMaterial({color:0x3a4247,metalness:.3,roughness:.55});
 const magMetal=new THREE.MeshStandardMaterial({color:0x2a3036,metalness:.22,roughness:.56});
 const glove=new THREE.MeshStandardMaterial({color:0x5f594e,metalness:.02,roughness:.9});
 const gloveEdge=new THREE.MeshStandardMaterial({color:0x776e5e,metalness:.02,roughness:.88});
 const sleeveMat=new THREE.MeshStandardMaterial({color:0x39443b,roughness:.92});
 const rubberMat=new THREE.MeshStandardMaterial({color:0x1d2124,metalness:.02,roughness:.96});
  const glassMat=new THREE.MeshStandardMaterial({color:0x0a2230,metalness:.9,roughness:.12,emissive:0x123a4a,emissiveIntensity:.55});
 const dotMat=new THREE.MeshBasicMaterial({color:0xff3b2c});
 function part(w,h,d,x,y,z,material,rx=0,parent=group){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z);
  mesh.rotation.x=rx;
  parent.add(mesh);
  return mesh;
 }
 function tube(radius,length,x,y,z,material,parent=group){
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(radius,radius,length,12),material);
  mesh.rotation.x=Math.PI/2;
  mesh.position.set(x,y,z);
  parent.add(mesh);
  return mesh;
 }
 // Receiver, rail and optic.
 part(.072,.078,.34,0,.012,-.04,receiverMat);
 part(.062,.05,.2,0,-.052,-.05,receiverMat);
 part(.078,.018,.055,0,-.088,.02,darkMetal);
 part(.03,.012,.34,0,.062,-.04,railMat);
 for(let i=0;i<4;i++)part(.034,.007,.016,0,.071,-.15+i*.06,railMat);
 part(.008,.03,.06,.038,.02,-.1,darkMetal);
 part(.05,.018,.03,.01,.048,.13,railMat);
 // Compact red-dot whose window faces the shooter.
 part(.034,.018,.08,0,.076,-.03,darkMetal);
 part(.048,.05,.07,0,.106,-.035,darkMetal);
 part(.054,.009,.056,0,.136,-.038,polymerMat);
 const lensFront=new THREE.Mesh(new THREE.PlaneGeometry(.038,.038),glassMat);
 lensFront.position.set(0,.106,.0008);
 group.add(lensFront);
 const dot=new THREE.Mesh(new THREE.CircleGeometry(.0062,10),dotMat);
 dot.position.set(0,.106,.0017);
 group.add(dot);
 const glint=new THREE.Mesh(new THREE.CircleGeometry(.006,8),new THREE.MeshBasicMaterial({color:0xcfe6f2}));
 glint.position.set(-.009,.117,.0022);
 group.add(glint);
 // Barrel group; a short weapon pulls the whole front back.
 const front=new THREE.Group();
 group.add(front);
 const barrel=tube(.014,.34,0,.012,-.36,steelMat,front);
 part(.034,.034,.05,0,.022,-.31,darkMetal,0,front);
 const handguard=part(.074,.066,.22,0,.002,-.28,polymerMat,0,front);
 for(let i=0;i<3;i++){
  part(.004,.026,.05,.038,-.006,-.21-i*.06,darkMetal,0,front);
  part(.004,.026,.05,-.038,-.006,-.21-i*.06,darkMetal,0,front);
 }
 part(.05,.012,.2,0,-.042,-.28,steelMat,0,front);
 tube(.026,.08,0,.012,-.575,darkMetal,front);
 for(let i=0;i<3;i++)part(.048,.009,.012,0,.012,-.588+i*.021,steelMat,0,front);
 const bore=new THREE.Mesh(new THREE.CircleGeometry(.011,12),new THREE.MeshBasicMaterial({color:0x03060a}));
 bore.position.set(0,.012,-.6115);
 front.add(bore);
 part(.012,.052,.014,0,.062,-.34,darkMetal,0,front);
 const muzzleRef=new THREE.Object3D();
 muzzleRef.position.set(0,.012,-.612);
 front.add(muzzleRef);
 // Magazine, grip, trigger guard and stock.
 const magazine=part(.058,.16,.082,0,-.15,.03,magMetal,.3);
 part(.064,.028,.09,0,-.228,-.005,steelMat,.3);
 const grip=part(.048,.115,.062,0,-.135,.125,polymerMat,-.32);
 part(.012,.05,.012,0,-.098,.064,darkMetal);
 part(.022,.02,.035,0,-.079,.075,steelMat);
 part(.012,.05,.012,0,-.098,.027,darkMetal);
 part(.05,.012,.06,0,-.121,.045,darkMetal);
 // Solid skeleton stock with a comb and a thin rubber pad.
 const stock=new THREE.Group();
 group.add(stock);
 tube(.022,.12,0,.005,.17,darkMetal,stock);
 part(.042,.074,.19,0,-.004,.265,polymerMat,0,stock);
 part(.038,.03,.2,0,.045,.265,polymerMat,0,stock);
 part(.044,.052,.06,0,-.034,.345,polymerMat,0,stock);
 part(.046,.084,.014,0,-.004,.372,rubberMat,0,stock);
 part(.014,.032,.012,0,-.058,.3,steelMat,0,stock);
 part(.008,.014,.05,0,-.028,.305,rubberMat,0,stock);
 part(.036,.006,.17,0,.041,.26,railMat,0,stock);
 // Support hand wrapped under the handguard, palm on the near side.
 const hands=new THREE.Group();
 group.add(hands);
 const supportHand=new THREE.Group();
 hands.add(supportHand);
 part(.046,.086,.07,-.044,-.055,-.29,glove,0,supportHand);
 part(.02,.072,.066,-.066,-.05,-.29,gloveEdge,0,supportHand);
 // Wide spacing and alternating shades keep the fingers apart at 720p.
 for(let i=0;i<4;i++){
  const z=-.228-i*.042;
  const finger=part(.019,.06,.026,-.078,-.004,z,i%2?gloveEdge:glove,0,supportHand);
  finger.rotation.z=1.25;
  const tip=part(.017,.026,.024,-.09,.014,z,gloveEdge,0,supportHand);
  tip.rotation.z=2.1;
 }
 // Thumb over the top of the handguard, the classic viewmodel grip read.
 const supportThumb=part(.028,.064,.032,-.014,.052,-.262,gloveEdge,0,supportHand);
 supportThumb.rotation.z=-1.0;
 supportThumb.rotation.x=.2;
 part(.052,.028,.058,-.044,-.102,-.275,gloveEdge,0,supportHand);
 part(.058,.058,.052,-.04,-.142,-.25,sleeveMat,0,supportHand);
 const supportArm=part(.048,.048,.24,-.03,-.2,-.15,sleeveMat,-.5,supportHand);
 supportArm.rotation.y=.2;
 // Trigger hand on the camera side of the grip.
 part(.05,.086,.07,-.016,-.168,.152,glove,.12);
 part(.02,.072,.066,-.04,-.16,.152,gloveEdge,0);
 for(let i=0;i<3;i++){
  const z=.108+i*.04;
  const finger=part(.019,.056,.026,-.054,-.122,z,i%2?gloveEdge:glove,0);
  finger.rotation.x=.6;
  const tip=part(.017,.026,.024,-.062,-.104,z,gloveEdge,0);
  tip.rotation.x=.95;
 }
 const triggerThumb=part(.028,.06,.034,-.042,-.072,.088,gloveEdge,0);
 triggerThumb.rotation.x=.2;
 part(.05,.028,.062,-.026,-.214,.168,gloveEdge,0);
 part(.054,.054,.05,-.02,-.252,.19,sleeveMat,0);
 const triggerArm=part(.048,.048,.24,-.008,-.32,.24,sleeveMat,-.3);
 triggerArm.rotation.y=-.1;
 const pump=part(.09,.07,.22,0,-.026,-.25,polymerMat);
 const bolt=part(.022,.024,.06,.06,.04,.02,steelMat);
 front.add(flash);
 front.add(flashCross);
 front.add(flashLight);
 // Sit on the bore so the streak and flash meet.
 flash.position.set(0,.012,-.612);
 flashCross.position.set(0,.012,-.612);
 flashLight.position.set(0,.03,-.5);
 // Two gloved hands on the charge while the plant runs.
 const plantHands=new THREE.Group();
 for(const side of[-1,1]){
  const hand=new THREE.Group();
  // Break the mirror so the two gloves read as hands, not clamps.
  hand.position.set(side*(.088+(side>0?.006:0)),-.178+(side>0?.012:-.008),-.6+(side>0?.03:-.01));
  hand.rotation.set(-.3+(side>0?.1:-.03),side*-.6+(side>0?.12:.03),side*(side>0?.2:.12));
  plantHands.add(hand);
  const palm=new THREE.Mesh(new THREE.BoxGeometry(.052,.08,.042),glove);
  hand.add(palm);
  const knuckle=new THREE.Mesh(new THREE.BoxGeometry(.056,.026,.024),gloveEdge);
  knuckle.position.set(0,.038,.012);
  hand.add(knuckle);
  for(let f=0;f<4;f++){
   const inner=side<0?f===3:f===0;
   const finger=new THREE.Mesh(new THREE.BoxGeometry(.014,inner?.058:.05,.019),gloveEdge);
   finger.position.set(-.026+f*.0175,.062,inner?.016:.004);
   finger.rotation.x=-.45;
   finger.rotation.z=inner?side*-.22:0;
   hand.add(finger);
  }
  const thumb=new THREE.Mesh(new THREE.BoxGeometry(.016,.042,.02),glove);
  thumb.position.set(side*-.042,.02,.03);
  thumb.rotation.z=side*.95;
  thumb.rotation.x=-.3;
  hand.add(thumb);
  const cuff=new THREE.Mesh(new THREE.BoxGeometry(.062,.05,.05),sleeveMat);
  cuff.position.set(0,-.056,.01);
  hand.add(cuff);
  // Forearms angle outward and down instead of filling the bottom centre.
  const forearm=new THREE.Mesh(new THREE.BoxGeometry(.046,.06,.2),sleeveMat);
  forearm.position.set(side*.055,-.15,.16);
  forearm.rotation.x=-1.2;
  forearm.rotation.y=side*-.35;
  hand.add(forearm);
 }
 plantHands.visible=false;
 vmScene.add(plantHands);
 const layouts={
  pistol:{scale:.64,x:.24,y:-.16,z:-.7,stock:false,handguard:false,longBarrel:false,pump:false,bolt:true},
  smg:{scale:.78,x:.25,y:-.17,z:-.82,stock:false,handguard:true,longBarrel:false,pump:false,bolt:false},
  rifle:{scale:.74,x:.225,y:-.17,z:-1.0,stock:true,handguard:true,longBarrel:true,pump:false,bolt:false},
  shotgun:{scale:.82,x:.25,y:-.175,z:-.92,stock:true,handguard:false,longBarrel:true,pump:true,bolt:false},
 };
 let kick=0;
 let reloadSway=0;
 let baseY=-.175;
 function applyLayout(){
  const id=state.weapon;
  const layout=layouts[id]||layouts.rifle;
  group.scale.setScalar(layout.scale);
  group.position.set(layout.x,layout.y,layout.z);
  baseY=layout.y;
  stock.visible=layout.stock;
  handguard.visible=layout.handguard;
  pump.visible=layout.pump;
  bolt.visible=layout.bolt;
  supportHand.visible=layout.handguard;
  // A short weapon pulls the front group back.
  front.position.z=layout.longBarrel?0:.15;
  hands.position.z=layout.longBarrel?0:.11;
 }
 function def(){return WEAPONS[state.weapon];}
 function equip(id){
  if(id!=='pistol'&&id!=='smg'&&id!=='rifle'&&id!=='shotgun')return;
  if(id!=='pistol'&&state.primary!==id)return;
  state.weapon=id;
  state.grenade=null;
  state.reload=0;
  state.switchTimer=.18;
  applyLayout();
 }
 function reload(){
  const weapon=def();
  const ammo=state.ammo[state.weapon];
  if(state.grenade||state.reload>0||ammo.mag>=weapon.mag||ammo.reserve<=0)return;
  state.reload=weapon.reload;
  audio.reload();
 }
 function eyeHeight(){return state.player.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand;}
 function fire(){
  if(state.mode!=='live'&&state.mode!=='planted')return false;
  if(!state.alive||state.grenade||state.reload>0||state.switchTimer>0)return false;
  const weapon=def();
  if(state.shotTimer>0)return false;
  const ammo=state.ammo[state.weapon];
  // Empty magazine blocks the shot before any ammo, accuracy or tracer work.
  if(ammo.mag<=0){
   if(input.firePressed){
    audio.dry();
    state.shotTimer=.32;
    hud.setPrompt('PRESS R TO RELOAD',.5);
   }
   return false;
  }
  const oy=state.player.y+eyeHeight();
  const ox=state.player.x;
  const oz=state.player.z;
  const pitch=state.pitch+state.recoilPitch;
  const yaw=state.yaw+state.recoilYaw;
  const cp=Math.cos(pitch);
  const fx=-Math.sin(yaw)*cp;
  const fy=Math.sin(pitch);
  const fz=-Math.cos(yaw)*cp;
  const rx=Math.cos(yaw);
  const rz=-Math.sin(yaw);
  const ux=-rz*fy;
  const uy=rz*fx-rx*fz;
  const uz=rx*fy;
  const crouchFactor=state.player.crouch?.55:1;
  const moveFactor=clamp(state.player.speed/PLAYER.speed,0,1);
  const spread=(weapon.spread*crouchFactor+weapon.move*moveFactor)*(1+state.consecutive*.2);
  state.spread=spread;
  const pellets=weapon.pellets||1;
  let anyHit=false;
  let hitX=0;
  let hitY=0;
  let hitZ=0;
  let hasPoint=false;
  for(let p=0;p<pellets;p++){
   const sx=(rng()-.5)*2*spread;
   const sy=(rng()-.5)*2*spread;
   let dx=fx+rx*sx+ux*sy;
   let dy=fy+uy*sy;
   let dz=fz+rz*sx+uz*sy;
   const len=Math.hypot(dx,dy,dz)||1;
   dx/=len;dy/=len;dz/=len;
   const wallT=map.raycast(ox,oy,oz,dx,dy,dz).t;
   const botHit=bots.raycast(ox,oy,oz,dx,dy,dz,Math.min(120,wallT));
   if(botHit.hit){
    const falloff=1-clamp((botHit.t-15)/30,0,1)*.3;
    const zoneMul=botHit.zone==='head'?weapon.head:botHit.zone==='legs'?weapon.legs:1;
    bots.damage(botHit.bot,weapon.body*falloff*zoneMul,botHit.zone);
    effects.impact(botHit.x,botHit.y,botHit.z,dx,dy,dz);
    if(!hasPoint){hitX=botHit.x;hitY=botHit.y;hitZ=botHit.z;hasPoint=true;}
    anyHit=true;
   }else if(wallT<120){
    effects.impact(ox+dx*wallT,oy+dy*wallT,oz+dz*wallT,dx,dy,dz);
    if(!hasPoint){hitX=ox+dx*wallT;hitY=oy+dy*wallT;hitZ=oz+dz*wallT;hasPoint=true;}
   }
  }
  state.ammo[state.weapon].mag-=1;
  state.shots+=1;
  if(anyHit)state.hits+=1;
  state.shotTimer=weapon.gap;
  state.consecutive+=1;
  state.consecutiveTimer=.28;
  state.spread=Math.min(.09,spread);
  state.recoilPitch+=weapon.recoil;
  state.recoilYaw+=(rng()-.5)*weapon.recoil*.6;
  state.shake=Math.min(.5,state.shake+weapon.recoil*2.2);
  state.muzzle=.05;
  worldFlash.position.set(ox+fx*.7,oy+fy*.7-.04,oz+fz*.7);
  kick=1;
  audio.shot(weapon.sound);
  // Scale the muzzle offset into the world camera.
  group.updateMatrixWorld(true);
  const muzzleView=new THREE.Vector3();
  muzzleRef.getWorldPosition(muzzleView);
  const vmScale=Math.tan(Math.PI/6)/Math.tan(Math.PI*25/180);
  const mvx=muzzleView.x/-muzzleView.z*vmScale;
  const mvy=muzzleView.y/-muzzleView.z*vmScale;
  let tdx=fx+rx*mvx+ux*mvy;
  let tdy=fy+uy*mvy;
  let tdz=fz+rz*mvx+uz*mvy;
  const tlen=Math.hypot(tdx,tdy,tdz)||1;
  tdx/=tlen;tdy/=tlen;tdz/=tlen;
  const tracerX=ox+tdx*1.05;
  const tracerY=oy+tdy*1.05;
  const tracerZ=oz+tdz*1.05;
  if(hasPoint)effects.tracerLine(tracerX,tracerY,tracerZ,hitX,hitY,hitZ,PALETTE.sodium);
  else effects.tracerLine(tracerX,tracerY,tracerZ,ox+fx*45,oy+fy*45,oz+fz*45,PALETTE.sodium);
  effects.shell(ox+rx*.22,oy-.14,oz+rz*.22,rx*1.6+(rng()-.5)*.4,1.4+rng()*.6,rz*1.6);
  bots.hear(ox,oz,30);
  hud.hitmarker(anyHit);
  if(state.ammo[state.weapon].mag<=0)hud.setPrompt('PRESS R TO RELOAD',.6);
  return true;
 }
 function update(dt){
  state.shotTimer=Math.max(0,state.shotTimer-dt);
  state.switchTimer=Math.max(0,state.switchTimer-dt);
  state.muzzle=Math.max(0,state.muzzle-dt);
  state.flash=Math.max(0,state.flash-dt*1.4);
  state.spread=damp(state.spread,0,9,dt);
  if(state.consecutive>0){
   state.consecutiveTimer=(state.consecutiveTimer||0)-dt;
   if(state.consecutiveTimer<=0)state.consecutive=0;
  }
  if(state.reload>0){
   state.reload-=dt;
   if(state.reload<=0){
    state.reload=0;
    const weapon=def();
    const ammo=state.ammo[state.weapon];
    const take=Math.min(weapon.mag-ammo.mag,ammo.reserve);
    ammo.mag+=take;
    ammo.reserve-=take;
   }
  }
  if(state.mode==='live'||state.mode==='planted'){
   if(input.pressed.has('Digit1'))equip('pistol');
   if(input.pressed.has('Digit2')&&state.primary)equip(state.primary);
   if(input.pressed.has('Digit3'))grenades.select('frag');
   if(input.pressed.has('Digit4'))grenades.select('flash');
   if(input.pressed.has('KeyR'))reload();
   if(input.pressed.has('KeyG'))grenades.throwCharge();
   if(state.alive&&!state.grenade){
    const weapon=def();
    const wants=weapon.auto?input.mouseDown:input.firePressed;
    if(wants)fire();
   }
  }
  grenades.update(dt);
  kick=damp(kick,0,15,dt);
  reloadSway=damp(reloadSway,state.reload>0?1:0,9,dt);
  group.visible=state.mode!=='start'&&state.mode!=='buy'&&state.alive&&!state.grenade;
  if(group.visible){
   const sway=Math.sin(state.time*1.6)*.004+Math.sin(state.bobPhase)*.006*Math.min(1,state.player.speed/PLAYER.speed);
   const plantDrop=state.plant.active?1:0;
   group.position.x=(layouts[state.weapon]||layouts.rifle).x+sway;
   group.position.y=baseY-reloadSway*.1+Math.cos(state.time*1.3)*.003-plantDrop*.24;
   group.position.z=(layouts[state.weapon]||layouts.rifle).z+kick*.055+plantDrop*.06;
   group.rotation.x=.02+kick*.12-plantDrop*.42;
   group.rotation.z=reloadSway*.35+plantDrop*.12;
   group.rotation.y=.045+sway*.6;
  }
  flash.visible=state.muzzle>0;
  flashCross.visible=state.muzzle>0;
  flashMaterial.opacity=state.muzzle>0?.95:0;
  flashCross.material.opacity=state.muzzle>0?.7:0;
  flashLight.intensity=state.muzzle>0?40:0;
  worldFlash.intensity=state.muzzle>0?22:0;
  plantHands.visible=group.visible&&state.plant.active;
 }
 // Screenshot staging: drop the recoil kick so the flash sits on the bore.
 function settle(){
  kick=0;
  reloadSway=0;
 }
 function resetRound(){
  for(const id of['pistol','smg','rifle','shotgun']){
   state.ammo[id].mag=WEAPONS[id].mag;
   state.ammo[id].reserve=WEAPONS[id].reserve;
  }
  state.weapon=state.primary||'pistol';
  state.grenade=null;
  state.reload=0;
  state.shotTimer=0;
  state.consecutive=0;
  state.spread=0;
  state.muzzle=0;
  grenades.reset();
  applyLayout();
 }
 function accuracy(){return state.shots>0?Math.round((state.hits/state.shots)*100):0;}
 applyLayout();
 return{fire,reload,equip,update,resetRound,settle,accuracy,group};
}
