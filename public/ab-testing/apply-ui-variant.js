// Apply chat UI variant as CSS hooks.
// Usage: include after /public/ab-testing/cortex-ab.js
(function () {
  if (!window.CortexABTesting) return;
  try {
    const v = window.CortexABTesting.getVariant('chat_ui_v1');
    document.documentElement.dataset.chatUiVariant = v;
    document.body && document.body.classList.add(`ab-ui-${v}`);
  } catch (e) {
    // ignore
  }
})();
