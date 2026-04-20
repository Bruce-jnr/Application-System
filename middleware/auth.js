// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
    console.log('isAdmin middleware check:', {
        session: req.session,
        isAdmin: req.session.isAdmin,
        adminId: req.session.adminId,
        sessionId: req.session.id,
        headers: req.headers
    });

    // Check if session exists and has required properties
    if (!req.session) {
        console.log('No session found');
        return res.status(403).json({
            success: false,
            message: 'No session found'
        });
    }

    // Check if user is admin
    if (!req.session.isAdmin) {
        console.log('User is not admin');
        return res.status(403).json({
            success: false,
            message: 'Not an admin user'
        });
    }

    // Check if adminId exists
    if (!req.session.adminId) {
        console.log('No adminId in session');
        return res.status(403).json({
            success: false,
            message: 'No admin ID in session'
        });
    }

    // All checks passed
    console.log('Admin check passed');
    next();
};

module.exports = {
    isAdmin
}; 