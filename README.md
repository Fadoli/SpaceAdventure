# Space Adventure - OGame-like Strategy Game

A browser-based space strategy game built with Bun, featuring PVE gameplay with AI opponents.

## Overview

Space Adventure is a real-time space strategy game inspired by OGame, where players build and manage their space empire, research technologies, build fleets, and engage in PVE battles against AI-controlled entities.

## Technology Stack

- **Runtime**: Bun (JavaScript runtime with built-in bundler, transpiler, and package manager)
- **Backend**: Bun HTTP server
- **Frontend**: Vanilla JavaScript with modern ES6+ features
- **Database**: JSON file storage (with plans for future database integration)
- **Authentication**: Custom auth with bcrypt for password hashing

## Project Structure

```
SpaceAdventure/
├── docs/                   # Documentation
│   ├── ARCHITECTURE.md    # System architecture
│   ├── API.md            # API documentation
│   ├── GAME_DESIGN.md    # Game design document
│   └── SECURITY.md       # Security considerations
├── src/
│   ├── server/           # Backend code
│   │   ├── index.ts     # Main server entry point
│   │   ├── auth/        # Authentication system
│   │   ├── game/        # Game logic
│   │   ├── ai/          # AI system
│   │   └── storage/     # Data persistence
│   ├── client/          # Frontend code
│   │   ├── index.html
│   │   ├── js/
│   │   ├── css/
│   │   └── assets/
│   └── shared/          # Shared types and utilities
├── data/                # JSON data storage
│   ├── users.json
│   └── gamestate.json
├── tests/               # Test files
├── package.json
├── tsconfig.json
└── bunfig.toml         # Bun configuration
```

## Core Features

### Implemented Systems
- User authentication and registration
- Basic resource management (Metal, Crystal, Deuterium, Energy)
- Building construction system
- Research system
- Fleet construction
- PVE combat system
- Combat reports
- Multiple planets/colonies
- Galaxy exploration and espionage
- Alliance communications and attack planning
- Ranking system

### Current Focus
- Balance validation and playtesting
- Cross-browser and mobile QA
- Production deployment, monitoring, and deeper AI behavior

## Getting Started

### Prerequisites
- Bun installed (https://bun.sh)

### Installation
```bash
# Clone the repository
git clone <repository-url>
cd SpaceAdventure

# Install dependencies
bun install

# Start the development server
bun run dev
```

### Running Tests
```bash
bun test
```

## Security Features

- Password hashing using bcrypt with salt rounds
- Session-based authentication
- Input validation and sanitization
- CSRF protection
- Rate limiting on authentication endpoints

## Contributing

This is a personal project, but suggestions and feedback are welcome!

## License

MIT License
