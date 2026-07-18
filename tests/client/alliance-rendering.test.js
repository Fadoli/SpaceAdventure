import { expect, it } from 'bun:test';

globalThis.window ||= {};

const { renderPlanParticipantSummary } = await import('../../src/client/js/views/alliance.js');

it('renders an empty alliance attack plan without throwing', () => {
  expect(renderPlanParticipantSummary({ participants: [] })).toContain('NO ASSETS CURRENTLY POOLED');
});
