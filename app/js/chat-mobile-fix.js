/**
 * CF-095 — Fix chat input losing focus on mobile keyboards
 * Prevents scroll-to-top when mobile keyboard opens, keeps input focused
 */
(function () {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  const CHAT_INPUT_SELECTORS = [
    '#chat-input',
    '.chat-input',
    '[data-chat-input]',
    'textarea[name="chat"]'
  ];

  let _viewport = null;
  let _inputEl = null;
  let _containerEl = null;

  function isMobile() {
    return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
      (window.innerWidth <= 768 && 'ontouchstart' in window);
  }

  function findChatInput() {
    for (var i = 0; i < CHAT_INPUT_SELECTORS.length; i++) {
      var el = document.querySelector(CHAT_INPUT_SELECTORS[i]);
      if (el) return el;
    }
    return null;
  }

  function adjustForKeyboard() {
    if (!_viewport || !_inputEl) return;

    var viewportHeight = _viewport.height;
    var offsetTop = _viewport.offsetTop;

    // Adjust container to account for keyboard
    if (_containerEl) {
      _containerEl.style.height = viewportHeight + 'px';
      _containerEl.style.transform = 'translateY(' + offsetTop + 'px)';
    }

    // Ensure input stays visible
    setTimeout(function () {
      _inputEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }, 100);
  }

  function resetLayout() {
    if (_containerEl) {
      _containerEl.style.height = '';
      _containerEl.style.transform = '';
    }
  }

  function handleFocus(e) {
    if (!isMobile()) return;
    // Prevent default scroll behavior
    e.target.dataset.wasFocused = 'true';
    setTimeout(function () {
      if (_inputEl) {
        _inputEl.scrollIntoView({ block: 'end', behavior: 'smooth' });
      }
    }, 300);
  }

  function handleBlur() {
    if (!isMobile()) return;
    resetLayout();
  }

  function preventScrollOnFocus(el) {
    el.addEventListener('touchstart', function (e) {
      // Store scroll position before focus
      var scrollY = window.scrollY;
      setTimeout(function () {
        if (Math.abs(window.scrollY - scrollY) > 50) {
          window.scrollTo(0, scrollY);
          el.scrollIntoView({ block: 'end', behavior: 'smooth' });
        }
      }, 300);
    }, { passive: true });
  }

  function init() {
    if (!isMobile()) return;

    _inputEl = findChatInput();
    if (!_inputEl) return;

    _containerEl = _inputEl.closest('.chat-container') ||
      _inputEl.closest('[data-chat-container]') ||
      _inputEl.parentElement;

    // Use visualViewport API for accurate keyboard detection
    if (window.visualViewport) {
      _viewport = window.visualViewport;
      _viewport.addEventListener('resize', adjustForKeyboard);
      _viewport.addEventListener('scroll', adjustForKeyboard);
    }

    _inputEl.addEventListener('focus', handleFocus);
    _inputEl.addEventListener('blur', handleBlur);
    preventScrollOnFocus(_inputEl);

    // Prevent iOS bounce scroll
    document.body.style.overscrollBehavior = 'none';
  }

  function destroy() {
    if (_viewport) {
      _viewport.removeEventListener('resize', adjustForKeyboard);
      _viewport.removeEventListener('scroll', adjustForKeyboard);
    }
    if (_inputEl) {
      _inputEl.removeEventListener('focus', handleFocus);
      _inputEl.removeEventListener('blur', handleBlur);
    }
    resetLayout();
  }

  ns.ChatMobileFix = {
    init: init,
    destroy: destroy,
    isMobile: isMobile
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
