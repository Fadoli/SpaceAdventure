import { expect, it } from 'bun:test';
import { readFile } from 'fs/promises';

it('escapes dynamic errors written through HTML sinks', async () => {
  const files = ['admin.js', 'views/shipyard.js', 'views/research.js', 'views/messages.js'];
  const sources = await Promise.all(files.map(file =>
    readFile(new URL(`../../src/client/js/${file}`, import.meta.url), 'utf8')
  ));

  for (const source of sources) {
    const errorSinkLines = source.split('\n').filter(line =>
      line.includes('innerHTML') && line.includes('${') && /\.(?:message|error)/.test(line)
    );
    expect(errorSinkLines.length).toBeGreaterThan(0);
    expect(errorSinkLines.every(line => line.includes('escapeHtml('))).toBe(true);
  }
});

it('keeps the details modal text-safe', async () => {
  const source = await readFile(new URL('../../src/client/js/views/details.js', import.meta.url), 'utf8');
  const buildingsSource = await readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8');
  const researchSource = await readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8');
  expect(source).toContain('modalTitle.textContent = data.title');
  expect(source).toContain('escapeHtml(data.detailedDescription || data.description)');
  expect(source).toContain('data.table.allowHtml ? cell : escapeHtml(cell)');
  expect(buildingsSource).toContain('modalTitle.textContent = `Design Options: ${building.name}`');
  expect(buildingsSource).toContain('allowHtml: true');
  expect(researchSource).toContain('table: { headers, rows, allowHtml: true }');
  expect(researchSource).toContain('/assets/icons/buildings/${baseType}.png');
});

it('formats blueprint modifier percentages with compact numbers', async () => {
  const buildingsSource = await readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8');
  const researchSource = await readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8');
  expect(buildingsSource).toContain('formatNumber((val - 1) * 100)');
  expect(researchSource).toContain('formatNumber((val - 1) * 100)');
  expect(buildingsSource).toContain('getCustomVariant(buildingKey, bp.focusLevels)');
  expect(researchSource).toContain('getCustomVariant(baseType, focusLevels)');
});

it('escapes renamed planets in shell and overview renders', async () => {
  const mainSource = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const overviewSource = await readFile(new URL('../../src/client/js/views/overview.js', import.meta.url), 'utf8');
  expect(mainSource).toContain('escapeHtml(p.name)}</option>');
  expect(overviewSource).toContain('System Intel: ${escapeHtml(planet.name)}');
  expect(overviewSource).toContain('${escapeHtml(p.name)} [${p.coordinates.join(\':\')}]');
});

it('opens detail cards without separate info buttons', async () => {
  const sources = await Promise.all([
    readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8'),
    readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8')
  ]);
  expect(sources.every(source => !source.includes('class="btn-info"'))).toBe(true);
  expect(sources[0]).toContain('onclick="window.showBuildingDetails');
  expect(sources[1]).toContain('onclick="window.showResearchDetails');
  expect(sources[2]).toContain('onclick="window.showShipDetails');
  expect(sources[2]).toContain('onclick="window.showDefenseDetails');
});

it('updates shipyard folds and queue mutations without polling', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('data-category-content="queue"');
  expect(source).toContain('content.hidden = collapsedSections[categoryId]');
  expect(source).toContain("appendQueueItem('ships', response)");
  expect(source).toContain("appendQueueItem('defenses', response)");
});

it('formats ship and defense counts with compact numbers', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('${formatNumber(count)} IN DOCK');
  expect(source).toContain('${formatNumber(count)} ACTIVE');
  expect(source).toContain("const countText = `${formatNumber(count)} ${isDefenses ? 'ACTIVE' : 'IN DOCK'}`");
});

it('scopes shipyard updates to the active view container', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('function updateUnitCardsGranular(planet, shipyardData, subView, container)');
  expect(source).toContain('container.querySelector(`#variant-${key}`)');
  expect(source).toContain('container.querySelector(`#cost-${id}`)');
  expect(source).toContain("e.target.closest('#shipyard-view, #defenses-view')");
});

it('renders building details from server level projections', async () => {
  const source = await readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8');
  expect(source).toContain('const levelProjections = building.levelProjections || []');
  expect(source).toContain('const projection = levelProjections.find(item => item.level === levelItem)');
  expect(source).not.toContain('const baseCostEstimate = building.cost ?');
  expect(source).not.toContain('const baseProductionEstimate = {}');
});
