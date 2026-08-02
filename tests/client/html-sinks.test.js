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
  const mainSource = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  expect(source).toContain('data-category-content="queue"');
  expect(source).toContain('content.hidden = collapsedSections[categoryId]');
  expect(source).toContain("appendQueueItem('ships', response)");
  expect(source).toContain("appendQueueItem('defenses', response)");
  expect(mainSource).toContain('if (forceFetch || stateOnly) updateShipyardView');
  expect(mainSource).toContain("view === 'shipyard' || view === 'defenses'");
});

it('formats ship and defense counts with compact numbers', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('${formatNumber(count)} IN DOCK');
  expect(source).toContain('${formatNumber(count)} ACTIVE');
  expect(source).toContain("const countText = `${formatNumber(count)} ${isDefenses ? 'ACTIVE' : 'IN DOCK'}`");
});

it('scopes shipyard updates to the active view container', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  const timerSource = await readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8');
  expect(source).toContain('function updateUnitCardsGranular(planet, shipyardData, subView, container)');
  expect(source).toContain('container.querySelector(`#variant-${key}`)');
  expect(source).toContain('container.querySelector(`#cost-${id}`)');
  expect(source).toContain("e.target.closest('#shipyard-view, #defenses-view')");
  expect(timerSource).toContain("timer.closest('#buildings-view, #shipyard-view, #defenses-view')");
});

it('renders building details from server level projections', async () => {
  const source = await readFile(new URL('../../src/client/js/views/buildings.js', import.meta.url), 'utf8');
  expect(source).toContain('const levelProjections = building.levelProjections || []');
  expect(source).toContain('const projection = levelProjections.find(item => item.level === levelItem)');
  expect(source).not.toContain('const baseCostEstimate = building.cost ?');
  expect(source).not.toContain('const baseProductionEstimate = {}');
});

it('keeps notifications above dynamically-created modals', async () => {
  const html = await readFile(new URL('../../src/client/index.html', import.meta.url), 'utf8');
  const styles = await readFile(new URL('../../src/client/css/notifications.css', import.meta.url), 'utf8');
  const appEnd = html.indexOf('\n    </div>\n\n    <!-- Notifications');
  expect(appEnd).toBeGreaterThan(html.indexOf('<div id="app">'));
  expect(html.indexOf('id="notifications-container"')).toBeGreaterThan(appEnd);
  expect(styles).toContain('z-index: 10000;');
  expect(styles).toContain('top: 30px;');
  expect(styles).toContain('top: 12px;');
});

it('keeps confirmation dialogs above blueprint selection modals', async () => {
  const styles = await readFile(new URL('../../src/client/css/modal.css', import.meta.url), 'utf8');
  expect(styles).toContain('#input-modal {');
  expect(styles).toContain('z-index: 4000;');
});

it('renders the existing queue before shipyard details finish loading', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('const queuePreview = getQueuePreviewData(planet)');
  expect(source).toContain('queueContainer.innerHTML = renderBuildQueue(queuePreview)');
  expect(source).toContain('if (!isCurrentRequest()) return;');
});

it('recomputes allocation blueprint effects from focus levels', async () => {
  const source = await readFile(new URL('../../src/client/js/views/allocation.js', import.meta.url), 'utf8');
  expect(source).toContain('applyCustomization, getCustomVariant');
  expect(source).toContain('getCustomVariant(buildingType, blueprint.focusLevels)');
  expect(source).toContain('applyCustomization(BUILDINGS[buildingType], variant.modifiers)');
});

it('documents vehicle engine upgrades in ship and propulsion details', async () => {
  const shipyard = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  const research = await readFile(new URL('../../src/client/js/views/research.js', import.meta.url), 'utf8');
  expect(shipyard).toContain('Engine Upgrade Path');
  expect(shipyard).toContain('SHIPS[shipKey]?.engineSwaps');
  expect(research).toContain('Vehicle Engine Upgrades');
  expect(research).toContain('swap.techKey === techKey');
});

it('keeps fleet movements unbounded and exposes recall handling', async () => {
  const styles = await readFile(new URL('../../src/client/css/views/fleetMovements.css', import.meta.url), 'utf8');
  const view = await readFile(new URL('../../src/client/js/views/fleetMovements.js', import.meta.url), 'utf8');
  const main = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('../../src/server/index.js', import.meta.url), 'utf8');
  expect(styles).toContain('max-height: none;');
  expect(styles).toContain('overflow: visible;');
  expect(view).toContain('fleet-recall-btn');
  expect(main).toContain('window.recallFleet');
  expect(server).toContain('recallFleet(user.id, fleetId)');
});

it('resets galaxy navigation to the selected planet system', async () => {
  const source = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  expect(source).toContain("if (view === 'galaxy' && gameState)");
  expect(source).toContain('[window.currentGalaxy, window.currentSystem] = planet.coordinates');
});

it('applies research cost reduction to shipyard UI prices', async () => {
  const view = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('../../src/server/game/shipyard.js', import.meta.url), 'utf8');
  expect(view).toContain('currentShipyardData?.costReductionBonus');
  expect(view).toContain('calculateDefenseCost(id, quantity)');
  expect(view).toContain('baseCost.metal * quantity * reduction');
  expect(server).toContain("costReductionBonus: getResearchBonus(player?.research, 'globalCostReduction')");
});

