const jwt = require('jsonwebtoken');

function getTokenFromReq(req) {
  const auth = req.headers.authorization || '';
  const [scheme, token] = auth.split(' ');
  if (scheme && scheme.toLowerCase() === 'bearer' && token) return token;
  return null;
}

function adminJwtAuth(req, res, next) {
  const token = getTokenFromReq(req);
  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing admin token' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (!payload || payload.userType !== 'admin' || !payload.adminId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    req.admin = {
      adminId: payload.adminId,
      username: payload.username || null,
    };
    next();
  } catch (e) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
}

module.exports = adminJwtAuth;

