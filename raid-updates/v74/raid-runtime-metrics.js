'use strict';
// Sample process memory at most once per 30 seconds across all active battles.
// This is diagnostic output only: it never changes a player's state or timers.
let nextSample = 0;
module.exports = function sampleMemory() {
  const now = Date.now();
  if (now < nextSample) return undefined;
  nextSample = now + 30000;
  const renderer = require('./raid-render-worker').stats();
  return {
    ...process.memoryUsage(),
    renderer: renderer ? {
      pid: renderer.pid,
      queued: renderer.queued,
      queueBytes: renderer.queueBytes,
      // A separate process is not included in the bot's RSS above.
      lastRenderRSS: renderer.pid ? renderer.memory?.rss : 0,
      lastRenderHeap: renderer.pid ? renderer.memory?.heapUsed : 0,
    } : null,
  };
};
