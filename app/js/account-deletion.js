(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var CSS_INJECTED = false;
  var CONFIRM_PHRASE = 'DELETE MY ACCOUNT';

  var FIRESTORE_COLLECTIONS = [
    'users',
    'proposals',
    'bookmarks',
    'analytics',
    'exports'
  ];

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function getCurrentUser() {
    if (typeof firebase !== 'undefined' && firebase.auth) {
      return firebase.auth().currentUser;
    }
    return null;
  }

  function cancelStripeSubscription(userId) {
    var SubscriptionStore = window.CortexFreelancer.SubscriptionStore;
    if (!SubscriptionStore) return Promise.resolve();

    return Promise.resolve().then(function () {
      var sub = SubscriptionStore.get ? SubscriptionStore.get() : null;
      if (!sub || sub.plan === 'free' || sub.status === 'canceled') {
        return;
      }

      var stripeCustomerId = sub.stripe_customer_id;
      if (!stripeCustomerId) return;

      return fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: userId,
          customerId: stripeCustomerId,
          reason: 'account_deletion'
        })
      }).then(function (res) {
        if (!res.ok) throw new Error('Failed to cancel subscription');
      });
    }).catch(function (err) {
      console.warn('[AccountDeletion] Stripe cancellation error:', err);
    });
  }

  function deleteFirestoreData(userId, onProgress) {
    var db = getFirestore();
    if (!db) return Promise.resolve();

    var total = FIRESTORE_COLLECTIONS.length;
    var done = 0;

    return FIRESTORE_COLLECTIONS.reduce(function (chain, collection) {
      return chain.then(function () {
        var docRef = db.collection(collection).doc(userId);
        return docRef.delete().then(function () {
          done++;
          if (onProgress) onProgress(done, total, collection);
        }).catch(function (err) {
          console.warn('[AccountDeletion] Failed to delete from ' + collection + ':', err);
          done++;
          if (onProgress) onProgress(done, total, collection);
        });
      });
    }, Promise.resolve());
  }

  function clearLocalData() {
    var keysToRemove = [];
    for (var i = 0; i < localStorage.length; i++) {
      var key = localStorage.key(i);
      if (key && (key.startsWith('cortex_') || key.startsWith('cf_'))) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(function (k) { localStorage.removeItem(k); });

    for (var j = sessionStorage.length - 1; j >= 0; j--) {
      var sKey = sessionStorage.key(j);
      if (sKey && (sKey.startsWith('cortex_') || sKey.startsWith('cf_'))) {
        sessionStorage.removeItem(sKey);
      }
    }
  }

  function deleteFirebaseUser() {
    var user = getCurrentUser();
    if (!user) return Promise.resolve();
    return user.delete();
  }

  function performDeletion(onProgress) {
    var user = getCurrentUser();
    if (!user) return Promise.reject(new Error('No authenticated user'));
    var userId = user.uid;

    return Promise.resolve()
      .then(function () {
        if (onProgress) onProgress('stripe', 'Canceling subscription...');
        return cancelStripeSubscription(userId);
      })
      .then(function () {
        if (onProgress) onProgress('firestore', 'Deleting your data...');
        return deleteFirestoreData(userId, function (done, total, col) {
          if (onProgress) onProgress('firestore', 'Deleting ' + col + '... (' + done + '/' + total + ')');
        });
      })
      .then(function () {
        if (onProgress) onProgress('local', 'Clearing local data...');
        clearLocalData();
      })
      .then(function () {
        if (onProgress) onProgress('auth', 'Removing account...');
        return deleteFirebaseUser();
      })
      .then(function () {
        if (onProgress) onProgress('done', 'Account deleted.');
      });
  }

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-delete-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 16px; }',
      '.cf-delete-modal { background: #fff; border-radius: 16px; max-width: 440px; width: 100%; padding: 28px; box-shadow: 0 20px 60px rgba(0,0,0,0.15); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-delete-modal h3 { font-size: 18px; font-weight: 700; color: #dc2626; margin: 0 0 8px; }',
      '.cf-delete-modal p { font-size: 14px; color: #475569; line-height: 1.5; margin: 0 0 16px; }',
      '.cf-delete-warning { background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 12px; margin-bottom: 16px; }',
      '.cf-delete-warning ul { margin: 8px 0 0; padding-left: 20px; font-size: 13px; color: #991b1b; }',
      '.cf-delete-warning ul li { margin-bottom: 4px; }',
      '.cf-delete-confirm-label { display: block; font-size: 13px; color: #64748b; margin-bottom: 6px; }',
      '.cf-delete-confirm-input { width: 100%; padding: 10px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; box-sizing: border-box; outline: none; margin-bottom: 16px; }',
      '.cf-delete-confirm-input:focus { border-color: #dc2626; box-shadow: 0 0 0 3px rgba(220,38,38,0.1); }',
      '.cf-delete-actions { display: flex; gap: 12px; justify-content: flex-end; }',
      '.cf-delete-cancel { padding: 10px 20px; border: 1px solid #d1d5db; border-radius: 8px; background: #fff; font-size: 14px; cursor: pointer; color: #334155; }',
      '.cf-delete-cancel:hover { background: #f8fafc; }',
      '.cf-delete-btn { padding: 10px 20px; border: none; border-radius: 8px; background: #dc2626; color: #fff; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
      '.cf-delete-btn:hover { background: #b91c1c; }',
      '.cf-delete-btn:disabled { opacity: 0.4; cursor: not-allowed; }',
      '.cf-delete-progress { font-size: 13px; color: #64748b; margin-top: 12px; min-height: 18px; }',
      '.cf-delete-progress.error { color: #dc2626; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function showModal(onComplete) {
    injectCSS();

    var overlay = document.createElement('div');
    overlay.className = 'cf-delete-overlay';
    overlay.innerHTML =
      '<div class="cf-delete-modal">' +
        '<h3>Delete Your Account</h3>' +
        '<p>This action is <strong>permanent and irreversible</strong>. All your data will be deleted.</p>' +
        '<div class="cf-delete-warning">' +
          '<strong>This will permanently:</strong>' +
          '<ul>' +
            '<li>Cancel your active subscription</li>' +
            '<li>Delete all saved proposals, bookmarks, and analytics</li>' +
            '<li>Remove your profile and settings</li>' +
            '<li>Delete your authentication account</li>' +
          '</ul>' +
        '</div>' +
        '<label class="cf-delete-confirm-label">Type <strong>' + CONFIRM_PHRASE + '</strong> to confirm:</label>' +
        '<input class="cf-delete-confirm-input" id="cf-delete-confirm" type="text" placeholder="' + CONFIRM_PHRASE + '" autocomplete="off">' +
        '<div class="cf-delete-actions">' +
          '<button class="cf-delete-cancel" id="cf-delete-cancel">Cancel</button>' +
          '<button class="cf-delete-btn" id="cf-delete-submit" disabled>Delete Account</button>' +
        '</div>' +
        '<div class="cf-delete-progress" id="cf-delete-progress"></div>' +
      '</div>';

    document.body.appendChild(overlay);

    var confirmInput = overlay.querySelector('#cf-delete-confirm');
    var submitBtn = overlay.querySelector('#cf-delete-submit');
    var cancelBtn = overlay.querySelector('#cf-delete-cancel');
    var progressEl = overlay.querySelector('#cf-delete-progress');

    confirmInput.addEventListener('input', function () {
      submitBtn.disabled = confirmInput.value.trim() !== CONFIRM_PHRASE;
    });

    cancelBtn.addEventListener('click', function () {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });

    submitBtn.addEventListener('click', function () {
      if (confirmInput.value.trim() !== CONFIRM_PHRASE) return;

      submitBtn.disabled = true;
      cancelBtn.disabled = true;
      confirmInput.disabled = true;

      performDeletion(function (step, msg) {
        progressEl.textContent = msg;
        progressEl.className = 'cf-delete-progress';
      }).then(function () {
        progressEl.textContent = 'Account deleted. Redirecting...';
        if (onComplete) onComplete();
        setTimeout(function () {
          window.location.href = '/';
        }, 1500);
      }).catch(function (err) {
        progressEl.textContent = 'Error: ' + err.message;
        progressEl.className = 'cf-delete-progress error';
        submitBtn.disabled = false;
        cancelBtn.disabled = false;
        confirmInput.disabled = false;

        if (err.code === 'auth/requires-recent-login') {
          progressEl.textContent = 'Please sign in again before deleting your account.';
        }
      });
    });
  }

  window.CortexFreelancer.AccountDeletion = {
    showModal: showModal,
    performDeletion: performDeletion,
    CONFIRM_PHRASE: CONFIRM_PHRASE
  };
})();
