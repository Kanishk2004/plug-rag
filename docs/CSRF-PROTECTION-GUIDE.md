# CSRF (Cross-Site Request Forgery) Protection Guide

## What is CSRF?

**Cross-Site Request Forgery (CSRF)** is an attack where a malicious website tricks a user's browser into making unwanted requests to your application using the user's authenticated session.

### Example Attack Scenario:

1. User logs into your app at `yourapp.com` (gets auth cookie/token)
2. User visits malicious site `evil.com` (in another tab)
3. `evil.com` contains hidden form:
   ```html
   <form action="https://yourapp.com/api/bots/123" method="POST">
     <input type="hidden" name="status" value="inactive">
   </form>
   <script>document.forms[0].submit();</script>
   ```
4. Browser automatically sends your app's cookies with this request
5. Your server thinks it's a legitimate request from the user
6. User's bot gets disabled without their knowledge!

---

## How CSRF Tokens Prevent This

### The Solution:

1. **Server generates a unique, unpredictable token** for each user session
2. **Token is embedded in forms** and required for state-changing operations
3. **Server validates token** on each POST/PUT/DELETE request
4. **Malicious sites can't get the token** (same-origin policy prevents cross-origin cookie reading)

### Token Flow:

```
User Request → Server generates CSRF token → Stored in session/cookie
↓
Form renders with hidden token field
↓
User submits form → Token sent with request
↓
Server validates: Token in request === Token in session?
↓
✅ Match: Process request | ❌ Mismatch: Reject (403 Forbidden)
```

---

## Do You Need CSRF Protection?

### ✅ **YOU ARE PROTECTED** if using Clerk authentication

**Why?**
- Clerk uses **JWT tokens in Authorization headers** (not cookies)
- Requests must explicitly include: `Authorization: Bearer <token>`
- Malicious sites **cannot read or send** these headers due to CORS
- Clerk handles token validation automatically

### ⚠️ **YOU MIGHT BE VULNERABLE** if:

1. **Using cookie-based sessions** instead of JWT headers
2. **Webhook endpoints** without signature verification
3. **Public endpoints** that perform state changes

---

## Current Status in Your Application

### Protected Endpoints ✅

All authenticated endpoints using Clerk's `auth()`:
- `POST /api/bots` - Create bot
- `PATCH /api/bots/[id]` - Update bot
- `DELETE /api/bots/[id]` - Delete bot
- `POST /api/files/upload/*` - File operations
- All dashboard routes

**Reason:** Clerk's JWT in Authorization header prevents CSRF

### Potentially Vulnerable ⚠️

**1. Webhook Endpoint:** `POST /api/webhooks/clerk`
- **Risk:** Low (uses Svix signature verification)
- **Status:** Protected by webhook signature
- **Action Needed:** None

**2. Public Chat Endpoint:** `POST /api/chat/[botId]`
- **Risk:** Low (no authentication, no state changes to user account)
- **Status:** Uses rate limiting (your recent fix!)
- **Action Needed:** None (chat is meant to be public)

---

## Implementation Options (If Needed)

### Option 1: Use Clerk's Built-in Protection (Recommended)

