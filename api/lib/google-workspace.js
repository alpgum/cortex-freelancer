// Google Workspace API Client — Drive, Docs, Sheets
// Reuses Google OAuth tokens from Gmail (extended scopes)

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DOCS_API = 'https://docs.googleapis.com/v1';
const SHEETS_API = 'https://sheets.googleapis.com/v4';

// Additional scopes needed beyond Gmail
const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',        // Create/open files
  'https://www.googleapis.com/auth/drive.readonly',     // List/read files
  'https://www.googleapis.com/auth/documents',          // Google Docs
  'https://www.googleapis.com/auth/spreadsheets',       // Google Sheets
];

/**
 * Get all required scopes (Gmail + Workspace)
 */
function getAllScopes() {
  const gmailScopes = [
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.labels',
  ];
  return [...gmailScopes, ...WORKSPACE_SCOPES].join(' ');
}

// ── Drive API ───────────────────────────────────────────────────────────

/**
 * List files in Google Drive
 * @param {string} accessToken
 * @param {object} options - { query, pageSize, pageToken, orderBy, fields }
 */
async function listFiles(accessToken, options = {}) {
  const params = new URLSearchParams();
  if (options.query) params.set('q', options.query);
  params.set('pageSize', String(options.pageSize || 20));
  if (options.pageToken) params.set('pageToken', options.pageToken);
  params.set('orderBy', options.orderBy || 'modifiedTime desc');
  params.set('fields', options.fields || 'nextPageToken,files(id,name,mimeType,modifiedTime,size,webViewLink,parents)');

  const res = await fetch(`${DRIVE_API}/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive list failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Search files by name or content
 */
async function searchFiles(accessToken, searchQuery, mimeType) {
  let q = `name contains '${searchQuery.replace(/'/g, "\\'")}'`;
  if (mimeType) q += ` and mimeType = '${mimeType}'`;
  q += ' and trashed = false';

  return listFiles(accessToken, { query: q });
}

/**
 * Get file metadata
 */
async function getFile(accessToken, fileId) {
  const fields = 'id,name,mimeType,modifiedTime,size,webViewLink,parents,description,createdTime';
  const res = await fetch(`${DRIVE_API}/files/${fileId}?fields=${fields}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive get file failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Create a new file in Drive
 * @param {string} accessToken
 * @param {object} metadata - { name, mimeType, parents }
 * @param {string|Buffer} content - File content (optional for Google Docs/Sheets)
 */
async function createFile(accessToken, metadata, content) {
  // For Google Docs/Sheets — use metadata-only creation
  if (!content) {
    const res = await fetch(`${DRIVE_API}/files`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Drive create failed (${res.status}): ${body}`);
    }

    return res.json();
  }

  // Multipart upload for files with content
  const boundary = '----CortexUploadBoundary' + Date.now();
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const body = delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${metadata.mimeType || 'application/octet-stream'}\r\n\r\n` +
    (typeof content === 'string' ? content : content.toString()) +
    closeDelimiter;

  const res = await fetch(`${DRIVE_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const respBody = await res.text();
    throw new Error(`Drive upload failed (${res.status}): ${respBody}`);
  }

  return res.json();
}

/**
 * Delete a file (move to trash)
 */
async function trashFile(accessToken, fileId) {
  const res = await fetch(`${DRIVE_API}/files/${fileId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ trashed: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Drive trash failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Google Docs API ─────────────────────────────────────────────────────

/**
 * Get a Google Doc's content
 */
async function getDocument(accessToken, docId) {
  const res = await fetch(`${DOCS_API}/documents/${docId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Docs get failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Create a Google Doc from template
 * @param {string} accessToken
 * @param {string} title
 * @param {object} replacements - { '{{PLACEHOLDER}}': 'value' }
 * @param {string} templateDocId - Optional template doc to copy
 */
async function createDocFromTemplate(accessToken, title, replacements = {}, templateDocId) {
  let docId;

  if (templateDocId) {
    // Copy the template
    const copyRes = await fetch(`${DRIVE_API}/files/${templateDocId}/copy`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: title }),
    });

    if (!copyRes.ok) {
      const body = await copyRes.text();
      throw new Error(`Copy template failed (${copyRes.status}): ${body}`);
    }

    const copied = await copyRes.json();
    docId = copied.id;
  } else {
    // Create blank doc
    const file = await createFile(accessToken, {
      name: title,
      mimeType: 'application/vnd.google-apps.document',
    });
    docId = file.id;
  }

  // Apply replacements if any
  if (Object.keys(replacements).length > 0) {
    const requests = Object.entries(replacements).map(([placeholder, value]) => ({
      replaceAllText: {
        containsText: { text: placeholder, matchCase: true },
        replaceText: String(value),
      },
    }));

    await batchUpdateDocument(accessToken, docId, requests);
  }

  return { docId, title };
}

/**
 * Batch update a Google Doc
 */
