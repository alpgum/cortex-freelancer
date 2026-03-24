/**
 * T05b: Chat Rate Limiter
 * Free=10/day, Pro=200/day. localStorage backed.
 */
(function () {
  'use strict';

  function today() { return new Date().toISOString().slice(0, 10); }
  function key() { return 'cortex_chat_usage_' + today(); }

  function getCount() {
    try { return parseInt(localStorage.getItem(key()), 10) || 0; }
    catch (e) { return 0; }
  }

  function isPro() {
    if (window.CortexPro && typeof window.CortexPro.isPro === 'function') return window.CortexPro.isPro();
    return !!localStorage.getItem('proPreview');
  }

  function limit() { return isPro() ? 200 : 10; }

  function canSend() { return getCount() < limit(); }

  function record() {
    localStorage.setItem(key(), String(getCount() + 1));
  }

  function remaining() { return Math.max(0, limit() - getCount()); }

  window.CortexChatLimiter = { canSend: canSend, record: record, remaining: remaining, limit: limit, isPro: isPro };
})();
