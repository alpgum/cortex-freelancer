import { renderTemplate, validateTemplateVariables, extractVariables } from '../src/templates/renderer';
import { MessageTemplate, EscalationLevel, ToneStyle } from '../src/types';

describe('Template Renderer', () => {
  const template: MessageTemplate = {
    id: 't1',
    name: 'Test',
    escalation: EscalationLevel.FriendlyReminder,
    tone: ToneStyle.Warm,
    channel: 'email',
    subject: 'Invoice {{invoiceNumber}} for {{clientName}}',
    body: 'Hello {{clientName}}, amount {{amount}} due {{dueDate}}.',
    variables: ['clientName', 'invoiceNumber', 'amount', 'dueDate'],
    isDefault: true,
  };

  test('renders subject and body with substitution', () => {
    const { subject, body } = renderTemplate(template, {
      clientName: 'Acme',
      invoiceNumber: '2026-001',
      amount: '1000.00',
      currency: '$',
      dueDate: 'Jan 10, 2026',
      daysOverdue: 5,
      freelancerName: 'Me',
    });

    expect(subject).toContain('2026-001');
    expect(subject).toContain('Acme');
    expect(body).toContain('Hello Acme');
    expect(body).toContain('1000.00');
  });

  test('validateTemplateVariables finds missing vars', () => {
    const missing = validateTemplateVariables(template, {
      clientName: 'Acme',
      invoiceNumber: '2026-001',
      amount: '1000.00',
      currency: '$',
      dueDate: 'Jan 10, 2026',
      daysOverdue: 5,
      freelancerName: 'Me',
    } as any);

    expect(missing).toEqual([]);

    const missing2 = validateTemplateVariables(template, {
      clientName: 'Acme',
      invoiceNumber: '2026-001',
      amount: '1000.00',
      currency: '$',
      dueDate: undefined as any,
      daysOverdue: 5,
      freelancerName: 'Me',
    });

    expect(missing2).toContain('dueDate');
  });

  test('extractVariables detects vars from subject and body', () => {
    const vars = extractVariables(template);
    expect(vars.sort()).toEqual(['amount', 'clientName', 'dueDate', 'invoiceNumber'].sort());
  });
});
