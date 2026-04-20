const crypto = require('crypto');
const bcrypt = require('bcrypt');
const pool = require('../config/db');

class ApiKeyManager {
    static generateApiKey() {
        // Generate a random 32-byte hex string
        return crypto.randomBytes(32).toString('hex');
    }

    static async hashApiKey(apiKey) {
        // Hash the API key using bcrypt
        return bcrypt.hash(apiKey, 10);
    }

    static async createApiKey(vendorId, expiresInDays = 365) {
        if (!vendorId || typeof vendorId !== 'number' || vendorId <= 0) {
            throw new Error('Invalid vendor ID');
        }

        const apiKey = this.generateApiKey();
        const apiKeyHash = await this.hashApiKey(apiKey);
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + expiresInDays);
        const name = `API Key ${new Date().toISOString().split('T')[0]}`; // Default name with date

        try {
            // First verify the vendor exists and is active
            const [vendors] = await pool.query(
                'SELECT id FROM users WHERE id = ? AND user_type = "vendor"',
                [vendorId]
            );

            if (vendors.length === 0) {
                throw new Error('Vendor not found');
            }

            // Check for existing active keys
            const [existingKeys] = await pool.query(
                'SELECT COUNT(*) as count FROM vendor_api_keys WHERE vendor_id = ? AND is_active = true',
                [vendorId]
            );

            if (existingKeys[0].count >= 5) {
                throw new Error('Maximum number of active API keys (5) reached for this vendor');
            }

            // Create the new API key
            await pool.query(
                'INSERT INTO vendor_api_keys (vendor_id, name, api_key, api_key_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
                [vendorId, name, apiKey, apiKeyHash, expiresAt]
            );

            return apiKey; // Return the unhashed API key only once
        } catch (error) {
            console.error('Error creating API key:', error);
            if (error.message === 'Vendor not found') {
                throw error;
            }
            if (error.message.includes('Maximum number of active API keys')) {
                throw error;
            }
            throw new Error('Failed to create API key: Database error');
        }
    }

    static async validateApiKey(apiKey) {
        try {
            const [rows] = await pool.query(
                `SELECT v.id as vendor_id, v.username, vk.id as key_id, vk.api_key_hash 
                 FROM vendor_api_keys vk 
                 JOIN users v ON vk.vendor_id = v.id 
                 WHERE vk.is_active = true 
                 AND (vk.expires_at IS NULL OR vk.expires_at > NOW())`
            );

            for (const row of rows) {
                const isValid = await bcrypt.compare(apiKey, row.api_key_hash);
                if (isValid) {
                    // Update last used timestamp
                    await pool.query(
                        'UPDATE vendor_api_keys SET last_used_at = NOW() WHERE id = ?',
                        [row.key_id]
                    );

                    return {
                        vendorId: row.vendor_id,
                        username: row.username
                    };
                }
            }

            return null;
        } catch (error) {
            console.error('Error validating API key:', error);
            throw new Error('Failed to validate API key');
        }
    }

    static async revokeApiKey(apiKey) {
        const apiKeyHash = await this.hashApiKey(apiKey);
        
        try {
            await pool.query(
                'UPDATE vendor_api_keys SET is_active = false WHERE api_key_hash = ?',
                [apiKeyHash]
            );
            return true;
        } catch (error) {
            console.error('Error revoking API key:', error);
            throw new Error('Failed to revoke API key');
        }
    }

    static async listApiKeys(vendorId) {
        try {
            const [rows] = await pool.query(
                `SELECT id, created_at, last_used_at, expires_at, is_active 
                 FROM vendor_api_keys 
                 WHERE vendor_id = ? 
                 ORDER BY created_at DESC`,
                [vendorId]
            );
            return rows;
        } catch (error) {
            console.error('Error listing API keys:', error);
            throw new Error('Failed to list API keys');
        }
    }
}

module.exports = ApiKeyManager; 