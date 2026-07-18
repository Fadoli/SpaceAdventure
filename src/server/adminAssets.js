import { BUILDINGS } from '../shared/buildings.js';
import { DEFENSES } from '../shared/defenses.js';
import { RESOURCES } from '../shared/constants.js';
import { getTheoreticalResearch } from '../shared/research.js';
import { SHIPS } from '../shared/ships.js';

function getUpdates(current, changes, allowedKeys, isSet) {
  if (changes == null) return null;
  if (typeof changes !== 'object' || Array.isArray(changes)) throw new Error('Invalid asset changes');

  const allowed = new Set(allowedKeys);
  return Object.fromEntries(Object.entries(changes).map(([key, value]) => {
    if (!allowed.has(key)) throw new Error(`Invalid asset key: ${key}`);
    if (!Number.isSafeInteger(value)) throw new Error(`Invalid asset value for ${key}`);
    const next = isSet ? value : (Number.isFinite(current?.[key]) ? current[key] : 0) + value;
    if (!Number.isFinite(next) || Math.abs(next) > Number.MAX_SAFE_INTEGER) throw new Error(`Invalid asset value for ${key}`);
    return [key, Math.max(0, next)];
  }));
}

export function applyAdminAssetUpdate(player, { planetId, ships, defenses, resources, buildings, research, mode }) {
  if (!['SET', 'ADD'].includes(mode)) throw new Error('Invalid asset update mode');
  const hasPlanetChanges = [ships, defenses, resources, buildings].some(value => value != null);
  const planet = planetId ? player.planets.find(candidate => candidate.id === planetId) : null;
  if (hasPlanetChanges && !planet) throw new Error('Planet not found');

  const isSet = mode === 'SET';
  const updates = {
    ships: getUpdates(planet?.ships, ships, Object.keys(SHIPS), isSet),
    defenses: getUpdates(planet?.defenses, defenses, Object.keys(DEFENSES), isSet),
    resources: getUpdates(planet?.resources, resources, Object.values(RESOURCES), isSet),
    buildings: getUpdates(planet?.buildings, buildings, Object.keys(BUILDINGS), isSet),
    research: getUpdates(player.research, research, Object.keys(getTheoreticalResearch()), isSet)
  };

  if (planet) {
    for (const category of ['ships', 'defenses', 'resources', 'buildings']) {
      if (updates[category]) Object.assign(planet[category], updates[category]);
    }
  }
  if (updates.research) Object.assign(player.research ||= {}, updates.research);

  return { planet, buildingsChanged: updates.buildings !== null };
}