Clerk automatically prevents CSRF when using:
- **JWT Bearer tokens** in headers (you're using this ✅)
- **Not using** cookie-based auth

**No additional code needed!**

### Option 2: Custom CSRF Tokens (For Cookie-Based Auth)

If you ever switch to cookie-based sessions:

```javascript
// middleware.js
import { createHash, randomBytes } from 'crypto';

export function generateCSRFToken() {
  return randomBytes(32).toString('hex');
}

export function validateCSRFToken(token, sessionToken) {
  // Constant-time comparison to prevent timing attacks
  const expected = Buffer.from(sessionToken);
  const actual = Buffer.from(token);
  
  if (expected.length !== actual.length) return false;
  return crypto.timingSafeEqual(expected, actual);
}

// In your API route:
export async function POST(request) {
  const csrfToken = request.headers.get('X-CSRF-Token');
  const sessionToken = request.cookies.get('csrf_token');
  
  if (!validateCSRFToken(csrfToken, sessionToken)) {
    return new Response('CSRF validation failed', { status: 403 });
  }
  
  // Process request...
}
```

### Option 3: Double-Submit Cookie Pattern

```javascript
// Set CSRF cookie on login
response.cookies.set('XSRF-TOKEN', generateToken(), {
  httpOnly: false, // Allow JavaScript to read
  secure: true,
  sameSite: 'strict'
});

// Client sends token in header
fetch('/api/endpoint', {
  headers: {
    'X-XSRF-TOKEN': getCookie('XSRF-TOKEN')
  }
});

// Server validates both match
const cookieToken = request.cookies.get('XSRF-TOKEN');
const headerToken = request.headers.get('X-XSRF-TOKEN');
if (cookieToken !== headerToken) return 403;
```

---

## Best Practices

### ✅ Do:

1. **Use HTTPS** - Prevents token theft via man-in-the-middle
2. **Set SameSite=Strict** on auth cookies (if using cookies)
3. **Validate on ALL state-changing operations** (POST, PUT, DELETE, PATCH)
4. **Use Clerk's recommended patterns** (JWT in headers)
5. **Verify webhook signatures** (you're doing this ✅)

### ❌ Don't:

1. **Accept CSRF tokens via URL params** (logged in browser history)
2. **Use GET requests for state changes** (GET should be idempotent)
3. **Disable CORS** without understanding the risks
4. **Trust referer header alone** (can be spoofed)

---

## Testing for CSRF Vulnerabilities

### Manual Test:

1. Log into your app
2. Open browser dev tools → Network tab
3. Find an authenticated request (e.g., create bot)
4. Copy as cURL
5. Try running from different origin:

```html
<!-- test.html on different domain -->
<form action="https://yourapp.com/api/bots" method="POST">
  <input name="name" value="hacked">
  <button>Submit</button>
</form>
```

If request succeeds without proper auth headers, you have CSRF vulnerability.

### Automated Test:

```javascript
// Using curl to simulate CSRF attack
curl 'https://yourapp.com/api/bots' \
  -H 'Cookie: session=stolen_cookie' \
  -H 'Origin: https://evil.com' \
  -H 'Referer: https://evil.com' \
  -X POST \
  -d '{"name":"hacked"}'

// Should return: 401 Unauthorized or 403 Forbidden
```

---

## Verdict for Your Application

### **STATUS: ✅ SECURE**

**Reasons:**
1. Using Clerk with JWT Bearer tokens (not vulnerable to CSRF)
2. Webhook endpoints use signature verification
3. Public endpoints (chat) don't modify user accounts
4. All authenticated operations require explicit Authorization header

**Recommendation:** 
- **No additional CSRF protection needed for MVP**
- Current architecture (JWT in headers) is CSRF-resistant by design
- Keep using Clerk's authentication patterns
- Monitor security logs for suspicious activity

---

## Additional Resources

- [OWASP CSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)
- [Clerk Security Best Practices](https://clerk.com/docs/security)
- [Next.js Security Headers](https://nextjs.org/docs/app/building-your-application/configuring/security-headers)

---

## Quick Reference

| Attack Type | Your Risk | Protection In Place |
|-------------|-----------|---------------------|
| CSRF on Auth Endpoints | **Low** | JWT in Authorization header |
| CSRF on Webhooks | **Low** | Svix signature verification |
| CSRF on Public Chat | **None** | No auth required, rate limited |
| XSS | **Medium** | Add input sanitization (✅ Done!) |
| SQL/NoSQL Injection | **Low** | Mongoose + sanitization (✅ Done!) |
| Rate Limiting | **None** | Implemented (✅ Done!) |

**Overall Security Score: 🟢 Good for MVP**
