'use strict';
// Offline interaction-contract tests; not Discord network E2E.
const test = require('node:test');
const assert = require('node:assert/strict');
const { create: createEntry } = require('../raid-entry-flow');
const { createStore: createCharacters } = require('../raid-characters');
const { createShopWindows } = require('../shop-window');

function fakeInteraction(userId, customId = null) {
  return {
    id: 'fake-interaction-' + Math.random().toString(36).slice(2), guildId: 'test-guild', channelId: 'test-channel',
    user: { id: userId, username: 'TestUser', bot: false }, customId,
    acknowledged: [], edits: [], deferred: false, replied: false,
    async deferReply(args) { this.deferred = true; this.acknowledged.push(['deferReply', args]); },
    async deferUpdate() { this.deferred = true; this.acknowledged.push(['deferUpdate']); },
    async update(body) { this.replied = true; this.edits.push(body); this.acknowledged.push(['update']); return { id: 'm' }; },
    async editReply(body) { this.edits.push(body); return { id: 'm' }; },
    async reply(body) { this.replied = true; this.edits.push(body); return { id: 'm' }; },
    async followUp(body) { this.edits.push(body); return { id: 'm' }; },
    async deleteReply() { this.acknowledged.push(['deleteReply']); },
    isChatInputCommand() { return false; }
  };
}
function findCustomId(x, suffix) {
  if (!x || typeof x !== 'object') return null;
  if (typeof x.custom_id === 'string' && x.custom_id.endsWith(':' + suffix)) return x.custom_id;
  for (const child of Object.values(x)) {
    if (Array.isArray(child)) { for (const v of child) { const found = findCustomId(v, suffix); if (found) return found; } }
    else if (child && typeof child === 'object') { const found = findCustomId(child, suffix); if (found) return found; }
  }
  return null;
}

test('raid entry: authorized click advances rules and can select class; another member is denied', async () => {
  const characters = createCharacters({ file: null });
  let starts = 0;
  const context = { boss: 'earth', lobby: { remainingHP: 400000 }, controller: { activeBattle: false } };
  const flow = createEntry({ characters, readLevel: async () => 10,
    valid: c => c === context,
    start: async (_i, c) => { starts++; c.controller.activeBattle = true; },
    render: false });
  const begin = fakeInteraction('alice');
  await flow.begin(begin, context);
  const rules = findCustomId(begin.edits.at(-1), 'rules');
  assert.ok(rules && rules.startsWith('raidprep:'));
  const denied = fakeInteraction('bob', rules);
  assert.equal(await flow.handle(denied), true);
  assert.match(denied.edits.at(-1).content, /expired/i);
  assert.equal(starts, 0);
  const proceed = fakeInteraction('alice', rules);
  assert.equal(await flow.handle(proceed), true);
  assert.equal(proceed.acknowledged[0][0], 'deferUpdate');
  const chooseId = findCustomId(proceed.edits.at(-1), 'choose');
  assert.ok(chooseId);
  const choose = fakeInteraction('alice', chooseId);
  assert.equal(await flow.handle(choose), true);
  assert.equal(starts, 1);
  assert.equal(context.controller.activeBattle, true);
  assert.equal(flow.isOpen('alice'), false);
});

test('raid entry: cancel invalidates stale controls and never starts a battle', async () => {
  const characters = createCharacters({ file: null });
  let starts = 0;
  const context = { boss: 'earth', lobby: { remainingHP: 400000 }, controller: { activeBattle: false } };
  const flow = createEntry({ characters, readLevel: async () => 10, valid: () => true,
    start: async () => { starts++; }, render: false });
  const begin = fakeInteraction('alice'); await flow.begin(begin, context);
  const rulesId = findCustomId(begin.edits.at(-1), 'rules');
  const cancelId = rulesId.replace(/:rules$/, ':cancel');
  const cancel = fakeInteraction('alice', cancelId); await flow.handle(cancel);
  assert.match(cancel.edits.at(-1).components[0].content, /cancelled/i);
  assert.equal(flow.isOpen('alice'), false);
  const stale = fakeInteraction('alice', rulesId); await flow.handle(stale);
  assert.match(stale.edits.at(-1).content, /expired/i);
  assert.equal(starts, 0);
});

test('shop window: private navigation acknowledges clicks without posting to public channel', async () => {
  const timers=[];
  const windows = createShopWindows({schedule:(fn,ms)=>{const t={fn,ms,unref(){}};timers.push(t);return t;}, cancel:()=>{}, idleMs:20000});
  const api = {editMessage: async (_id,payload)=>({id:'private-msg',payload}),deleteMessage: async()=>{}};
  const first = fakeInteraction('alice'); first.isChatInputCommand=()=>true;
  first.webhook=api;
  const window1=await windows.begin(first);
  assert.equal(first.acknowledged[0][0], 'deferReply');
  first.editReply=async payload=>({id:'private-msg',payload});
  const body1 = await window1.editReply({ content: 'Products', components: [] });
  assert.ok(findCustomId(body1.payload,'alice')?.startsWith('points:close:'));
  window1.release();
  const next = fakeInteraction('alice','points:home'); next.webhook=api;
  next.message={id:'private-msg',flags:{has:()=>true}}; next.editReply=async payload=>({id:'private-msg',payload});
  const window2=await windows.begin(next);
  assert.equal(next.acknowledged[0][0], 'deferUpdate');
  const result=await window2.editReply({content:'Category',components:[]});
  assert.equal(result.id,'private-msg');
  window2.release();
  assert.ok(timers.some(x=>x.ms>=19900&&x.ms<=20000));
});
