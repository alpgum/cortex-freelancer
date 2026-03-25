import { ProposalInput } from '../src/types';

export const SAMPLE_PROPOSAL: ProposalInput = {
  proposalId: 'P-1001',
  projectName: 'Website Redesign',
  clientId: 'C-001',
  clientName: 'Acme Co',
  projectType: 'fixed',
  totalValue: 12000,
  currency: 'USD',
  scope: 'Redesign marketing website with updated brand and improved conversion.',
  deliverables: [
    {
      name: 'Design System',
      description: 'Core UI components and styles',
      estimatedHours: 30,
      acceptanceCriteria: ['Approved in Figma', 'Includes typography + colors'],
    },
    {
      name: 'Landing Page Implementation',
      description: 'Implement new landing page in code',
      estimatedHours: 50,
      acceptanceCriteria: ['Responsive', 'Matches design within tolerance'],
      dependencies: ['Design System'],
    },
    {
      name: 'QA + Handover',
      description: 'Testing, documentation, and handover session',
      estimatedHours: 20,
      acceptanceCriteria: ['No P1 bugs', 'Handover docs delivered'],
      dependencies: ['Landing Page Implementation'],
    },
  ],
  estimatedHours: 100,
  startDate: '2026-04-01',
  endDate: '2026-04-30',
  paymentStructure: 'milestone',
  revisionRounds: 2,
  tags: ['web', 'design'],
  notes: 'Client prefers async updates.',
};
