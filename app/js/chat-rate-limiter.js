/**
 * CF-091 — Chat rate limiting — 10 messages per minute per user (client-side)
 * Client-side rate limiter to complement server-side IP-based limiting
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const MAX_MESSAGES = 10;
  const WINDOW_MS = 60 * 1000; // 1 minute
  const COOLDOWN_WARN_THRESHOLD = 8;

  let _timestamps = [];
  let _onLimitCallbacks = [];

  function cleanOldTimestamps() {
    var cutoff = Date.now() - WINDOW_MS;
    _timestamps = _timestamps.filter(function (t) { return t > cutoff; });
  }

  function canSend() {
    cleanOldTimestamps();
    return _timestamps.length < MAX_MESSAGES;
  }

  function remainingMessages() {
    cleanOldTimestamps();
    return Math.max(0, MAX_MESSAGES - _timestamps.length);
  }

  function timeUntilNextSlot() {
    cleanOldTimestamps();
    if (_timestamps.length < MAX_MESSAGES) return 0;
    return Math.max(0, _timestamps[0] + WINDOW_MS - Date.now());
  }

  function recordMessage() {
    cleanOldTimestamps();
    if (_timestamps.length >= MAX_MESSAGES) {
      var waitMs = timeUntilNextSlot();
      _onLimitCallbacks.forEach(function (fn) { fn(waitMs); });
      return false;
    }
    _timestamps.push(Date.now());

    if (_timestamps.length >= COOLDOWN_WARN_THRESHOLD) {
      var left = MAX_MESSAGES - _timestamps.length;
      console.info('[ChatRateLimit] ' + left + ' messages remaining in this window');
    }
    return true;
  }

  function onRateLimited(fn) {
    _onLimitCallbacks.push(fn);
  }

  function getStatus() {
    cleanOldTimestamps();
    return {
      used: _timestamps.length,
      remaining: remainingMessages(),
      limit: MAX_MESSAGES,
      windowMs: WINDOW_MS,
      nextSlotIn: timeUntilNextSlot()
    };
  }

  function reset() {
    _timestamps = [];
  }

  ns.ChatRateLimiter = {
    canSend: canSend,
    recordMessage: recordMessage,
    remainingMessages: remainingMessages,
    timeUntilNextSlot: timeUntilNextSlot,
    onRateLimited: onRateLimited,
    getStatus: getStatus,
    reset: reset
  };
})();
