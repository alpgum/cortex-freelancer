/**
 * CF-115: Fix fee calculator Upwork fee tier thresholds
 * Updates fee tiers to current Upwork fee structure (10% flat as of 2023).
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const FeeTierUpdate = {
    // Current Upwork fee: flat 10% (changed from tiered 20%/10%/5% in 2023)
    UPWORK_FEE_RATE: 0.10,

    // Legacy tiers for reference/comparison
    LEGACY_TIERS: [
      { threshold: 0, rate: 0.20, label: 'First $500' },
      { threshold: 500, rate: 0.10, label: '$500.01 – $10,000' },
      { threshold: 10000, rate: 0.05, label: 'Over $10,000' }
    ],

    init() {
      document.addEventListener('DOMContentLoaded', () => this.patchCalculator());
    },

    patchCalculator() {
      const feeInputs = document.querySelectorAll(
        '#project-amount, #earnings-input, [data-fee-input]'
      );
      feeInputs.forEach(input => {
        input.addEventListener('input', () => this.calculate(input));
      });

      // Auto-calculate if value already present
      feeInputs.forEach(input => {
        if (input.value) this.calculate(input);
      });
    },

    calculate(input) {
      const amount = parseFloat(input.value) || 0;
      const fee = this.calculateFee(amount);
      const net = amount - fee;

      const feeEl = document.querySelector('#fee-amount, [data-fee-result]');
      const netEl = document.querySelector('#net-amount, [data-net-result]');
      const rateEl = document.querySelector('#fee-rate, [data-fee-rate]');

      if (feeEl) feeEl.textContent = '$' + fee.toFixed(2);
      if (netEl) netEl.textContent = '$' + net.toFixed(2);
      if (rateEl) rateEl.textContent = (this.UPWORK_FEE_RATE * 100) + '%';

      return { amount, fee, net, rate: this.UPWORK_FEE_RATE };
    },

    calculateFee(amount) {
      return amount * this.UPWORK_FEE_RATE;
    },

    calculateLegacyFee(amount) {
      if (amount <= 500) return amount * 0.20;
      if (amount <= 10000) return 500 * 0.20 + (amount - 500) * 0.10;
      return 500 * 0.20 + 9500 * 0.10 + (amount - 10000) * 0.05;
    },

    compareFees(amount) {
      const current = this.calculateFee(amount);
      const legacy = this.calculateLegacyFee(amount);
      return {
        current,
        legacy,
        savings: legacy - current,
        betterWith: current < legacy ? 'new' : 'old'
      };
    }
  };

  FeeTierUpdate.init();
  window.CortexFreelancer.FeeTierUpdate = FeeTierUpdate;
})();
