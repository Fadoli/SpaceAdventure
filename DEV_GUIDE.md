# Quick Development Guide

## Installing Bun

Bun is not currently installed on your system. Install it with:

```bash
curl -fsSL https://bun.sh/install | bash
```

After installation, restart your terminal or run:
```bash
source ~/.bashrc
```

## Quick Start Commands

```bash
# Install dependencies
bun install

# Start development server (auto-reloads on file changes)
bun run dev

# Start production server
bun start

# Run tests
bun test
```

## Testing the Application

1. Start the server: `bun run dev`
2. Open http://localhost:3000
3. Register a new account
4. Your password will be hashed with bcrypt (12 rounds + salt)
5. You'll see your starting planet with resources generating

## File Locations for Development

### To add building upgrade functionality:
- `src/server/game/buildings.js` (create this)
- `src/server/index.js` (add POST /api/game/planet/:id/build endpoint)
- `src/client/js/main.js` (update upgradeBuilding function)

### To add research system:
- `src/server/game/research.js` (create this)
- `src/server/index.js` (add research endpoints)
- `src/client/js/research.js` (create this)

### To add AI opponents:
- `src/server/ai/ai.js` (create this)
- `src/server/game/combat.js` (create this)

## Directory Structure

```
src/
├── server/          # Backend code
│   ├── index.js    # Main server - add new API routes here
│   ├── auth/       # Authentication (complete)
│   ├── game/       # Game logic (player.js done, add more)
│   ├── ai/         # AI system (ready for implementation)
│   └── storage/    # Data persistence (complete)
├── client/         # Frontend code
│   ├── index.html  # Main HTML (complete)
│   ├── js/         # JavaScript modules
│   └── css/        # Stylesheets
└── shared/         # Shared utilities (complete)
```

## Making Changes

### Adding a new API endpoint:

1. Edit `src/server/index.js`
2. Add your route in the handleRequest function:
```javascript
if (path === '/api/your/route' && method === 'POST') {
  // Your logic here
  return successResponse(data);
}
```

### Adding a new frontend view:

1. Add HTML in `src/client/index.html`
2. Add navigation button
3. Add view content
4. Update `src/client/js/main.js` with view logic

### Modifying game constants:

Edit `src/shared/constants.js` - both server and client can use these.

## Development Tips

- **Hot Reload**: Use `bun run dev` for automatic reloading
- **Debugging**: Check browser console and terminal for errors
- **Data**: JSON files are in `data/` directory
- **Testing**: Create accounts and test features manually

## Common Tasks

### Add a new building type:
1. Add to `BUILDINGS` in `src/shared/constants.js`
2. Add building data to player creation
3. Update UI in `src/client/js/main.js`

### Change starting resources:
Edit `STARTING_RESOURCES` in `src/shared/constants.js`

### Adjust game balance:
Edit formulas in `src/shared/formulas.js`

## Current State

✅ Authentication works (bcrypt with salt)
✅ Game state saves to JSON
✅ Resources update in real-time
✅ UI is responsive and styled

🔨 Building upgrades need backend implementation
🔨 Research system needs full implementation
🔨 AI and combat systems ready to build

## Useful Commands

```bash
# View JSON data files
cat data/users.json
cat data/players.json

# Check if server is running
curl http://localhost:3000/api/auth/me

# Test registration
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"password123"}'
```

## Next Implementation Priority

1. **Building Upgrades** - Let players actually upgrade buildings
2. **Resource Costs** - Deduct resources when building
3. **Build Queue** - Timer system for construction
4. **Research Lab** - Technology research system
5. **AI Generation** - Create AI opponents

See `docs/ROADMAP.md` for the full development plan!
