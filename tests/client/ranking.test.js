import { expect, it } from 'bun:test';

globalThis.window = {};

const { renderRankingTable } = await import('../../src/client/js/views/ranking.js');

it('escapes player-controlled ranking fields', () => {
  const container = {};

  renderRankingTable(container, [{
    userId: 'attacker',
    username: '<img src=x onerror=alert(1)>',
    allianceTag: '<script>alert(1)</script>',
    homeworldCoords: [1, 2, 3],
    rank: 1,
    rankChange: 0,
    planets: 1,
    score: 0,
    scoreChange: 0
  }], 1, 0, 100, 'total', null);

  expect(container.innerHTML).toContain('&lt;img src=x onerror=alert(1)&gt;');
  expect(container.innerHTML).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  expect(container.innerHTML).not.toContain('<img');
  expect(container.innerHTML).not.toContain('<script>');
});
