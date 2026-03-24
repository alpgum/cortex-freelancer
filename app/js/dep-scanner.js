/**
 * CF-280 Dependency Vulnerability Scanner
 * Parse package.json, check against known vulnerability patterns, generate report
 */
(function() {
  const ns = (window.CortexFreelancer = window.CortexFreelancer || {});

  // Known vulnerability database (simplified pattern matching)
  const VULN_DB = [
    { package: 'lodash', below: '4.17.21', severity: 'high', cve: 'CVE-2021-23337', title: 'Command Injection via template' },
    { package: 'minimist', below: '1.2.6', severity: 'critical', cve: 'CVE-2021-44906', title: 'Prototype Pollution' },
    { package: 'json5', below: '2.2.2', severity: 'high', cve: 'CVE-2022-46175', title: 'Prototype Pollution' },
    { package: 'semver', below: '7.5.2', severity: 'medium', cve: 'CVE-2022-25883', title: 'ReDoS vulnerability' },
    { package: 'tough-cookie', below: '4.1.3', severity: 'medium', cve: 'CVE-2023-26136', title: 'Prototype Pollution' },
    { package: 'word-wrap', below: '1.2.4', severity: 'medium', cve: 'CVE-2023-26115', title: 'ReDoS vulnerability' },
    { package: 'axios', below: '1.6.0', severity: 'high', cve: 'CVE-2023-45857', title: 'CSRF token exposure via XSRF-TOKEN cookie' },
    { package: 'express', below: '4.19.2', severity: 'medium', cve: 'CVE-2024-29041', title: 'Open redirect via malformed URL' },
    { package: 'follow-redirects', below: '1.15.4', severity: 'medium', cve: 'CVE-2023-26159', title: 'URL redirection to untrusted site' },
    { package: 'ip', below: '2.0.1', severity: 'high', cve: 'CVE-2024-29415', title: 'SSRF bypass via octal IP notation' },
    { package: 'tar', below: '6.2.1', severity: 'high', cve: 'CVE-2024-28863', title: 'Denial of Service' },
    { package: 'braces', below: '3.0.3', severity: 'medium', cve: 'CVE-2024-4068', title: 'ReDoS via unbalanced braces' },
    { package: 'ws', below: '8.17.1', severity: 'high', cve: 'CVE-2024-37890', title: 'DoS when handling request with many HTTP headers' },
    { package: 'path-to-regexp', below: '6.3.0', severity: 'high', cve: 'CVE-2024-45296', title: 'ReDoS vulnerability' },
    { package: 'cookie', below: '0.7.0', severity: 'medium', cve: 'CVE-2024-47764', title: 'Cookie parsing accepts invalid characters' }
  ];

  function parseVersion(ver) {
    if (!ver) return [0, 0, 0];
    const clean = ver.replace(/^[^\d]*/, '');
    const parts = clean.split('.').map(Number);
    return [parts[0] || 0, parts[1] || 0, parts[2] || 0];
  }

  function isBelow(version, threshold) {
    const v = parseVersion(version);
    const t = parseVersion(threshold);
    for (let i = 0; i < 3; i++) {
      if (v[i] < t[i]) return true;
      if (v[i] > t[i]) return false;
    }
    return false;
  }

  function scanDependencies(packageJson) {
    const deps = {
      ...(packageJson.dependencies || {}),
      ...(packageJson.devDependencies || {})
    };

    const findings = [];
    const scanned = [];

    for (const [name, version] of Object.entries(deps)) {
      const entry = { name, version, vulnerabilities: [] };
      for (const vuln of VULN_DB) {
        if (vuln.package === name && isBelow(version, vuln.below)) {
          entry.vulnerabilities.push({
            cve: vuln.cve,
            severity: vuln.severity,
            title: vuln.title,
            fixVersion: vuln.below
          });
        }
      }
      scanned.push(entry);
      if (entry.vulnerabilities.length) findings.push(entry);
    }

    const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
    for (const f of findings) {
      for (const v of f.vulnerabilities) {
        severityCounts[v.severity] = (severityCounts[v.severity] || 0) + 1;
      }
    }

    const totalVulns = Object.values(severityCounts).reduce((a, b) => a + b, 0);

    return {
      scannedCount: scanned.length,
      vulnerableCount: findings.length,
      totalVulnerabilities: totalVulns,
      severityCounts,
      findings,
      scannedAt: new Date().toISOString()
    };
  }

  function checkOutdated(packageJson) {
    const deps = packageJson.dependencies || {};
    const warnings = [];
    for (const [name, version] of Object.entries(deps)) {
      if (version.startsWith('*') || version === 'latest') {
        warnings.push({ name, version, issue: 'Unpinned version — use exact or range' });
      }
      if (/^[<>]/.test(version)) {
        warnings.push({ name, version, issue: 'Comparison range — consider using caret or tilde' });
      }
    }
    return warnings;
  }

  function renderVulnerabilityReport(containerId, packageJson) {
    const el = document.getElementById(containerId);
    if (!el) return;

    if (!packageJson) {
      el.innerHTML = '<p style="color:#94a3b8;font-size:14px">Provide a package.json object to scan.</p>';
      return;
    }

    const report = scanDependencies(packageJson);
    const outdated = checkOutdated(packageJson);
    const sevColor = { critical: '#ef4444', high: '#f97316', medium: '#f59e0b', low: '#3b82f6' };
    const overallStatus = report.severityCounts.critical > 0 ? 'critical' : report.severityCounts.high > 0 ? 'high' : report.totalVulnerabilities > 0 ? 'medium' : 'clean';
    const overallColor = overallStatus === 'clean' ? '#22c55e' : sevColor[overallStatus];

    el.innerHTML = `
      <div style="font-family:var(--font-main,system-ui);max-width:900px">
        <div style="display:flex;align-items:center;gap:12px;margin-bottom:24px">
          <h2 style="margin:0">Vulnerability Report</h2>
          <span style="background:${overallColor};color:#fff;padding:4px 12px;border-radius:12px;font-size:13px;font-weight:600">
            ${report.totalVulnerabilities === 0 ? 'No vulnerabilities found' : report.totalVulnerabilities + ' vulnerabilities'}
          </span>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px">
          ${[
            ['Scanned', report.scannedCount, '#64748b'],
            ['Critical', report.severityCounts.critical, sevColor.critical],
            ['High', report.severityCounts.high, sevColor.high],
            ['Medium', report.severityCounts.medium, sevColor.medium]
          ].map(([label, val, color]) => `
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;text-align:center">
              <div style="font-size:24px;font-weight:700;color:${val > 0 && label !== 'Scanned' ? color : '#1e293b'}">${val}</div>
              <div style="font-size:12px;color:#64748b">${label}</div>
            </div>
          `).join('')}
        </div>

        ${report.findings.length ? `
          <h3 style="margin:0 0 12px;font-size:15px">Vulnerable Dependencies</h3>
          ${report.findings.map(f => `
            <div style="border:1px solid #e2e8f0;border-radius:8px;margin-bottom:12px;overflow:hidden">
              <div style="padding:12px 16px;background:#f8fafc;border-bottom:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
                <strong style="font-size:14px">${f.name} <span style="color:#94a3b8;font-weight:400">${f.version}</span></strong>
                <span style="font-size:12px;color:#64748b">${f.vulnerabilities.length} issue${f.vulnerabilities.length > 1 ? 's' : ''}</span>
              </div>
              ${f.vulnerabilities.map(v => `
                <div style="padding:10px 16px;border-bottom:1px solid #f1f5f9;display:flex;align-items:flex-start;gap:10px">
                  <span style="background:${sevColor[v.severity]};color:#fff;padding:1px 6px;border-radius:8px;font-size:10px;font-weight:600;text-transform:uppercase;white-space:nowrap;margin-top:2px">${v.severity}</span>
                  <div style="flex:1;font-size:13px">
                    <div><strong>${v.title}</strong></div>
                    <div style="color:#64748b;font-size:12px">${v.cve} — Fix: upgrade to ${v.fixVersion}+</div>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        ` : '<div style="padding:24px;text-align:center;color:#22c55e;font-weight:600;background:#f0fdf4;border-radius:8px;margin-bottom:16px">No known vulnerabilities detected</div>'}

        ${outdated.length ? `
          <h3 style="margin:24px 0 12px;font-size:15px">Version Warnings</h3>
          <div style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
            ${outdated.map(w => `
              <div style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;display:flex;justify-content:space-between">
                <span><strong>${w.name}</strong> <span style="color:#94a3b8">${w.version}</span></span>
                <span style="color:#f59e0b">${w.issue}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <p style="color:#94a3b8;font-size:11px;margin-top:16px;text-align:right">
          Scanned ${report.scannedCount} dependencies at ${new Date(report.scannedAt).toLocaleTimeString()}
        </p>
      </div>
    `;
  }

  ns.depScanner = {
    VULN_DB, scanDependencies, checkOutdated, isBelow,
    parseVersion, renderVulnerabilityReport
  };
})();