async function batchUpdateDocument(accessToken, docId, requests) {
  const res = await fetch(`${DOCS_API}/documents/${docId}:batchUpdate`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ requests }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Docs batch update failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Append text to a Google Doc
 */
async function appendToDocument(accessToken, docId, text) {
  // First get doc to find end index
  const doc = await getDocument(accessToken, docId);
  const endIndex = doc.body?.content?.slice(-1)?.[0]?.endIndex || 1;

  const requests = [{
    insertText: {
      location: { index: endIndex - 1 },
      text,
    },
  }];

  return batchUpdateDocument(accessToken, docId, requests);
}

// ── Google Sheets API ───────────────────────────────────────────────────

/**
 * Get spreadsheet metadata and data
 */
async function getSpreadsheet(accessToken, spreadsheetId, ranges) {
  let url = `${SHEETS_API}/spreadsheets/${spreadsheetId}`;
  if (ranges) {
    const rangeParams = Array.isArray(ranges) ? ranges.map(r => `ranges=${encodeURIComponent(r)}`).join('&') : `ranges=${encodeURIComponent(ranges)}`;
    url += `?${rangeParams}&includeGridData=true`;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets get failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Read values from a range
 */
async function getSheetValues(accessToken, spreadsheetId, range) {
  const res = await fetch(
    `${SHEETS_API}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets read failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Write values to a range
 */
async function updateSheetValues(accessToken, spreadsheetId, range, values) {
  const res = await fetch(
    `${SHEETS_API}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, values }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets write failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Append rows to a sheet
 */
async function appendSheetValues(accessToken, spreadsheetId, range, values) {
  const res = await fetch(
    `${SHEETS_API}/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ range, values }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets append failed (${res.status}): ${body}`);
  }

  return res.json();
}

/**
 * Create a new spreadsheet
 */
async function createSpreadsheet(accessToken, title, sheetTitles = ['Sheet1']) {
  const res = await fetch(`${SHEETS_API}/spreadsheets`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: { title },
      sheets: sheetTitles.map(t => ({ properties: { title: t } })),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets create failed (${res.status}): ${body}`);
  }

  return res.json();
}

// ── Freelancer-specific helpers ─────────────────────────────────────────

const MIME_TYPES = {
  doc: 'application/vnd.google-apps.document',
  sheet: 'application/vnd.google-apps.spreadsheet',
  slide: 'application/vnd.google-apps.presentation',
  folder: 'application/vnd.google-apps.folder',
};

/**
 * Create a project folder structure in Drive
 */
async function createProjectFolder(accessToken, projectName, parentFolderId) {
  // Create main project folder
  const mainFolder = await createFile(accessToken, {
    name: `📁 ${projectName}`,
    mimeType: MIME_TYPES.folder,
    parents: parentFolderId ? [parentFolderId] : undefined,
  });

  // Create subfolders
  const subfolders = ['Contracts', 'Invoices', 'Deliverables', 'Communication'];
  const created = {};

  for (const name of subfolders) {
    const folder = await createFile(accessToken, {
      name,
      mimeType: MIME_TYPES.folder,
      parents: [mainFolder.id],
    });
    created[name.toLowerCase()] = folder.id;
  }

  return {
    folderId: mainFolder.id,
    subfolders: created,
    webViewLink: `https://drive.google.com/drive/folders/${mainFolder.id}`,
  };
}

/**
 * Create a project tracking spreadsheet
 */
async function createProjectTracker(accessToken, projectName, milestones = []) {
  const spreadsheet = await createSpreadsheet(accessToken, `${projectName} — Tracker`, [
    'Tasks', 'Time Log', 'Budget', 'Notes',
  ]);

  // Add headers to Tasks sheet
  await updateSheetValues(accessToken, spreadsheet.spreadsheetId, 'Tasks!A1:F1', [
    ['Task', 'Status', 'Priority', 'Due Date', 'Hours Est.', 'Hours Actual'],
  ]);

  // Add milestone rows if provided
  if (milestones.length > 0) {
    const rows = milestones.map(m => [
      m.name || m, 'Not Started', m.priority || 'Medium', m.dueDate || '', m.hours || '', '',
    ]);
    await appendSheetValues(accessToken, spreadsheet.spreadsheetId, 'Tasks!A2', rows);
  }

  // Add headers to Time Log
  await updateSheetValues(accessToken, spreadsheet.spreadsheetId, 'Time Log!A1:E1', [
    ['Date', 'Task', 'Hours', 'Notes', 'Billable'],
  ]);

  // Add headers to Budget
  await updateSheetValues(accessToken, spreadsheet.spreadsheetId, 'Budget!A1:D1', [
    ['Item', 'Estimated', 'Actual', 'Status'],
  ]);

  return {
    spreadsheetId: spreadsheet.spreadsheetId,
    webViewLink: `https://docs.google.com/spreadsheets/d/${spreadsheet.spreadsheetId}`,
  };
}

module.exports = {
  // Scopes
  WORKSPACE_SCOPES,
  getAllScopes,
  MIME_TYPES,

  // Drive
  listFiles,
  searchFiles,
  getFile,
  createFile,
  trashFile,
  createProjectFolder,

  // Docs
  getDocument,
  createDocFromTemplate,
  batchUpdateDocument,
  appendToDocument,

  // Sheets
  getSpreadsheet,
  getSheetValues,
  updateSheetValues,
  appendSheetValues,
  createSpreadsheet,
  createProjectTracker,
};
