import { ContractGenerator } from '../src/contract-generator';
import { SAMPLE_PROPOSAL } from './fixtures';

describe('ContractGenerator', () => {
  test('generates a contract with milestone-based payment schedule', () => {
    const gen = new ContractGenerator();
    const c = gen.generateFromProposal(SAMPLE_PROPOSAL);

    expect(c.terms.paymentSchedule.length).toBe(SAMPLE_PROPOSAL.deliverables.length);
    expect(c.status).toBe('draft');

    const total = c.terms.paymentSchedule.reduce((sum, i) => sum + i.amount, 0);
    expect(total).toBeGreaterThan(0);
  });

  test('renders to markdown', () => {
    const gen = new ContractGenerator();
    const c = gen.generateFromProposal(SAMPLE_PROPOSAL);
    const md = gen.renderToMarkdown(c, SAMPLE_PROPOSAL);
    expect(md).toContain('Fixed-Price Project Agreement');
    expect(md).toContain('Payment Schedule');
    expect(md).toContain(SAMPLE_PROPOSAL.projectName);
  });
});
