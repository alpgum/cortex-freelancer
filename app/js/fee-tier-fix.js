/**
 * CF-115: Fix fee calculator Upwork fee tier thresholds
 * Updated to current Upwork fee structure: 10% flat rate (since 2023).
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  // Current Upwork fee structure (as of 2023+): flat 10%
  var UPWORK_FEE_RATE = 0.10;

  // Legacy tiers kept for reference/historical calculations
  var LEGACY_TIERS = [
    { threshold: 0, rate: 0.20, label: 'First $500' },
    { threshold: 500, rate: 0.10, label: '$500.01 - $10,000' },
    { threshold: 10000, rate: 0.05, label: 'Above $10,000' }
  ];

  /**
   * Calculate Upwork fee on earnings (current flat rate).
   * @param {number} gross - Gross earnings
   * @returns {{ gross: number, fee: number, net: number, rate: number }}
   */
  function calculateFee(gross) {
    gross = parseFloat(gross) || 0;
    var fee = gross * UPWORK_FEE_RATE;
    return {
      gross: gross,
      fee: Math.round(fee * 100) / 100,
      net: Math.round((gross - fee) * 100) / 100,
      rate: UPWORK_FEE_RATE
    };
  }

  /**
   * Calculate what gross amount is needed for a desired net.
   * @param {number} desiredNet
   * @returns {{ gross: number, fee: number, net: number }}
   */
  function grossForNet(desiredNet) {
    desiredNet = parseFloat(desiredNet) || 0;
    var gross = desiredNet / (1 - UPWORK_FEE_RATE);
    return calculateFee(Math.ceil(gross * 100) / 100);
  }

  /**
   * Calculate legacy tiered fees (for comparison display).
   */
  function calculateLegacyFee(gross, clientTotal) {
    gross = parseFloat(gross) || 0;
    clientTotal = parseFloat(clientTotal) || 0;
    var remaining = gross;
    var totalFee = 0;
    var breakdown = [];

    // Sort tiers descending by threshold
    var tiers = LEGACY_TIERS.slice().sort(function (a, b) { return b.threshold - a.threshold; });

    for (var i = 0; i < tiers.length; i++) {
      var tier = tiers[i];
      var tierStart = Math.max(0, tier.threshold - clientTotal);
      if (remaining <= 0) break;

      var nextThreshold = i > 0 ? tiers[i - 1].threshold - clientTotal : Infinity;
      var amountInTier = Math.min(remaining, Math.max(0, nextThreshold - tierStart));

      if (amountInTier > 0) {
        var fee = amountInTier * tier.rate;
        totalFee += fee;
        breakdown.push({ tier: tier.label, amount: amountInTier, rate: tier.rate, fee: fee });
        remaining -= amountInTier;
      }
    }

    return {
      gross: gross,
      fee: Math.round(totalFee * 100) / 100,
      net: Math.round((gross - totalFee) * 100) / 100,
      breakdown: breakdown
    };
  }

  /**
   * Auto-bind fee calculator forms.
   */
  function init() {
    var form = document.querySelector('#fee-calculator-form, [data-fee-calculator]');
    if (!form) return;

    var input = form.querySelector('input[name="amount"], #fee-amount');
    var output = form.querySelector('.fee-result, #fee-result');
    if (!input || !output) return;

    function update() {
      var result = calculateFee(input.value);
      output.innerHTML =
        '<div>Gross: <strong>$' + result.gross.toFixed(2) + '</strong></div>' +
        '<div>Upwork Fee (10%): <strong>-$' + result.fee.toFixed(2) + '</strong></div>' +
        '<div>You Receive: <strong>$' + result.net.toFixed(2) + '</strong></div>';
    }

    input.addEventListener('input', update);
    input.addEventListener('change', update);
    if (input.value) update();
  }

  window.CortexFreelancer.FeeTierFix = {
    calculateFee: calculateFee,
    grossForNet: grossForNet,
    calculateLegacyFee: calculateLegacyFee,
    UPWORK_FEE_RATE: UPWORK_FEE_RATE,
    init: init
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
