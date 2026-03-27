/**
 * Cortex Freelancer — Gmail Integration Prep
 * CF3-MVP-004: OAuth2 structure, email templates, mock sending UI
 *
 * For MVP: Mocks email sending; real Gmail integration via /api/gmail-auth post-MVP
 */
;(function(global) {
  'use strict';

  var KEYS = {
    GMAIL_STATE: 'cortex_gmail_state',
    EMAIL_TEMPLATES: 'cortex_email_templates',
    EMAIL_HISTORY: 'cortex_email_history',
    SETTINGS: 'cortex_settings'
  };

  function load(key, fb) {
    try { var r = localStorage.getItem(key); return r ? JSON.parse(r) : fb; } catch(e) { return fb; }
  }
  function save(key, val) { localStorage.setItem(key, JSON.stringify(val)); }

  // ── Built-in Email Templates ──────────────────────────
  var DEFAULT_TEMPLATES = [
    {
      id: 'proposal_followup',
      name: 'Proposal Follow-Up',
      category: 'proposals',
      subject: 'Following up on my proposal — {{projectTitle}}',
      body: 'Hi {{clientName}},\n\nI wanted to follow up on the proposal I submitted {{daysSince}} days ago for {{projectTitle}}.\n\nI\'m still very interested in this project and believe my experience with {{keySkill}} makes me an excellent fit. I\'d love to answer any questions you might have.\n\nWould you be available for a quick call this week?\n\nBest regards,\n{{userName}}',
      variables: ['clientName', 'projectTitle', 'daysSince', 'keySkill', 'userName']
    },
    {
      id: 'invoice_reminder',
      name: 'Invoice Reminder',
      category: 'payments',
      subject: 'Friendly reminder: Invoice #{{invoiceNumber}} — {{amount}} due',
      body: 'Hi {{clientName}},\n\nJust a friendly reminder that Invoice #{{invoiceNumber}} for {{amount}} is due on {{dueDate}}.\n\nYou can find the invoice attached or I can resend it if needed. Payment can be made via {{paymentMethod}}.\n\nPlease let me know if you have any questions!\n\nBest,\n{{userName}}',
      variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate', 'paymentMethod', 'userName']
    },
    {
      id: 'project_update',
      name: 'Project Status Update',
      category: 'projects',
      subject: 'Project Update: {{projectTitle}} — Week {{weekNumber}}',
      body: 'Hi {{clientName}},\n\nHere\'s your weekly update on {{projectTitle}}:\n\n**Completed this week:**\n{{completedItems}}\n\n**In progress:**\n{{inProgressItems}}\n\n**Next week\'s plan:**\n{{nextWeekPlan}}\n\n**Hours logged:** {{hoursLogged}}h\n**Budget used:** {{budgetUsed}}%\n\nEverything is on track. Let me know if you have any questions or would like to adjust priorities.\n\nBest,\n{{userName}}',
      variables: ['clientName', 'projectTitle', 'weekNumber', 'completedItems', 'inProgressItems', 'nextWeekPlan', 'hoursLogged', 'budgetUsed', 'userName']
    },
    {
      id: 'thank_you',
      name: 'Thank You / Project Complete',
      category: 'client_relations',
      subject: 'Thank you — {{projectTitle}} complete! 🎉',
      body: 'Hi {{clientName}},\n\nI\'m delighted to let you know that {{projectTitle}} is now complete!\n\nIt\'s been a great experience working with you. The final deliverables are ready for your review.\n\nIf you\'re happy with the work, I\'d really appreciate a review or testimonial — it helps me grow my freelance business.\n\nI\'d love to work with you again in the future. Don\'t hesitate to reach out for any new projects!\n\nBest regards,\n{{userName}}',
      variables: ['clientName', 'projectTitle', 'userName']
    },
    {
      id: 'availability_update',
      name: 'Availability Update',
      category: 'client_relations',
      subject: 'Availability Update — {{month}} {{year}}',
      body: 'Hi {{clientName}},\n\nI wanted to let you know about my availability for {{month}}:\n\n**Available hours:** {{availableHours}}h/week\n**Start date:** {{startDate}}\n\nI have capacity for {{projectType}} projects and would love to discuss any upcoming needs you have.\n\nBest,\n{{userName}}',
      variables: ['clientName', 'month', 'year', 'availableHours', 'startDate', 'projectType', 'userName']
    },
    {
      id: 'rate_increase',
      name: 'Rate Increase Notice',
      category: 'business',
      subject: 'Updated rates effective {{effectiveDate}}',
      body: 'Hi {{clientName}},\n\nI wanted to give you advance notice that my rates will be adjusting effective {{effectiveDate}}.\n\n**New rate:** {{newRate}}/hr (previously {{oldRate}}/hr)\n\nThis reflects my growing expertise and the value I bring to projects. For ongoing projects, the current rate will be honored until completion.\n\nI value our working relationship and look forward to continuing to deliver great results.\n\nBest regards,\n{{userName}}',
      variables: ['clientName', 'effectiveDate', 'newRate', 'oldRate', 'userName']
    }
  ];

  var GmailIntegration = {

    // ── Connection Status ────────────────────────────────
    getConnectionState: function() {
      return load(KEYS.GMAIL_STATE, {
        connected: false,
        email: null,
        lastSync: null,
        mockMode: true
      });
    },

    isConnected: function() {
      return this.getConnectionState().connected;
    },

    // ── OAuth2 Flow (placeholder) ───────────────────────
    connect: async function() {
      var state = this.getConnectionState();

      if (state.mockMode) {
        // Mock connection for demo
        state.connected = true;
        state.email = 'freelancer@gmail.com';
        state.lastSync = new Date().toISOString();
        save(KEYS.GMAIL_STATE, state);
        return { success: true, email: state.email, mock: true };
      }

      // Real OAuth2 flow
      try {
        var resp = await fetch('/api/gmail-auth');
        var data = await resp.json();
        if (data.authUrl) {
          window.open(data.authUrl, '_blank', 'width=500,height=600');
          return { success: true, pending: true, message: 'Complete Google sign-in in the popup.' };
        }
        return data;
      } catch(e) {
        return { success: false, error: 'Gmail connection unavailable. Using mock mode.', mock: true };
      }
    },

    disconnect: function() {
      save(KEYS.GMAIL_STATE, { connected: false, email: null, lastSync: null, mockMode: true });
    },

    // ── Template Management ─────────────────────────────
    getTemplates: function() {
      var custom = load(KEYS.EMAIL_TEMPLATES, []);
      return DEFAULT_TEMPLATES.concat(custom);
    },

    getTemplate: function(id) {
      return this.getTemplates().find(function(t) { return t.id === id; });
    },

    saveCustomTemplate: function(template) {
      var custom = load(KEYS.EMAIL_TEMPLATES, []);
      template.id = template.id || 'custom_' + Date.now();
      template.isCustom = true;
      var idx = custom.findIndex(function(t) { return t.id === template.id; });
      if (idx >= 0) custom[idx] = template;
      else custom.push(template);
      save(KEYS.EMAIL_TEMPLATES, custom);
      return template;
    },

    deleteCustomTemplate: function(id) {
      var custom = load(KEYS.EMAIL_TEMPLATES, []);
      save(KEYS.EMAIL_TEMPLATES, custom.filter(function(t) { return t.id !== id; }));
    },

    // ── Template Rendering ──────────────────────────────
    renderTemplate: function(templateId, variables) {
      var template = this.getTemplate(templateId);
      if (!template) return null;

      var settings = load(KEYS.SETTINGS, {});
      variables = variables || {};
      variables.userName = variables.userName || settings.name || settings.businessName || 'Your Name';

      var subject = template.subject;
      var body = template.body;

      Object.keys(variables).forEach(function(key) {
        var regex = new RegExp('\\{\\{' + key + '\\}\\}', 'g');
        subject = subject.replace(regex, variables[key] || '');
        body = body.replace(regex, variables[key] || '');
      });

      // Replace any remaining placeholders with empty
      subject = subject.replace(/\{\{[^}]+\}\}/g, '[TBD]');
      body = body.replace(/\{\{[^}]+\}\}/g, '[TBD]');

      return { subject: subject, body: body, templateId: templateId };
    },

    // ── Send Email (Mock or Real) ───────────────────────
    sendEmail: async function(email) {
      var state = this.getConnectionState();

      // Validate
      if (!email.to) return { success: false, error: 'Recipient email required' };
      if (!email.subject) return { success: false, error: 'Subject required' };

      var record = {
        id: 'email_' + Date.now(),
        to: email.to,
        subject: email.subject,
        body: email.body,
        templateId: email.templateId || null,
        sentAt: new Date().toISOString(),
        status: 'sent',
        mock: state.mockMode
      };

      if (state.mockMode || !state.connected) {
        // Mock send — just save to history
        record.status = 'sent_mock';
        this.saveToHistory(record);
        return { success: true, mock: true, message: 'Email saved (demo mode). Connect Gmail to send for real.', emailId: record.id };
      }

      // Real send via API
      try {
        var resp = await fetch('/api/gmail-send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ to: email.to, subject: email.subject, body: email.body })
        });
        var data = await resp.json();
        record.status = data.success ? 'sent' : 'failed';
        record.apiResponse = data;
        this.saveToHistory(record);
        return data;
      } catch(e) {
        record.status = 'failed';
        record.error = e.message;
        this.saveToHistory(record);
        return { success: false, error: 'Failed to send email: ' + e.message };
      }
    },

    saveToHistory: function(record) {
      var history = load(KEYS.EMAIL_HISTORY, []);
      history.unshift(record);
      if (history.length > 500) history = history.slice(0, 500);
      save(KEYS.EMAIL_HISTORY, history);
    },

    getHistory: function(limit) {
      return load(KEYS.EMAIL_HISTORY, []).slice(0, limit || 50);
    },

    // ── Proposal Email Helper ───────────────────────────
    sendProposalEmail: async function(proposal, clientEmail) {
      var rendered = this.renderTemplate('proposal_followup', {
        clientName: proposal.clientName || 'there',
        projectTitle: proposal.jobTitle || 'your project',
        daysSince: '3',
        keySkill: (proposal.skills || ['my expertise'])[0]
      });

      return this.sendEmail({
        to: clientEmail,
        subject: rendered.subject,
        body: rendered.body,
        templateId: 'proposal_followup'
      });
    },

    // ── Invoice Email Helper ────────────────────────────
    sendInvoiceEmail: async function(invoice, clientEmail) {
      var rendered = this.renderTemplate('invoice_reminder', {
        clientName: invoice.clientName || 'there',
        invoiceNumber: invoice.id,
        amount: '$' + (invoice.total || 0).toLocaleString(),
        dueDate: invoice.dueDate,
        paymentMethod: 'bank transfer or PayPal'
      });

      return this.sendEmail({
        to: clientEmail,
        subject: rendered.subject,
        body: rendered.body,
        templateId: 'invoice_reminder'
      });
    }
  };

  global.GmailIntegration = GmailIntegration;
})(window);
