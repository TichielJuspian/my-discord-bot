'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const root = path.resolve(__dirname, '..');

test('VVIP and community slash-command registration removes duplicates, retains private recovery commands', () => {
  const gifts = require('../gift-system').createGifts({ client: { user: { id:'bot' }, on:()=>{} }, isAdmin:()=>false, operatorId:'owner', modRole:'mod' });
  const registered = gifts.commands.map(c=>c.name);
  for (const obsolete of ['gift','giftpreview']) assert(!registered.includes(obsolete),obsolete);
  for (const recovery of ['giftsetup','giftpanel','giftqueue','giftverify','giftextra']) {
    const cmd = gifts.commands.find(c=>c.name===recovery);
    assert(cmd,recovery);
    assert(BigInt(cmd.toJSON().default_member_permissions) > 0n,`${recovery} must remain admin-only`);
  }
  const views = require('../community-views').createCommunityViews({client:{}});
  assert(!views.commands.some(c=>c.name==='rank'));
  assert(views.commands.some(c=>c.name==='leaderboard'));
});

test('new community panel has no rank-specific button or obsolete slash command but retains profile and leaderboard', () => {
  const {showcasePanel,guidePanel}=require('../community-panels');
  const route={shop:'1',daily:'2',showcase:'3',guide:'4',gift:'5',publicCardChannels:['3']};
  const panel=showcasePanel('g',route);
  const ids=panel.components[0].components.map(x=>x.data.custom_id||x.data.url);
  assert(ids.includes('points:profile'));
  assert(ids.includes('community:leaderboard'));
  assert(!ids.includes('community:rank'));
  const desc=panel.embeds[0].data.description;
  assert(!desc.includes('/rank'));
  const guide=guidePanel('g',route).embeds[0].data.fields.map(x=>x.value).join('\n');
  assert(!guide.includes('/rank'));
});

test('existing community:rank buttons remain routed to the full profile card', async () => {
  const views=require('../community-views');
  const card=require('../community-cards');
  const originalRender=card.renderProfileAsync, originalAvatar=card.avatarData;
  card.renderProfileAsync=async()=>Buffer.from('test-image');
  card.avatarData=async()=>null;
  try {
    const view=views.createCommunityViews({client:{}});
    await view.init({collection(name){ if(name==='user_xp')return {findOne:async()=>({level:5,xp:2800}),countDocuments:async()=>3};return {findOne:async()=>({balance:99,owned:[]})};}});
    const responses=[];
    const interaction={isChatInputCommand:()=>false,customId:'community:rank',guildId:'guild',channelId:'channel',
      user:{id:'person',username:'Example',globalName:'Example'},deferReply:async()=>{},editReply:async x=>responses.push(x),
      reply:async x=>responses.push(x)};
    assert.equal(await view.handle(interaction),true);
    assert.equal(responses.length,1);
    assert.equal(responses[0].files?.[0]?.name,'community-profile.png');
  } finally {card.renderProfileAsync=originalRender;card.avatarData=originalAvatar;}
});

test('boost administrator information displays +10% per stack and keeps command private', async () => {
  const benefits=require('../booster-point-benefits');
  const original=benefits.information;
  benefits.information=async()=>({active:true,effectiveCount:2,registration:{current:true,count:2},premiumSince:null,source:'manual'});
  try {
    const {createBoosterAdmin}=require('../booster-point-admin');
    const admin=createBoosterAdmin({guildId:'guild',operatorId:'owner'});
    const info=admin.commands.find(c=>c.name==='boostinfo');
    assert(BigInt(info.toJSON().default_member_permissions)>0n);
    let output='';
    const i={id:'click',guildId:'guild',guild:{id:'guild'},user:{id:'owner'},commandName:'boostinfo',
      isChatInputCommand:()=>true,options:{getUser:()=>({id:'member',bot:false})},
      deferReply:async()=>{},editReply:async x=>{output=x.content;}};
    assert.equal(await admin.handle(i),true);
    assert.match(output,/\+20% raid ATK/); // Two stacks × 10%, never 40%.
    assert(!output.includes('+40% raid ATK'));
  } finally {benefits.information=original;}
});

test('source references no removed slash-command registration while retaining old button compatibility',()=>{
  const fs=require('fs');
  const content=n=>fs.readFileSync(path.join(root,n),'utf8');
  assert(!content('gift-entry.js').includes('Use /gift for your VVIP'));
  assert(!content('community-layout.js').includes('**/rank**'));
  assert(content('community-views.js').includes("'community:rank'"));
  assert(content('gift-system.js').includes("btn('gift:open'"));
});
