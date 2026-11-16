// Round flow, economy and the bomb; live play and staging share these calls.
import *as THREE from'three';
import {ECONOMY,MAP,PALETTE,ROUND,WEAPONS}from'./config.js';
import {clamp,lerp}from'./util.js';
export function createRounds(state,scene,map,player,bots,weapon,hud,audio,effects,input){
 const bomb=new THREE.Group();
 const bodyMat=new THREE.MeshStandardMaterial({color:0x232d36,roughness:.62,metalness:.35});
 const body=new THREE.Mesh(new THREE.BoxGeometry(.38,.2,.28),bodyMat);
 body.position.y=.1;
 body.castShadow=true;
 bomb.add(body);
 const bezelMat=new THREE.MeshStandardMaterial({color:0x0a0f14,roughness:.45,metalness:.7});
 const bezel=new THREE.Mesh(new THREE.BoxGeometry(.42,.03,.32),bezelMat);
 bezel.position.y=.205;
 bomb.add(bezel);
 // Countdown display on the charge face, drawn as canvas digits.
 const displayCanvas=document.createElement('canvas');
 displayCanvas.width=256;
 displayCanvas.height=128;
 const displayCtx=displayCanvas.getContext('2d');
 const displayTexture=new THREE.CanvasTexture(displayCanvas);
 displayTexture.colorSpace=THREE.SRGBColorSpace;
 let displayFuse=-1;
 function face(color,label,size){
  displayCtx.fillStyle='#170303';
  displayCtx.fillRect(0,0,256,128);
  displayCtx.fillStyle=color;
  displayCtx.font=`bold ${size}px ui-monospace, Menlo, Consolas, monospace`;
  displayCtx.textAlign='center';
  displayCtx.textBaseline='middle';
  displayCtx.fillText(label,128,64);
  displayCtx.fillStyle='rgba(0, 0, 0, 0.3)';
  for(let y=0;y<128;y+=6)displayCtx.fillRect(0,y,256,2);
  displayTexture.needsUpdate=true;
 }
 // Idle face: the charge is carried or being planted, so no fuse is running.
 function paintIdle(){
  displayFuse=-1;
  face('#c8842a','SAFE',40);
  screenLight.intensity=.35;
 }
 function paintDisplay(seconds){
  const whole=Math.max(0,Math.ceil(seconds));
  if(whole===displayFuse)return;
  displayFuse=whole;
  face('#ff3a2c',`0:${String(whole).padStart(2, '0')}`,88);
  screenLight.intensity=1.15;
 }
 const screenBezel=new THREE.Mesh(new THREE.BoxGeometry(.25,.14,.016),bezelMat);
 screenBezel.position.set(0,.11,.141);
 bomb.add(screenBezel);
 const screen=new THREE.Mesh(new THREE.PlaneGeometry(.21,.11),new THREE.MeshBasicMaterial({map:displayTexture}));
 screen.position.set(0,.11,.1505);
 bomb.add(screen);
 const screenLight=new THREE.PointLight(0xff2a18,1.15,2.4,2);
 screenLight.position.set(0,.2,.34);
 bomb.add(screenLight);
 paintIdle();
 const keyMat=new THREE.MeshStandardMaterial({color:0x8a97a3,roughness:.5,metalness:.4});
 for(let r=0;r<2;r++){
  for(let c=0;c<3;c++){
   const key=new THREE.Mesh(new THREE.BoxGeometry(.028,.008,.02),keyMat);
   key.position.set(-.03+c*.035,.225,-.04-r*.028);
   bomb.add(key);
  }
 }
 const strapMat=new THREE.MeshStandardMaterial({color:0x3a2c22,roughness:.92});
 const strap=new THREE.Mesh(new THREE.BoxGeometry(.4,.07,.3),strapMat);
 strap.position.y=.1;
 bomb.add(strap);
 const cableMat=new THREE.MeshStandardMaterial({color:0x6a4a22,roughness:.8});
 for(let i=0;i<2;i++){
  const cable=new THREE.Mesh(new THREE.TorusGeometry(.07+i*.03,.009,6,14,Math.PI),cableMat);
  cable.position.set(-.04+i*.07,.19,-.13);
  cable.rotation.x=1.15;
  cable.rotation.y=.4-i*.7;
  bomb.add(cable);
 }
 // Charge padding and contact shadow so it sits on the deck.
 const contact=new THREE.Mesh(new THREE.CircleGeometry(.3,20),new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.42,depthWrite:false}));
 contact.rotation.x=-Math.PI/2;
 contact.position.y=.012;
 bomb.add(contact);
 const puttyMat=new THREE.MeshStandardMaterial({color:0x9c8a63,roughness:.94});
 const tapeMat=new THREE.MeshStandardMaterial({color:0x2a2622,roughness:.95});
 for(const side of[-1,1]){
  const block=new THREE.Mesh(new THREE.BoxGeometry(.14,.07,.15),puttyMat);
  block.position.set(side*.105,.245,-.04+side*.012);
  bomb.add(block);
  const strap=new THREE.Mesh(new THREE.BoxGeometry(.148,.016,.032),tapeMat);
  strap.position.set(side*.105,.283,-.04+side*.012);
  bomb.add(strap);
 }
 const ledMaterial=new THREE.MeshStandardMaterial({color:PALETTE.danger,emissive:PALETTE.danger,emissiveIntensity:3});
 const led=new THREE.Mesh(new THREE.BoxGeometry(.045,.03,.02),ledMaterial);
 led.position.set(-.16,.19,.145);
 bomb.add(led);
 const ringMaterial=new THREE.MeshBasicMaterial({color:PALETTE.cyan,transparent:true,opacity:.8,side:THREE.DoubleSide,depthWrite:false});
 const ring=new THREE.Mesh(new THREE.RingGeometry(.34,.44,28),ringMaterial);
 ring.rotation.x=-Math.PI/2;
 ring.position.y=.26;
 ring.visible=false;
 bomb.add(ring);
 bomb.visible=false;
 scene.add(bomb);
 let lastGear=100;
 let lastShots=0;
 let beepGap=1;
 function resetBomb(){
  state.bomb.active=false;
  state.bomb.planted=false;
  state.bomb.fuse=0;
  state.bomb.defuse=0;
  state.bomb.defusing=false;
  state.bomb.defuserId=-1;
  state.bomb.beep=0;
  state.bomb.led=0;
  state.plant.time=0;
  state.plant.active=false;
  state.plant.site=null;
  bomb.visible=false;
  ring.visible=false;
  ring.scale.setScalar(.1);
  paintIdle();
 }
 function setBombYaw(yaw){
  bomb.rotation.y=yaw;
 }
 function showBomb(x,z){
  bomb.position.set(x,0,z);
  bomb.visible=true;
  state.bomb.x=x;
  state.bomb.z=z;
  if(state.bomb.active)paintDisplay(state.bomb.fuse);
  else paintIdle();
 }
 function startMatch(){
  state.scoreYou=0;
  state.scoreRust=0;
  state.round=1;
  state.kills=0;
  state.plants=0;
  state.shots=0;
  state.hits=0;
  state.money=ECONOMY.start;
  for(const row of state.roster){
   row.k=0;
   row.d=0;
   row.money=ECONOMY.start;
   row.mvp=false;
  }
  state.mvp='';
  state.primary=null;
  state.matchResult='';
  startBuyPhase();
 }
 function startBuyPhase(){
  state.mode='buy';
  state.buyClock=ROUND.buy;
  state.clock=ROUND.live;
  state.buyOpen=true;
  state.endClock=0;
  state.plant.time=0;
  state.plant.active=false;
  state.plant.site=null;
  state.alive=true;
  state.health=100;
  state.armor=0;
  state.grenades.frag=0;
  state.grenades.flash=0;
  state.grenade=null;
  state.damageFlash=0;
  state.shake=0;
  state.flash=0;
  resetBomb();
  effects.reset();
  player.respawn();
  bots.spawnRound();
  weapon.resetRound();
  lastGear=100;
  lastShots=state.shots;
  hud.setOverlay('buy');
  hud.setPrompt('',0);
  input.unlock();
 }
 function startLive(){
  if(state.mode!=='buy')return;
  state.mode='live';
  state.buyOpen=false;
  state.buyClock=0;
  state.clock=ROUND.live;
  state.bomb.fuse=0;
  state.plant.time=0;
  state.plant.active=false;
  state.plant.site=null;
  bots.activate();
  hud.setOverlay(null);
  hud.addFeed('TIDE DEPLOYED · PLANT AT A, B OR C','call');
  input.lock();
 }
 function toggleBuy(){
  if(state.mode!=='buy')return;
  if(state.buyOpen){
   closeBuy();
  }else{
   state.buyOpen=true;
   hud.setOverlay('buy');
   input.unlock();
  }
 }
 function closeBuy(){
  if(state.mode!=='buy')return;
  state.buyOpen=false;
  hud.setOverlay(null);
  input.lock();
 }
 function buy(id){
  if(state.mode!=='buy')return false;
  let price=0;
  if(id==='armor'){
   price=ECONOMY.armor;
   if(state.armor>0)return false;
  }else if(id==='frag'||id==='flash'){
   price=id==='frag'?ECONOMY.frag:ECONOMY.flash;
   if(state.grenades[id]>0)return false;
  }else{
   if(!WEAPONS[id]||WEAPONS[id].slot!==2)return false;
   price=WEAPONS[id].price;
   if(state.primary===id)return false;
  }
  if(state.money<price)return false;
  state.pay('YOU',-price);
  if(id==='armor')state.armor=100;
  else if(id==='frag'||id==='flash')state.grenades[id]=1;
  else{
   state.primary=id;
   weapon.equip(id);
  }
  audio.buy();
  hud.addFeed(`${id === 'armor' ? 'PLATE ARMOR' : id === 'frag' ? 'FRAG CHARGE' : id === 'flash' ? 'FLASH CHARGE' : WEAPONS[id].name} ACQUIRED`,'call');
  return true;
 }
 function completePlant(siteKey){
  if(state.mode!=='live')return false;
  const site=MAP.sites[siteKey];
  state.mode='planted';
  state.bomb.active=true;
  state.bomb.planted=true;
  state.bomb.fuse=ROUND.fuse;
  state.bomb.defuse=0;
  state.bomb.defusing=false;
  state.bomb.defuserId=-1;
  state.bomb.beep=0;
  state.plant.time=0;
  state.plant.active=false;
  state.plant.site=siteKey;
  state.pay('YOU',ECONOMY.plant);
  state.plants+=1;
  showBomb(site.x,site.z);
  bots.hear(site.x,site.z,60);
  bots.rotate(siteKey);
  hud.addFeed(`YOU > CHARGE PLANTED AT ${siteKey}`,'you');
  audio.plant();
  hud.setPrompt('CHARGE PLANTED · DEFEND',1.2);
  return true;
 }
 function stageCharge(siteKey,progress){
  const site=MAP.sites[siteKey];
  state.mode='live';
  state.plant.site=siteKey;
  state.plant.active=true;
  state.plant.time=ROUND.plantTime*progress;
  showBomb(site.x,site.z);
 }
 function detonate(){
  effects.explosion(state.bomb.x,.1,state.bomb.z);
  audio.explosion();
  state.shake=.9;
  state.flash=.8;
  bomb.visible=false;
 }
 function updatePlant(dt){
  const gear=state.health+state.armor;
  if(gear<lastGear-.01||state.shots!==lastShots){
   state.plant.time=0;
   state.plant.active=false;
   lastGear=gear;
   lastShots=state.shots;
  }else{
   lastGear=gear;
   lastShots=state.shots;
  }
  const site=map.nearSite(state.player.x,state.player.z);
  const holding=input.keys.KeyE;
  if(site&&holding&&state.alive&&state.player.speed<.7){
   if(!state.plant.active){
    state.plant.active=true;
    state.plant.site=site;
    showBomb(MAP.sites[site].x,MAP.sites[site].z);
   }
   state.plant.time+=dt;
   if(state.plant.time>=ROUND.plantTime)completePlant(site);
  }else if(state.plant.active){
   state.plant.active=false;
   state.plant.time=0;
   if(!state.bomb.planted)bomb.visible=false;
  }
  if(state.plant.active&&state.plant.time>0&&Math.floor(state.plant.time*2.5)!==Math.floor((state.plant.time-dt)*2.5))audio.plantTick();
 }
 function updateMvp(){
  let best=state.roster[0];
  for(const row of state.roster){
   row.mvp=false;
   if(row.k>best.k)best=row;
  }
  best.mvp=true;
  state.mvp=best.name;
 }
 function endRound(winner,reason){
  if(state.mode==='ended'||state.mode==='matchEnd')return;
  const win=winner==='you';
  state.mode='ended';
  state.endClock=ROUND.end;
  state.plant.active=false;
  state.plant.time=0;
  state.bomb.planted=false;
  state.bomb.active=false;
  state.bomb.defusing=false;
  state.bomb.defuse=0;
  state.bomb.defuserId=-1;
  bomb.visible=false;
  ring.visible=false;
  if(win)state.scoreYou+=1;
  else state.scoreRust+=1;
  const delta=win?ECONOMY.win:ECONOMY.loss;
  for(const row of state.roster)state.pay(row.name,(row.team==='TIDE')===win?ECONOMY.win:ECONOMY.loss);
  updateMvp();
  hud.showRound(win,reason,delta,ROUND.end);
  hud.setOverlay('round');
  audio.roundEnd(win);
 }
 function showMatch(){
  const win=state.scoreYou>=ROUND.target;
  state.mode='matchEnd';
  state.matchResult=win?'MATCH WON':'MATCH LOST';
  hud.showMatch(win,{
   rounds:`${state.scoreYou} : ${state.scoreRust}`,
   kills:state.kills,
   plants:state.plants,
   accuracy:weapon.accuracy(),
  });
  hud.setOverlay('match');
  input.unlock();
 }
 function nextRound(){
  if(state.scoreYou>=ROUND.target||state.scoreRust>=ROUND.target){
   showMatch();
   return;
  }
  state.round+=1;
  startBuyPhase();
 }
 function restartMatch(){
  startMatch();
  hud.setOverlay('buy');
 }
 function updateBombVisuals(dt){
  if(state.bomb.planted){
   state.bomb.led+=dt;
   led.visible=Math.floor(state.bomb.led*(6+(1-state.bomb.fuse/ROUND.fuse)*12))%2===0;
   ring.visible=state.bomb.defusing;
   if(ring.visible){
    const k=clamp(state.bomb.defuse/ROUND.defuseTime,0,1);
    ring.scale.setScalar(.35+k*.9);
    ringMaterial.opacity=.55+Math.sin(state.time*12)*.2;
   }
   state.bomb.beep-=dt;
   if(state.bomb.beep<=0&&state.bomb.fuse>0){
    beepGap=lerp(.12,1.0,clamp(state.bomb.fuse/ROUND.fuse,0,1));
    state.bomb.beep=beepGap;
    audio.beep();
   }
  }else{
   led.visible=true;
   ring.visible=false;
  }
 }
 function update(dt){
  if(state.mode==='buy'){
   if(input.pressed.has('KeyB'))toggleBuy();
   state.buyClock-=dt;
   if(state.buyClock<=0)startLive();
   updateBombVisuals(dt);
   return;
  }
  updateBombVisuals(dt);
  if(state.mode==='live'){
   state.clock=Math.max(0,state.clock-dt);
   updatePlant(dt);
   if(state.mode!=='live')return;
   if(state.health<=0){endRound('rust','TIDE DOWN');return;}
   if(bots.allDead()){endRound('you','DEFENDERS DOWN');return;}
   if(state.clock<=0){endRound('rust','TIME EXPIRED');return;}
  }else if(state.mode==='planted'){
   state.bomb.fuse=Math.max(0,state.bomb.fuse-dt);
   paintDisplay(state.bomb.fuse);
   if(state.health<=0){endRound('rust','TIDE DOWN');return;}
   if(state.bomb.defuse>=ROUND.defuseTime){endRound('rust','CHARGE DEFUSED');return;}
   if(bots.allDead()){endRound('you','DEFENDERS DOWN');return;}
   if(state.bomb.fuse<=0){detonate();endRound('you','CHARGE DETONATED');return;}
  }else if(state.mode==='ended'){
   state.endClock-=dt;
   if(state.endClock<=0){
    if(state.scoreYou>=ROUND.target||state.scoreRust>=ROUND.target)showMatch();
    else nextRound();
   }
  }
 }
 return{
  bomb,startMatch,startBuyPhase,startLive,closeBuy,toggleBuy,buy,update,
  completePlant,stageCharge,endRound,restartMatch,showMatch,resetBomb,
  paintDisplay,updateMvp,
  setBombYaw,
 };
}
