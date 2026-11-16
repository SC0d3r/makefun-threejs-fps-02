// One mutable state object, including the per-player roster the scoreboard reads.
import {ECONOMY,MAP,ROUND,WEAPONS}from'./config.js';
function freshAmmo(){
 return{
  pistol:{mag:WEAPONS.pistol.mag,reserve:WEAPONS.pistol.reserve},
  smg:{mag:WEAPONS.smg.mag,reserve:WEAPONS.smg.reserve},
  rifle:{mag:WEAPONS.rifle.mag,reserve:WEAPONS.rifle.reserve},
  shotgun:{mag:WEAPONS.shotgun.mag,reserve:WEAPONS.shotgun.reserve},
 };
}
export function createState(){
 const state={
  mode:'start',// start | buy | live | planted | ended | matchEnd
  started:false,
  paused:false,
  shot:null,
  shotFrozen:false,
  shotFrames:0,
  round:1,
  scoreYou:0,
  scoreRust:0,
  clock:ROUND.live,
  buyClock:ROUND.buy,
  endClock:0,
  matchResult:'',
  money:ECONOMY.start,
  // Per-player scoreboard: kills, deaths, money and the round MVP.
  roster:[
   {name:'YOU',team:'TIDE',k:0,d:0,money:ECONOMY.start,mvp:false},
   {name:'WARDEN',team:'RUST',k:0,d:0,money:ECONOMY.start,mvp:false},
   {name:'SABLE',team:'RUST',k:0,d:0,money:ECONOMY.start,mvp:false},
   {name:'CUTTER',team:'RUST',k:0,d:0,money:ECONOMY.start,mvp:false},
  ],
  mvp:'',
  showBoard:false,
  health:100,
  armor:0,
  alive:true,
  primary:null,
  weapon:'pistol',
  grenade:null,
  grenades:{frag:0,flash:0},
  ammo:freshAmmo(),
  reload:0,
  switchTimer:0,
  shotTimer:0,
  consecutive:0,
  consecutiveTimer:0,
  spread:0,
  muzzle:0,
  hitmarker:0,
  damageFlash:0,
  shake:0,
  flash:0,
  kills:0,
  plants:0,
  shots:0,
  hits:0,
  player:{
   x:MAP.playerSpawn.x,y:0,z:MAP.playerSpawn.z,
   vx:0,vy:0,vz:0,onGround:true,crouch:false,speed:0,
  },
  yaw:0,
  pitch:0,
  recoilPitch:0,
  recoilYaw:0,
  bob:0,
  bobPhase:0,
  plant:{time:0,site:null,active:false},
  bomb:{active:false,planted:false,x:0,z:0,fuse:0,defuse:0,defusing:false,defuserId:-1,beep:0,led:0},
  buyOpen:false,
  overlay:'start',
  hoverCard:0,
  feed:[],
  feedVersion:0,
  calloutText:'',
  calloutTime:0,
  promptText:'',
  promptTime:0,
  time:0,
  step:0,
 };
 // Every money change goes through pay(), so the board row and the wallet agree.
 state.pay=(name,delta)=>{
  const row=state.roster.find((r)=>r.name===name);
  if(!row)return;
  row.money=Math.max(0,Math.min(ECONOMY.cap,row.money+delta));
  if(row.name==='YOU')state.money=row.money;
 };
 state.setMoney=(value)=>state.pay('YOU',value-state.money);
 return state;
}
