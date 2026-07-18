import { expect, it } from 'bun:test';

const elements = Object.fromEntries([
  'input-modal', 'input-modal-title', 'input-modal-body',
  'input-modal-field-container', 'input-modal-field',
  'input-modal-confirm', 'input-modal-cancel'
].map(id => [id, {
  style: { setProperty(key, value) { this[key] = value; } },
  setAttribute(key, value) { this[key] = value; },
  focus() { document.activeElement = this; }
}]));

const trigger = { focus() { document.activeElement = this; } };
globalThis.document = { activeElement: trigger, getElementById: id => elements[id] };
globalThis.window = { addEventListener() {}, removeEventListener() {} };

const { closeInputModal, showConfirm, showPrompt } = await import('../../src/client/js/views/modals.js');

it('resolves a confirmation cancelled through the modal close action', async () => {
  const result = showConfirm('Confirm', 'Continue?');
  expect(document.activeElement).toBe(elements['input-modal-confirm']);
  closeInputModal();
  expect(await result).toBe(false);
  expect(document.activeElement).toBe(trigger);
});

it('focuses and names prompt input', async () => {
  const result = showPrompt('Alliance Tag', 'Enter a tag');
  expect(document.activeElement).toBe(elements['input-modal-field']);
  expect(elements['input-modal-field']['aria-label']).toBe('Alliance Tag');
  closeInputModal();
  expect(await result).toBeNull();
});
