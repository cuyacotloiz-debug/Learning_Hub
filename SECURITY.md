CSRF protection for refresh cookie flows

This project uses a double-submit cookie pattern to protect cookie-based refresh and logout endpoints from CSRF attacks.

How it works (server & frontend contract):

1. On successful login (POST /api/auth/login):
   - Server sets an HttpOnly refresh cookie named `refreshToken` (used only by the server).
   - Server also sets a non-HttpOnly cookie named `csrfToken` with a secure random value. This cookie is readable by JavaScript.
   - Server returns an access token in the response body as usual.

2. On requests that mutate auth state or exchange tokens (POST /api/auth/refresh and POST /api/auth/logout):
   - Client-side JavaScript must read the `csrfToken` cookie and include its value in the X-CSRF-Token header when making the request.
   - Server verifies the header value matches the `csrfToken` cookie (double-submit verification). If the values do not match, the request is rejected with HTTP 403.

Notes and considerations:
- The refresh cookie remains HttpOnly and is automatically included by the browser in requests to the same origin; the csrfToken cookie is intentionally non-HttpOnly so client code can read it and send it in the header.
- Cookies are set with SameSite=lax by default; tune this depending on your frontend architecture (e.g., same-site SPA vs cross-site embed).
- In production, cookies are set with Secure (only over HTTPS).
- This approach mitigates CSRF for token-refresh and logout endpoints. If you prefer stronger protection, consider an authenticated POST from the SPA that includes a per-request CSRF token retrieved via an authenticated API (synchronizer token) or other anti-CSRF patterns.

Frontend example (simplified):

// Read csrf cookie and include it in header
function getCsrf() {
  return document.cookie.split('; ').find(row => row.startsWith('csrfToken='))?.split('=')[1]
}

fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': getCsrf() },
  credentials: 'include'
})

Security tradeoffs and guidance:
- Double-submit token is stronger than relying on SameSite alone and is compatible with browser restrictions.
- Ensure the csrfToken cookie is not leaked to third-party scripts; avoid exposing it unnecessarily.
- For highly sensitive apps, combine CSRF protection with additional checks (origin header validation, same-site cookies, and user action verification).
