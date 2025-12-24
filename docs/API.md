# API Documentation

## Base URL
- Development: `http://localhost:3000/api`
- Production: `https://spaceadventure.example.com/api`

## Authentication

All game endpoints require authentication. Include the session cookie in requests.

### Register
Create a new user account.

**Endpoint**: `POST /api/auth/register`

**Request Body**:
```json
{
  "username": "string (3-20 chars)",
  "password": "string (min 8 chars)",
  "email": "string (optional)"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "username": "string",
    "sessionToken": "string"
  },
  "timestamp": 1703462400000
}
```

**Errors**:
- `400` - Invalid input
- `409` - Username already exists

### Login
Authenticate an existing user.

**Endpoint**: `POST /api/auth/login`

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "username": "string",
    "sessionToken": "string"
  },
  "timestamp": 1703462400000
}
```

**Errors**:
- `400` - Invalid input
- `401` - Invalid credentials
- `429` - Too many login attempts

### Logout
End the current session.

**Endpoint**: `POST /api/auth/logout`

**Response**: `200 OK`
```json
{
  "success": true,
  "timestamp": 1703462400000
}
```

### Get Current User
Get information about the authenticated user.

**Endpoint**: `GET /api/auth/me`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "userId": "string",
    "username": "string",
    "createdAt": 1703462400000,
    "lastLogin": 1703462400000
  },
  "timestamp": 1703462400000
}
```

**Errors**:
- `401` - Not authenticated

## Game State

### Get Player State
Get complete game state for the current player.

**Endpoint**: `GET /api/game/state`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "planets": [
      {
        "id": "string",
        "name": "string",
        "coordinates": [1, 1, 1],
        "resources": {
          "metal": 1000,
          "crystal": 500,
          "deuterium": 100,
          "energy": 0
        },
        "production": {
          "metal": 30,
          "crystal": 15,
          "deuterium": 0,
          "energy": 50
        },
        "buildings": {
          "metalMine": 5,
          "crystalMine": 3,
          "deuteriumSynthesizer": 0,
          "solarPlant": 4
        },
        "buildQueue": [
          {
            "building": "metalMine",
            "level": 6,
            "finishTime": 1703462400000
          }
        ]
      }
    ],
    "research": {
      "energyTech": 2,
      "computerTech": 1,
      "weaponsTech": 0
    },
    "researchQueue": [],
    "fleets": []
  },
  "timestamp": 1703462400000
}
```

### Get Planet Details
Get detailed information about a specific planet.

**Endpoint**: `GET /api/game/planet/:planetId`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "string",
    "name": "string",
    "coordinates": [1, 1, 1],
    "resources": {},
    "buildings": {},
    "production": {},
    "storage": {},
    "buildQueue": [],
    "ships": {},
    "defenses": {}
  },
  "timestamp": 1703462400000
}
```

## Buildings

### Build/Upgrade Building
Start construction or upgrade of a building.

**Endpoint**: `POST /api/game/planet/:planetId/build`

**Request Body**:
```json
{
  "building": "metalMine|crystalMine|deuteriumSynthesizer|solarPlant|...",
  "cancel": false
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "building": "metalMine",
    "level": 6,
    "cost": {
      "metal": 500,
      "crystal": 250
    },
    "buildTime": 120,
    "finishTime": 1703462520000
  },
  "timestamp": 1703462400000
}
```

**Errors**:
- `400` - Invalid building or insufficient resources
- `409` - Build queue full

### Cancel Building
Cancel ongoing construction.

**Endpoint**: `DELETE /api/game/planet/:planetId/build/:buildingId`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "refund": {
      "metal": 400,
      "crystal": 200
    }
  },
  "timestamp": 1703462400000
}
```

## Research

### Start Research
Begin researching a technology.

**Endpoint**: `POST /api/game/research`

**Request Body**:
```json
{
  "technology": "energyTech|weaponsTech|shieldingTech|...",
  "planetId": "string"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "technology": "energyTech",
    "level": 3,
    "cost": {
      "metal": 0,
      "crystal": 800,
      "deuterium": 400
    },
    "researchTime": 600,
    "finishTime": 1703463000000
  },
  "timestamp": 1703462400000
}
```

**Errors**:
- `400` - Requirements not met or insufficient resources
- `409` - Research already in progress

### Cancel Research
Cancel ongoing research.

**Endpoint**: `DELETE /api/game/research`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "refund": {
      "crystal": 640,
      "deuterium": 320
    }
  },
  "timestamp": 1703462400000
}
```

## Fleet

### Build Ships
Construct ships in the shipyard.

**Endpoint**: `POST /api/game/planet/:planetId/ships`

