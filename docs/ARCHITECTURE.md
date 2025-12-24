# System Architecture

## Overview

Space Adventure uses a client-server architecture with Bun as the runtime environment. The backend handles all game logic, authentication, and data persistence, while the frontend provides an interactive UI.

## Technology Choices

### Bun Runtime
- **Fast**: Native TypeScript support, optimized performance
- **All-in-one**: Built-in bundler, test runner, package manager
- **Modern**: Latest JavaScript/TypeScript features
- **Simple**: Minimal configuration required

### JSON Storage
- **Phase 1 Solution**: Simple file-based storage for MVP
- **Benefits**: No additional dependencies, easy debugging, version controllable
- **Limitations**: Not suitable for high concurrency, will migrate later
- **Future**: Plan to migrate to SQLite or PostgreSQL

## System Components

### 1. Authentication System

```typescript
// Authentication Flow
User Input (username/password)
  ↓
Client hashes password with SHA-256
  ↓
Hashed password sent to server
  ↓
Server validates credentials
  ↓
Server hashes again with bcrypt + salt
  ↓
Password hash comparison (bcrypt)
  ↓
Session token generated
  ↓
Token stored in memory + cookie
  ↓
Client stores token
```

#### Password Security (Double Hashing)
- **Client-side Hashing**: SHA-256 via Web Crypto API
  - Password hashed before network transmission
  - 64 hexadecimal character output
  - Prevents plain text password exposure
- **Server-side Hashing**: bcrypt
  - Hashes the client-provided SHA-256 hash
  - Salt Rounds: 12 (configurable)
  - Unique salt per user automatically generated
- **Password Requirements**: 
  - Minimum 8 characters (validated before client hashing)
  - Mix of letters and numbers recommended
  - Special characters supported

#### Session Management
- **Token Storage**: In-memory Map with user ID → session data
- **Token Expiry**: 24 hours (configurable)
- **Cookie**: httpOnly, secure (in production), sameSite
- **Logout**: Removes session from memory and clears cookie

### 2. Game Engine

```
Game Loop (Server-Side)
  ↓
Calculate resource production per player
  ↓
Update building construction timers
  ↓
Process research completion
  ↓
Update fleet movements
  ↓
Process combat if fleet arrives
  ↓
Execute AI decisions
  ↓
Persist state to JSON
  ↓
Repeat every tick (1-5 seconds)
```

#### Resource Calculation
```typescript
// Formula for resource production
currentAmount = storedAmount + (productionRate * timeDelta)
productionRate = baseMineProduction * (1.05 ^ buildingLevel)
maxStorage = baseStorage * (1.5 ^ storageLevel)
```

#### Building System
```typescript
// Building construction
const cost = baseCost * (1.5 ^ level)
const buildTime = baseTime * (1.5 ^ level) / roboticsMultiplier
```

### 3. AI System

```
AI Agent
  ↓
Evaluate Current State
  - Resources available
  - Fleet strength
  - Defense level
  - Tech level
  ↓
Decision Tree
  - Need resources? → Build mines
  - Weak defense? → Build defenses
  - Strong economy? → Build fleet
  - Ready to attack? → Select target
  ↓
Execute Action
  ↓
Update AI State
```

#### AI Decision Making
- **Priority Queue**: Tasks ordered by importance
- **State Machine**: Different behaviors based on game phase
- **Fuzzy Logic**: Weighted decision making
- **Random Variation**: Prevent predictability

### 4. Data Storage

#### File Structure
```
data/
  users.json          # User accounts and authentication
  players.json        # Player game state (planets, resources, buildings)
  fleets.json         # Fleet positions and movements
  combatLogs.json     # Battle history
  aiStates.json       # AI player states
```

#### Data Models

**User Model**
```typescript
interface User {
  id: string;
  username: string;
  passwordHash: string;
  email?: string;
  createdAt: number;
  lastLogin: number;
}
```

**Player Model**
```typescript
interface Player {
  userId: string;
  planets: Planet[];
  research: Research;
  fleets: Fleet[];
}

interface Planet {
  id: string;
  name: string;
  coordinates: [galaxy: number, system: number, position: number];
  resources: Resources;
  buildings: Buildings;
  production: Production;
  lastUpdate: number;
}
```

### 5. API Layer

#### RESTful Endpoints

**Authentication**
- `POST /api/auth/register` - Create new account
- `POST /api/auth/login` - Authenticate user
- `POST /api/auth/logout` - End session
- `GET /api/auth/me` - Get current user info

**Game State**
- `GET /api/game/state` - Get full player state
- `GET /api/game/planet/:id` - Get planet details
- `POST /api/game/planet/:id/build` - Start building construction
- `POST /api/game/research` - Start research
- `POST /api/game/fleet/create` - Build ships
- `POST /api/game/fleet/send` - Send fleet mission

**AI Interaction**
- `GET /api/game/galaxy/:galaxy/:system` - Get galaxy view
- `POST /api/game/attack` - Attack AI planet
- `GET /api/game/reports` - Get combat reports

#### Request/Response Format
```typescript
// Standard response format
interface APIResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: number;
}
```

### 6. Frontend Architecture

#### Structure
```
client/
  index.html          # Main HTML shell
  js/
    main.js          # App initialization
    api.js           # API client
    game.js          # Game state management
    ui/
      overview.js    # Overview screen
      buildings.js   # Buildings screen
      research.js    # Research screen
      fleet.js       # Fleet management
      galaxy.js      # Galaxy view
    components/
      header.js      # UI header
      timer.js       # Countdown timers
      resources.js   # Resource display
  css/
    main.css         # Main styles
    theme.css        # Color theme
  assets/
    images/          # Game images
    icons/           # UI icons
```

#### State Management
- Simple reactive state object
- Event-driven updates
- LocalStorage for client preferences
- Periodic polling for game state updates

### 7. Security Considerations

#### Authentication Security
- Passwords never stored in plaintext
- Bcrypt with salt rounds for hashing
- Session tokens with expiry
- HTTP-only cookies to prevent XSS
- Rate limiting on login attempts

#### Input Validation
- Server-side validation for all inputs
- Type checking with TypeScript
- Sanitization of user input
- Protection against injection attacks

#### API Security
- Authentication required for game endpoints
- CORS configured for production
- Request size limits
- Rate limiting on expensive operations

### 8. Performance Optimization

#### Backend
- Lazy loading of game data
- Batch updates to JSON files
- In-memory caching of active players
- Efficient game loop with delta time

#### Frontend
- Minimal DOM manipulation
- Virtual scrolling for large lists
- Debounced API calls
- Asset optimization and lazy loading

## Deployment Architecture

### Development
```
Bun Dev Server (port 3000)
  ↓
Serves static files
  ↓
API endpoints
  ↓
JSON file storage
```

### Production (Future)
```
Nginx (Reverse Proxy)
  ↓
Bun Application Server
  ↓
PostgreSQL Database
  ↓
Redis (Session Store)
```

## Testing Strategy

### Unit Tests
- Authentication logic
- Game calculations (resource production, combat)
- Building cost calculations
- AI decision making

### Integration Tests
- API endpoint testing
- Full game flow scenarios
- Combat system end-to-end

### Performance Tests
- Concurrent user handling
- Game loop efficiency
- Large fleet battles

## Monitoring & Logging

### Logging Levels
- **ERROR**: Authentication failures, system errors
- **WARN**: Rate limit hits, unusual behavior
- **INFO**: User actions, game events
- **DEBUG**: Detailed execution flow

### Metrics to Track
- Active users
- API response times
- Game loop execution time
- Combat calculations per second
- AI decision time
