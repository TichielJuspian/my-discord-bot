'use strict';
// Production raid scheduler. No network action happens at import time.
// One authoritative persistent journal; replay is conservative after an uncertain publish.
const fs = require('node:fs');
const path = require('node:path');
const { randomInt } = require('node:crypto');
const registry=require('./raid-boss-registry');
const DURATION_MS = 23 * 60 * 60 * 1000;
const BREAK_MS = 60 * 60 * 1000;
const BOSS_POOL = Object.freeze(registry.rotationBosses().map(b=>b.id));
function chooseDifferent(previous, pool=BOSS_POOL, roll=randomInt) {
  const choices = [...new Set(pool)].filter(b=>b!==previous);
  if (!choices.length) throw Error('No alternative raid boss is available.');
  const n = roll(choices.length);
  if (!Number.isSafeInteger(n) || n<0 || n>=choices.length) throw Error('Invalid boss selection');
  return choices[n];
}
function createRaidScheduler({ stateFile, lobbies, guildId, ownerId, readServerLevel,
  clock=Date.now, setTimer=setTimeout, clearTimer=clearTimeout, choose=chooseDifferent, onError=e=>console.error('[RAID SCHEDULER]',e?.code||e?.name||e) }) {
  if (!stateFile || !lobbies || !guildId || !ownerId) throw Error('Scheduler requires configured state, lobbies and owner.');
  if (BOSS_POOL.length<2 || BOSS_POOL.some(id=>!lobbies.has(id))) throw Error('Scheduler is missing an enabled boss lobby.');
  let state={version:1,enabled:false,phase:'idle',previousBoss:null};
  if (fs.existsSync(stateFile)) {
    const loaded=JSON.parse(fs.readFileSync(stateFile,'utf8'));
    if(loaded.version!==1||typeof loaded.enabled!=='boolean'||!['idle','publishing','active','cooldown'].includes(loaded.phase))throw Error('Raid scheduler journal is invalid; no automatic raid will be created.');
    state=loaded;
  }
  let client=null,timer=null,running=null;
  const current =()=>structuredClone(state);
  function persist(next) {
    const written={...next,version:1};
    fs.mkdirSync(path.dirname(stateFile),{recursive:true});
    fs.writeFileSync(stateFile+'.tmp',JSON.stringify(written),{mode:0o600});
    fs.renameSync(stateFile+'.tmp',stateFile);state=written;
  }
  // Production class rules remain in force even when rotation is paused or stopped.
  const isProductionActive=()=>!!state.productionRulesEnabled||state.enabled&&['publishing','active','cooldown'].includes(state.phase);
  function arm(delay) {
    if(timer)clearTimer(timer);timer=null;
    if(!client||!state.enabled)return;
    const wait=Math.max(1000,Math.min(60*60*1000,delay));
    timer=setTimer(()=>{timer=null;void tick().catch(onError);},wait);timer?.unref?.();
  }
  function status(){
    if(state.phase==='idle'||!state.enabled)return 'Automatic raids are not active. Run /raidset to start a new 23-hour cycle.';
    if(state.phase==='publishing')return 'A lobby publish was interrupted or is still pending. No replacement will be sent until its identity is verified.';
    if(state.phase==='active')return `${registry.get(state.boss)?.name||state.boss} · active until <t:${Math.floor((state.openedAt+DURATION_MS)/1000)}:F>. Ranked rewards settle at the deadline, then a one-hour break.`;
    return `Raid settled. Next different boss is scheduled for <t:${Math.floor(state.spawnAt/1000)}:F>.`;
  }
  async function publishBoss(boss,prior=null) {
    if(!client)throw Error('Bot is not ready.');
    const lobby=lobbies.get(boss);if(!lobby)throw Error('Boss lobby not configured: '+boss);
    const guild=await client.guilds.fetch(guildId);
    const channel=await guild.channels.fetch(state.channelId);
    if(!channel?.send)throw Error('Raid channel cannot send messages. No existing lobby was removed.');
    // A publishing journal is committed BEFORE send. An ambiguous send never causes a duplicate.
    persist({...state,phase:'publishing',boss,publishingAt:clock(),priorBoss:prior});
    const synthetic={guild,channel,guildId,user:{id:ownerId},client,deferred:true,editReply:async()=>{}};
    const ok=await lobby.publish(synthetic,readServerLevel,{freshOnly:true,scheduledRaid:true});
    if(!ok)throw Error('Raid lobby was not published');
    const cycle=lobby.cycle;
    if(!cycle.active||!cycle.scheduled)throw Error('Published lobby identity was not persisted');
    persist({...state,enabled:true,phase:'active',boss,openedAt:cycle.openedAt,raidId:cycle.id,previousBoss:prior,publishingAt:null,priorBoss:null});
    if(prior&&prior!==boss){
      const old=lobbies.get(prior);
      if(old?.cycle?.settled){await old.closeUi?.().catch(onError);old.retire();}
    }
    arm(DURATION_MS);return cycle;
  }
  async function reconcilePublishing(){
    if(state.phase!=='publishing')return true;
    const c=lobbies.get(state.boss)?.cycle;
    // Only the newly saved scheduled raid can resolve a potentially lost Discord response.
    if(!c?.active||!c.scheduled||!Number.isFinite(c.openedAt)||c.openedAt<state.publishingAt)return false;
    persist({...state,phase:'active',openedAt:c.openedAt,raidId:c.id,previousBoss:state.priorBoss??state.previousBoss,publishingAt:null,priorBoss:null});
    return true;
  }
  async function doTick(){
    if(!state.enabled||!client)return;
    if(state.phase==='publishing'){
      if(!await reconcilePublishing()){onError(Error('Raid publish requires operator review. The bot will not send another lobby blindly.'));return;}
    }
    if(state.phase==='active'){
      const deadline=state.openedAt+DURATION_MS;
      if(clock()<deadline){arm(deadline-clock());return;}
      const lobby=lobbies.get(state.boss);
      if(!lobby)throw Error('Current boss lobby is missing.');
      if(lobby.cycle.id!==state.raidId)throw Error('Raid identity mismatch; settlement blocked.');
      await lobby.settleRewards();
      if(!lobby.cycle.settled)throw Error('Raid settlement not durably completed.');
      if(state.stopAfterCurrent){persist({...state,enabled:false,phase:'idle',previousBoss:state.boss,stopAfterCurrent:false});return;}
      persist({...state,phase:'cooldown',spawnAt:deadline+BREAK_MS});
    }
    if(state.phase==='cooldown'){
      if(state.stopAfterCurrent){persist({...state,enabled:false,phase:'idle',previousBoss:state.boss,stopAfterCurrent:false});return;}
      if(clock()<state.spawnAt){arm(state.spawnAt-clock());return;}
      const boss=choose(state.boss);
      await publishBoss(boss,state.boss);return;
    }
  }
  async function tick() {
    if(running)return running;
    running=doTick();
    try{return await running;}catch(e){onError(e);arm(60000);throw e;}finally{running=null;}
  }
  async function resume(readyClient){
    client=readyClient;
    if(!state.enabled)return;
    if(state.phase==='publishing'&&!await reconcilePublishing()){
      onError(Error('Publishing state needs manual review; no duplicate lobby will be sent.'));return;
    }
    await tick();
  }
  async function enable(readyClient,channelId){
    client=readyClient;
    if(state.enabled){await tick();return {started:false,status:status()};}
    if(!channelId)throw Error('Choose the channel where the raid lobby should be published.');
    // Never supersede a live beta raid with an automatic production raid.
    for(const lobby of lobbies.values())if(lobby.cycle.active&&!lobby.cycle.settled)throw Error('An existing raid has an unsettled reward journal. Finish or safely recover it before enabling automatic raids. No data was reset.');
    persist({...state,enabled:true,productionRulesEnabled:true,channelId,phase:'publishing',boss:choose(state.previousBoss),publishingAt:clock()});
    try {await publishBoss(state.boss,state.previousBoss);return {started:true,status:status()};}
    catch(e){onError(e);throw e;}
  }
  // Stop future rotation only after settlement. Never erase an active reward journal.
  function stopAfterCurrent(){
    if(!state.enabled)return 'Automatic raids are already disabled.';
    persist({...state,stopAfterCurrent:true});
    return 'Auto-rotation will stop after the current raid has settled. No active raid or reward was cancelled.';
  }
  return {resume,enable,stopAfterCurrent,status,tick,current,isProductionActive,chooseDifferent};
}
module.exports={createRaidScheduler,chooseDifferent,DURATION_MS,BREAK_MS,BOSS_POOL};
