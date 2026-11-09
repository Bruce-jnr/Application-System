# Security changes and production checks

These changes require no database migrations or credential resets. Deploy the
changed source files together, then restart the Node application. Do not enable
`FORCE_DB_INIT`: the initializer drops core tables.

## Compatibility

- GET and POST `/api/vouchers` now require an admin bearer token. The listing
  excludes PIN hashes. These older endpoints also now use the promise database
  API correctly. Existing `/api/admin` voucher routes retain their URLs.
- POST `/api/vendor/generate-api-key` now requires an admin bearer token.
  Vendor voucher operations retain their existing API-key authentication.
- PIN and serial formats remain unchanged; generation uses cryptographic randomness.
- Applicant and student logins regenerate their sessions after successful
  authentication. Existing authenticated sessions do not need a reset.
- Login/PIN-check routes allow 30 failed attempts per 15 minutes per IP, in
  addition to the existing global limiter. Successful requests do not consume
  the failed-login allowance. Shared networks can share that allowance.
- Rate limiting now uses Express's proxy-aware `req.ip` instead of directly
  trusting arbitrary IP headers. The existing `trust proxy = 1` assumes exactly
  one trusted proxy hop; verify this against the hosting configuration.
- Production CORS retains the three existing college origins and FRONTEND_URL.
  FRONTEND_URL is normalized to its origin, so a trailing slash/path is accepted.
  Denied origins return 403 and are logged. PATCH and X-API-Key preflights are
  supported. CORS does not replace authentication.
- Application authentication runs before upload parsing. Voucher selection uses
  a row lock within the existing transaction to serialize duplicate submissions.
- API and student responses use Cache-Control: no-store.

## Validation

Run `node --test tests/security.test.js`. These tests stub database access and
cover anonymous access denial, valid admin access, malformed voucher input,
trusted and denied CORS origins, and JWT role/algorithm restrictions.

Before production rollout, exercise voucher login, application submission with
documents, admin login/review, student login, and vendor API generation in a
staging environment with the production schema. Check CORS logs for any genuine
frontend origin missing from the allowlist. Check API-key provisioning tools for
the new admin authorization requirement.

## Remaining work

This is a targeted hardening pass, not a complete security audit. Existing issues
still include mixed admin session/JWT flows, routes after the catch-all 404,
legacy document paths exposed through the uploads static mount, browser HTML
rendering that needs an XSS review, plaintext admission PIN storage, and API-key
revocation logic that compares freshly salted bcrypt hashes. These require
separate compatibility work and end-to-end verification.

A credential-shaped value was removed from the vendor API documentation. If it
was an active credential, revoke/rotate it separately; removing it from the
current file does not remove previous copies or Git history.
