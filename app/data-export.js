/* ===== GDPR Data Export — Client-side handler ===== */
(function () {
  'use strict';

  /**
   * Request a full data export for the current user.
   * Calls /api/export-data and triggers a JSON file download.
   */
  function requestDataExport() {
    var user = window.cortexAuth && window.cortexAuth.currentUser;
    if (!user) {
      if (window.cortexToast) window.cortexToast.show('Please sign in to export your data.', 'error');
      return Promise.reject(new Error('Not authenticated'));
    }

    return user.getIdToken().then(function (token) {
      return fetch('/api/export-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({ email: user.email })
      });
    }).then(function (res) {
      if (!res.ok) throw new Error('Export request failed: ' + res.status);
      return res.json();
    }).then(function (result) {
      if (!result.success || !result.data) {
        throw new Error(result.error && result.error.message || 'Export failed');
      }

      // Trigger download of the exported JSON
      var blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'cortex-data-export-' + new Date().toISOString().slice(0, 10) + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (window.cortexToast) window.cortexToast.show('Your data export has been downloaded.', 'success');
      return result.data;
    }).catch(function (err) {
      console.error('[data-export] Error:', err.message);
      if (window.cortexToast) window.cortexToast.show('Failed to export data. Please try again.', 'error');
      throw err;
    });
  }

  // Expose globally
  window.cortexDataExport = { request: requestDataExport };
})();
