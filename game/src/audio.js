// Procedural WebAudio: every shot, step, beep and callout is synthesized, no audio files.
export function createAudio(){
 let ctx=null;
 let master=null;
 let noise=null;
 let brown=null;
 function enable(){
  if(ctx){
   if(ctx.state==='suspended')ctx.resume();
   return;
  }
  const Ctor=window.AudioContext||window.webkitAudioContext;
  if(!Ctor)return;
  ctx=new Ctor();
  master=ctx.createGain();
  master.gain.value=.55;
  master.connect(ctx.destination);
  noise=buffer(false);
  brown=buffer(true);
  const ambience=ctx.createBufferSource();
  ambience.buffer=brown;
  ambience.loop=true;
  const lowpass=ctx.createBiquadFilter();
  lowpass.type='lowpass';
  lowpass.frequency.value=400;
  const gain=ctx.createGain();
  gain.gain.value=.03;
  ambience.connect(lowpass).connect(gain).connect(master);
  ambience.start();
  const hum=ctx.createOscillator();
  hum.type='sine';
  hum.frequency.value=60;
  const humGain=ctx.createGain();
  humGain.gain.value=.01;
  hum.connect(humGain).connect(master);
  hum.start();
  if(ctx.state==='suspended')ctx.resume();
 }
 function buffer(isBrown){
  const length=ctx.sampleRate*2;
  const audioBuffer=ctx.createBuffer(1,length,ctx.sampleRate);
  const data=audioBuffer.getChannelData(0);
  let last=0;
  for(let i=0;i<length;i++){
   const white=Math.random()*2-1;
   if(isBrown){
    last=(last+.02*white)/1.02;
    data[i]=last*3.2;
   }else{
    data[i]=white;
   }
  }
  return audioBuffer;
 }
 function tone(freq,duration,type,gain,toFreq=0,delay=0){
  if(!ctx)return;
  const now=ctx.currentTime+delay;
  const osc=ctx.createOscillator();
  const amp=ctx.createGain();
  osc.type=type;
  osc.frequency.setValueAtTime(freq,now);
  if(toFreq>0)osc.frequency.exponentialRampToValueAtTime(toFreq,now+duration);
  amp.gain.setValueAtTime(gain,now);
  amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
  osc.connect(amp).connect(master);
  osc.start(now);
  osc.stop(now+duration+.02);
 }
 function burst(duration,gain,frequency,delay=0){
  if(!ctx)return;
  const now=ctx.currentTime+delay;
  const source=ctx.createBufferSource();
  source.buffer=noise;
  const filter=ctx.createBiquadFilter();
  filter.type='lowpass';
  filter.frequency.value=frequency;
  const amp=ctx.createGain();
  amp.gain.setValueAtTime(gain,now);
  amp.gain.exponentialRampToValueAtTime(.0001,now+duration);
  source.connect(filter).connect(amp).connect(master);
  source.start(now);
  source.stop(now+duration+.01);
 }
 function shot(scale=1){
  if(!ctx)return;
  burst(.09,.32,1800*scale);
  tone(110,.16,'sine',.26,48);
 }
 function botShot(volume=.6){
  if(!ctx)return;
  burst(.08,.16*volume,1300);
  tone(95,.12,'sine',.12*volume,45);
 }
 function dry(){tone(1400,.03,'square',.05);}
 function reload(){
  tone(1200,.035,'square',.06);
  tone(800,.04,'square',.06,0,.13);
 }
 function footstep(volume=1){burst(.05,.05*volume,380);}
 function hit(kill){
  tone(kill?1900:1600,.03,'sine',kill?.12:.08);
  if(kill)tone(2400,.04,'sine',.07,0,.04);
 }
 function toss(){burst(.06,.05,900);}
 function beep(){tone(880,.04,'sine',.1);}
 function plant(){tone(500,.07,'square',.09);tone(760,.08,'square',.08,0,.12);}
 function plantTick(){tone(500,.02,'square',.04);}
 function explosion(){
  tone(60,1.2,'sine',.5,28);
  burst(.8,.4,700);
 }
 function flash(){
  tone(2400,.4,'sine',.2,900);
  burst(.2,.14,3000);
 }
 function callout(){tone(600,.08,'square',.06);tone(900,.09,'square',.055,0,.1);}
 function buy(){tone(760,.05,'square',.06);tone(1140,.07,'square',.05,0,.06);}
 function roundEnd(win){
  if(win){tone(520,.2,'triangle',.1);tone(780,.28,'triangle',.09,0,.18);}
  else{tone(320,.24,'triangle',.1);tone(190,.32,'triangle',.09,0,.2);}
 }
 return{enable,shot,botShot,dry,reload,footstep,hit,toss,beep,plant,plantTick,explosion,flash,callout,buy,roundEnd};
}
