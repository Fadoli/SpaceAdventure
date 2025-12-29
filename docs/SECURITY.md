# Security Documentation

## Overview

This document outlines the security measures implemented in Space Adventure to protect user data and prevent common vulnerabilities.

## Authentication Security

### Password Storage

**Double Hashing Strategy**: Client-side + Server-side
- **Client-side**: SHA-256 hash before transmission (prevents plain text over network)
- **Server-side**: bcrypt with salt on the already-hashed password (prevents rainbow table attacks)

**Why Double Hashing?**
1. Password never transmitted in plain text
2. Even if HTTPS is compromised, attacker gets SHA-256 hash, not original password
3. Server adds bcrypt with unique salt per user
4. Defense in depth approach

**Implementation**:
```javascript
// Client-side (browser)
const encoder = new TextEncoder();
const data = encoder.encode(password);
const hashBuffer = await crypto.subtle.digest('SHA-256', data);
const clientHash = arrayToHex(hashBuffer); // 64 hex chars

// Server-side (Bun)
import bcrypt from 'bcrypt';

// Registration - hash the client-provided hash
const saltRounds = 12;
const passwordHash = await bcrypt.hash(clientHash, saltRounds);

// Login - compare hashed client hash
const isValid = await bcrypt.compare(clientHash, user.passwordHash);
```

**Salt Rounds**: 12
- Balances security and performance
- Each increment doubles computation time
- Configurable via environment variable

### Password Requirements

**Minimum Requirements**:
- Length: At least 8 characters (validated on client before hashing)
- Recommended: Mix of uppercase, lowercase, numbers, and special characters
- No maximum length (within reason)

**Validation Flow**:
1. Client validates password length and complexity
2. Client hashes with SHA-256 (produces 64 hex character string)
3. Server validates hash format (must be 64 hex chars)
4. Server hashes again with bcrypt + salt

**Benefits**:
- Original password never leaves the client
- Network sniffing only reveals SHA-256 hash
- Server breach only exposes bcrypt(SHA-256(password))
- Attacker needs to crack both layers

### Session Management

**Session Storage**:
- In-memory Map for development
- Redis recommended for production
- Sessions expire after 24 hours

**Session Token**:
- Random UUID generated on login
- Stored in httpOnly cookie
- Associated with user ID server-side

**Cookie Configuration**:
```typescript
{
  httpOnly: true,        // Prevents XSS access
  secure: production,    // HTTPS only in production
  sameSite: 'strict',   // CSRF protection
  maxAge: 86400000      // 24 hours
}
```

### Login Rate Limiting

**Implementation**:
- Track failed login attempts per username
- Progressive delays after failures
- Temporary lockout after 5 failed attempts
- 15-minute cooldown period

```typescript
const MAX_ATTEMPTS = 5;
const LOCKOUT_TIME = 15 * 60 * 1000; // 15 minutes
```

## Input Validation

### Server-Side Validation

All user inputs are validated on the server before processing.

**Username Validation**:
- Length: 3-20 characters
- Allowed characters: alphanumeric, underscore, hyphen
- Case-insensitive uniqueness check

**Coordinate Validation**:
- Galaxy: 1-9
- System: 1-499
- Position: 1-15

**Amount Validation**:
- Non-negative numbers
- Within available resources
- Integer values only

### Type Safety

TypeScript provides compile-time type checking:
```typescript
interface BuildRequest {
  building: BuildingType;
  planetId: string;
}

type BuildingType = 'metalMine' | 'crystalMine' | 'solarPlant' | ...;
```

### Sanitization

- HTML escaping for any user-generated content
- JSON serialization handles special characters
- No direct SQL (using JSON storage)

## API Security

### Authentication Middleware

All game endpoints require valid session:
```typescript
async function requireAuth(req: Request): Promise<User | null> {
  const token = getCookie(req, 'session');
  if (!token) return null;
  
  const session = sessions.get(token);
  if (!session || session.expiresAt < Date.now()) {
    return null;
  }
  
  return getUserById(session.userId);
}
```

### CORS Configuration

**Development**:
- Allow localhost origins
- Credentials enabled

**Production**:
- Whitelist specific domains
- Strict origin checking
- No wildcard origins with credentials

### Request Size Limits

- Body size: 1MB maximum
- Prevents memory exhaustion attacks
- Configurable per endpoint

### Rate Limiting

