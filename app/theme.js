// Theme system moved to _includes/js/theme.js — this file loads it for backward compat
(function(){
  if (document.querySelector('script[src*="_includes/js/theme.js"]')) return;
  var s = document.createElement('script');
  s.src = '/app/_includes/js/theme.js';
  document.head.appendChild(s);
})();
