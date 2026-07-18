import { expect, it } from 'bun:test';

globalThis.window ||= {};

const { renderPlanParticipantSummary } = await import('../../src/client/js/views/alliance.js');
const { API } = await import('../../src/client/js/api.js');

it('renders an empty alliance attack plan without throwing', () => {
  expect(renderPlanParticipantSummary({ participants: [] })).toContain('NO ASSETS CURRENTLY POOLED');
});

it('keeps a chat draft when sending fails', async () => {
  const originalDocument = globalThis.document;
  const originalSend = API.sendAllianceMessage;
  const input = { value: 'distress call', disabled: false, focus() {} };

  globalThis.document = { getElementById: (id) => id === 'alliance-chat-input' ? input : null };
  API.sendAllianceMessage = async () => { throw new Error('offline'); };

  try {
    await window.sendAllianceMessageUI();
    expect(input.value).toBe('distress call');
  } finally {
    API.sendAllianceMessage = originalSend;
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
