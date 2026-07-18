import { expect, it } from 'bun:test';

globalThis.window = {};
globalThis.localStorage = { setItem() {}, getItem() { return null; } };

const { renderFleetRow } = await import('../../src/client/js/views/fleetMovements.js');

it('escapes hostile fleet owner names', () => {
  const now = Date.now();
  const html = renderFleetRow({
    id: 'fleet-1',
    ownerName: '<img src=x onerror=alert(1)>',
    missionType: 'attack',
    originCoords: [1, 1, 1],
    targetCoords: [1, 1, 2],
    startTime: now,
    arrivalTime: now + 60_000,
    ships: {},
    resources: {},
    isHostile: true
  });

  expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(html).not.toContain('<img');
});

it('keeps collapsed telemetry state in sync', () => {
  const classes = () => {
    const values = new Set();
    return {
      contains: value => values.has(value),
      toggle(value, force) {
        const enabled = force ?? !values.has(value);
        enabled ? values.add(value) : values.delete(value);
        return enabled;
      }
    };
  };
  const list = { classList: classes() };
  const status = {};
  const icon = {};
  const header = {
    classList: classes(),
    setAttribute(name, value) { this[name] = value; },
    querySelector(selector) { return selector === '.header-status-text' ? status : icon; }
  };
  globalThis.document = { getElementById: id => id === 'fleet-list' ? list : header };

  window.toggleFleetMovements();

  expect(list.classList.contains('collapsed')).toBe(true);
  expect(header['aria-expanded']).toBe('false');
  expect(status.textContent).toBe('DATA FEED COLLAPSED');
  expect(icon.textContent).toBe('▼');
});
