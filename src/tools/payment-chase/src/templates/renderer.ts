import { MessageTemplate, TemplateVariables } from '../types';

/**
 * Render a template with variable substitution.
 * Replaces all {{variableName}} tokens with the provided values.
 */
export function renderTemplate(
  template: MessageTemplate,
  variables: TemplateVariables
): { subject?: string; body: string } {
  const substitute = (text: string): string => {
    return text.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
      const value = variables[key];
      if (value === undefined || value === null) return '';
      return String(value);
    });
  };

  return {
    subject: template.subject ? substitute(template.subject) : undefined,
    body: substitute(template.body),
  };
}

/**
 * Validate that all required variables are present.
 * Returns list of missing variable names.
 */
export function validateTemplateVariables(
  template: MessageTemplate,
  variables: TemplateVariables
): string[] {
  const missing: string[] = [];
  for (const varName of template.variables) {
    if (variables[varName] === undefined || variables[varName] === null) {
      missing.push(varName);
    }
  }
  return missing;
}

/**
 * Extract all variable names from a template body (and subject).
 */
export function extractVariables(template: MessageTemplate): string[] {
  const vars = new Set<string>();
  const regex = /\{\{(\w+)\}\}/g;

  const scanText = (text: string) => {
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      vars.add(match[1]);
    }
  };

  if (template.subject) scanText(template.subject);
  scanText(template.body);

  return Array.from(vars);
}
