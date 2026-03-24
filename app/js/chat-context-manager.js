/**
 * CF-092 — Fix chat context window — messages exceeding token limit
 * Sliding window for chat history, truncates oldest messages when approaching limit
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const MAX_TOKENS = 100000;
  const RESERVED_TOKENS = 4096; // reserve for response
  const BUDGET = MAX_TOKENS - RESERVED_TOKENS;
  const SYSTEM_MSG_RESERVE = 500;

  // Rough token estimator: ~4 chars per token for English text
  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / 4);
  }

  function estimateMessageTokens(msg) {
    var tokens = 4; // message overhead
    tokens += estimateTokens(msg.role);
    tokens += estimateTokens(msg.content);
    return tokens;
  }

  function trimHistory(messages, systemPrompt) {
    if (!messages || messages.length === 0) return [];

    var systemTokens = systemPrompt ? estimateTokens(systemPrompt) + SYSTEM_MSG_RESERVE : 0;
    var available = BUDGET - systemTokens;

    // Always keep the latest message (user's current input)
    var result = [];
    var totalTokens = 0;

    // Work backwards from newest to oldest
    for (var i = messages.length - 1; i >= 0; i--) {
      var msgTokens = estimateMessageTokens(messages[i]);
      if (totalTokens + msgTokens > available && result.length > 0) {
        break;
      }
      totalTokens += msgTokens;
      result.unshift(messages[i]);
    }

    return result;
  }

  function createSummaryMessage(droppedMessages) {
    if (!droppedMessages || droppedMessages.length === 0) return null;
    var count = droppedMessages.length;
    return {
      role: 'system',
      content: '[Earlier conversation of ' + count + ' messages was truncated to fit context window]'
    };
  }

  function manageContext(messages, systemPrompt) {
    var totalTokens = messages.reduce(function (sum, m) {
      return sum + estimateMessageTokens(m);
    }, 0);

    var systemTokens = systemPrompt ? estimateTokens(systemPrompt) : 0;

    if (totalTokens + systemTokens <= BUDGET) {
      return { messages: messages, truncated: false, estimatedTokens: totalTokens };
    }

    var trimmed = trimHistory(messages, systemPrompt);
    var droppedCount = messages.length - trimmed.length;

    if (droppedCount > 0) {
      var summary = createSummaryMessage(messages.slice(0, droppedCount));
      if (summary) trimmed.unshift(summary);
    }

    var finalTokens = trimmed.reduce(function (sum, m) {
      return sum + estimateMessageTokens(m);
    }, 0);

    return {
      messages: trimmed,
      truncated: droppedCount > 0,
      droppedCount: droppedCount,
      estimatedTokens: finalTokens
    };
  }

  ns.ChatContextManager = {
    manageContext: manageContext,
    trimHistory: trimHistory,
    estimateTokens: estimateTokens,
    estimateMessageTokens: estimateMessageTokens,
    MAX_TOKENS: MAX_TOKENS,
    BUDGET: BUDGET
  };
})();
