const ApiKeyManager = require('../utils/apiKeyManager');

const apiKeyAuth = async (req, res, next) => {
    try {
        const apiKey = req.headers['x-api-key'];

        if (!apiKey) {
            return res.status(401).json({ error: 'API key is required' });
        }

        const vendor = await ApiKeyManager.validateApiKey(apiKey);
        
        if (!vendor) {
            return res.status(401).json({ error: 'Invalid API key' });
        }

        if (vendor.status === 'suspended') {
            return res.status(403).json({
                error: 'API key is suspended and will be reactivated when sales of forms begins'
            });
        }

        if (vendor.status === 'expired') {
            return res.status(403).json({
                error: 'API key has expired'
            });
        }

        // Add vendor information to request object
        req.vendor = vendor;
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = apiKeyAuth; 