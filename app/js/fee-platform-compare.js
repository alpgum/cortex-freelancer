/**
 * CF-127: Fee Calculator — add platform comparison (Upwork vs Fiverr vs Toptal)
 * Shows fee comparison across platforms for same project value.
 */
(function () {
  'use strict';
  window.CortexFreelancer = window.CortexFreelancer || {};

  const FeePlatformCompare = {
    PLATFORMS: {
      upwork: {
        name: 'Upwork',
        feeRate: 0.10,
        description: 'Flat 10% service fee',
        calculate(amount) { return amount * 0.10; }
      },
      fiverr: {
        name: 'Fiverr',
        feeRate: 0.20,
        description: '20% service fee on all orders',
        calculate(amount) { return amount * 0.20; }
      },
      toptal: {
        name: 'Toptal',
        feeRate: 0,
        description: 'No freelancer fee (client pays separately)',
        calculate() { return 0; }
      },
      freelancerCom: {
        name: 'Freelancer.com',
        feeRate: 0.10,
        description: '10% or $5 (whichever is greater)',
        calculate(amount) { return Math.max(amount * 0.10, 5); }
      },
      peoplePerHour: {
        name: 'PeoplePerHour',
        feeRate: null,
        description: '20% up to £350, then 7.5%',
        calculate(amount) {
          if (amount <= 350) return amount * 0.20;
          return 350 * 0.20 + (amount - 350) * 0.075;
        }
      }
    },

    init() {
      document.addEventListener('DOMContentLoaded', () => this.bind());
    },

    bind() {
      const input = document.querySelector('#compare-amount, [data-compare-input]');
      if (input) {
        input.addEventListener('input', () => this.compare(parseFloat(input.value) || 0));
      }
    },

    compare(amount) {
      const results = {};
      Object.entries(this.PLATFORMS).forEach(([key, platform]) => {
        const fee = platform.calculate(amount);
        results[key] = {
          name: platform.name,
          description: platform.description,
          grossAmount: amount,
          fee,
          netAmount: amount - fee,
          effectiveRate: amount > 0 ? (fee / amount * 100).toFixed(1) + '%' : '0%'
        };
      });

      this.render(results);
      return results;
    },

    render(results) {
      const container = document.querySelector('#platform-comparison, [data-compare-output]');
      if (!container) return;

      const sorted = Object.values(results).sort((a, b) => a.fee - b.fee);
      const best = sorted[0];

      container.innerHTML = sorted.map((r, i) => `
        <div class="platform-row ${i === 0 ? 'best-deal' : ''}" style="
          display: flex; justify-content: space-between; align-items: center;
          padding: 12px 16px; margin: 8px 0; border-radius: 8px;
          background: var(--bg-card, #fff); border: 1px solid var(--border-color, #e0e0e0);
          ${i === 0 ? 'border-color: var(--success, #28a745); box-shadow: 0 0 0 1px var(--success, #28a745);' : ''}
        ">
          <div>
            <strong>${r.name}</strong> ${i === 0 ? '<span style="color: var(--success, #28a745); font-size: 12px;">Best deal</span>' : ''}
            <div style="font-size: 12px; color: var(--text-muted, #999);">${r.description}</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 600; color: var(--text-primary);">$${r.netAmount.toFixed(2)}</div>
            <div style="font-size: 12px; color: var(--danger, #dc3545);">-$${r.fee.toFixed(2)} (${r.effectiveRate})</div>
          </div>
        </div>
      `).join('');
    }
  };

  FeePlatformCompare.init();
  window.CortexFreelancer.FeePlatformCompare = FeePlatformCompare;
})();
