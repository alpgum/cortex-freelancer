/**
 * Google Workspace API — Drive, Docs, Sheets operations
 *
 * GET  /api/google-workspace?action=files     — List Drive files
 * GET  /api/google-workspace?action=search    — Search files
 * GET  /api/google-workspace?action=doc       — Get document content
 * GET  /api/google-workspace?action=sheet     — Get spreadsheet data
 * POST /api/google-workspace?action=create-project — Create project folder + tracker
 * POST /api/google-workspace?action=create-doc     — Create doc from template
 * POST /api/google-workspace?action=append-sheet   — Append rows to spreadsheet
 * POST /api/google-workspace?action=log-time       — Log time entry
 */

const { cors } = require('./middleware/cors');
const { rateLimit } = require('./middleware/rate-limit');
const { withErrorHandler, sendError } = require('./middleware/error-handler');
const { getFirestore } = require('./lib/firestore');
const gmail = require('./lib/gmail');
const workspace = require('./lib/google-workspace');

async function getUserTokens(uid) {
  const firestore = getFirestore();
  if (!firestore) throw new Error('Firestore unavailable');

  const doc = await firestore.collection('gmail_tokens').doc(uid).get();
  if (!doc.exists) return null;

  const tokens = doc.data();
  const valid = await gmail.getValidToken(tokens);

  if (valid.access_token !== tokens.access_token) {
    await firestore.collection('gmail_tokens').doc(uid).set(valid, { merge: true });
  }

  return valid;
}

module.exports = withErrorHandler(async function handler(req, res) {
  if (cors(req, res)) return;
  if (rateLimit(req, res)) return;

  const action = req.query.action || req.body?.action;
  const uid = req.query.uid || req.body?.uid;

  if (!uid) return sendError(res, 400, 'uid required', 'MISSING_UID', 'validation_error');

  const tokens = await getUserTokens(uid);
  if (!tokens) {
    return sendError(res, 401, 'Google not connected. Please authorize first.', 'NOT_CONNECTED', 'auth_error');
  }

  const at = tokens.access_token;

  // ── GET actions ─────────────────────────────────────────────────────
  if (req.method === 'GET') {
    switch (action) {
      case 'files': {
        const files = await workspace.listFiles(at, {
          query: req.query.q,
          pageSize: parseInt(req.query.pageSize) || 20,
          pageToken: req.query.pageToken,
        });
        return res.json({ success: true, ...files });
      }

      case 'search': {
        const q = req.query.q;
        if (!q) return sendError(res, 400, 'q (search query) required', 'MISSING_QUERY', 'validation_error');
        const results = await workspace.searchFiles(at, q, req.query.mimeType);
        return res.json({ success: true, ...results });
      }

      case 'doc': {
        const docId = req.query.docId;
        if (!docId) return sendError(res, 400, 'docId required', 'MISSING_DOC_ID', 'validation_error');
        const doc = await workspace.getDocument(at, docId);
        return res.json({ success: true, document: doc });
      }

      case 'sheet': {
        const sheetId = req.query.spreadsheetId;
        const range = req.query.range;
        if (!sheetId) return sendError(res, 400, 'spreadsheetId required', 'MISSING_SHEET_ID', 'validation_error');

        if (range) {
          const values = await workspace.getSheetValues(at, sheetId, range);
          return res.json({ success: true, ...values });
        }

        const sheet = await workspace.getSpreadsheet(at, sheetId);
        return res.json({ success: true, spreadsheet: sheet });
      }

      default:
        return sendError(res, 400, `Unknown action: ${action}. Use: files, search, doc, sheet`, 'UNKNOWN_ACTION', 'validation_error');
    }
  }

  // ── POST actions ────────────────────────────────────────────────────
  if (req.method === 'POST') {
    switch (action) {
      case 'create-project': {
        const { projectName, milestones, parentFolderId } = req.body;
        if (!projectName) return sendError(res, 400, 'projectName required', 'MISSING_PROJECT_NAME', 'validation_error');

        const folder = await workspace.createProjectFolder(at, projectName, parentFolderId);
        const tracker = await workspace.createProjectTracker(at, projectName, milestones || []);

        // Log project creation
        const firestore = getFirestore();
        if (firestore) {
          await firestore.collection('workspace_projects').add({
            uid,
            projectName,
            folderId: folder.folderId,
            spreadsheetId: tracker.spreadsheetId,
            createdAt: new Date().toISOString(),
          }).catch(() => {});
        }

        return res.json({
          success: true,
          folder,
          tracker,
          message: `Project "${projectName}" created with folder structure and tracker`,
        });
      }

      case 'create-doc': {
        const { title, templateDocId, replacements } = req.body;
        if (!title) return sendError(res, 400, 'title required', 'MISSING_TITLE', 'validation_error');

        const doc = await workspace.createDocFromTemplate(at, title, replacements || {}, templateDocId);
        return res.json({ success: true, ...doc });
      }

      case 'create-sheet': {
        const { title, sheetTitles } = req.body;
        if (!title) return sendError(res, 400, 'title required', 'MISSING_TITLE', 'validation_error');

        const created = await workspace.createSpreadsheet(at, title, Array.isArray(sheetTitles) && sheetTitles.length ? sheetTitles : ['Sheet1']);
        const spreadsheetId = created.spreadsheetId;

        return res.json({
          success: true,
          spreadsheetId,
          webViewLink: spreadsheetId ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}` : null,
        });
      }

      case 'create-folder': {
        const { folderName, parentFolderId } = req.body;
        if (!folderName) return sendError(res, 400, 'folderName required', 'MISSING_FOLDER_NAME', 'validation_error');

        const folder = await workspace.createProjectFolder(at, folderName, parentFolderId);
        return res.json({ success: true, folder });
      }

      case 'append-sheet': {
        const { spreadsheetId, range, values } = req.body;
        if (!spreadsheetId) return sendError(res, 400, 'spreadsheetId required', 'MISSING_SHEET_ID', 'validation_error');
        if (!values || !Array.isArray(values)) return sendError(res, 400, 'values (2D array) required', 'MISSING_VALUES', 'validation_error');

        const result = await workspace.appendSheetValues(at, spreadsheetId, range || 'Sheet1!A1', values);
        return res.json({ success: true, ...result });
      }

      case 'log-time': {
        const { spreadsheetId, date, task, hours, notes, billable } = req.body;
        if (!spreadsheetId || !task || !hours) {
          return sendError(res, 400, 'spreadsheetId, task, hours required', 'MISSING_FIELDS', 'validation_error');
        }

        const result = await workspace.appendSheetValues(at, spreadsheetId, 'Time Log!A2', [
          [date || new Date().toISOString().slice(0, 10), task, hours, notes || '', billable !== false ? 'Yes' : 'No'],
        ]);

        return res.json({ success: true, ...result, message: `Logged ${hours}h for "${task}"` });
      }

      default:
        return sendError(res, 400, `Unknown action: ${action}. Use: create-project, create-doc, create-sheet, create-folder, append-sheet, log-time`, 'UNKNOWN_ACTION', 'validation_error');
    }
  }

  sendError(res, 405, 'Method not allowed', 'METHOD_NOT_ALLOWED', 'validation_error');
});
