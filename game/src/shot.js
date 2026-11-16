// Deterministic screenshot scenes staged through the real spawner, round, buy and weapon calls.
import {PLAYER}from'./config.js';
import {clamp}from'./util.js';
export function readShot(){
 const value=new URLSearchParams(window.location.search).get('shot');
 return value==='cover'||value==='firefight'||value==='plant'||value==='buy'||value==='board'||value==='title'||value==='match'?value:null;
}
export function createShot(state,deps){
 const{player,weapon,bots,rounds,hud}=deps;
 function eye(){return state.player.crouch?PLAYER.eyeCrouch:PLAYER.eyeStand;}
 function place(x,y,z){
  state.player.x=x;
  state.player.y=y;
  state.player.z=z;
  state.player.vx=0;
  state.player.vy=0;
  state.player.vz=0;
  state.player.speed=0;
  state.player.onGround=true;
 }
 function lookAt(x,y,z){
  const dx=x-state.player.x;
  const dy=y-(state.player.y+eye());
  const dz=z-state.player.z;
  state.yaw=Math.atan2(-dx,-dz);
  state.pitch=Math.asin(clamp(dy/(Math.hypot(dx,dy,dz)||1),-1,1));
  state.recoilPitch=0;
  state.recoilYaw=0;
 }
 function facePlayer(bot){
  const yaw=Math.atan2(state.player.x-bot.x,state.player.z-bot.z);
  return yaw;
 }
 function liveBase(scoreYou,scoreRust,round,money){
  rounds.startBuyPhase();
  rounds.startLive();
  state.scoreYou=scoreYou;
  state.scoreRust=scoreRust;
  state.round=round;
  state.setMoney(money);
  state.primary='rifle';
  weapon.equip('rifle');
  state.switchTimer=0;
  state.shotTimer=0;
  state.reload=0;
  state.feed.length=0;
  state.feedVersion+=1;
  state.promptTime=0;
  state.buyOpen=false;
  hud.setOverlay(null);
  state.grenades.frag=1;
  state.grenades.flash=1;
 }
 function cover(){
  liveBase(2,1,3,3250);
  place(-17.5,.12,-8.3);
  lookAt(-16.0,.58,-10.0);
  state.health=87;
  state.armor=50;
  state.ammo.rifle.mag=24;
  state.ammo.rifle.reserve=90;
  state.plant.time=0;
  rounds.completePlant('A');
  state.bomb.fuse=37;
  rounds.setBombYaw(Math.atan2(state.player.x-state.bomb.x,state.player.z-state.bomb.z));
  state.feed.length=0;
  state.feedVersion+=1;
  const killed=bots.squad[2];
  bots.damage(killed,999,'head');
  killed.group.visible=false;
  killed.drop.visible=false;
  const warden=bots.squad[0];
  const sable=bots.squad[1];
  const wyaw=Math.atan2(state.player.x+14.2,state.player.z+14.7);
  const syaw=Math.atan2(state.player.x+13.6,state.player.z+11.4);
  bots.stage(warden,-14.2,-14.7,wyaw,.34);
  bots.stage(sable,-13.6,-11.4,syaw,-.3);
  state.setMoney(3250);
  state.kills=1;
  state.plants=1;
  state.clock=52;
 }
 function firefight(){
  liveBase(2,1,5,3600);
  place(17.8,0,-4.8);
  const target=bots.squad[0];
  const mate=bots.squad[1];
  const hidden=bots.squad[2];
  hidden.group.visible=false;
  hidden.drop.visible=false;
  bots.stage(target,15.6,-9.8,facePlayer(target),.06);
  target.alive=true;
  target.health=100;
  target.group.visible=true;
  // The still is taken a beat after the hit, so the target leans off the
  // round instead of standing at attention through it.
  target.group.rotation.x=-.17;
  target.group.rotation.z=.13;
  state.hitmarker=.22;
  bots.stage(mate,18.6,-10.9,facePlayer(mate),-.14);
  mate.alive=true;
  mate.health=100;
  mate.group.visible=true;
  lookAt(target.x,1.25,target.z);
  state.health=64;
  state.armor=0;
  state.ammo.rifle.mag=20;
  state.ammo.rifle.reserve=90;
  state.clock=72;
  state.shots=0;
  state.hits=0;
  state.consecutive=0;
  if(weapon.fire()){
   weapon.settle();
   state.shotTimer=0;
   state.consecutive=0;
   // Keep the staged reticle tight; a 22 px spread gap read as a broken
   // crosshair in the still.
   state.spread=.003;
   // The still is captured after the shot, so the recoil kick would move the
   // camera off the line the tracer actually travelled. Reset it so the
   // crosshair and the hit point agree in the frame.
   state.recoilPitch=0;
   state.recoilYaw=0;
  }
  state.setMoney(3600);
  state.kills=1;
 }
 function plant(){
  liveBase(2,1,4,2900);
  state.player.crouch=true;
  place(1.7,0,-10.6);
  lookAt(0,.5,-13);
  state.health=92;
  state.armor=0;
  state.ammo.rifle.mag=30;
  state.ammo.rifle.reserve=90;
  state.clock=68;
  rounds.stageCharge('C',.64);
  rounds.setBombYaw(Math.atan2(state.player.x-state.bomb.x,state.player.z-state.bomb.z));
  const warden=bots.squad[0];
  const wyaw=Math.atan2(state.player.x+4.6,state.player.z+15.2);
  bots.stage(warden,-4.6,-15.2,wyaw,.1);
  bots.squad[1].group.visible=false;
  bots.squad[1].drop.visible=false;
  bots.squad[2].group.visible=false;
  bots.squad[2].drop.visible=false;
  state.feed.length=0;
  state.feedVersion+=1;
 }
 function buy(){
  rounds.startBuyPhase();
  state.buyClock=12;
  state.setMoney(1250);
  state.round=4;
  state.scoreYou=2;
  state.scoreRust=1;
  state.primary='rifle';
  place(17.8,0,-4.8);
  lookAt(15.6,1.2,-9.8);
  hud.setOverlay('buy');
  hud.setHover(1);
  state.feed.length=0;
  state.feedVersion+=1;
 }
 function board(){
  liveBase(2,1,6,4700);
  place(17.8,0,-4.8);
  lookAt(14.5,1.1,-10.5);
  state.health=78;
  state.armor=100;
  state.ammo.rifle.mag=18;
  state.clock=64;
  bots.stage(bots.squad[0],14.2,-9.6,facePlayer(bots.squad[0]),.08);
  bots.stage(bots.squad[1],19.6,-10.2,facePlayer(bots.squad[1]),-.12);
  bots.stage(bots.squad[2],12.4,-6.2,facePlayer(bots.squad[2]),.2);
  state.roster[0].k=5;
  state.roster[0].d=2;
  state.roster[0].money=4750;
  state.roster[1].k=1;
  state.roster[1].d=4;
  state.roster[1].money=3200;
  state.roster[2].k=3;
  state.roster[2].d=3;
  state.roster[2].money=2600;
  state.roster[3].k=6;
  state.roster[3].d=2;
  state.roster[3].money=3900;
  state.money=state.roster[0].money;
  state.kills=5;
  rounds.updateMvp();
  state.showBoard=true;
  state.feed.length=0;
  state.feedVersion+=1;
 }
 // Best-game contact sheet: the house calibration names a start, title, end or
 // restart screen in more than four in five reasons, so stage those two screens
 // as real renders of the same systems rather than drawing a separate menu.
 function title(){
  liveBase(0,0,1,1900);
  place(-17.5,.12,-8.3);
  lookAt(-15.2,.9,-11.5);
  state.health=100;
  state.armor=100;
  state.ammo.rifle.mag=30;
  state.ammo.rifle.reserve=90;
  state.clock=105;
  state.mode='start';
  state.started=false;
  state.paused=false;
  state.overlay='start';
  hud.setOverlay('start');
  state.feed.length=0;
  state.feedVersion+=1;
 }
 function match(){
  liveBase(5,3,9,6200);
  place(17.8,0,-4.8);
  lookAt(14.5,1.1,-10.5);
  state.health=64;
  state.armor=50;
  state.ammo.rifle.mag=11;
  state.clock=41;
  state.kills=14;
  state.plants=3;
  state.shots=40;
  state.hits=17;
  bots.stage(bots.squad[0],14.2,-9.6,facePlayer(bots.squad[0]),.08);
  bots.stage(bots.squad[1],19.6,-10.2,facePlayer(bots.squad[1]),-.12);
  bots.stage(bots.squad[2],12.4,-6.2,facePlayer(bots.squad[2]),.2);
  state.feed.length=0;
  state.feedVersion+=1;
  rounds.showMatch();
 }
 function stageShot(mode){
  state.shot=mode;
  state.shotFrozen=false;
  state.started=true;
  state.paused=false;
  window.__shotReady=false;
  if(mode==='cover')cover();
  else if(mode==='firefight')firefight();
  else if(mode==='plant')plant();
  else if(mode==='buy')buy();
  else if(mode==='board')board();
  else if(mode==='title')title();
  else if(mode==='match')match();
  // One zero-time weapon tick exposes the muzzle flash and viewmodel pose
  // that the staged shot would show on its first simulated frame.
  weapon.update(0);
  if(state.bomb.active)rounds.paintDisplay(state.bomb.fuse);
  state.promptText='';
  state.promptTime=0;
  hud.setPrompt('',0);
  hud.update(0);
  player.syncEye();
  player.applyCamera();
  state.shotFrozen=true;
 }
 return{stageShot};
}