**Request Body**:
```json
{
  "ships": {
    "lightFighter": 10,
    "smallCargo": 5
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "totalCost": {
      "metal": 5000,
      "crystal": 2500
    },
    "buildTime": 300,
    "finishTime": 1703462700000
  },
  "timestamp": 1703462400000
}
```

### Send Fleet
Dispatch fleet on a mission.

**Endpoint**: `POST /api/game/fleet/send`

**Request Body**:
```json
{
  "fromPlanetId": "string",
  "targetCoordinates": [1, 2, 3],
  "mission": "attack|transport|colonize|espionage",
  "ships": {
    "lightFighter": 10,
    "smallCargo": 2
  },
  "resources": {
    "metal": 1000,
    "crystal": 500,
    "deuterium": 100
  }
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "fleetId": "string",
    "arrivalTime": 1703463000000,
    "returnTime": 1703463600000,
    "fuelCost": 50
  },
  "timestamp": 1703462400000
}
```

### Recall Fleet
Recall a fleet before it arrives.

**Endpoint**: `POST /api/game/fleet/:fleetId/recall`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "newReturnTime": 1703462700000
  },
  "timestamp": 1703462400000
}
```

## Galaxy

### Get Galaxy View
View systems in a galaxy.

**Endpoint**: `GET /api/game/galaxy/:galaxy/:system`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "galaxy": 1,
    "system": 1,
    "planets": [
      {
        "position": 1,
        "player": "AI_Trader",
        "playerType": "ai",
        "planetName": "Homeworld",
        "activity": "15m",
        "moon": false
      },
      {
        "position": 4,
        "player": "YourPlayer",
        "playerType": "player",
        "planetName": "Your Colony",
        "activity": "0m",
        "moon": false
      }
    ]
  },
  "timestamp": 1703462400000
}
```

### Espionage Report
Get espionage data on a target (requires espionage probe).

**Endpoint**: `GET /api/game/espionage/:galaxy/:system/:position`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "resources": {
      "metal": 50000,
      "crystal": 25000,
      "deuterium": 10000
    },
    "fleet": {
      "lightFighter": 20,
      "cruiser": 5
    },
    "defenses": {
      "rocketLauncher": 50,
      "laserCannon": 10
    },
    "buildings": {
      "metalMine": 10,
      "crystalMine": 8
    }
  },
  "timestamp": 1703462400000
}
```

## Combat Reports

### Get Combat Reports
Retrieve list of combat reports.

**Endpoint**: `GET /api/game/reports`

**Query Parameters**:
- `limit` (optional): Number of reports (default: 20)
- `offset` (optional): Pagination offset (default: 0)

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "string",
        "timestamp": 1703462400000,
        "attacker": "YourPlayer",
        "defender": "AI_Aggressive",
        "coordinates": [1, 2, 3],
        "result": "won|lost|draw",
        "loot": {
          "metal": 10000,
          "crystal": 5000,
          "deuterium": 2000
        },
        "losses": {
          "attacker": {
            "lightFighter": 2
          },
          "defender": {
            "lightFighter": 15
          }
        },
        "debrisField": {
          "metal": 3000,
          "crystal": 1500
        }
      }
    ],
    "total": 45
  },
  "timestamp": 1703462400000
}
```

### Get Combat Report Details
Get detailed information about a specific combat.

**Endpoint**: `GET /api/game/reports/:reportId`

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "id": "string",
    "timestamp": 1703462400000,
    "rounds": [
      {
        "round": 1,
        "attackerDamage": 15000,
        "defenderDamage": 8000,
        "attackerShips": {},
        "defenderShips": {}
      }
    ],
    "result": "won",
    "loot": {},
    "debris": {}
  },
  "timestamp": 1703462400000
}
```

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "success": false,
  "error": "Invalid input",
  "timestamp": 1703462400000
}
```

### 401 Unauthorized
```json
{
  "success": false,
  "error": "Authentication required",
  "timestamp": 1703462400000
}
```

### 404 Not Found
```json
{
  "success": false,
  "error": "Resource not found",
  "timestamp": 1703462400000
}
```

### 429 Too Many Requests
```json
{
  "success": false,
  "error": "Rate limit exceeded",
  "retryAfter": 60,
  "timestamp": 1703462400000
}
```

### 500 Internal Server Error
```json
{
  "success": false,
  "error": "Internal server error",
  "timestamp": 1703462400000
}
```

## Rate Limits

- Authentication endpoints: 5 requests per minute
- Game state endpoints: 60 requests per minute
- Action endpoints (build, research, fleet): 30 requests per minute
- Combat endpoints: 10 requests per minute

Rate limits are per user session.
