const runtimePaths = require("../../runtime-paths.cjs");
'use strict';
// Production presentation/combat bridge only. The existing raid service owns
// player loading, admission, scores, journals, rewards and retirement.
const path = require('node:path');
const {setTimeout:wait}=require('node:timers/promises');
// Preserve the last confirmed button geometry during non-interactive cuts.
// This is display state only: all retained controls are disabled, with their
// original revision. The combat busy/revision checks remain authoritative.
function holdControls(body,previous,{id,ready,ended=false}) {
  if(ready||ended)return body;
  const components=(previous?.components||[]).map(c=>typeof c.toJSON==='function'?c.toJSON():c);
  const prefix='raidtest:'+id+':';
  const rows=components.filter(c=>c.type===1&&c.components?.length&&c.components.every(b=>b.type===2&&typeof b.custom_id==='string'&&b.custom_id.startsWith(prefix))).map(c=>({...structuredClone(c),components:c.components.map(b=>({...structuredClone(b),disabled:true}))}));
  if(!rows.length)return body;
  const next=body.components.filter(c=>c.type!==1);
  const at=next.findIndex(c=>c.type===12&&c.items?.some(item=>/^attachment:\/\/challenger-current(?:-[a-f0-9]+)?\./.test(item.media?.url||'')));
  next.splice(at<0?next.length:at+1,0,...rows);
  return {...body,components:next};
}
function create({root=runtimePaths.directory("."),combatRoot=runtimePaths.join(root,'raid15'),render=null,engineFactory=null,combatFactories=null}={}) {
  const engines=engineFactory||require(runtimePaths.join(combatRoot,'engine.cjs')).createEngine;
  const factories=combatFactories||{
    warrior:require(runtimePaths.join(combatRoot,'combat.cjs')).createCombat,
    paladin:require(runtimePaths.join(combatRoot,'paladin-combat.cjs')).createPaladinCombat,
    berserker:require(runtimePaths.join(combatRoot,'berserker-combat.cjs')).createBerserkerCombat,
  };
  const combats=new Map(),mediaReceipts=new WeakMap();
  const combat=s=>{const job=s.config.job;if(!factories[job])throw Error('Unsupported v2 class');if(!combats.has(job))combats.set(job,factories[job]({root}));return combats.get(job);};
  const is=active=>active?.v2?.schema===2;
  const eligible=s=>s?.config?.boss==='nameless_succubus'&&Object.hasOwn(factories,s.config.job);
  const load=active=>engines({combat:combat(active.state),initialState:active.state,runtime:active.v2.runtime});
  function commit(active,engine){const saved=engine.serialize();active.state=saved.state;active.v2.runtime=saved.runtime;}
  function initialize(active){
    if(is(active))return false;
    if(!eligible(active.state))return false;
    const engine=engines({combat:combat(active.state),initialState:active.state});
    const frames=engine.start();
    active.v2={schema:2,revision:0,runtime:null,frames,lastFrame:null,ready:false,accountingPending:false};
    commit(active,engine);return true;
  }
  function step(active,action,beforeState=active.state){
    if(!is(active))throw Error('Missing v2 session');
    if(active.v2.accountingPending)throw Error('Previous contribution is not yet confirmed');
    const engine=load(active);engine.replaceExternalState(beforeState);
    const frames=engine.act(action);
    console.info('[RAID RESOLVED]',JSON.stringify({job:beforeState.config.job,turn:beforeState.turn,phase:beforeState.phase,enrage:beforeState.director?.enrageLevel||0,action,frames:frames.map(f=>({kind:f.kind,hit:f.hitIndex||0,reaction:f.reaction||null,damage:f.log?.damage||0,incoming:f.log?.incoming||0,charmed:!!f.log?.charmBlocked,curse:f.lastTurn?.curseLanded,reason:f.lastTurn?.interruptionReason}))}));
    const saved=engine.serialize();
    if(!Number.isSafeInteger(saved.state.totals.damage)||saved.state.totals.damage<0)throw Object.assign(Error('Combat damage exceeds the supported numeric range.'),{code:'BOOST_COMBAT_RANGE'});
    active.state=saved.state;active.v2.runtime=saved.runtime;
    active.v2.frames=frames;active.v2.revision++;active.v2.ready=false;active.v2.accountingPending=true;
    return active.state;
  }
  function end(active){
    if(!is(active))throw Error('Missing v2 session');
    if(active.state.status!=='active')return active.state;
    const engine=load(active),frames=engine.end();commit(active,engine);
    active.v2.frames=frames;active.v2.revision++;active.v2.ready=false;active.v2.accountingPending=true;
    return active.state;
  }
  function flushAccounting(active,record){if(!is(active)||!active.v2.accountingPending)return false;record(active);active.v2.accountingPending=false;return true;}
  function presentation(active,frame){
    const engine=load(active),actions=engine.actions(),all=[...new Set([...engine.attackActions,...engine.defenseActions])];
    const shown=structuredClone(frame);
    // Accounting runs after combat commits. Update only lobby display metadata;
    // each frame's combat HP, resources and log remain its committed snapshot.
    for(const key of ['worldBossHP','personalBestDamage','bestImprovement'])if(active.state[key]!==undefined)shown.state[key]=active.state[key];
    return {id:active.id,revision:active.v2.revision,frame:shown,ready:frame.interactive===true&&engine.active,playerName:active.playerName,namespace:'raidtest',production:true,actions,attackActions:engine.attackActions,defenseActions:engine.defenseActions,actionInfo:Object.fromEntries(all.map(action=>[action,engine.actionInfo(action)]))};
  }
  const metadata=['worldBossHP','personalBestDamage','bestImprovement'];
  const mediaCache=()=>require(runtimePaths.join(root,'raid-attachment-cache.js'));
  function renderPanels(active,shown,panelRefs=mediaCache().references(active)){
    const renderFrame=render||require(runtimePaths.join(root,'raid-render-worker.js')).renderV2;
    return renderFrame(active,{...shown,panelRefs});
  }
  function primeFirst(draft,before){
    const frame=draft.v2.frames[0];
    if(!frame||frame.kind==='enrage')return null;
    const shown=presentation(draft,frame),damage=draft.state.totals.damage;
    if(Number.isSafeInteger(before.worldBossHP)&&Number.isSafeInteger(before.personalBestDamage)){
      const delta=Math.min(before.worldBossHP,Math.max(0,damage-before.personalBestDamage));
      Object.assign(shown.frame.state,{worldBossHP:before.worldBossHP-delta,personalBestDamage:Math.max(before.personalBestDamage,damage),bestImprovement:delta});
    }
    const result=Promise.resolve().then(()=>renderPanels(draft,shown)).then(body=>({body}),error=>({error}));
    return {frame,shown,result};
  }
  async function publish(i,active,{valid=()=>true,onPublished=()=>{},first,inputStart}={}){
    if(!valid())return false;
    const actionStarted=performance.now(),timings=[];
    const queued=active.v2.frames;
    // Interaction messages are snapshots. Reuse only our last confirmed receipt
    // for this exact panel/memo; a menu edit or a fresh reply invalidates it.
    const receipt=mediaReceipts.get(active);
    let currentMessage=receipt?.uncertain?null:receipt&&receipt.memo===active.attachmentMemo&&receipt.message.id===active.displayMessageId&&(receipt.reply===i||i.message?.id===receipt.message.id)?receipt.message:i.message;
    // Repainting/resuming a completed publication never advances combat.
    if(!queued.length&&active.v2.lastFrame)queued.push(active.v2.lastFrame);
    if(!queued.length)throw Error('Missing saved v2 frame');
    const cache=mediaCache();
    let ahead=first&&metadata.every(key=>first.shown.frame.state[key]===(active.state[key]??first.frame.state[key]))?first:null;
    while(queued.length){
      if(!valid())return false;
      // Enrage and the following idle use the same boss artwork. Publish the
      // resolved idle snapshot once, with its new turn and enrage badge together.
      // This changes publication only; both engine snapshots remain in accounting.
      if(queued[0].kind==='enrage'&&queued[1]?.kind==='idle'&&queued[0].state.director.enrageLevel===queued[1].state.director.enrageLevel){
        queued.shift();console.info('[RAID TRANSITION MERGED] enrage + idle');
      }
      const frame=queued[0];active.v2.ready=false;
      const started=performance.now(),cached=ahead?.frame===frame?ahead:null;
      ahead=null;
      const shown=cached?.shown||presentation(active,frame);let body;
      try{
        if(cached){
          const result=await cached.result;
          if(result.error)throw result.error;
          body=result.body;
        }else body=await renderPanels(active,shown);
      }
      catch(error){
        console.error('[RAID RENDER RETRY]',JSON.stringify({kind:frame.kind,hit:frame.hitIndex||0,code:error.code||error.name}));
        // One retry after the worker recreates failed native state. A second
        // failure leaves queued[0] intact so Resume retries the same cut.
        body=await renderPanels(active,shown,[]);
      }
      const controls={id:active.id,ready:shown.ready,ended:frame.kind==='ended'};
      body=holdControls(body,currentMessage,controls);
      const fullBody=async()=>holdControls(await renderPanels(active,shown,[]),currentMessage,controls);
      const bossHit=frame.kind==='boss_attack' ? frame.hitIndex : frame.kind==='idle' ? 'idle' : 0;
      let prepared;
      try{prepared=cache.prepare(active,body,currentMessage,bossHit);}
      catch(error){
        if(error.code!=='RAID_STALE_PANEL')throw error;
        // An intervening edit may have removed the old attachment. Materialize
        // this same resolved frame, without advancing the turn or rerolling it.
        body=await fullBody();
        prepared=cache.prepare(active,body,currentMessage,bossHit);
      }
      if(!valid())return false;
      const rendered=performance.now();
      let retryRenderMs=0;
      let response;
      try{
        try{response=await i.editReply(prepared.body);}
        catch(error){
          // Discord can reject a locally confirmed ID. Retry once with full files.
          if(error.code!==50035||!prepared.body.attachments?.length||!JSON.stringify(error.rawError?.errors||{}).includes('attachments'))throw error;
          if(body.files.some(f=>f.referenceId)){
            const retryStart=performance.now();
            body=await fullBody();
            retryRenderMs=performance.now()-retryStart;
          }
          if(!valid())return false;
          prepared=cache.prepare(active,body,null,bossHit);
          response=await i.editReply(prepared.body);
        }
      }catch(error){
        // A rejected edit can have reached Discord. Keep the last receipt for
        // provenance, but do not reuse its IDs until a new full upload confirms.
        mediaReceipts.set(active,{...(mediaReceipts.get(active)||{}),uncertain:true});
        throw error;
      }
      if(!valid())return false;
      const message=response?.resource?.message||response?.message||response;
      if(!message?.id){mediaReceipts.set(active,{...(mediaReceipts.get(active)||{}),uncertain:true});throw Error('V2 battle publication was not confirmed');}
      cache.remember(active,message,prepared.signatures);
      // Persist a compact receipt before the next edit can fail. Keep
      // only confirmed IDs, not client objects, pixels, or a serializable state field.
      currentMessage={id:message.id,attachments:(active.attachmentMemo?.files||[]).filter(f=>f.id).map(f=>({id:f.id,name:f.name})),components:body.components.filter(c=>c.type===1)};
      mediaReceipts.set(active,{message:currentMessage,memo:active.attachmentMemo,reply:i});
      active.displayMessageId=message.id;active.displayReply=i;active.displayDirty=false;
      const uploaded=performance.now();
      // Keep a confirmed ultimate or its Ragnarok follow-up visibly distinct.
      const reusedBeforeRender=body.files.filter(f=>f.referenceId).map(f=>f.panelKey.split(':')[1]);
      const timing={renderMs:Math.round(rendered-started+retryRenderMs),uploadMs:Math.round(uploaded-rendered-retryRenderMs),dwellMs:0,sentBytes:prepared.body.files.reduce((n,f)=>n+(f.attachment?.length||0),0),files:prepared.body.files.length,keptFiles:prepared.body.attachments.length,reusedBeforeRender,kind:frame.kind,turn:frame.state.turn,enrage:frame.state.director?.enrageLevel||0,hitIndex:frame.hitIndex||0,reaction:frame.reaction||null,controlRows:body.components.filter(c=>c.type===1).length};
      if(!timings.length&&inputStart!==undefined)console.info('[RAID FIRST EDIT]',JSON.stringify({...timing,job:frame.state.config.job,firstEditMs:Math.round(uploaded-inputStart),prefetched:!!cached}));
      if(inputStart!==undefined&&frame.kind==='boss_attack'&&!timings.some(entry=>entry.kind==='boss_attack')){
        console.info('[RAID FIRST IMPACT]',JSON.stringify({...timing,job:frame.state.config.job,firstImpactMs:Math.round(uploaded-inputStart)}));
      }
      if(!valid())return false;
      queued.shift();active.v2.lastFrame=frame;onPublished();
      const ultimate=(frame.kind==='ultimate_hit'||frame.kind==='cancelled')&&frame.log?.ultimate===true;
      const ragnarokHit=frame.state.config.job==='berserker'&&frame.kind==='reaction'&&frame.reaction==='hit'&&['ragnarok_a','ragnarok_defense_a'].includes(frame.state.phase);
      const bossDodge=frame.state.config.boss==='nameless_succubus'&&frame.kind==='reaction'&&frame.reaction==='evade'&&frame.log?.reaction==='evade'&&frame.log.damage===0&&frame.log.charmBlocked!==true;
      const minDwell=ultimate||ragnarokHit?500:bossDodge?320:0;
      if(queued.length&&minDwell){
        // Keep the acknowledged boss Dodge readable before a following cut replaces it.
        // This is post-edit only; initial response, unrelated cuts and existing ult timing stay unchanged.
        const remaining=minDwell-(performance.now()-uploaded);
        if(remaining>0)await wait(Math.ceil(remaining));
        timing.dwellMs=Math.round(performance.now()-uploaded);
      }
      timings.push(timing);console.info('[RAID TURN TIMING]',JSON.stringify(timing));
      if(!valid())return false;
    }
    active.v2.ready=!!active.v2.lastFrame?.interactive&&active.state.status==='active';
    console.info('[RAID ACTION TIMING]',JSON.stringify({frames:timings.length,totalMs:Math.round(performance.now()-actionStarted),renderMs:timings.reduce((n,t)=>n+t.renderMs,0),uploadMs:timings.reduce((n,t)=>n+t.uploadMs,0),dwellMs:timings.reduce((n,t)=>n+t.dwellMs,0)}));
    return true;
  }
  async function reopen(i,active,{valid=()=>true,onPublished=()=>{}}={}){
    const previousReply=active.displayReply,previousMessageId=active.displayMessageId;
    const panel={...active,v2:structuredClone(active.v2),attachmentMemo:null,mediaAttachments:null,view:null};
    const discard=()=>require(runtimePaths.join(root,'raid-async.js')).bounded(()=>i.deleteReply()).catch(()=>{});
    try{
      if(previousMessageId&&(i.deferred||i.replied)&&i.message?.id===previousMessageId)throw Error('Use Join Battle in the boss lobby to reopen');
      if(!i.deferred)await i.deferReply({ephemeral:true});
      if(!valid()){await discard();return false;}
      // Never reuse the public lobby's attachment IDs for the fresh private reply.
      const fresh=Object.create(i);Object.defineProperty(fresh,'message',{value:null});
      for(const key of ['editReply','deleteReply'])if(typeof i[key]==='function')fresh[key]=i[key].bind(i);
      if(!await publish(fresh,panel,{valid,onPublished})||!panel.displayMessageId||panel.displayMessageId===previousMessageId)throw Error('Fresh v2 window was not confirmed');
      if(!valid()){await discard();return false;}
      active.v2=panel.v2;active.view=null;active.displayReply=i;active.displayMessageId=panel.displayMessageId;
      active.attachmentMemo=panel.attachmentMemo;active.mediaAttachments=null;active.displayDirty=false;
      const receipt=mediaReceipts.get(panel);if(receipt)mediaReceipts.set(active,{...receipt,reply:i});
      active.renderedBoss=panel.renderedBoss;active.renderedProfile=panel.renderedProfile;
      if(previousReply)void require(runtimePaths.join(root,'raid-async.js')).bounded(()=>previousReply.deleteReply()).catch(()=>{});
      return true;
    }catch(error){await discard();throw error;}
  }
  return {is,eligible,initialize,step,end,flushAccounting,publish,reopen,primeFirst,revision:active=>is(active)?active.v2.revision:active.state.turn,actions:active=>load(active).actions(),presentation};
}
module.exports={create,holdControls};
