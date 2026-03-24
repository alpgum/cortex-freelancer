(function () {
  'use strict';

  window.CortexFreelancer = window.CortexFreelancer || {};

  var CSS_INJECTED = false;

  var EXPORT_COLLECTIONS = [
    { key: 'profile', collection: 'users', label: 'Profile & Settings' },
    { key: 'proposals', collection: 'proposals', label: 'Proposals' },
    { key: 'bookmarks', collection: 'bookmarks', label: 'Bookmarks' },
    { key: 'analytics', collection: 'analytics', label: 'Analytics Data' },
    { key: 'exports', collection: 'exports', label: 'Export History' }
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

  function collectUserData(userId, onProgress) {
    var db = getFirestore();
    var exportData = {
      exportDate: new Date().toISOString(),
      userId: userId,
      data: {}
    };

    if (!db) {
      var localKeys = [];
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.startsWith('cortex_') || key.startsWith('cf_'))) {
          try {
            exportData.data[key] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            exportData.data[key] = localStorage.getItem(key);
          }
        }
      }
      return Promise.resolve(exportData);
    }

    var total = EXPORT_COLLECTIONS.length;
    var done = 0;

    return EXPORT_COLLECTIONS.reduce(function (chain, item) {
      return chain.then(function () {
        if (onProgress) onProgress(done, total, item.label);

        return db.collection(item.collection).doc(userId).get()
          .then(function (doc) {
            if (doc.exists) {
              exportData.data[item.key] = doc.data();
            } else {
              exportData.data[item.key] = null;
            }
            done++;
            if (onProgress) onProgress(done, total, item.label);
          })
          .catch(function (err) {
            console.warn('[DataExport] Failed to read ' + item.collection + ':', err);
            exportData.data[item.key] = { error: 'Failed to export' };
            done++;
            if (onProgress) onProgress(done, total, item.label);
          });
      });
    }, Promise.resolve()).then(function () {
      var localData = {};
      for (var i = 0; i < localStorage.length; i++) {
        var key = localStorage.key(i);
        if (key && (key.startsWith('cortex_') || key.startsWith('cf_'))) {
          try {
            localData[key] = JSON.parse(localStorage.getItem(key));
          } catch (e) {
            localData[key] = localStorage.getItem(key);
          }
        }
      }
      if (Object.keys(localData).length > 0) {
        exportData.data.localStorage = localData;
      }

      return exportData;
    });
  }

  function generateJSON(data) {
    return JSON.stringify(data, null, 2);
  }

  function downloadFile(content, filename, mimeType) {
    var blob = new Blob([content], { type: mimeType });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  function exportAsJSON(userId, onProgress) {
    var uid = userId || (getCurrentUser() && getCurrentUser().uid);
    if (!uid) return Promise.reject(new Error('No authenticated user'));

    return collectUserData(uid, onProgress).then(function (data) {
      var json = generateJSON(data);
      var date = new Date().toISOString().slice(0, 10);
      downloadFile(json, 'cortex-freelancer-export-' + date + '.json', 'application/json');
      return data;
    });
  }

  function exportAsZIP(userId, onProgress) {
    var uid = userId || (getCurrentUser() && getCurrentUser().uid);
    if (!uid) return Promise.reject(new Error('No authenticated user'));

    return collectUserData(uid, onProgress).then(function (data) {
      if (typeof JSZip !== 'undefined') {
        var zip = new JSZip();
        zip.file('export-metadata.json', JSON.stringify({
          exportDate: data.exportDate,
          userId: data.userId,
          format: 'zip',
          collections: Object.keys(data.data)
        }, null, 2));

        Object.keys(data.data).forEach(function (key) {
          if (data.data[key]) {
            zip.file(key + '.json', JSON.stringify(data.data[key], null, 2));
          }
        });

        return zip.generateAsync({ type: 'blob' }).then(function (blob) {
          var date = new Date().toISOString().slice(0, 10);
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'cortex-freelancer-export-' + date + '.zip';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
          return data;
        });
      }

      var json = generateJSON(data);
      var date = new Date().toISOString().slice(0, 10);
      downloadFile(json, 'cortex-freelancer-export-' + date + '.json', 'application/json');
      return data;
    });
  }

  function injectCSS() {
    if (CSS_INJECTED) return;
    CSS_INJECTED = true;
    var style = document.createElement('style');
    style.textContent = [
      '.cf-export-panel { max-width: 480px; margin: 0 auto; padding: 24px 16px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }',
      '.cf-export-panel h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px; color: #1a1a2e; }',
      '.cf-export-panel p { font-size: 14px; color: #64748b; margin: 0 0 20px; line-height: 1.5; }',
      '.cf-export-items { margin-bottom: 20px; }',
      '.cf-export-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-size: 14px; color: #334155; }',
      '.cf-export-item:last-child { border-bottom: none; }',
      '.cf-export-item .dot { width: 8px; height: 8px; border-radius: 50%; background: #cbd5e1; margin-right: 10px; flex-shrink: 0; }',
      '.cf-export-item .dot.done { background: #22c55e; }',
      '.cf-export-item .dot.active { background: #6366f1; animation: cf-pulse 1s infinite; }',
      '@keyframes cf-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }',
      '.cf-export-actions { display: flex; gap: 12px; }',
      '.cf-export-btn { padding: 12px 24px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; transition: background 0.15s; }',
      '.cf-export-btn-json { background: #6366f1; color: #fff; }',
      '.cf-export-btn-json:hover { background: #4f46e5; }',
      '.cf-export-btn-zip { background: #f1f5f9; color: #334155; }',
      '.cf-export-btn-zip:hover { background: #e2e8f0; }',
      '.cf-export-btn:disabled { opacity: 0.5; cursor: not-allowed; }',
      '.cf-export-progress { margin-top: 16px; }',
      '.cf-export-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }',
      '.cf-export-progress-fill { height: 100%; background: #6366f1; border-radius: 3px; transition: width 0.3s; width: 0%; }',
      '.cf-export-progress-text { font-size: 13px; color: #64748b; margin-top: 8px; }',
      '.cf-export-done { font-size: 14px; color: #22c55e; font-weight: 500; margin-top: 12px; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function render(container) {
    injectCSS();

    var html = '<div class="cf-export-panel">' +
      '<h3>Export Your Data</h3>' +
      '<p>Download a copy of all your data stored in Cortex Freelancer. This includes your profile, proposals, bookmarks, analytics, and settings.</p>' +
      '<div class="cf-export-items">' +
        EXPORT_COLLECTIONS.map(function (item) {
          return '<div class="cf-export-item" data-key="' + item.key + '">' +
            '<span style="display:flex;align-items:center"><span class="dot"></span>' + item.label + '</span>' +
            '<span class="status" style="font-size:12px;color:#94a3b8">Pending</span>' +
          '</div>';
        }).join('') +
      '</div>' +
      '<div class="cf-export-actions">' +
        '<button class="cf-export-btn cf-export-btn-json" id="cf-export-json">Export as JSON</button>' +
        '<button class="cf-export-btn cf-export-btn-zip" id="cf-export-zip">Export as ZIP</button>' +
      '</div>' +
      '<div class="cf-export-progress" style="display:none" id="cf-export-progress">' +
        '<div class="cf-export-progress-bar"><div class="cf-export-progress-fill" id="cf-export-fill"></div></div>' +
        '<div class="cf-export-progress-text" id="cf-export-text">Preparing export...</div>' +
      '</div>' +
    '</div>';

    container.innerHTML = html;

    var jsonBtn = container.querySelector('#cf-export-json');
    var zipBtn = container.querySelector('#cf-export-zip');

    function startExport(format) {
      jsonBtn.disabled = true;
      zipBtn.disabled = true;
      var progressWrap = container.querySelector('#cf-export-progress');
      var fill = container.querySelector('#cf-export-fill');
      var text = container.querySelector('#cf-export-text');
      progressWrap.style.display = 'block';

      var onProgress = function (done, total, label) {
        var pct = Math.round((done / total) * 100);
        fill.style.width = pct + '%';
        text.textContent = 'Exporting: ' + label + ' (' + done + '/' + total + ')';

        var item = container.querySelector('[data-key]');
        container.querySelectorAll('[data-key]').forEach(function (el, i) {
          var dot = el.querySelector('.dot');
          var status = el.querySelector('.status');
          if (i < done) {
            dot.className = 'dot done';
            status.textContent = 'Done';
            status.style.color = '#22c55e';
          } else if (i === done) {
            dot.className = 'dot active';
            status.textContent = 'Exporting...';
            status.style.color = '#6366f1';
          }
        });
      };

      var exportFn = format === 'zip' ? exportAsZIP : exportAsJSON;
      exportFn(null, onProgress).then(function () {
        fill.style.width = '100%';
        text.textContent = 'Export complete! Your download should begin shortly.';
        text.style.color = '#22c55e';
        container.querySelectorAll('.dot').forEach(function (d) { d.className = 'dot done'; });
        container.querySelectorAll('.status').forEach(function (s) { s.textContent = 'Done'; s.style.color = '#22c55e'; });
        jsonBtn.disabled = false;
        zipBtn.disabled = false;
      }).catch(function (err) {
        text.textContent = 'Export failed: ' + err.message;
        text.style.color = '#dc2626';
        jsonBtn.disabled = false;
        zipBtn.disabled = false;
      });
    }

    jsonBtn.addEventListener('click', function () { startExport('json'); });
    zipBtn.addEventListener('click', function () { startExport('zip'); });
  }

  window.CortexFreelancer.DataExport = {
    exportAsJSON: exportAsJSON,
    exportAsZIP: exportAsZIP,
    collectUserData: collectUserData,
    render: render
  };
})();
