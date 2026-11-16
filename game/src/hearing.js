// Noise events mark a source for nearby defenders, who investigate on the next AI tick.
export function createHearing(state,squad){
 function emit(x,z,radius){
  for(const bot of squad){
   if(!bot.alive)continue;
   if(Math.hypot(bot.x-x,bot.z-z)>radius)continue;
   bot.lastHeardX=x;
   bot.lastHeardZ=z;
   bot.lastHeardAt=state.time;
   if(bot.state!=='engage'&&bot.state!=='defuse'){
    bot.state='investigate';
    bot.repath=0;
   }
  }
 }
 return{emit};
}
