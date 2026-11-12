'use strict';
const crypto = require('node:crypto');
const benefits = require('./booster-point-benefits');
function rankPoints(rank) { if (!Number.isSafeInteger(rank) || rank < 1) throw Error('Invalid raid rank'); return rank === 1 ? 500 : rank === 2 ? 400 : rank <= 5 ? 300 : rank <= 25 ? 200 : 100; }
function rewards(rows, success, rewardVersion=3) { let previous = null, rank = 0; return rows.filter(x => Number.isSafeInteger(x.damage) && x.damage > 0).sort((a,b) => b.damage-a.damage).map((x,i) => { if (x.damage !== previous) rank=i+1; previous=x.damage; return { userId:x.id, rank, points:rankPoints(rank)+(success?(rewardVersion===2?1000:900):(rewardVersion===4?100:200)) }; }); }
const VALID_BASES = new Set([200,300,400,500,600,700,1000,1100,1200,1300,1400,1500]);
function validateRow(row, guildId, success, rewardVersion) {
  const basePoints = rankPoints(row.rank) + (success ? (rewardVersion === 2 ? 1000 : 900) : rewardVersion === 4 ? 100 : 200);
  if (row.basePoints !== basePoints) throw Error('Frozen raid base reward mismatch');
  if (row.bonus) benefits.validateSnapshot(row.bonus, { guildId, userId:row.userId, basePoints, points:row.points });
  else if (row.points !== basePoints) throw Error('Unresolved raid reward mismatch');
}
// Version 4 freezes the 900 clear / 100 failure base.
// Version 3 freezes the 900 clear base; version 2 retains its original 1000 clear base.
// Both versions freeze rankings/base immediately, then persist each successful lookup.
// No wallet payout starts until every row has durable final evidence. Old journals are untouched.
async function prepareSettlement(settlement, guildId, persist) {
  if (settlement.rewardVersion === undefined) return;
  if ((settlement.rewardVersion !== 2 && settlement.rewardVersion !== 3 && settlement.rewardVersion !== 4) || !Array.isArray(settlement.rows)) throw Error('Unsupported raid reward journal');
  for (const row of settlement.rows) {
    validateRow(row, guildId, settlement.success, settlement.rewardVersion);
    if (row.bonus) continue;
    const bonus = await benefits.snapshot(guildId, row.userId, row.basePoints);
    benefits.validateSnapshot(bonus, { guildId, userId:row.userId, basePoints:row.basePoints });
    row.bonus = bonus; row.points = bonus.points;
    // A failed persist stops payout. The same in-memory snapshot is re-persisted on retry.
    persist();
  }
  settlement.prepared = true;
  persist();
}
async function credit(db, g, u, raidId, amount, bonus) {
  if (!db) throw Error('Raid points database unavailable');
  if (typeof raidId !== 'string' || !raidId.length || raidId.length > 256) throw Error('Invalid raid receipt identity');
  if (bonus) {
    benefits.validateSnapshot(bonus, { guildId:g, userId:u, points:amount });
    if (!VALID_BASES.has(bonus.basePoints)) throw Error('Invalid boosted raid base points');
  } else if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1500) throw Error('Invalid raid points');
  const wallets = db.collection('community_points'), id = g+'_'+u;
  await wallets.updateOne({_id:id}, {$setOnInsert:{guildId:g,userId:u,balance:0,earned:0,spent:0,visits:0,streak:0,version:0,owned:[],theme:null,badge:null}}, {upsert:true});
  const hash = crypto.createHash('sha256').update(raidId).digest('hex'), key = 'raidRewardReceipts.'+hash;
  for (let attempt=0; attempt<8; attempt++) {
    const wallet = await wallets.findOne({_id:id});
    if (!wallet) throw Error('Raid wallet unavailable');
    if (wallet.raidRewardReceipts?.[hash] !== undefined) return false;
    const filter = {_id:id,[key]:{$exists:false}};
    for (const field of ['balance','earned','version','raidEarned']) {
      const value = wallet[field] ?? 0, delta = field === 'version' ? 1 : amount;
      if (!Number.isSafeInteger(value) || value < 0 || !Number.isSafeInteger(value+delta)) throw Error('Raid wallet total exceeds supported range');
      filter[field] = wallet[field] === undefined ? {$exists:false} : value;
    }
    const result = await wallets.updateOne(filter, {$inc:{balance:amount,earned:amount,version:1,raidEarned:amount},
      $set:{[key]:amount,...(bonus?{['raidRewardEvidence.'+hash]:bonus}:{})}});
    if (result.modifiedCount === 1) return true;
  }
  throw Error('Raid wallet changed; retry the same frozen receipt');
}
module.exports = { rankPoints, rewards, credit, prepareSettlement };
