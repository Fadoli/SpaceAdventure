import { expect, it } from 'bun:test';

const trigger = { focus() { document.activeElement = this; } };
const closeButton = { focus() { document.activeElement = this; } };
const modal = {
  style: {},
  querySelector(selector) { return selector === '.modal-close' ? closeButton : null; }
};

globalThis.document = {
  activeElement: trigger,
  getElementById(id) { return id === 'details-modal' ? modal : null; }
};
globalThis.window = {};

const { closeDetailsModal, openDetailsModal } = await import('../../src/client/js/views/details.js');

it('manages details dialog focus and backdrop close', () => {
  openDetailsModal();
  expect(modal.style.display).toBe('flex');
  expect(document.activeElement).toBe(closeButton);

  modal.onclick({ target: modal });
  expect(modal.style.display).toBe('none');
  expect(document.activeElement).toBe(trigger);
});
