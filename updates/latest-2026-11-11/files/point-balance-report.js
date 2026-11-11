'use strict';
const { SlashCommandBuilder, MessageFlags, PermissionFlagsBits } = require('discord.js');
const { randomBytes } = require('node:crypto');
const { PRICE } = require('./point-skin-store');
const OWNER_ID = '170947916167512064', GUILD_ID = '495716062097309697';
const TTL_MS = 10 * 60 * 1000, MAX_SNAPSHOTS = 5, PAGE_SIZE = 10;
const PREFIX = 'points:top:';
const fmt = n => n.toLocaleString('en-US');
function createPointBalanceReport({ now = Date.now } = {}) {
  let db;
  const snapshots = new Map();
  const commands = [new SlashCommandBuilder().setName('pointtop')
    .setDescription('현재 보유 포인트 TOP 30과 MLBB 스킨 목표까지 남은 포인트 (운영자 전용)')
    .setDMPermission(false).setDefaultMemberPermissions(PermissionFlagsBits.Administrator)];
  function prune() {
    const time = now();
    for (const [key, value] of snapshots) if (time >= value.expiresAt) snapshots.delete(key);
  }
  function render(snapshot, token, page) {
    const pages = Math.max(1, Math.ceil(snapshot.rows.length / PAGE_SIZE));
    const lines = snapshot.rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map((r, index) =>
      `${page * PAGE_SIZE + index + 1}위 · <@${r.userId}> · ${fmt(r.balance)}P · 남음 ${fmt(Math.max(0, PRICE - r.balance))}P`);
    return {
      content: `현재 보유 포인트 TOP 30\nMLBB 스킨 목표: ${fmt(PRICE)}P · 누적 획득량이 아닌 현재 잔액 기준\n조회 시각: ${snapshot.at} (UTC)\n\n${lines.join('\n') || '등록된 포인트 잔액이 없습니다.'}\n\n${page + 1}/${pages}페이지 · ${snapshot.rows.length}명 · 같은 잔액은 사용자 ID 순\n10분간 같은 조회 결과를 표시합니다. 새로 조회: /pointtop`,
      allowedMentions: { parse: [] },
      components: pages <= 1 ? [] : [{ type: 1, components: [
        { type: 2, style: 2, custom_id: `${PREFIX}${token}:${page - 1}`, label: '이전', disabled: page === 0 },
        { type: 2, style: 2, custom_id: `${PREFIX}${token}:${page + 1}`, label: '다음', disabled: page === pages - 1 },
      ] }],
    };
  }
  const deny = (i, content) => i.reply({ content, flags: MessageFlags.Ephemeral, allowedMentions: { parse: [] } });
  async function handle(i) {
    const chat = i.isChatInputCommand?.() && i.commandName === 'pointtop';
    const paging = i.customId?.startsWith(PREFIX);
    if (!chat && !paging) return false;
    // Authorization precedes every collection access, query, and snapshot lookup.
    if (i.user?.id !== OWNER_ID || i.user?.bot || i.guildId !== GUILD_ID) {
      await deny(i, '이 서버의 지정 운영자만 조회할 수 있습니다.'); return true;
    }
    prune();
    if (paging) {
      const match = /^points:top:([a-f0-9]{32}):([0-2])$/.exec(i.customId);
      const snapshot = match && snapshots.get(match[1]);
      const page = match ? Number(match[2]) : -1;
      const message = i.message;
      const origin = message?.interactionMetadata?.user?.id || message?.interaction?.user?.id;
      const ephemeral = message?.flags?.has?.(MessageFlags.Ephemeral) === true;
      const botId = i.client?.user?.id;
      if (!i.isButton?.() || !snapshot || snapshot.ownerId !== i.user.id || snapshot.guildId !== i.guildId ||
          !ephemeral || !botId || message.author?.id !== botId || origin !== OWNER_ID ||
          message.id !== snapshot.messageId || i.channelId !== snapshot.channelId ||
          page < 0 || page >= Math.ceil(snapshot.rows.length / PAGE_SIZE)) {
        await deny(i, '이 조회 버튼은 사용할 수 없거나 만료되었습니다. /pointtop으로 다시 조회해 주세요.');
        return true;
      }
      // Only update the verified original private response. Never copy balances to a new response.
      await i.update(render(snapshot, match[1], page));
      return true;
    }
    let deferred = false, token;
    try {
      await i.deferReply({ flags: MessageFlags.Ephemeral }); deferred = true;
      if (!db) throw Error('not ready');
      const rows = await db.collection('community_points').find({
        guildId: GUILD_ID,
        userId: { $type: 'string', $regex: '^\\d{1,22}$' },
        balance: { $type: 'number', $gte: 0, $lte: Number.MAX_SAFE_INTEGER },
        $expr: { $eq: [{ $cond: [{ $isNumber: '$balance' }, { $mod: ['$balance', 1] }, null] }, 0] },
      }).project({ _id: 0, userId: 1, balance: 1 }).sort({ balance: -1, userId: 1 }).limit(30).toArray();
      const valid = rows.filter(r => typeof r.userId === 'string' && /^\d{1,22}$/.test(r.userId) && Number.isSafeInteger(r.balance) && r.balance >= 0)
        .map(r => ({ userId: r.userId, balance: r.balance })).slice(0, 30);
      const time = now();
      const snapshot = { rows: valid, ownerId: OWNER_ID, guildId: GUILD_ID, channelId: i.channelId,
        at: new Date(time).toISOString(), expiresAt: time + TTL_MS, messageId: null };
      token = randomBytes(16).toString('hex');
      prune();
      while (snapshots.size >= MAX_SNAPSHOTS) snapshots.delete(snapshots.keys().next().value);
      snapshots.set(token, snapshot);
      const message = await i.editReply(render(snapshot, token, 0));
      if (!message?.id) snapshots.delete(token);
      else snapshot.messageId = message.id;
    } catch (_) {
      if (token) snapshots.delete(token);
      const payload = { content: '포인트 순위를 불러오지 못했습니다. 잠시 후 /pointtop으로 다시 조회해 주세요.', allowedMentions: { parse: [] }, components: [] };
      if (deferred) await i.editReply(payload);
      else await deny(i, payload.content);
    }
    return true;
  }
  // Binding stores a reference only: no reads, writes, indexes, timers, or startup tasks.
  return { commands, init(database) { db = database; }, handle };
}
module.exports = { createPointBalanceReport };
