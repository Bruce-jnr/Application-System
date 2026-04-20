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

        // Add vendor information to request object
        req.vendor = vendor;
        next();
    } catch (error) {
        console.error('API key authentication error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = apiKeyAuth; 