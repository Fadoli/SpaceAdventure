# Space Adventure — Working Context

This file is a compact handoff for future maintenance chats. It records only repository facts that are useful when changing the game.

## Runtime and commands

- Bun + native ES modules (`package.json` has `"type": "module"`).
- Development server: `bun run dev`.
- Production-style server: `bun start`.
- Test suite: `bun test` (last verified: 490 passing tests).
- No frontend framework or TypeScript build is used; the client is vanilla JavaScript and CSS.
- Do not add Google-hosted fonts (`fonts.googleapis.com`). Keep assets local.

## Repository layout

```text
src/server/index.js       HTTP/API entry point, static-file serving, WebSocket upgrade, shutdown hooks
src/server/auth/          authentication and sessions
src/server/game/          player, buildings, shipyard, research, fleets, combat, galaxy, AI, alliances, messages
src/server/storage/       JSON persistence, backups, event log
src/shared/               game definitions and formulas shared by server/client
src/client/index.html     authenticated app shell
src/client/login.html     login/register shell
src/client/js/main.js     client bootstrap, state refresh, view switching
src/client/js/views/      overview, buildings, research, shipyard, fleet, galaxy, messages, alliance, rankings, etc.
src/client/css/            global, modal, and per-view styles
src/client/assets/icons/  local building, ship, research, and defense artwork
data/                     runtime JSON data; do not reset or overwrite casually
tests/                    Bun tests grouped into client, server, shared, and benchmarks
docs/                     design, API, security, roadmap, and research notes
```

## Important flows

- `src/server/index.js` initializes config/storage, serves `/api/*`, serves the client, accepts `/ws`, starts the game loop, and flushes state on shutdown.
- `src/server/game/gameLoop.js` advances production, construction, research, fleets/combat, AI, rankings, and periodic persistence. Shutdown calls flush routines before stopping.
- `src/server/storage/storage.js` stores JSON under `data/`, serializes writes per file, and maintains `.backup` files.
- `src/server/game/fleet.js` owns mission validation and arrival processing. Galaxy missions use `POST /api/game/galaxy/mission`; expedition and harvest missions can target position 16.
- `src/server/game/combatEngine.js` is the shared combat simulator. Alien expedition units are defined in `src/shared/ships.js` under `ALIEN_SHIPS` and have `baseCost` values for loss reports/debris.
- `src/server/game/galaxyData.js` stores debris fields keyed by `galaxy:system:position`.
- `src/client/js/api.js` uses `/api`; the client receives live updates through `src/client/js/socket.js` and also performs periodic state refreshes.
- Public artwork is requested as `/assets/...`; `src/server/publicFiles.js` maps that alias into `src/client/assets`.

## Shared sources of truth

- Buildings: `src/shared/buildings.js`
- Ships (including alien ships): `src/shared/ships.js`
- Defenses: `src/shared/defenses.js`
- Research definitions: `src/shared/research.js`
- Constants and mission types: `src/shared/constants.js`
- Cross-system formulas: `src/shared/formulas.js`

Prefer these definitions/helpers over duplicating values in views or route handlers.

## Maintenance notes

- Preserve existing user data in `data/` while testing or editing.
- Add a focused regression test for non-trivial fixes, then run `bun test`.
- Keep rendering-safe code: escape user/storage-controlled text before HTML sinks; only use explicitly trusted static markup.
- UI uses the existing cyan sci-fi theme and local artwork. Building cards open their detail action by clicking the card surface; avoid reintroducing redundant info buttons.
- Check `docs/ROADMAP.md` when a change materially affects the documented project state.
