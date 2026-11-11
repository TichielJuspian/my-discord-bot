'use strict';
const { randomUUID } = require('node:crypto');
const PRICE = 90000, MAX_DIAMONDS = 1199, PRODUCT_VERSION = 'mlbb-under1200-v2';
const ACTIVE_STATES = ['purchased', 'submitted', 'changes'];
function validateRequest({ account, server, item, diamonds, notes = '' }) {
  if (!/^\d{1,20}$/.test(account || '') || !/^\d{1,12}$/.test(server || '')) throw Error('Enter digits only for MLBB ID and server/Zone ID.');
  if (!item?.trim() || item.trim().length > 150) throw Error('Enter the exact giftable skin, hero or item name (up to 150 characters).');
  if (!/^[1-9]\d{0,3}$/.test(String(diamonds)) || Number(diamonds) > MAX_DIAMONDS) throw Error('The in-game gift price must be 1–1,199 Diamonds (strictly under 1,200).');
  if (notes.length > 500) throw Error('Notes must be 500 characters or fewer.');
  return { account, server, item: item.trim(), diamonds: Number(diamonds), notes: notes.trim() };
}
function createSkinStore({ db, mongo, guildId, operatorId, clock = () => new Date() }) {
  const orders = db.collection('point_skin_orders'), wallets = db.collection('community_points'), events = db.collection('point_skin_events');
  const requireOwner = actor => { if (actor !== operatorId) throw Error('Only Gosu General can manage delivery or refund requests.'); };
  const tx = work => mongo.withSession(session => session.withTransaction(() => work(session)));
  async function init() {
    await orders.createIndex({ guildId: 1, userId: 1 }, { unique: true, partialFilterExpression: { active: true } });
    await orders.createIndex({ guildId: 1, status: 1, createdAt: 1 });
    await events.createIndex({ orderId: 1, at: 1 });
  }
  async function audit(order, kind, actorId, detail, session) {
    await events.insertOne({ _id: `${order._id}:${order.revision}`, guildId, orderId: order._id, userId: order.userId, kind, actorId, at: clock(), detail }, { session });
  }
  async function purchase(userId, orderId, version) {
    if (version !== PRODUCT_VERSION || !/^[a-f0-9-]{36}$/.test(orderId)) throw Error('Open a fresh product preview before purchasing.');
    try { return await tx(async session => {
      const repeated = await orders.findOne({ _id: orderId, guildId, userId }, { session });
      if (repeated) return { order: repeated, charged: false };
      const active = await orders.findOne({ guildId, userId, active: true }, { session });
      if (active) return { order: active, charged: false };
      const wallet = await wallets.findOneAndUpdate({ _id: `${guildId}_${userId}`, balance: { $gte: PRICE } }, { $inc: { balance: -PRICE, spent: PRICE, version: 1 } }, { returnDocument: 'after', session });
      if (!wallet) throw Error(`You need ${PRICE.toLocaleString()} points. No points were spent.`);
      const order = { _id: orderId, guildId, userId, productVersion: PRODUCT_VERSION, price: PRICE, maxDiamonds: MAX_DIAMONDS, status: 'purchased', active: true, revision: 0, createdAt: clock(), updatedAt: clock(), notifiedRevision: -1 };
      await orders.insertOne(order, { session }); await audit(order, 'PURCHASE', userId, { price: PRICE, balanceAfter: wallet.balance }, session);
      return { order, charged: true };
    }); } catch(e) {
      // A competing distinct purchase may lose the unique active-order race.
      if (e.code === 11000) { const order = await orders.findOne({ guildId, userId, active: true }); if (order) return { order, charged: false }; }
      throw e;
    }
  }
  async function submit(userId, orderId, revision, fields) {
    const details = validateRequest(fields);
    return tx(async session => {
      const order = await orders.findOneAndUpdate({ _id: orderId, guildId, userId, active: true, revision, status: { $in: ['purchased', 'changes', 'submitted'] } }, { $set: { request: details, status: 'submitted', updatedAt: clock() }, $inc: { revision: 1 } }, { returnDocument: 'after', session });
      if (!order) throw Error('This request changed or is already complete. Reopen your ticket for the latest form.');
      await audit(order, 'SUBMIT', userId, details, session); return order;
    });
  }
  async function decision(actorId, orderId, revision, action, detail) {
    requireOwner(actorId);
    if (!['fulfilled', 'changes', 'refunded'].includes(action)) throw Error('Invalid request action.');
    if (!detail.reason?.trim()) throw Error('A delivery reference or reason is required.');
    if (action === 'fulfilled') {
      if (!detail.item?.trim() || !Number.isInteger(detail.diamonds) || detail.diamonds < 1 || detail.diamonds > MAX_DIAMONDS) throw Error('Confirm the gift actually sent and its price below 1,200 Diamonds.');
    }
    return tx(async session => {
      const order = await orders.findOneAndUpdate({ _id: orderId, guildId, active: true, revision, status: { $in: action === 'refunded' ? ACTIVE_STATES : ['submitted'] } }, { $set: { status: action, active: action === 'changes', decision: { actorId, ...detail, at: clock() }, updatedAt: clock() }, $inc: { revision: 1 } }, { returnDocument: 'after', session });
      if (!order) throw Error('This request changed or was already processed. Nothing was charged or refunded again.');
      if (action === 'refunded') {
        const wallet = await wallets.findOneAndUpdate({ _id: `${guildId}_${order.userId}` }, { $inc: { balance: order.price, spent: -order.price, version: 1 } }, { returnDocument: 'after', session });
        if (!wallet) throw Error('Wallet unavailable. Refund was not committed.');
      }
      await audit(order, action.toUpperCase(), actorId, detail, session); return order;
    });
  }
  return { init, purchase, submit, decision,
    newId: randomUUID,
    get: id => orders.findOne({ _id: id, guildId }),
    latest: userId => orders.find({ guildId, userId }).sort({ createdAt: -1, _id: -1 }).limit(1).toArray().then(rows => rows[0]),
    active: () => orders.find({ guildId, active: true }).sort({ createdAt: 1 }).toArray(),
    pendingNotifications: () => orders.find({ guildId, $expr: { $lt: ['$notifiedRevision', '$revision'] } }).limit(25).toArray(),
    balance: userId => wallets.findOne({ _id: `${guildId}_${userId}` }).then(w => w?.balance || 0),
    claimChannel: (id, key) => orders.findOneAndUpdate({ _id: id, guildId, $or: [{ channelLeaseUntil: { $exists: false } }, { channelLeaseUntil: { $lt: clock() } }] }, { $set: { channelLease: key, channelLeaseUntil: new Date(clock().getTime() + 60000) } }, { returnDocument: 'after' }),
    saveChannel: (id, key, channelId) => orders.updateOne({ _id: id, guildId, channelLease: key }, { $set: { channelId }, $unset: { channelLease: '', channelLeaseUntil: '' } }),
    releaseChannel: (id, key) => orders.updateOne({ _id: id, guildId, channelLease: key }, { $unset: { channelLease: '', channelLeaseUntil: '' } }),
    savePanel: (id, panelMessageId) => orders.updateOne({ _id: id, guildId }, { $set: { panelMessageId } }),
    notified: (id, revision) => orders.updateOne({ _id: id, guildId, revision }, { $set: { notifiedRevision: revision } }),
  };
}
module.exports = { PRICE, MAX_DIAMONDS, PRODUCT_VERSION, createSkinStore, validateRequest };
