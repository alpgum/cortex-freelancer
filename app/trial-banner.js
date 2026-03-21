// Trial expiry in-app banner
// Shows "Trial ends in X days" when user is on a trial
(function() {
  function getTrialEnd() {
    try {
      var data = JSON.parse(localStorage.getItem('cortex_trial'));
      if (data && data.endDate) return new Date(data.endDate);
    } catch(e) {}
    // Fallback: check if pro was activated recently (within 7 days)
    try {
      var pro = localStorage.getItem('cortex_pro');
      var proTs = localStorage.getItem('cortex_pro_activated');
      if (pro === 'true' && proTs) {
        var activated = new Date(proTs);
        var trialEnd = new Date(activated.getTime() + 7 * 24 * 60 * 60 * 1000);
        return trialEnd;
      }
    } catch(e) {}
    return null;
  }

  function showBanner(daysLeft) {
    if (document.getElementById('trialBanner')) return;
    var banner = document.createElement('div');
    banner.id = 'trialBanner';
    banner.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;background:linear-gradient(90deg,#ff6622,#ff8844);color:#000;text-align:center;padding:10px 16px;font-size:14px;font-weight:700;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:flex;align-items:center;justify-content:center;gap:12px';

    var msg = daysLeft <= 0
      ? 'Your trial has expired. Upgrade to keep your Pro features.'
      : 'Trial ends in ' + daysLeft + ' day' + (daysLeft === 1 ? '' : 's') + '. Upgrade now to keep your Pro features.';

    banner.innerHTML = '<span>' + msg + '</span><a href="/pricing" style="background:#000;color:#ff8844;padding:5px 14px;border-radius:100px;font-size:12px;font-weight:800;text-decoration:none;letter-spacing:.5px">UPGRADE</a><button onclick="this.parentElement.style.display=\'none\'" style="background:none;border:none;color:#000;font-size:18px;cursor:pointer;padding:0 4px;margin-left:8px">&times;</button>';
    document.body.prepend(banner);
  }

  function check() {
    var trialEnd = getTrialEnd();
    if (!trialEnd) return;
    var now = new Date();
    var diff = trialEnd.getTime() - now.getTime();
    var daysLeft = Math.ceil(diff / (24 * 60 * 60 * 1000));

    // Show banner when 2 days or less remain (or expired)
    if (daysLeft <= 2) {
      showBanner(daysLeft);
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check);
  } else {
    check();
  }
})();
