/**
 * Cortex Freelancer — Firebase Security Rules
 * [CF-221] Generate and validate Firestore security rules: users read/write
 * own data only, admins read all. Includes rule template and validator.
 *
 * @namespace window.CortexFreelancer.FirebaseSecurityRules
 */
(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  // ─── Rule Template ──────────────────────────────────────────────

  var RULES_TEMPLATE = [
    'rules_version = \'2\';',
    'service cloud.firestore {',
    '  match /databases/{database}/documents {',
    '',
    '    // ─── Helper Functions ───────────────────────────────',
    '    function isAuthenticated() {',
    '      return request.auth != null;',
    '    }',
    '',
    '    function isOwner(userId) {',
    '      return isAuthenticated() && request.auth.uid == userId;',
    '    }',
    '',
    '    function isAdmin() {',
    '      return isAuthenticated()',
    '        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == \'admin\';',
    '    }',
    '',
    '    function hasValidFields(required, optional) {',
    '      let all = required.concat(optional);',
    '      return request.resource.data.keys().hasAll(required)',
    '        && request.resource.data.keys().hasOnly(all);',
    '    }',
    '',
    '    // ─── User Profiles ─────────────────────────────────',
    '    match /users/{userId} {',
    '      allow read: if isOwner(userId) || isAdmin();',
    '      allow create: if isOwner(userId);',
    '      allow update: if isOwner(userId);',
    '      allow delete: if isOwner(userId) || isAdmin();',
    '    }',
    '',
    '    // ─── User Preferences ──────────────────────────────',
    '    match /user_preferences/{userId} {',
    '      allow read: if isOwner(userId) || isAdmin();',
    '      allow write: if isOwner(userId);',
    '    }',
    '',
    '    // ─── Login Analytics ───────────────────────────────',
    '    match /login_analytics/{docId} {',
    '      allow create: if isAuthenticated()',
    '        && request.resource.data.uid == request.auth.uid;',
    '      allow read: if isAuthenticated()',
    '        && (resource.data.uid == request.auth.uid || isAdmin());',
    '      allow delete: if isAdmin();',
    '    }',
    '',
    '    // ─── Subscriptions ─────────────────────────────────',
    '    match /subscriptions/{userId} {',
    '      allow read: if isOwner(userId) || isAdmin();',
    '      allow write: if isAdmin();',
    '    }',
    '',
    '    // ─── Contracts ─────────────────────────────────────',
    '    match /contracts/{contractId} {',
    '      allow read: if isAuthenticated()',
    '        && (resource.data.freelancerId == request.auth.uid',
    '            || resource.data.clientId == request.auth.uid',
    '            || isAdmin());',
    '      allow create: if isAuthenticated();',
    '      allow update: if isAuthenticated()',
    '        && (resource.data.freelancerId == request.auth.uid',
    '            || resource.data.clientId == request.auth.uid);',
    '      allow delete: if isAdmin();',
    '    }',
    '',
    '    // ─── Payments ──────────────────────────────────────',
    '    match /payments/{paymentId} {',
    '      allow read: if isAuthenticated()',
    '        && (resource.data.userId == request.auth.uid || isAdmin());',
    '      allow create: if false; // server-only',
    '      allow update: if false;',
    '      allow delete: if false;',
    '    }',
    '',
    '    // ─── Notifications ─────────────────────────────────',
    '    match /notifications/{userId}/items/{notifId} {',
    '      allow read: if isOwner(userId);',
    '      allow update: if isOwner(userId)',
    '        && request.resource.data.diff(resource.data).affectedKeys().hasOnly([\'read\']);',
    '      allow create: if isAdmin();',
    '      allow delete: if isOwner(userId) || isAdmin();',
    '    }',
    '',
    '    // ─── Admin-Only Collections ────────────────────────',
    '    match /admin/{document=**} {',
    '      allow read, write: if isAdmin();',
    '    }',
    '',
    '    // ─── Deny all other access ─────────────────────────',
    '    match /{document=**} {',
    '      allow read, write: if false;',
    '    }',
    '  }',
    '}'
  ].join('\n');

  // ─── Validator ──────────────────────────────────────────────────

  var VALIDATION_CHECKS = [
    {
      name: 'has_rules_version',
      description: 'Rules must declare version 2',
      test: function (rules) { return rules.indexOf('rules_version') !== -1; }
    },
    {
      name: 'has_service_block',
      description: 'Rules must have service cloud.firestore block',
      test: function (rules) { return rules.indexOf('service cloud.firestore') !== -1; }
    },
    {
      name: 'has_auth_check',
      description: 'Rules should check request.auth',
      test: function (rules) { return rules.indexOf('request.auth') !== -1; }
    },
    {
      name: 'no_open_write',
      description: 'Rules should not allow unrestricted write access',
      test: function (rules) { return rules.indexOf('allow write: if true') === -1; }
    },
    {
      name: 'no_open_read',
      description: 'Rules should not allow unrestricted read access',
      test: function (rules) { return rules.indexOf('allow read: if true') === -1; }
    },
    {
      name: 'has_default_deny',
      description: 'Rules should have a default deny clause',
      test: function (rules) {
        return rules.indexOf('allow read, write: if false') !== -1 ||
          rules.indexOf('allow read: if false') !== -1;
      }
    },
    {
      name: 'user_data_ownership',
      description: 'User data should enforce ownership checks',
      test: function (rules) {
        return rules.indexOf('request.auth.uid') !== -1;
      }
    },
    {
      name: 'has_admin_role_check',
      description: 'Rules should include admin role verification',
      test: function (rules) {
        return rules.indexOf('admin') !== -1 && rules.indexOf('role') !== -1;
      }
    },
    {
      name: 'balanced_braces',
      description: 'Rules must have balanced curly braces',
      test: function (rules) {
        var open = (rules.match(/\{/g) || []).length;
        var close = (rules.match(/\}/g) || []).length;
        return open === close;
      }
    },
    {
      name: 'no_wildcards_at_root',
      description: 'Root-level wildcards should deny, not allow',
      test: function (rules) {
        // Check the default deny pattern is the catch-all
        var catchAll = rules.match(/match\s+\/\{document=\*\*\}[\s\S]*?allow\s+\w/);
        if (!catchAll) return true;
        return catchAll[0].indexOf('if false') !== -1 || rules.indexOf('allow read, write: if false') !== -1;
      }
    }
  ];

  // ─── Public API ─────────────────────────────────────────────────

  window.CortexFreelancer.FirebaseSecurityRules = {
    /**
     * Get the Firestore security rules template.
     * @returns {string}
     */
    getTemplate: function () {
      return RULES_TEMPLATE;
    },

    /**
     * Validate a rules string against security best practices.
     * @param {string} [rules] — rules to validate (defaults to template)
     * @returns {{ valid: boolean, passed: Array, failed: Array }}
     */
    validate: function (rules) {
      var rulesText = rules || RULES_TEMPLATE;
      var passed = [];
      var failed = [];

      for (var i = 0; i < VALIDATION_CHECKS.length; i++) {
        var check = VALIDATION_CHECKS[i];
        var result = {
          name: check.name,
          description: check.description
        };
        if (check.test(rulesText)) {
          result.status = 'passed';
          passed.push(result);
        } else {
          result.status = 'failed';
          failed.push(result);
        }
      }

      return {
        valid: failed.length === 0,
        total: VALIDATION_CHECKS.length,
        passed: passed,
        failed: failed
      };
    },

    /**
     * Generate rules with custom collection configs.
     * @param {Array<{ collection: string, ownerField: string, adminRead: boolean, adminWrite: boolean }>} collections
     * @returns {string}
     */
    generate: function (collections) {
      var lines = [
        'rules_version = \'2\';',
        'service cloud.firestore {',
        '  match /databases/{database}/documents {',
        '',
        '    function isAuthenticated() {',
        '      return request.auth != null;',
        '    }',
        '',
        '    function isAdmin() {',
        '      return isAuthenticated()',
        '        && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == \'admin\';',
        '    }',
        ''
      ];

      for (var i = 0; i < collections.length; i++) {
        var c = collections[i];
        var ownerField = c.ownerField || 'userId';
        var matchPath = c.collection.indexOf('{') !== -1
          ? c.collection
          : c.collection + '/{docId}';

        lines.push('    match /' + matchPath + ' {');

        // Read rule
        if (c.adminRead !== false) {
          lines.push('      allow read: if isAuthenticated()');
          lines.push('        && (resource.data.' + ownerField + ' == request.auth.uid || isAdmin());');
        } else {
          lines.push('      allow read: if isAuthenticated()');
          lines.push('        && resource.data.' + ownerField + ' == request.auth.uid;');
        }

        // Write rule
        if (c.adminWrite) {
          lines.push('      allow write: if isAdmin();');
        } else {
          lines.push('      allow create: if isAuthenticated()');
          lines.push('        && request.resource.data.' + ownerField + ' == request.auth.uid;');
          lines.push('      allow update: if isAuthenticated()');
          lines.push('        && resource.data.' + ownerField + ' == request.auth.uid;');
          lines.push('      allow delete: if isAuthenticated()');
          lines.push('        && resource.data.' + ownerField + ' == request.auth.uid;');
        }

        lines.push('    }');
        lines.push('');
      }

      lines.push('    match /{document=**} {');
      lines.push('      allow read, write: if false;');
      lines.push('    }');
      lines.push('  }');
      lines.push('}');

      return lines.join('\n');
    },

    /**
     * Export rules as a downloadable file.
     * @param {string} [rules]
     */
    download: function (rules) {
      var text = rules || RULES_TEMPLATE;
      var blob = new Blob([text], { type: 'text/plain' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'firestore.rules';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };
})();
