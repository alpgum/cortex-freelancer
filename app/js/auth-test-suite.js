/**
 * CF-271 — Integration Test Suite for Auth Flows
 * Mock-based test definitions for auth: email signup, Google sign-in,
 * guest mode, session persistence, logout
 */
(function() {
  const NS = (window.CortexFreelancer = window.CortexFreelancer || {});

  // ── Mock factory ──
  function createAuthMock() {
    const users = {};
    let currentUser = null;
    const listeners = [];

    return {
      currentUser: () => currentUser,
      onAuthStateChanged(cb) { listeners.push(cb); return () => { const i = listeners.indexOf(cb); if (i >= 0) listeners.splice(i, 1); }; },
      _notify() { listeners.forEach(cb => cb(currentUser)); },

      async createUserWithEmailAndPassword(email, password) {
        if (!email || !password) throw new Error('auth/invalid-argument');
        if (password.length < 6) throw new Error('auth/weak-password');
        if (users[email]) throw new Error('auth/email-already-in-use');
        const user = { uid: 'uid_' + Date.now(), email, displayName: null, isAnonymous: false, providerData: [{ providerId: 'password' }] };
        users[email] = { user, password };
        currentUser = user;
        this._notify();
        return { user };
      },

      async signInWithEmailAndPassword(email, password) {
        const rec = users[email];
        if (!rec) throw new Error('auth/user-not-found');
        if (rec.password !== password) throw new Error('auth/wrong-password');
        currentUser = rec.user;
        this._notify();
        return { user: rec.user };
      },

      async signInWithPopup(provider) {
        const user = { uid: 'google_' + Date.now(), email: 'test@gmail.com', displayName: 'Google User', isAnonymous: false, providerData: [{ providerId: provider }] };
        currentUser = user;
        this._notify();
        return { user, credential: { accessToken: 'mock_token' } };
      },

      async signInAnonymously() {
        const user = { uid: 'anon_' + Date.now(), email: null, displayName: null, isAnonymous: true, providerData: [] };
        currentUser = user;
        this._notify();
        return { user };
      },

      async signOut() {
        currentUser = null;
        this._notify();
      },

      _seed(email, password) {
        const user = { uid: 'uid_seed_' + Math.random().toString(36).slice(2), email, displayName: null, isAnonymous: false, providerData: [{ providerId: 'password' }] };
        users[email] = { user, password };
      }
    };
  }

  // ── Helpers ──
  function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }
  function assertEqual(a, b, msg) { if (a !== b) throw new Error(msg || `Expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

  // ── Test definitions ──
  function defineAuthTests() {
    const tests = [];
    function test(name, fn) { tests.push({ name, fn }); }

    // Email signup
    test('Email signup creates user', async function() {
      const auth = createAuthMock();
      const res = await auth.createUserWithEmailAndPassword('new@test.com', 'pass123');
      assert(res.user.uid, 'Should have uid');
      assertEqual(res.user.email, 'new@test.com');
      assertEqual(res.user.isAnonymous, false);
    });

    test('Email signup rejects weak password', async function() {
      const auth = createAuthMock();
      let err = null;
      try { await auth.createUserWithEmailAndPassword('a@b.com', '12'); } catch (e) { err = e; }
      assert(err, 'Should throw');
      assert(err.message.includes('weak-password'));
    });

    test('Email signup rejects duplicate', async function() {
      const auth = createAuthMock();
      await auth.createUserWithEmailAndPassword('dup@test.com', 'pass123');
      let err = null;
      try { await auth.createUserWithEmailAndPassword('dup@test.com', 'pass456'); } catch (e) { err = e; }
      assert(err && err.message.includes('email-already-in-use'));
    });

    test('Email signup fires auth state listener', async function() {
      const auth = createAuthMock();
      let stateUser = null;
      auth.onAuthStateChanged(u => { stateUser = u; });
      await auth.createUserWithEmailAndPassword('listen@test.com', 'pass123');
      assert(stateUser && stateUser.email === 'listen@test.com');
    });

    // Email sign-in
    test('Email sign-in succeeds with correct credentials', async function() {
      const auth = createAuthMock();
      auth._seed('exist@test.com', 'mypass');
      const res = await auth.signInWithEmailAndPassword('exist@test.com', 'mypass');
      assertEqual(res.user.email, 'exist@test.com');
    });

    test('Email sign-in fails with wrong password', async function() {
      const auth = createAuthMock();
      auth._seed('exist@test.com', 'mypass');
      let err = null;
      try { await auth.signInWithEmailAndPassword('exist@test.com', 'wrong'); } catch (e) { err = e; }
      assert(err && err.message.includes('wrong-password'));
    });

    test('Email sign-in fails for unknown user', async function() {
      const auth = createAuthMock();
      let err = null;
      try { await auth.signInWithEmailAndPassword('noone@test.com', 'pass'); } catch (e) { err = e; }
      assert(err && err.message.includes('user-not-found'));
    });

    // Google sign-in
    test('Google sign-in returns user with display name', async function() {
      const auth = createAuthMock();
      const res = await auth.signInWithPopup('google.com');
      assert(res.user.displayName, 'Should have display name');
      assert(res.credential.accessToken);
    });

    test('Google sign-in sets current user', async function() {
      const auth = createAuthMock();
      await auth.signInWithPopup('google.com');
      assert(auth.currentUser());
      assertEqual(auth.currentUser().isAnonymous, false);
    });

    // Guest / anonymous mode
    test('Anonymous sign-in sets isAnonymous', async function() {
      const auth = createAuthMock();
      const res = await auth.signInAnonymously();
      assertEqual(res.user.isAnonymous, true);
      assertEqual(res.user.email, null);
    });

    test('Anonymous user has uid', async function() {
      const auth = createAuthMock();
      const res = await auth.signInAnonymously();
      assert(res.user.uid.startsWith('anon_'));
    });

    // Session persistence
    test('currentUser persists after sign-in', async function() {
      const auth = createAuthMock();
      auth._seed('persist@test.com', 'pass');
      await auth.signInWithEmailAndPassword('persist@test.com', 'pass');
      assertEqual(auth.currentUser().email, 'persist@test.com');
    });

    test('Auth state listener receives user on sign-in', async function() {
      const auth = createAuthMock();
      const states = [];
      auth.onAuthStateChanged(u => states.push(u));
      auth._seed('s@t.com', 'p');
      await auth.signInWithEmailAndPassword('s@t.com', 'p');
      assert(states.length >= 1);
      assertEqual(states[states.length - 1].email, 's@t.com');
    });

    // Logout
    test('Sign-out clears current user', async function() {
      const auth = createAuthMock();
      auth._seed('out@test.com', 'pass');
      await auth.signInWithEmailAndPassword('out@test.com', 'pass');
      assert(auth.currentUser());
      await auth.signOut();
      assertEqual(auth.currentUser(), null);
    });

    test('Sign-out fires listener with null', async function() {
      const auth = createAuthMock();
      const states = [];
      auth.onAuthStateChanged(u => states.push(u));
      auth._seed('x@t.com', 'p');
      await auth.signInWithEmailAndPassword('x@t.com', 'p');
      await auth.signOut();
      assertEqual(states[states.length - 1], null);
    });

    test('Unsubscribe stops listener', async function() {
      const auth = createAuthMock();
      let calls = 0;
      const unsub = auth.onAuthStateChanged(() => { calls++; });
      auth._seed('u@t.com', 'p');
      await auth.signInWithEmailAndPassword('u@t.com', 'p');
      const after = calls;
      unsub();
      await auth.signOut();
      assertEqual(calls, after, 'Listener should not fire after unsubscribe');
    });

    return tests;
  }

  // ── Runner ──
  async function runAuthTests() {
    const tests = defineAuthTests();
    const results = [];
    for (const t of tests) {
      try {
        await t.fn();
        results.push({ name: t.name, status: 'pass', error: null });
      } catch (e) {
        results.push({ name: t.name, status: 'fail', error: e.message });
      }
    }
    return {
      suite: 'Auth Integration Tests',
      total: results.length,
      passed: results.filter(r => r.status === 'pass').length,
      failed: results.filter(r => r.status === 'fail').length,
      results
    };
  }

  NS.AuthTestSuite = { defineAuthTests, runAuthTests, createAuthMock };
})();
