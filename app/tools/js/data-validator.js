/**
 * CortexDataValidator — localStorage data integrity validator [cf3-035]
 * Validates data integrity across all localStorage models:
 *   - Orphaned references (project → deleted client, invoice → missing project)
 *   - Data type mismatches (string where number expected, etc.)
 *   - Missing required fields
 *   - Corrupted JSON
 *   - Invalid enum values
 *   - Duplicate record IDs
 * Auto-repairs where possible, reports issues silently.
 * Provides manual validation UI via settings Data Health tab.
 *
 * window.CortexDataValidator
 */
(function () {
  'use strict';

  var VERSION = '2.0.0';
  var LOG_KEY = 'cortex_validator_log';
  var MAX_LOG_ENTRIES = 50;

  /* ── Schema Definitions ────────────────────────────────── */

  var SCHEMAS = {
    cortex_client_crm: {
      type: 'array',
      label: 'Clients (CRM)',
      required: ['id', 'name', 'createdAt'],
      fields: {
        id:           { type: 'string' },
        name:         { type: 'string' },
        company:      { type: 'string', default: '' },
        email:        { type: 'string', default: '' },
        platform:     { type: 'string', default: '' },
        tag:          { type: 'string', enum: ['hot', 'warm', 'cold', 'lost', ''], default: '' },
        industry:     { type: 'string', enum: ['saas', 'ecommerce', 'agency', 'startup', 'fintech', 'healthcare', 'education', 'media', 'consulting', 'other', ''], default: '' },
        followUpDate: { type: 'string', nullable: true },
        source:       { type: 'string', default: '' },
        notes:        { type: 'array', default: [] },
        communications: { type: 'array', default: [] },
        createdAt:    { type: 'string' },
        updatedAt:    { type: 'string', default: '' }
      }
    },

    cortex_client_directory: {
      type: 'object',
      label: 'Client Directory',
      wrapper: 'clients',
      required: ['id', 'name'],
      fields: {
        id:           { type: 'string' },
        name:         { type: 'string' },
        company:      { type: 'string', default: '' },
        email:        { type: 'string', default: '' },
        phone:        { type: 'string', default: '' },
        status:       { type: 'string', enum: ['active', 'prospect', 'inactive', 'archived', ''], default: 'active' },
        hourlyRate:   { type: 'string', default: '' },
        paymentTerms: { type: 'string', default: '' },
        tags:         { type: 'array', default: [] },
        notes:        { type: 'string', default: '' },
        website:      { type: 'string', default: '' },
        address:      { type: 'string', default: '' },
        timezone:     { type: 'string', default: '' },
        rating:       { type: 'number', default: 0 },
        projects:     { type: 'array', default: [] },
        createdAt:    { type: 'string', default: '' },
        updatedAt:    { type: 'string', default: '' }
      }
    },

    cortex_projects: {
      type: 'array',
      label: 'Projects',
      required: ['id', 'name', 'createdAt'],
      fields: {
        id:           { type: 'string' },
        name:         { type: 'string' },
        clientId:     { type: 'string', nullable: true, ref: 'cortex_client_crm' },
        clientName:   { type: 'string', default: '' },
        status:       { type: 'string', enum: ['lead', 'active', 'completed', 'archived'], default: 'lead' },
        budget:       { type: 'number', default: 0 },
        hourlyRate:   { type: 'number', default: 0 },
        deadline:     { type: 'string', nullable: true },
        tags:         { type: 'array', default: [] },
        description:  { type: 'string', default: '' },
        currency:     { type: 'string', default: 'USD' },
        timeEntryIds: { type: 'array', default: [] },
        invoiceIds:   { type: 'array', default: [] },
        proposalIds:  { type: 'array', default: [] },
        totalLogged:  { type: 'number', default: 0 },
        totalBilled:  { type: 'number', default: 0 },
        createdAt:    { type: 'string' },
        updatedAt:    { type: 'string', default: '' }
      }
    },

    cf_proposal_tracker: {
      type: 'array',
      label: 'Proposals',
      required: ['id', 'jobTitle'],
      fields: {
        id:            { type: 'string' },
        jobId:         { type: 'string', nullable: true },
        jobTitle:      { type: 'string' },
        clientName:    { type: 'string', default: 'Unknown Client' },
        category:      { type: 'string', default: 'General' },
        budget:        { type: 'number', nullable: true },
        status:        { type: 'string', enum: ['sent', 'viewed', 'shortlisted', 'hired', 'rejected'], default: 'sent' },
        submittedAt:   { type: 'string', default: '' },
        statusHistory: { type: 'array', default: [] },
        notes:         { type: 'string', default: '' }
      }
    },

    cortex_invoices: {
      type: 'array',
      label: 'Invoices',
      required: ['number', 'clientName'],
      fields: {
        number:      { type: 'string' },
        date:        { type: 'string', default: '' },
        due:         { type: 'string', default: '' },
        status:      { type: 'string', enum: ['draft', 'sent', 'viewed', 'partial', 'paid', 'overdue', 'cancelled'], default: 'draft' },
        clientName:  { type: 'string' },
        clientEmail: { type: 'string', default: '' },
        items:       { type: 'array', default: [] },
        tax:         { type: 'number', default: 0 },
        currency:    { type: 'string', default: 'USD' },
        notes:       { type: 'string', default: '' },
        paidAmount:  { type: 'number', default: 0 }
      }
    },

    cortex_invoice_payments: {
      type: 'array',
      label: 'Invoice Payments',
      required: ['invoiceNumber', 'amount'],
      fields: {
        id:            { type: 'string' },
        invoiceNumber: { type: 'string', ref: 'cortex_invoices' },
        amount:        { type: 'number' },
        method:        { type: 'string', enum: ['bank_transfer', 'credit_card', 'paypal', 'stripe', 'cash', 'check', 'crypto', 'wise', 'other', ''], default: '' },
        reference:     { type: 'string', default: '' },
        date:          { type: 'string', default: '' },
        notes:         { type: 'string', default: '' },
        currency:      { type: 'string', default: 'USD' },
        createdAt:     { type: 'string', default: '' }
      }
    },

    cf_time_entries: {
      type: 'array',
      label: 'Time Entries (Timer)',
      required: ['id'],
      fields: {
        id:        { type: 'string' },
        project:   { type: 'string', default: 'Unassigned' },
        task:      { type: 'string', default: '' },
        startTime: { type: 'number' },
        endTime:   { type: 'number', nullable: true },
        duration:  { type: 'number', default: 0 }
      }
    },

    cortex_time_entries: {
      type: 'array',
      label: 'Time Entries (Manual)',
      required: ['id'],
      fields: {
        id:          { type: 'string' },
        date:        { type: 'string', default: '' },
        startTime:   { type: 'string', default: '' },
        endTime:     { type: 'string', default: '' },
        hours:       { type: 'number', default: 0 },
        project:     { type: 'string', default: 'Unassigned' },
        client:      { type: 'string', default: '' },
        description: { type: 'string', default: '' },
        duration:    { type: 'number', default: 0 },
        tags:        { type: 'array', default: [] }
      }
    },

    cortex_expenses: {
      type: 'array',
      label: 'Expenses',
      required: ['id'],
      fields: {
        id:         { type: 'string' },
        date:       { type: 'string', default: '' },
        category:   { type: 'string', enum: ['software', 'hardware', 'office', 'travel', 'education', 'marketing', 'professional', 'utilities', 'other', ''], default: '' },
        amount:     { type: 'number', default: 0 },
        note:       { type: 'string', default: '' },
        deductible: { type: 'boolean', default: true }
      }
    },

    cortex_expenses_revenue: {
      type: 'array',
      label: 'Revenue Entries',
      required: ['id'],
      fields: {
        id:     { type: 'string' },
        month:  { type: 'string', default: '' },
        amount: { type: 'number', default: 0 }
      }
    },

    cortex_case_studies: {
      type: 'array',
      label: 'Case Studies',
      required: [],
      fields: {}
    },

    cortex_testimonials: {
      type: 'array',
      label: 'Testimonials',
      required: [],
      fields: {}
    },

    cortex_saved_jobs: {
      type: 'array',
      label: 'Saved Jobs',
      required: [],
      fields: {}
    },

    cortex_saved_searches: {
      type: 'array',
      label: 'Saved Searches',
      required: [],
      fields: {}
    },

    cortex_comm_templates: {
      type: 'array',
      label: 'Communication Templates',
      required: ['id'],
      fields: {
        id:        { type: 'string' },
        name:      { type: 'string', default: 'Untitled' },
        category:  { type: 'string', default: '' },
        content:   { type: 'string', default: '' },
        variables: { type: 'array', default: [] },
        createdAt: { type: 'string', default: '' }
      }
    },

    cortex_followup_reminders: {
      type: 'array',
      label: 'Follow-up Reminders',
      required: ['id'],
      fields: {
        id:           { type: 'string' },
        type:         { type: 'string', default: '' },
        status:       { type: 'string', enum: ['pending', 'sent', 'completed', 'dismissed', ''], default: 'pending' },
        scheduledFor: { type: 'string', default: '' },
        message:      { type: 'string', default: '' },
        createdAt:    { type: 'string', default: '' }
      }
    }
  };

  /* ── Helpers ───────────────────────────────────────────── */

  function now() {
    return new Date().toISOString();
  }

  function safeLoad(key) {
    var raw;
    try {
      raw = localStorage.getItem(key);
    } catch (e) {
      return { error: 'storage_access', raw: null, data: null };
    }
    if (raw === null) return { error: null, raw: null, data: null };
    try {
      var parsed = JSON.parse(raw);
      return { error: null, raw: raw, data: parsed };
    } catch (e) {
      return { error: 'corrupted_json', raw: raw, data: null };
    }
  }

  function safeSave(key, data) {
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      return false;
    }
  }

  function idIndex(arr) {
    var map = {};
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].id) map[arr[i].id] = true;
    }
    return map;
  }

  function invoiceNumberIndex(arr) {
    var map = {};
    for (var i = 0; i < arr.length; i++) {
      if (arr[i] && arr[i].number) map[arr[i].number] = true;
    }
    return map;
  }

  /* ── Issue Tracker ─────────────────────────────────────── */

  function createReport() {
    return {
      timestamp: now(),
      version: VERSION,
      issues: [],
      repairs: [],
      keysChecked: 0,
      recordsChecked: 0,
      ok: true
    };
  }

  function addIssue(report, key, recordId, severity, message) {
    report.issues.push({
      key: key,
      recordId: recordId || null,
      severity: severity,
      message: message
    });
    if (severity === 'error') report.ok = false;
  }

  function addRepair(report, key, recordId, action) {
    report.repairs.push({
      key: key,
      recordId: recordId || null,
      action: action
    });
  }

  /* ── Validators ────────────────────────────────────────── */

  function tryRepairJson(raw) {
    var attempts = [
      // Trailing comma before ] or }
      function (s) { return s.replace(/,\s*([}\]])/g, '$1'); },
      // Single quotes → double quotes
      function (s) { return s.replace(/'/g, '"'); },
      // Missing closing bracket
      function (s) {
        if (s.charAt(0) === '[' && s.charAt(s.length - 1) !== ']') return s + ']';
        if (s.charAt(0) === '{' && s.charAt(s.length - 1) !== '}') return s + '}';
        return s;
      }
    ];

    for (var i = 0; i < attempts.length; i++) {
      try {
        var fixed = attempts[i](raw);
        var parsed = JSON.parse(fixed);
        return parsed;
      } catch (e) { /* continue */ }
    }
    return null;
  }

  function validateField(value, spec) {
    if (value === null || value === undefined) {
      if (spec.nullable) return { valid: true };
      if (spec.default !== undefined) return { valid: false, repaired: spec.default, reason: 'missing_field' };
      return { valid: false, reason: 'missing_required' };
    }

    var actualType = Array.isArray(value) ? 'array' : typeof value;

    // Type check
    if (spec.type === 'array' && !Array.isArray(value)) {
      return { valid: false, repaired: spec.default || [], reason: 'type_mismatch_expected_array' };
    }
    if (spec.type === 'number' && actualType !== 'number') {
      var num = Number(value);
      if (!isNaN(num)) return { valid: false, repaired: num, reason: 'type_coerced_to_number' };
      return { valid: false, repaired: spec.default !== undefined ? spec.default : 0, reason: 'type_mismatch_expected_number' };
    }
    if (spec.type === 'string' && actualType !== 'string') {
      return { valid: false, repaired: String(value), reason: 'type_coerced_to_string' };
    }
    if (spec.type === 'boolean' && actualType !== 'boolean') {
      return { valid: false, repaired: !!value, reason: 'type_coerced_to_boolean' };
    }

    // Enum check
    if (spec.enum && spec.enum.indexOf(value) === -1) {
      return { valid: false, repaired: spec.default !== undefined ? spec.default : spec.enum[0], reason: 'invalid_enum_value' };
    }

    return { valid: true };
  }

  function validateRecord(record, schema, key, report) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) {
      addIssue(report, key, null, 'error', 'Record is not an object');
      return null;
    }

    var recordId = record.id || record.number || '(unknown)';
    var repaired = false;

    // Check required fields
    for (var r = 0; r < schema.required.length; r++) {
      var reqField = schema.required[r];
      if (!record[reqField] && record[reqField] !== 0) {
        addIssue(report, key, recordId, 'error', 'Missing required field: ' + reqField);
        if (reqField === 'id' || reqField === 'name' || reqField === 'number' || reqField === 'jobTitle') {
          return null;
        }
        if (schema.fields[reqField] && schema.fields[reqField].default !== undefined) {
          record[reqField] = schema.fields[reqField].default;
          addRepair(report, key, recordId, 'Set default for required field: ' + reqField);
          repaired = true;
        }
      }
    }

    // Validate all schema fields
    var fieldNames = Object.keys(schema.fields);
    for (var f = 0; f < fieldNames.length; f++) {
      var fname = fieldNames[f];
      var spec = schema.fields[fname];
      var result = validateField(record[fname], spec);

      if (!result.valid) {
        if (result.repaired !== undefined) {
          addIssue(report, key, recordId, 'warn', fname + ': ' + result.reason + ' (auto-repaired)');
          addRepair(report, key, recordId, fname + ': ' + result.reason + ' → set to ' + JSON.stringify(result.repaired));
          record[fname] = result.repaired;
          repaired = true;
        } else if (result.reason === 'missing_required') {
          addIssue(report, key, recordId, 'error', 'Missing required field without default: ' + fname);
        }
      }
    }

    return record;
  }

  /* ── Reference Validators ──────────────────────────────── */

  function validateOrphanedRefs(data, report) {
    var clients = safeLoad('cortex_client_crm');
    var clientDir = safeLoad('cortex_client_directory');
    var projects = safeLoad('cortex_projects');
    var invoices = safeLoad('cortex_invoices');
    var proposals = safeLoad('cf_proposal_tracker');
    var timeEntries = safeLoad('cf_time_entries');

    // Build ID indexes — merge CRM + directory client IDs
    var clientIds = {};
    if (clients.data && Array.isArray(clients.data)) {
      var crmIdx = idIndex(clients.data);
      for (var ck in crmIdx) clientIds[ck] = true;
    }
    if (clientDir.data && clientDir.data.clients && Array.isArray(clientDir.data.clients)) {
      var dirIdx = idIndex(clientDir.data.clients);
      for (var dk in dirIdx) clientIds[dk] = true;
    }

    var invoiceNums = (invoices.data && Array.isArray(invoices.data)) ? invoiceNumberIndex(invoices.data) : {};
    var proposalIds = (proposals.data && Array.isArray(proposals.data)) ? idIndex(proposals.data) : {};
    var timeEntryIds = (timeEntries.data && Array.isArray(timeEntries.data)) ? idIndex(timeEntries.data) : {};

    // Also index cortex_time_entries
    var manualTime = safeLoad('cortex_time_entries');
    if (manualTime.data && Array.isArray(manualTime.data)) {
      var mtIdx = idIndex(manualTime.data);
      for (var mk in mtIdx) timeEntryIds[mk] = true;
    }

    // Check project → client references
    if (projects.data && Array.isArray(projects.data)) {
      var projectsDirty = false;
      for (var p = 0; p < projects.data.length; p++) {
        var proj = projects.data[p];
        if (!proj) continue;

        // Orphaned clientId
        if (proj.clientId && !clientIds[proj.clientId]) {
          addIssue(report, 'cortex_projects', proj.id, 'warn', 'Orphaned clientId: ' + proj.clientId + ' (client not found)');
          proj.clientId = null;
          addRepair(report, 'cortex_projects', proj.id, 'Cleared orphaned clientId');
          projectsDirty = true;
        }

        // Orphaned invoiceIds
        if (proj.invoiceIds && Array.isArray(proj.invoiceIds)) {
          var cleanInvoiceIds = [];
          for (var ii = 0; ii < proj.invoiceIds.length; ii++) {
            if (invoiceNums[proj.invoiceIds[ii]]) {
              cleanInvoiceIds.push(proj.invoiceIds[ii]);
            } else {
              addIssue(report, 'cortex_projects', proj.id, 'warn', 'Orphaned invoiceId: ' + proj.invoiceIds[ii]);
              addRepair(report, 'cortex_projects', proj.id, 'Removed orphaned invoiceId: ' + proj.invoiceIds[ii]);
              projectsDirty = true;
            }
          }
          proj.invoiceIds = cleanInvoiceIds;
        }

        // Orphaned proposalIds
        if (proj.proposalIds && Array.isArray(proj.proposalIds)) {
          var cleanProposalIds = [];
          for (var pi = 0; pi < proj.proposalIds.length; pi++) {
            if (proposalIds[proj.proposalIds[pi]]) {
              cleanProposalIds.push(proj.proposalIds[pi]);
            } else {
              addIssue(report, 'cortex_projects', proj.id, 'warn', 'Orphaned proposalId: ' + proj.proposalIds[pi]);
              addRepair(report, 'cortex_projects', proj.id, 'Removed orphaned proposalId: ' + proj.proposalIds[pi]);
              projectsDirty = true;
            }
          }
          proj.proposalIds = cleanProposalIds;
        }

        // Orphaned timeEntryIds
        if (proj.timeEntryIds && Array.isArray(proj.timeEntryIds)) {
          var cleanTimeIds = [];
          for (var ti = 0; ti < proj.timeEntryIds.length; ti++) {
            if (timeEntryIds[proj.timeEntryIds[ti]]) {
              cleanTimeIds.push(proj.timeEntryIds[ti]);
            } else {
              addIssue(report, 'cortex_projects', proj.id, 'warn', 'Orphaned timeEntryId: ' + proj.timeEntryIds[ti]);
              addRepair(report, 'cortex_projects', proj.id, 'Removed orphaned timeEntryId: ' + proj.timeEntryIds[ti]);
              projectsDirty = true;
            }
          }
          proj.timeEntryIds = cleanTimeIds;
        }
      }
      if (projectsDirty) safeSave('cortex_projects', projects.data);
    }

    // Check payment → invoice references
    var payments = safeLoad('cortex_invoice_payments');
    if (payments.data && Array.isArray(payments.data)) {
      for (var pm = 0; pm < payments.data.length; pm++) {
        var pmt = payments.data[pm];
        if (pmt && pmt.invoiceNumber && !invoiceNums[pmt.invoiceNumber]) {
          addIssue(report, 'cortex_invoice_payments', pmt.id || pmt.invoiceNumber, 'warn',
            'Payment references missing invoice: ' + pmt.invoiceNumber);
        }
      }
    }
  }

  /* ── Duplicate Detection ───────────────────────────────── */

  function checkDuplicateIds(arr, key, report) {
    var seen = {};
    var dupes = [];
    for (var i = 0; i < arr.length; i++) {
      var id = arr[i] && (arr[i].id || arr[i].number);
      if (!id) continue;
      if (seen[id]) {
        dupes.push(i);
        addIssue(report, key, id, 'warn', 'Duplicate record id (keeping first occurrence)');
      } else {
        seen[id] = true;
      }
    }
    if (dupes.length > 0) {
      for (var d = dupes.length - 1; d >= 0; d--) {
        addRepair(report, key, arr[dupes[d]].id || '(dup)', 'Removed duplicate record at index ' + dupes[d]);
        arr.splice(dupes[d], 1);
      }
      return true;
    }
    return false;
  }

  /* ── Unwrap helper for wrapper schemas ─────────────────── */

  function getArray(loaded, schema) {
    if (!loaded.data) return null;
    if (schema.wrapper) {
      if (loaded.data && typeof loaded.data === 'object' && !Array.isArray(loaded.data)) {
        return loaded.data[schema.wrapper] || null;
      }
      return null;
    }
    return loaded.data;
  }

  function setArray(loaded, schema, arr) {
    if (schema.wrapper) {
      loaded.data[schema.wrapper] = arr;
      return loaded.data;
    }
    return arr;
  }

  /* ── Main Validation Loop ──────────────────────────────── */

  function validate(options) {
    var opts = options || {};
    var dryRun = opts.dryRun || false;
    var verbose = opts.verbose || false;
    var report = createReport();

    var keys = Object.keys(SCHEMAS);

    for (var k = 0; k < keys.length; k++) {
      var key = keys[k];
      var schema = SCHEMAS[key];
      report.keysChecked++;

      var loaded = safeLoad(key);

      // Storage access error
      if (loaded.error === 'storage_access') {
        addIssue(report, key, null, 'error', 'Cannot access localStorage');
        continue;
      }

      // Key doesn't exist yet — skip
      if (loaded.raw === null) continue;

      // Corrupted JSON
      if (loaded.error === 'corrupted_json') {
        addIssue(report, key, null, 'error', 'Corrupted JSON data');
        var repaired = tryRepairJson(loaded.raw);
        if (repaired !== null) {
          addRepair(report, key, null, 'Auto-repaired corrupted JSON');
          if (!dryRun) safeSave(key, repaired);
          loaded.data = repaired;
        } else {
          addIssue(report, key, null, 'error', 'JSON could not be auto-repaired — data may need manual recovery');
          continue;
        }
      }

      // Handle wrapped objects (e.g., { clients: [...] })
      var isWrapped = schema.type === 'object' && schema.wrapper;
      var data;

      if (isWrapped) {
        data = getArray(loaded, schema);
        if (data === null) continue; // wrapper key absent or wrong shape
        if (!Array.isArray(data)) {
          addIssue(report, key, null, 'error', 'Expected ' + schema.wrapper + ' to be array, got ' + typeof data);
          continue;
        }
      } else if (schema.type === 'array') {
        data = loaded.data;
        if (!Array.isArray(data)) {
          addIssue(report, key, null, 'error', 'Expected array, got ' + typeof data);
          if (data && typeof data === 'object') {
            data = [data];
            addRepair(report, key, null, 'Wrapped single object in array');
            if (!dryRun) safeSave(key, data);
          } else {
            continue;
          }
        }
      } else {
        continue;
      }

      // Remove null/undefined entries
      var nullCount = 0;
      for (var n = data.length - 1; n >= 0; n--) {
        if (data[n] === null || data[n] === undefined) {
          data.splice(n, 1);
          nullCount++;
        }
      }
      if (nullCount > 0) {
        addIssue(report, key, null, 'warn', nullCount + ' null/undefined entries found');
        addRepair(report, key, null, 'Removed ' + nullCount + ' null entries');
      }

      // Check duplicates
      var hadDupes = checkDuplicateIds(data, key, report);

      // Validate each record
      var dirty = nullCount > 0 || hadDupes;
      if (Object.keys(schema.fields).length > 0) {
        var validRecords = [];
        for (var i = 0; i < data.length; i++) {
          report.recordsChecked++;
          var result = validateRecord(data[i], schema, key, report);
          if (result !== null) {
            validRecords.push(result);
          } else {
            dirty = true;
            addRepair(report, key, null, 'Removed unrecoverable record at index ' + i);
          }
        }
        if (validRecords.length !== data.length) dirty = true;
        data = validRecords;
      } else {
        report.recordsChecked += data.length;
      }

      if (dirty && !dryRun) {
        if (isWrapped) {
          safeSave(key, setArray(loaded, schema, data));
        } else {
          safeSave(key, data);
        }
      }
    }

    // Cross-reference validation
    validateOrphanedRefs(null, report);

    // Log results
    if (!dryRun) saveLog(report);

    if (verbose || report.issues.length > 0) {
      logReport(report);
    }

    return report;
  }

  /* ── Storage Health Summary ─────────────────────────────── */

  function getStorageHealth() {
    var totalBytes = 0;
    var cortexBytes = 0;
    var keyCounts = {};

    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        var v = localStorage.getItem(k) || '';
        var bytes = (k.length + v.length) * 2; // UTF-16
        totalBytes += bytes;
        if (k.indexOf('cortex_') === 0 || k.indexOf('cf_') === 0) {
          cortexBytes += bytes;
          // Count records for known array keys
          if (SCHEMAS[k]) {
            try {
              var parsed = JSON.parse(v);
              var schema = SCHEMAS[k];
              if (schema.wrapper && parsed && parsed[schema.wrapper]) {
                keyCounts[k] = { records: parsed[schema.wrapper].length, bytes: bytes, label: schema.label };
              } else if (Array.isArray(parsed)) {
                keyCounts[k] = { records: parsed.length, bytes: bytes, label: schema.label };
              } else {
                keyCounts[k] = { records: 1, bytes: bytes, label: schema.label };
              }
            } catch (e) {
              keyCounts[k] = { records: 0, bytes: bytes, label: SCHEMAS[k].label, error: true };
            }
          }
        }
      }
    } catch (e) { /* silent */ }

    return {
      totalBytes: totalBytes,
      cortexBytes: cortexBytes,
      totalKeys: localStorage.length,
      models: keyCounts,
      quotaEstimate: 5 * 1024 * 1024, // 5MB typical
      usagePercent: Math.round((totalBytes / (5 * 1024 * 1024)) * 100)
    };
  }

  /* ── Logging ───────────────────────────────────────────── */

  function saveLog(report) {
    try {
      var logs = JSON.parse(localStorage.getItem(LOG_KEY)) || [];
      logs.unshift({
        timestamp: report.timestamp,
        issues: report.issues.length,
        repairs: report.repairs.length,
        keysChecked: report.keysChecked,
        recordsChecked: report.recordsChecked,
        ok: report.ok
      });
      if (logs.length > MAX_LOG_ENTRIES) logs.length = MAX_LOG_ENTRIES;
      localStorage.setItem(LOG_KEY, JSON.stringify(logs));
    } catch (e) { /* silent */ }
  }

  function logReport(report) {
    if (typeof console === 'undefined') return;

    if (report.issues.length === 0) {
      console.log('[CortexDataValidator] All data OK (' + report.recordsChecked + ' records checked)');
      return;
    }

    console.group('[CortexDataValidator] Integrity report');
    console.log('Keys checked:', report.keysChecked);
    console.log('Records checked:', report.recordsChecked);
    console.log('Issues:', report.issues.length);
    console.log('Auto-repairs:', report.repairs.length);

    for (var i = 0; i < report.issues.length; i++) {
      var issue = report.issues[i];
      var method = issue.severity === 'error' ? 'error' : 'warn';
      console[method]('[' + issue.key + '] ' + (issue.recordId ? issue.recordId + ': ' : '') + issue.message);
    }

    if (report.repairs.length > 0) {
      console.log('--- Repairs applied ---');
      for (var r = 0; r < report.repairs.length; r++) {
        var rep = report.repairs[r];
        console.log('[' + rep.key + '] ' + (rep.recordId ? rep.recordId + ': ' : '') + rep.action);
      }
    }

    console.groupEnd();
  }

  /* ── Public API ────────────────────────────────────────── */

  window.CortexDataValidator = {
    version: VERSION,
    schemas: SCHEMAS,

    /** Run full validation. Options: { dryRun: bool, verbose: bool } */
    validate: validate,

    /** Run in dry-run mode (report only, no changes) */
    check: function () {
      return validate({ dryRun: true, verbose: true });
    },

    /** Run full validation + repair */
    repair: function () {
      return validate({ dryRun: false, verbose: true });
    },

    /** Get storage health summary */
    getHealth: getStorageHealth,

    /** Get validation history */
    getLog: function () {
      try {
        return JSON.parse(localStorage.getItem(LOG_KEY)) || [];
      } catch (e) {
        return [];
      }
    },

    /** Clear validation log */
    clearLog: function () {
      try { localStorage.removeItem(LOG_KEY); } catch (e) { /* silent */ }
    }
  };

  /* ── Auto-run on startup (silent) ──────────────────────── */

  function init() {
    try {
      validate({ dryRun: false, verbose: false });
    } catch (e) {
      if (typeof console !== 'undefined') {
        console.error('[CortexDataValidator] Init error:', e);
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 100);
  }

})();
