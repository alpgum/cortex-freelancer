(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var COLLECTION = 'users';
  var STORAGE_KEY = 'cortex_user_role';

  var ROLES = {
    free: { level: 0, label: 'Free' },
    pro: { level: 1, label: 'Pro' },
    admin: { level: 2, label: 'Admin' }
  };

  var FEATURE_GATES = {
    'proposal-generator': 'pro',
    'rate-optimizer': 'pro',
    'earnings-projection': 'pro',
    'client-crm': 'pro',
    'contract-review': 'pro',
    'tax-estimator': 'pro',
    'cashflow-forecast': 'pro',
    'competition-tracker': 'pro',
    'bulk-proposal': 'pro',
    'data-export': 'pro',
    'profile-rewriter': 'pro',
    'revenue-forecast': 'pro',
    'admin-panel': 'admin',
    'user-management': 'admin',
    'analytics-admin': 'admin',
    'stripe-dashboard': 'admin'
  };

  var state = {
    userId: null,
    role: 'free',
    unsub: null,
    listeners: []
  };

  function getFirestore() {
    if (typeof firebase !== 'undefined' && firebase.firestore) {
      return firebase.firestore();
    }
    return null;
  }

  function saveLocal(role) {
    try {
      localStorage.setItem(STORAGE_KEY, role);
    } catch (e) { /* quota */ }
  }

  function loadLocal() {
    try {
      return localStorage.getItem(STORAGE_KEY) || 'free';
    } catch (e) {
      return 'free';
    }
  }

  function emit(role) {
    state.listeners.forEach(function (fn) {
      try { fn(role); } catch (e) { console.error('[RoleAccess] Listener error:', e); }
    });
    document.dispatchEvent(new CustomEvent('cortex-role-change', { detail: { role: role } }));
  }

  function fetchRole(userId) {
    state.userId = userId;
    var db = getFirestore();
    if (!db || !userId) {
      state.role = loadLocal();
      return Promise.resolve(state.role);
    }

    return db.collection(COLLECTION).doc(userId).get().then(function (doc) {
      if (doc.exists && doc.data().role) {
        state.role = doc.data().role;
      } else {
        state.role = 'free';
      }
      saveLocal(state.role);
      return state.role;
    }).catch(function () {
      state.role = loadLocal();
      return state.role;
    });
  }

  function setRole(userId, role) {
    if (!ROLES[role]) return Promise.reject(new Error('Invalid role: ' + role));

    var db = getFirestore();
    state.role = role;
    saveLocal(role);
    emit(role);

    if (!db || !userId) return Promise.resolve(role);

    return db.collection(COLLECTION).doc(userId).set(
      { role: role, roleUpdatedAt: new Date().toISOString() },
      { merge: true }
    ).then(function () {
      return role;
    });
  }

  function startListener(userId) {
    stopListener();
    var db = getFirestore();
    if (!db || !userId) return;

    state.unsub = db.collection(COLLECTION).doc(userId).onSnapshot(function (doc) {
      if (doc.exists && doc.data().role) {
        var newRole = doc.data().role;
        if (newRole !== state.role) {
          state.role = newRole;
          saveLocal(newRole);
          emit(newRole);
        }
      }
    }, function (err) {
      console.error('[RoleAccess] Listener error:', err);
    });
  }

  function stopListener() {
    if (state.unsub) {
      state.unsub();
      state.unsub = null;
    }
  }

  function getRole() {
    return state.role || loadLocal();
  }

  function getRoleLevel(role) {
    return ROLES[role] ? ROLES[role].level : 0;
  }

  function hasAccess(featureId) {
    var requiredRole = FEATURE_GATES[featureId];
    if (!requiredRole) return true;
    return getRoleLevel(getRole()) >= getRoleLevel(requiredRole);
  }

  function isAdmin() {
    return getRole() === 'admin';
  }

  function isPro() {
    return getRoleLevel(getRole()) >= ROLES.pro.level;
  }

  function requireRole(featureId, fallback) {
    if (hasAccess(featureId)) return true;

    if (typeof fallback === 'function') {
      fallback(FEATURE_GATES[featureId], getRole());
    }
    return false;
  }

  function applyVisibility(container) {
    container = container || document;
    var currentRole = getRole();
    var currentLevel = getRoleLevel(currentRole);

    container.querySelectorAll('[data-role-min]').forEach(function (el) {
      var minRole = el.getAttribute('data-role-min');
      var minLevel = getRoleLevel(minRole);
      el.style.display = currentLevel >= minLevel ? '' : 'none';
    });

    container.querySelectorAll('[data-role-exact]').forEach(function (el) {
      var exact = el.getAttribute('data-role-exact');
      el.style.display = currentRole === exact ? '' : 'none';
    });

    container.querySelectorAll('[data-feature-gate]').forEach(function (el) {
      var featureId = el.getAttribute('data-feature-gate');
      el.style.display = hasAccess(featureId) ? '' : 'none';
    });

    container.querySelectorAll('[data-upgrade-gate]').forEach(function (el) {
      var featureId = el.getAttribute('data-upgrade-gate');
      if (!hasAccess(featureId)) {
        el.classList.add('cf-role-locked');
        el.setAttribute('title', 'Upgrade to ' + (FEATURE_GATES[featureId] || 'Pro') + ' to unlock');
      } else {
        el.classList.remove('cf-role-locked');
        el.removeAttribute('title');
      }
    });
  }

  function onChange(fn) {
    state.listeners.push(fn);
    return function () {
      state.listeners = state.listeners.filter(function (l) { return l !== fn; });
    };
  }

  function syncWithSubscription() {
    var SubscriptionStore = window.CortexFreelancer.SubscriptionStore;
    if (!SubscriptionStore || !SubscriptionStore.onChange) return;

    SubscriptionStore.onChange(function (sub) {
      if (!sub) return;
      if (getRole() === 'admin') return;

      var newRole = 'free';
      if (sub.plan === 'pro' || sub.plan === 'lifetime') {
        newRole = 'pro';
      }

      if (newRole !== getRole()) {
        state.role = newRole;
        saveLocal(newRole);
        emit(newRole);
      }
    });
  }

  window.CortexFreelancer.RoleAccess = {
    fetch: fetchRole,
    setRole: setRole,
    getRole: getRole,
    hasAccess: hasAccess,
    isAdmin: isAdmin,
    isPro: isPro,
    requireRole: requireRole,
    applyVisibility: applyVisibility,
    onChange: onChange,
    startListener: startListener,
    stopListener: stopListener,
    syncWithSubscription: syncWithSubscription,
    ROLES: ROLES,
    FEATURE_GATES: FEATURE_GATES
  };
})();
