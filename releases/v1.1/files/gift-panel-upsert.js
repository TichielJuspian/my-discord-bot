'use strict';
// One published application panel per server. Never send a duplicate if a read fails.
// The helper only edits a bot-authored panel or sends a new one when no existing panel can be found.
const inFlight = new Map();
const isPanel = (message, botId) => message?.author?.id === botId && Boolean(message.components?.some(
  row => row.components?.some(button => button.customId === 'gift:open')
));
async function upsert({ guildId, channel, botId, settings, payload, allowedChannelId }) {
  if (!guildId || !channel?.id || !botId || !settings || !payload) throw Error('VVIP panel configuration is incomplete.');
  if (allowedChannelId && channel.id !== allowedChannelId) throw Error(`Use the VVIP panel channel <#${allowedChannelId}>.`);
  const key = `${guildId}:${channel.id}`;
  if (inFlight.has(key)) return inFlight.get(key);
  const operation = (async () => {
    const saved = await settings.findOne({ _id: guildId });
    if (saved?.panelChannelId && saved.panelChannelId !== channel.id) throw Error(`Use the VVIP panel channel <#${saved.panelChannelId}>.`);
    let existing = null;
    if (saved?.buttonMessageId) {
      try { existing = await channel.messages.fetch(saved.buttonMessageId); }
      catch (error) { if (error?.code !== 10008) throw error; }
      if (!isPanel(existing, botId)) existing = null;
    }
    if (!existing) {
      // If Discord permissions or history retrieval fail, stop without publishing a duplicate.
      const recent = await channel.messages.fetch({ limit: 100 });
      existing = recent.find(message => isPanel(message, botId)) || null;
    }
    const body = { ...payload, content: '' };
    const message = existing ? await existing.edit(body) : await channel.send(body);
    // A failed DB update is recoverable: a retry discovers the existing panel by its customId.
    await settings.updateOne({ _id: guildId }, { $set: { panelChannelId: channel.id, buttonMessageId: message.id } }, { upsert: true });
    return { messageId: message.id, reused: Boolean(existing) };
  })();
  inFlight.set(key, operation);
  try { return await operation; }
  finally { if (inFlight.get(key) === operation) inFlight.delete(key); }
}
module.exports = { upsert, isPanel };
