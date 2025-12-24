# Getting Started with Space Adventure

## Installation

1. **Install Bun** (if not already installed):
   ```bash
   curl -fsSL https://bun.sh/install | bash
   ```

2. **Install Dependencies**:
   ```bash
   bun install
   ```

## Running the Application

### Development Mode
Start the server with auto-reload:
```bash
bun run dev
```

### Production Mode
Start the server without auto-reload:
```bash
bun start
```

The application will be available at: **http://localhost:3000**

## First Steps

1. **Open your browser** and navigate to `http://localhost:3000`
2. **Register a new account**:
   - Click the "Register" tab
   - Choose a username (3-20 characters)
   - Create a password (minimum 8 characters)
   - Click "Register"

3. **Start playing**:
   - You'll automatically be logged in and see your starting planet
   - Resources will begin generating automatically
   - Explore the Buildings tab to upgrade your structures
   - More features coming soon!

## Project Structure

```
SpaceAdventure/
├── docs/               # Documentation
├── src/
│   ├── server/        # Backend code
│   │   ├── auth/      # Authentication system
│   │   ├── game/      # Game logic
│   │   ├── storage/   # JSON file storage
│   │   └── index.js   # Main server
│   ├── client/        # Frontend code
│   │   ├── js/        # JavaScript modules
│   │   ├── css/       # Stylesheets
│   │   └── index.html # Main HTML
│   └── shared/        # Shared utilities
├── data/              # JSON data files (created at runtime)
└── package.json       # Project configuration
```

## Features Currently Implemented

✅ User registration and authentication with bcrypt
✅ Session management with cookies
✅ JSON file-based storage
✅ Basic game state management
✅ Resource production system
✅ Building system (UI only)
✅ Responsive web interface

## Coming Soon

🔨 Building upgrade functionality
🔨 Research system
🔨 Fleet construction
🔨 AI opponents
🔨 Combat system
🔨 Galaxy view

## Development

### Running Tests
```bash
bun test
```

### Code Structure
- **Server**: Pure JavaScript with Bun runtime
- **Authentication**: bcrypt with 12 salt rounds
- **Storage**: JSON files in `data/` directory
- **Frontend**: Vanilla JavaScript (ES6 modules)

## Troubleshooting

**Port already in use?**
Change the port by setting the PORT environment variable:
```bash
PORT=3001 bun run dev
```

**Can't connect to server?**
Make sure the server is running and check the console for errors.

**Resources not updating?**
The UI updates resources every second. Try refreshing the page if they seem stuck.

## Next Development Steps

See [docs/ROADMAP.md](docs/ROADMAP.md) for the complete development plan.

Current focus: Implementing building upgrades and resource management.

## Contributing

This is a learning/personal project, but feedback and suggestions are welcome!

## License

MIT License - See LICENSE file for details
