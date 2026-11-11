const boosterBenefits = require('./booster-point-benefits');
const TIME_ZONE = 'America/Los_Angeles';
const DAILY_POINTS = 200;
const WEEKLY_BONUS = 300;
const MONTHLY_BONUS = 500;
const MEDIA_POINTS = Object.freeze({ photo: 100, video: 1000 });
function attendanceReward(streak) {
  const weekly = streak % 7 === 0 ? WEEKLY_BONUS : 0;
  const monthly = streak % 30 === 0 ? MONTHLY_BONUS : 0;
  return { base: DAILY_POINTS, weekly, monthly, total: DAILY_POINTS + weekly + monthly };
}
const { SLOTS, BASE_PRICES, ACCESSORIES } = require('./profile-accessories');
const {NEW_PIECES,SETS,LEGACY_SETS,ownsItem}=require('./profile-sets');
const premiumPieceIds=new Set(SETS.flatMap(s=>Object.values(s.pieces)));
let themeIndex = 0;
const CATALOG = Object.freeze([
  { id: 'badge_spark', type: 'badge', name: 'Little Spark', emoji: '✨', price: 100 },
  { id: 'badge_heart', type: 'badge', name: 'Community Heart', emoji: '💙', price: 150 },
  { id: 'badge_crown', type: 'badge', name: 'Golden Crown', emoji: '👑', price: 200 },
  ...[
    ['mint', 'Mint Garden', '🍃', 150, 0x6ee7b7, 'Common', 'leaves', '#102923'],
    ['ocean', 'Ocean Blue', '🌊', 200, 0x38bdf8, 'Common', 'waves', '#10283d'],
    ['sunset', 'California Sunset', '🌅', 250, 0xfb923c, 'Common', 'sunset', '#321c2f'],
    ['galaxy', 'Midnight Galaxy', '🌌', 300, 0xa78bfa, 'Common', 'stars', '#221b3e'],
    ['sakura', 'Sakura Breeze', '🌸', 500, 0xf9a8d4, 'Rare', 'sakura', '#342036'],
    ['arctic', 'Arctic Glass', '❄️', 650, 0x67e8f9, 'Rare', 'ice', '#112e40'],
    ['bamboo', 'Jade Sanctuary', '🎋', 800, 0x34d399, 'Rare', 'bamboo', '#11332d'],
    ['desert', 'Desert Mirage', '🏜️', 1000, 0xfcd34d, 'Rare', 'dunes', '#392a20'],
    ['cyber', 'Neon Circuit', '⚡', 1500, 0x22d3ee, 'Epic', 'circuit', '#15253e'],
    ['moon', 'Moonlit Shrine', '🌙', 1800, 0xc4b5fd, 'Epic', 'moon', '#272345'],
    ['volcano', 'Crimson Forge', '🌋', 2100, 0xfb7185, 'Epic', 'forge', '#3c1827'],
    ['abyss', 'Abyssal Leviathan', '🐙', 2400, 0x2dd4bf, 'Epic', 'abyss', '#103638'],
    ['royal', 'Royal Sovereign', '👑', 3000, 0xf5d782, 'Legendary', 'royal', '#342944'],
    ['phoenix', 'Phoenix Ascendant', '🔥', 3500, 0xffb454, 'Legendary', 'phoenix', '#3b2227'],
    ['dragon', 'Emerald Dragon', '🐉', 4000, 0x86efac, 'Legendary', 'dragon', '#18392f'],
    ['valkyrie', 'Valkyrie Wings', '🪽', 4500, 0xc7d2fe, 'Legendary', 'wings', '#252e49'],
    ['celestial', 'Celestial Oracle', '🔮', 5000, 0xf0abfc, 'Mythic', 'oracle', '#352044'],
    ['eclipse', 'Eclipse Monarch', '🌑', 6000, 0xfbbf24, 'Mythic', 'eclipse', '#302530'],
    ['void', 'Void Emperor', '🌀', 7000, 0xa78bfa, 'Mythic', 'void', '#2c184c'],
    ['genesis', 'Genesis Eternal', '💎', 8000, 0x99f6e4, 'Mythic', 'genesis', '#163c43'],
  ].map(([id, name, emoji, price, color, styleTier, art, backdrop], index) => ({ id: `theme_${id}`, type: 'theme', name, emoji, price, color, rarity: index < 10 ? 'Rare' : 'Epic', styleTier, art, backdrop })),
  ...[
    ['solar_throne', 'Solar Throne', '☀️', 9000, 0xffd477, 'Legendary', 'solar', '#392515', '#fff3bf'],
    ['frost_paladin', 'Frost Paladin', '❄️', 10000, 0x9beaff, 'Legendary', 'frost', '#173645', '#e3fbff'],
    ['crimson_regent', 'Crimson Regent', '🌹', 11000, 0xff829b, 'Legendary', 'regent', '#421c30', '#ffd4a0'],
    ['astral_seraph', 'Astral Seraph', '👼', 14000, 0xffe5a8, 'Mythic', 'seraph', '#292550', '#a5f5ff'],
    ['cosmic_dragon', 'Cosmic Dragon', '🐲', 16000, 0xc1a2ff, 'Mythic', 'cosmos', '#30184a', '#65f4e3'],
    ['eternal_dawn', 'Eternal Dawn', '🌟', 18000, 0xffe2b5, 'Mythic', 'dawn', '#3a2441', '#ffb7e5'],
  ].map(([id, name, emoji, price, color, rarity, art, backdrop, secondary]) => ({ id: `theme_${id}`, type: 'theme', name, emoji, price, color, rarity, art, backdrop, secondary, premium: true })),
  ...[
    ['thunder_wolf', 'Thunder Wolf', '🐺', 4500, 0x5de0ff, 'Epic', 'wolf', '#122e43', '#a5b4fc'],
    ['runeblade', 'Runeblade', '⚔️', 5500, 0xc89bff, 'Epic', 'runeblade', '#2b1b40', '#f0c2ff'],
    ['crystal_lotus', 'Crystal Lotus', '🪷', 6500, 0xff9ed6, 'Epic', 'lotus', '#392039', '#92efe1'],
    ['obsidian_shogun', 'Obsidian Shogun', '👹', 11500, 0xf4c468, 'Legendary', 'shogun', '#332126', '#ff826d'],
    ['tidal_empress', 'Tidal Empress', '🔱', 12000, 0x69e8e5, 'Legendary', 'tidal', '#12343f', '#d0efff'],
    ['nine_tailed_inferno', 'Nine-Tailed Inferno', '🦊', 13000, 0xffbb78, 'Legendary', 'fox', '#3d222c', '#ffd1e6'],
  ].map(([id, name, emoji, price, color, rarity, art, backdrop, secondary]) => ({ id: `theme_${id}`, type: 'theme', name, emoji, price, color, rarity, art, backdrop, secondary, premium: true, release: 'expansion2' })),
].map(item => item.type === 'theme' ? { ...item, legacyPrice: item.price, price: BASE_PRICES[themeIndex++], remastered: true, styleTier: 'Legendary' } : item).concat(ACCESSORIES,NEW_PIECES).map(item=>{
  if(item.saleCategory==='anime')return item;
  if(premiumPieceIds.has(item.id)||['frame','glow'].includes(item.type))return {...item,saleable:false,bundleOnly:premiumPieceIds.has(item.id)};
  return item.type==='theme'?{...item,price:1000,saleCategory:'regular'}:item;
}).map(item => item.saleable !== false && item.price > 0 ? { ...item, price: item.price + 2000 } : item).map(Object.freeze));
function pacificDay(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = type => parts.find(p => p.type === type).value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const dayNumber = day => Date.parse(`${day}T00:00:00Z`) / 86400000;
const itemById = id => CATALOG.find(item => item.id === id)||SETS.find(item=>item.id===id)||LEGACY_SETS.find(item=>item.id===id);
function assertCredit(old, amount) {
  if (!Number.isSafeInteger(amount) || amount < 0) throw new Error('Invalid earned points');
  for (const field of ['balance', 'earned', 'version']) {
    const value = old[field] ?? 0, increment = field === 'version' ? 1 : amount;
    if (!Number.isSafeInteger(value) || !Number.isSafeInteger(value + increment)) throw new Error('Invalid point balance');
  }
}
function createPointsStore() {
  let wallets, clipSubmissions;
  async function init(db) { wallets = db.collection('community_points'); clipSubmissions = db.collection('community_clip_submissions'); }
  async function wallet(guildId, userId) {
    if (!wallets) throw new Error('The points desk is warming up. Please try again soon.');
    const id = `${guildId}_${userId}`;
    const existing = await wallets.findOne({ _id: id });
    if (existing) return existing;
    try {
      return await wallets.findOneAndUpdate({ _id: id }, { $setOnInsert: { guildId, userId, balance: 0, earned: 0, spent: 0, visits: 0, streak: 0, version: 0, owned: [], theme: null, badge: null } }, { upsert: true, returnDocument: 'after' });
    } catch (e) { if (e.code !== 11000) throw e; }
    return wallets.findOne({ _id: id });
  }
  async function checkIn(guildId, userId, now = new Date()) {
    const day = pacificDay(now);
    for (let attempt = 0; attempt < 8; attempt++) {
      const old = await wallet(guildId, userId);
      if (old.lastDay && old.lastDay >= day) return { credited: false, wallet: old, day };
      const streak = old.lastDay && dayNumber(day) - dayNumber(old.lastDay) === 1 ? old.streak + 1 : 1;
      const baseReward = attendanceReward(streak);
      const booster = await boosterBenefits.snapshot(guildId, userId, baseReward.total);
      const reward = { ...baseReward, baseTotal: baseReward.total, boosterBonus: booster.bonusPoints, total: booster.points, booster };
      assertCredit(old, reward.total);
      if (!Number.isSafeInteger(streak) || !Number.isSafeInteger((old.visits ?? 0) + 1)) throw new Error('Invalid attendance count');
      const updated = await wallets.findOneAndUpdate({ _id: old._id, version: old.version }, {
        $set: { lastDay: day, streak, lastCheckInAt: now, lastAttendanceReward: reward },
        $inc: { balance: reward.total, earned: reward.total, visits: 1, version: 1 },
      }, { returnDocument: 'after' });
      if (updated) return { credited: true, wallet: updated, day, reward };
    }
    throw new Error('Your points are being updated. Try again in a moment.');
  }
  async function buy(guildId, userId, itemId) {
    const item = itemById(itemId);
    if (!item) throw new Error('That item is not available. Open the shop again.');
    if(item.saleable===false)throw new Error(item.bundleOnly?'This piece is available only in a premium set. Open Premium sets to preview the complete look.':'This item is no longer sold separately. Open the updated shop.');
    const old = await wallet(guildId, userId);
    if (ownsItem(old,item)) return { purchased: false, wallet: old, item };
    const bundle=item.type==='set',granted=bundle?[item.id,...Object.values(item.pieces)]:null;
    // Delivery and charge are the same atomic document update. No separate grant can fail.
    const updated = await wallets.findOneAndUpdate({ _id: old._id, balance: { $gte: item.price }, owned: { $ne: item.id } }, {
      $inc: { balance: -item.price, spent: item.price, version: 1 },
      $addToSet: { owned: bundle?{$each:granted}:item.id },
      $set: { ...(bundle?item.pieces:item.saleCategory==='anime'?{theme:item.id,frame:null,glow:null}:{[item.type]:item.id}), lastPurchase: { itemId: item.id, price: item.price, at: new Date() } },
    }, { returnDocument: 'after' });
    if (updated) return { purchased: true, wallet: updated, item };
    const current = await wallet(guildId, userId);
    if (ownsItem(current,item)) return { purchased: false, wallet: current, item };
    throw new Error(`You need ${Math.max(0, item.price - current.balance)} more points for ${item.name}. Your points have not been spent. 💙`);
  }
  // Receipts and credited totals move together in one wallet CAS update.
  async function earnedMedia(guildId, userId, basePoints, alreadyPaid, receipt, prepared) {
    let booster = prepared?.booster;
    if (booster) boosterBenefits.validateSnapshot(booster, { guildId, userId, basePoints });
    for (let attempt = 0; attempt < 8; attempt++) {
      const old = await wallet(guildId, userId);
      if (prepared?.alreadyPaid || alreadyPaid(old)) return { credited: false, amount: 0, wallet: old };
      booster ||= await boosterBenefits.snapshot(guildId, userId, basePoints);
      assertCredit(old, booster.points);
      const updated = await wallets.findOneAndUpdate({ _id: old._id, version: old.version }, {
        ...receipt, $set: { ...receipt.$set, lastMediaReward: booster },
        $inc: { balance: booster.points, earned: booster.points, version: 1 },
      }, { returnDocument: 'after' });
      if (updated) return { credited: true, amount: booster.points, baseAmount: basePoints, boosterBonus: booster.bonusPoints, booster, wallet: updated };
    }
    throw new Error('Your points are being updated. Try again in a moment.');
  }
  function mediaPaid(old, hash, kind, day) {
    return kind === 'photo'
      ? !!old.photoRewardDays?.includes(day) || old.lastPhotoDay === day || (old.lastMediaKind === 'photo' && old.lastMediaDay === day) || !!old.mediaHashes?.includes(hash)
      : !!old.clipRewardDays?.includes(day) || !!old.clipHashes?.includes(hash) || !!old.mediaHashes?.includes(hash);
  }
  function validateMedia(hash, kind) {
    if (!/^[a-f0-9]{64}$/.test(hash) || !['photo', 'video'].includes(kind)) throw new Error('A valid photo or video is required.');
  }
  // Finish BEFORE publication. Reuse this frozen decision and original Pacific day.
  async function prepareMediaReward(guildId, userId, hash, kind, now = new Date()) {
    validateMedia(hash, kind);
    const day = pacificDay(now), old = await wallet(guildId, userId);
    const alreadyPaid = mediaPaid(old, hash, kind, day);
    const booster = alreadyPaid ? null : Object.freeze({ ...boosterBenefits.validateSnapshot(
      await boosterBenefits.snapshot(guildId, userId, MEDIA_POINTS[kind]), { guildId, userId, basePoints: MEDIA_POINTS[kind] }) });
    return Object.freeze({ guildId, userId, hash, kind, day, alreadyPaid, booster });
  }
  function validatePrepared(prepared, guildId, userId, hash, kind, day) {
    if (!prepared) return;
    if (prepared.guildId !== guildId || prepared.userId !== userId || prepared.hash !== hash || prepared.kind !== kind || prepared.day !== day ||
        typeof prepared.alreadyPaid !== 'boolean' || (!prepared.alreadyPaid && !prepared.booster)) throw new Error('Media reward preflight does not match the upload.');
    if (prepared.booster) boosterBenefits.validateSnapshot(prepared.booster, { guildId, userId, basePoints: MEDIA_POINTS[kind] });
  }
  async function mediaBonus(guildId, userId, hash, kind, now = new Date(), prepared) {
    if (kind !== 'photo') throw new Error('Clip rewards require moderator approval after publication.');
    validateMedia(hash, kind);
    const day = pacificDay(now);
    validatePrepared(prepared, guildId, userId, hash, kind, day);
    return earnedMedia(guildId, userId, MEDIA_POINTS.photo,
      old => mediaPaid(old, hash, kind, day),
      { $max: { lastPhotoDay: day }, $set: { lastMediaDay: day, lastMediaKind: kind }, $addToSet: { photoRewardDays: day, mediaHashes: hash } }, prepared);
  }
  async function videoBonus(guildId, userId, hash, publicMessageId, now = new Date(), prepared) {
    validateMedia(hash, 'video');
    if (!publicMessageId) throw new Error('A published video is required.');
    const day = pacificDay(now);
    validatePrepared(prepared, guildId, userId, hash, 'video', day);
    return earnedMedia(guildId, userId, MEDIA_POINTS.video,
      old => mediaPaid(old, hash, 'video', day),
      { $addToSet: { clipRewardDays: day, clipHashes: hash, rewardedVideoMessageIds: String(publicMessageId) } }, prepared);
  }
  async function clipBonus(guildId, userId, submissionId) {
    const clip = await clipSubmissions.findOne({ _id: submissionId, guildId, userId, status: 'posted' });
    if (!clip?.approvedBy || !clip.publicMessageId || !/^\d{4}-\d{2}-\d{2}$/.test(clip.bonusDay || '') || !/^[a-f0-9]{64}$/.test(clip.hash || '')) throw new Error('The clip must be approved and published before points can be awarded.');
    const result = await earnedMedia(guildId, userId, MEDIA_POINTS.video,
      old => old.rewardedClipIds?.includes(clip._id) || old.clipRewardDays?.includes(clip.bonusDay) || old.clipHashes?.includes(clip.hash) || old.mediaHashes?.includes(clip.hash),
      { $addToSet: { rewardedClipIds: clip._id, clipRewardDays: clip.bonusDay, clipHashes: clip.hash } });
    return { ...result, rewarded: !!result.wallet.rewardedClipIds?.includes(clip._id) };
  }
  async function equip(guildId, userId, type, id) {
    if(type==='set') {
      const item=itemById(id);
      if(item?.type!=='set')throw new Error('Choose a complete profile set.');
      await wallet(guildId,userId);
      const updated=await wallets.findOneAndUpdate({_id:`${guildId}_${userId}`,owned:{$all:Object.values(item.pieces)}},{$set:{...item.pieces},$inc:{version:1}},{returnDocument:'after'});
      if(!updated)throw new Error('Unlock all pieces of this set first.');
      return updated;
    }
    if (!SLOTS.includes(type)) throw new Error('Choose a design, glow, frame or badge.');
    const item = id === 'default' ? null : itemById(id);
    if (id !== 'default' && (!item || item.type !== type)) throw new Error('That item does not match this slot.');
    const old = await wallet(guildId, userId);
    const updated = await wallets.findOneAndUpdate({ _id: old._id, ...(item ? { owned: item.id } : {}) }, {
      $set: { [type]: item?.id || null,...(item?.saleCategory==='anime'?{frame:null,glow:null}:{}) }, $inc: { version: 1 },
    }, { returnDocument: 'after' });
    if (!updated) throw new Error('Unlock this item in the shop first.');
    return updated;
  }
  return { init, wallet, checkIn, buy, equip, prepareMediaReward, mediaBonus, videoBonus, clipBonus };
}
module.exports = { createPointsStore, pacificDay, CATALOG, DAILY_POINTS, WEEKLY_BONUS, MONTHLY_BONUS, MEDIA_POINTS, attendanceReward, TIME_ZONE, itemById };
