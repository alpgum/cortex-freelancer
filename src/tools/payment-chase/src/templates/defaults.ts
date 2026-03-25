import { MessageTemplate, EscalationLevel, ToneStyle } from '../types';

/**
 * Default message templates for each escalation level.
 * Variables: {{clientName}}, {{invoiceNumber}}, {{amount}}, {{currency}},
 *            {{dueDate}}, {{daysOverdue}}, {{freelancerName}}, {{paymentLink}}, etc.
 */
export const DEFAULT_TEMPLATES: MessageTemplate[] = [
  // ── Friendly Reminder (Warm) ─────────────────────────────────
  {
    id: 'default-friendly-email',
    name: 'Friendly Payment Reminder',
    escalation: EscalationLevel.FriendlyReminder,
    tone: ToneStyle.Warm,
    channel: 'email',
    subject: 'Quick reminder: Invoice #{{invoiceNumber}} 🙂',
    body: `Hi {{clientName}},

Hope you're doing well! Just a friendly heads-up that invoice #{{invoiceNumber}} for {{currency}}{{amount}} was due on {{dueDate}} ({{daysOverdue}} days ago).

Sometimes invoices slip through the cracks — totally understand! If you've already sent the payment, please disregard this note.

If you have any questions about the invoice, I'm happy to chat.

{{paymentLink}}

Thanks so much!
{{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'daysOverdue', 'freelancerName', 'paymentLink'],
    isDefault: true,
  },
  {
    id: 'default-friendly-sms',
    name: 'Friendly Reminder SMS',
    escalation: EscalationLevel.FriendlyReminder,
    tone: ToneStyle.Warm,
    channel: 'sms',
    subject: undefined,
    body: `Hi {{clientName}}, friendly reminder that invoice #{{invoiceNumber}} ({{currency}}{{amount}}) was due {{dueDate}}. Let me know if you need anything! – {{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'freelancerName'],
    isDefault: true,
  },

  // ── Firm Follow-Up (Professional) ────────────────────────────
  {
    id: 'default-firm-email',
    name: 'Firm Follow-Up',
    escalation: EscalationLevel.FirmFollowUp,
    tone: ToneStyle.Professional,
    channel: 'email',
    subject: 'Follow-up: Invoice #{{invoiceNumber}} — {{daysOverdue}} days overdue',
    body: `Dear {{clientName}},

I'm following up regarding invoice #{{invoiceNumber}} for {{currency}}{{amount}}, which was due on {{dueDate}} and is now {{daysOverdue}} days past due.

I understand things can get busy, but I'd appreciate an update on the expected payment date. Timely payments help me continue delivering quality work for you and your team.

Could you please let me know when I can expect the payment?

{{paymentLink}}

Best regards,
{{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'daysOverdue', 'freelancerName', 'paymentLink'],
    isDefault: true,
  },

  // ── Formal Notice (Firm) ─────────────────────────────────────
  {
    id: 'default-formal-email',
    name: 'Formal Payment Notice',
    escalation: EscalationLevel.FormalNotice,
    tone: ToneStyle.Firm,
    channel: 'email',
    subject: 'OVERDUE: Invoice #{{invoiceNumber}} — Immediate attention required',
    body: `Dear {{clientName}},

This is a formal notice regarding invoice #{{invoiceNumber}} for {{currency}}{{amount}}, issued on {{dueDate}}, which is now {{daysOverdue}} days overdue.

Despite previous reminders, payment has not been received. I must stress the importance of resolving this matter promptly.

Please arrange payment within the next 7 business days. If there are circumstances preventing payment, I request you contact me immediately to discuss a resolution.

Continued non-payment may result in:
- Late fees as outlined in our agreement
- Suspension of ongoing work
- Further escalation

{{paymentLink}}

Regards,
{{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'daysOverdue', 'freelancerName', 'paymentLink'],
    isDefault: true,
  },

  // ── Final Warning (Legal) ────────────────────────────────────
  {
    id: 'default-final-email',
    name: 'Final Payment Warning',
    escalation: EscalationLevel.FinalWarning,
    tone: ToneStyle.Legal,
    channel: 'email',
    subject: 'FINAL NOTICE: Invoice #{{invoiceNumber}} — Action required within 48 hours',
    body: `Dear {{clientName}},

FINAL NOTICE

This serves as a final notice regarding the outstanding payment of {{currency}}{{amount}} for invoice #{{invoiceNumber}}, originally due on {{dueDate}} and now {{daysOverdue}} days overdue.

Multiple attempts to resolve this matter amicably have been unsuccessful. Unless full payment is received within 48 hours of this notice, I will have no choice but to:

1. Refer this matter to a collections agency
2. Report the outstanding debt to relevant credit agencies
3. Consider legal action to recover the amount owed, including any applicable late fees and recovery costs

I strongly urge you to settle this matter immediately to avoid these consequences.

{{paymentLink}}

{{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'daysOverdue', 'freelancerName', 'paymentLink'],
    isDefault: true,
  },

  // ── Collections Referral (Legal) ─────────────────────────────
  {
    id: 'default-collections-email',
    name: 'Collections Referral Notice',
    escalation: EscalationLevel.CollectionsReferral,
    tone: ToneStyle.Legal,
    channel: 'email',
    subject: 'Invoice #{{invoiceNumber}} — Referred to collections',
    body: `Dear {{clientName}},

This is to inform you that the outstanding balance of {{currency}}{{amount}} for invoice #{{invoiceNumber}}, due on {{dueDate}} ({{daysOverdue}} days overdue), has been referred to a third-party collections agency.

All future correspondence regarding this debt will be handled by the collections agency. You may still resolve this matter directly by contacting me immediately with full payment.

This action was taken after multiple attempts to resolve the matter, including:
- Friendly reminders
- Formal payment notices
- A final warning

Prompt resolution will prevent additional fees and further action.

{{freelancerName}}`,
    variables: ['clientName', 'invoiceNumber', 'amount', 'currency', 'dueDate', 'daysOverdue', 'freelancerName'],
    isDefault: true,
  },
];