it('keeps shipyard time reduction consistent between server and UI', async () => {
  const view = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  const server = await readFile(new URL('../../src/server/game/shipyard.js', import.meta.url), 'utf8');

  expect(view).toContain('timeReductionBonus');
  expect(view).toContain('calculateSharedShipBuildTime');
  expect(view).toContain('calculateSharedDefenseBuildTime');
  expect(server).toContain("timeReductionBonus: getResearchBonus(player?.research, 'globalTimeReduction')");
});

it('guards view responses against stale navigation results', async () => {
  const viewFiles = ['buildings', 'research', 'galaxy', 'ranking', 'messages', 'alliance'];
  for (const view of viewFiles) {
    const source = await readFile(new URL(`../../src/client/js/views/${view}.js`, import.meta.url), 'utf8');
    expect(source).toMatch(/requestId|RequestId|buildingDetailsRequest/);
  }
});

it('does not let stale allocation or galaxy responses overwrite navigation', async () => {
  const main = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const galaxy = await readFile(new URL('../../src/client/js/views/galaxy.js', import.meta.url), 'utf8');
  expect(main).toContain('allocationRenderId');
  expect(main).toContain("currentView !== 'allocation'");
  expect(galaxy).toContain("classList.contains('active')");
});

it('refreshes building queues after the accepted mutation response', async () => {
  const source = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  expect(source).toContain('buildingUpgrade(buildingKey, () => loadGameState(true))');
  expect(source).toContain('buildingCancel(queuePosition, () => loadGameState(true))');
});

it('refreshes immediately when a building completion event arrives', async () => {
  const source = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  expect(source).toContain("if (type === 'BUILDING_COMPLETE') {");
  expect(source).toContain('loadGameState(true);\n                return;');
});

it('applies versioned WebSocket state syncs before using HTTP recovery', async () => {
  const source = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const gameLoop = await readFile(new URL('../../src/server/game/gameLoop.js', import.meta.url), 'utf8');
  expect(source).toContain("if (type === 'STATE_SYNC')");
  expect(source).toContain('incomingVersion < currentVersion');
  expect(source).toContain('incomingVersion <= currentVersion');
  expect(source).toContain('data.force');
  expect(source).toContain('updateUI(false, true)');
  expect(source).toContain('nextGameState?.stateVersion');
  expect(gameLoop).toContain('STATE_SYNC_INTERVAL');
  expect(gameLoop).toContain('sendStateSync(');
});

it('refreshes canonical state after accepted fleet and planet mutations', async () => {
  const mainSource = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const galaxySource = await readFile(new URL('../../src/client/js/views/galaxy.js', import.meta.url), 'utf8');
  expect(mainSource).toContain('loadGameState(force);');
  expect(mainSource).toContain('await loadGameState(true);');
  expect(galaxySource).toContain('if (window.loadGameState) await window.loadGameState(true);');
});

it('supports balanced expedition splitting in the mission flow', async () => {
  const galaxySource = await readFile(new URL('../../src/client/js/views/galaxy.js', import.meta.url), 'utf8');
  const fleetSource = await readFile(new URL('../../src/server/game/fleet.js', import.meta.url), 'utf8');
  expect(galaxySource).toContain('id="exp-split-count"');
  expect(galaxySource).toContain('splitFleetComposition(shipsToSend, splitCount)');
  expect(galaxySource).toContain('splitCount');
  expect(fleetSource).toContain('export async function sendExpeditions');
  expect(fleetSource).toContain('if (persist) await updatePlayer');
});

it('does not poll alliance data from the one-second resource refresh', async () => {
  const source = await readFile(new URL('../../src/client/js/main.js', import.meta.url), 'utf8');
  const updateCurrentView = source.slice(source.indexOf('function updateCurrentView'));
  const allianceCase = updateCurrentView.slice(
    updateCurrentView.indexOf("case 'alliance':"),
    updateCurrentView.indexOf("case 'ranking':")
  );

  expect(allianceCase).not.toContain('updateAllianceView');
});

it('renders fleet counts from synchronized game state', async () => {
  const source = await readFile(new URL('../../src/client/js/views/fleet.js', import.meta.url), 'utf8');

  expect(source).toContain('ships: planet.ships || {}');
  expect(source).toContain('defenses: planet.defenses || {}');
  expect(source).not.toContain('API.getFleetDetails');
});

it('applies state-sync queues directly to the active shipyard', async () => {
  const source = await readFile(new URL('../../src/client/js/views/shipyard.js', import.meta.url), 'utf8');
  expect(source).toContain('applyPlanetStateToShipyard');
  expect(source).toContain('stateOnly = false');
  expect(source).toContain('shipQueue: planet.shipQueue');
});

it('syncs new message contents over WebSocket', async () => {
  const server = await readFile(new URL('../../src/server/game/messages.js', import.meta.url), 'utf8');
  const client = await readFile(new URL('../../src/client/js/views/messages.js', import.meta.url), 'utf8');
  expect(server).toContain('message: newMessage');
  expect(client).toContain('export function syncNewMessage');
  expect(client).toContain('updateMessagesView(cachedMessages)');
});