**Implementation**:
```typescript
const rateLimits = new Map<string, number[]>();

function checkRateLimit(userId: string, limit: number, window: number): boolean {
  const timestamps = rateLimits.get(userId) || [];
  const cutoff = Date.now() - window;
  
  const recent = timestamps.filter(t => t > cutoff);
  
  if (recent.length >= limit) {
    return false;
  }
  
  recent.push(Date.now());
  rateLimits.set(userId, recent);
  return true;
}
```

**Rate Limits by Endpoint Type**:
- Auth: 5/minute
- Read operations: 60/minute
- Write operations: 30/minute
- Combat: 10/minute

## Data Security

### File System Storage

**Development Phase**:
- JSON files in `data/` directory
- File permissions: 600 (owner read/write only)
- Regular backups recommended

**File Structure**:
- Separate files for different data types
- Atomic writes to prevent corruption
- Validation on read

**Backup Strategy**:
```bash
# Automated backup script
cp -r data/ backups/data-$(date +%Y%m%d-%H%M%S)/
```

### Sensitive Data

**Never Log**:
- Passwords (plain or hashed)
- Session tokens
- Authentication cookies

**What Can Be Logged**:
- User IDs
- Usernames
- Game actions
- Timestamps
- Error messages (sanitized)

## Common Vulnerabilities

### XSS (Cross-Site Scripting)

**Prevention**:
- httpOnly cookies prevent script access
- HTML escaping for user-generated content
- Content-Security-Policy headers

### CSRF (Cross-Site Request Forgery)

**Prevention**:
- SameSite cookie attribute
- Token validation for state-changing operations
- Origin checking

### SQL Injection

**Not Applicable**:
- Using JSON file storage (no SQL)
- Future migration will use parameterized queries

### Session Hijacking

**Prevention**:
- Secure, httpOnly cookies
- HTTPS in production
- Session expiry
- Token rotation on privilege escalation

### Timing Attacks

**Password Comparison**:
- bcrypt.compare() is timing-safe
- Constant-time operations for sensitive checks

### Resource Exhaustion

**Prevention**:
- Rate limiting on all endpoints
- Request size limits
- Game loop optimization
- Maximum resource caps

## Production Checklist

### Environment Variables

```bash
NODE_ENV=production
SESSION_SECRET=<random-secret-256-bits>
BCRYPT_ROUNDS=12
COOKIE_SECURE=true
ALLOWED_ORIGINS=https://yourdomain.com
```

### HTTPS Configuration

- TLS 1.3 minimum
- Strong cipher suites
- Certificate from trusted CA
- HSTS headers

### Headers

```typescript
{
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Content-Security-Policy': "default-src 'self'"
}
```

### Monitoring

**Log Events**:
- Failed login attempts
- Rate limit violations
- System errors
- Unusual activity patterns

**Alerts**:
- Multiple failed logins
- Sudden traffic spikes
- System errors
- Data corruption

### Regular Updates

- Keep Bun updated
- Update dependencies regularly
- Review security advisories
- Patch vulnerabilities promptly

## Security Audit Checklist

- [ ] Passwords hashed with bcrypt
- [ ] Session tokens secure and httpOnly
- [ ] Rate limiting implemented
- [ ] Input validation on all endpoints
- [ ] CORS properly configured
- [ ] HTTPS enabled in production
- [ ] Security headers configured
- [ ] File permissions set correctly
- [ ] Logging excludes sensitive data
- [ ] Error messages don't leak information
- [ ] Regular backups configured
- [ ] Dependency vulnerabilities checked

## Reporting Security Issues

If you discover a security vulnerability:
1. **Do not** open a public issue
2. Email security@spaceadventure.example.com
3. Provide detailed description
4. Allow time for patch before disclosure

## Future Enhancements

### Short Term
- Implement CSRF tokens
- Add 2FA support
- Email verification
- Password reset flow

### Long Term
- OAuth integration
- Hardware security key support
- Security audit logging
- Intrusion detection system

## Research System Security

### Data Integrity
- **Validation**: All research requests are validated server-side to prevent tampering.
- **Queue Management**: Research queues are managed in-memory and written to disk to ensure consistency.

### Resource Deduction
- **Atomic Operations**: Resource deductions for research are performed atomically to prevent race conditions.
- **Rollback Mechanism**: If a research operation fails, resources are refunded automatically.

### API Security
- **Authentication**: All research endpoints require a valid session token.
- **Rate Limiting**: Research endpoints are rate-limited to prevent abuse.
- **Input Sanitization**: All input data is sanitized to prevent injection attacks.
