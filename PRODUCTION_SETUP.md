# Production Setup Guide

## Environment Variables for Production

Add these environment variables to your production server:

```bash
# Production Environment
NODE_ENV=production

# Database Configuration
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=your_production_db_name
DB_SSL=true

# Session Configuration
SESSION_SECRET=your_very_secure_production_session_secret_key_here
SESSION_COOKIE_NAME=nsacoe_admin_session
SESSION_MAX_AGE_MS=86400000
SESSION_SECURE=true
SESSION_SAMESITE=none
SESSION_ROLLING=true
SESSION_COOKIE_DOMAIN=.nsacoe.edu.gh

# Application Configuration
PORT=3000
FRONTEND_URL=https://app.nsacoe.edu.gh

# Force database initialization (set to false after first run)
FORCE_DB_INIT=false
```

## Key Changes Made for Production

### 1. Session Cookie Configuration

- `secure: true` - Only works with HTTPS
- `sameSite: 'none'` - Allows cross-site cookies
- `domain: '.nsacoe.edu.gh'` - Sets cookie for your domain and subdomains (automatically configured)

### 2. CORS Configuration

- Restricts origins to your production domains:
  - `https://nsacoe.edu.gh` (main domain)
  - `https://www.nsacoe.edu.gh` (www subdomain)
  - `https://app.nsacoe.edu.gh` (app subdomain)
- Allows credentials (cookies) to be sent

### 3. Trust Proxy

- `app.set('trust proxy', 1)` - Trusts reverse proxy headers

## Deployment Checklist

1. ✅ Set `NODE_ENV=production`
2. ✅ Use HTTPS in production
3. ✅ Set secure session secret
4. ✅ Configure database SSL
5. ✅ Set correct domain for cookies
6. ✅ Update CORS origins
7. ✅ Test login flow

## Common Production Issues

### Issue: Login redirects back to login page

**Solution**: Check these settings:

- `SESSION_SECURE=true` (requires HTTPS)
- `SESSION_SAMESITE=none`
- `SESSION_COOKIE_DOMAIN=.nsacoe.edu.gh`
- CORS origins include your domains:
  - `https://nsacoe.edu.gh`
  - `https://app.nsacoe.edu.gh`

### Issue: Cookies not being set

**Solution**:

- Ensure HTTPS is enabled
- Check domain configuration
- Verify CORS credentials setting

### Issue: Session not persisting

**Solution**:

- Check database connection
- Verify session store configuration
- Check session secret is set

### Issue: ERR_TOO_MANY_REDIRECTS

**Solution**:

- Remove any HTTPS redirect middleware (hosting provider handles this)
- Check for redirect loops in your routes
- Clear browser cookies and cache
- Verify `NODE_ENV=production` is set correctly
- Test with a minimal server first

### Issue: Content Security Policy (CSP) blocking API calls

**Solution**:

- Add your domains to the `connectSrc` directive in helmet CSP configuration:
  ```javascript
  connectSrc: [
    "'self'",
    'https://nsacoe.edu.gh',
    'https://www.nsacoe.edu.gh',
    'https://app.nsacoe.edu.gh',
    // ... other allowed domains
  ];
  ```
- This allows fetch/XMLHttpRequest calls to your API endpoints

### Issue: Login works from app.nsacoe.edu.gh but not from nsacoe.edu.gh

**Solution**:

- Ensure session cookies are shared between domains by setting `domain: '.nsacoe.edu.gh'`
- Use `window.location.origin` for API calls to avoid cross-domain issues
- Verify both domains are in CORS and CSP allowlists
- Check that redirects don't interfere with session cookies
