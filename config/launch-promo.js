// Launch promo configuration
// Set enabled: false to hide the banner, or update endDate to extend the promo
window.LAUNCH_PROMO = {
  enabled: true,
  headline: 'Launch Special: 50% off',
  subtext: 'ends Sunday',
  endDate: (function() {
    // Next Sunday at 23:59:59 local time
    var now = new Date();
    var daysUntilSunday = (7 - now.getDay()) % 7 || 7;
    var sunday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + daysUntilSunday, 23, 59, 59);
    return sunday.toISOString();
  })(),
  bgColor: 'linear-gradient(90deg, #ff6622, #ff8844)',
  textColor: '#000'
};
