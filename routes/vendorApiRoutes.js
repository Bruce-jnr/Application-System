const express = require('express');
const router = express.Router();
const ApiKeyManager = require('../utils/apiKeyManager');
const apiKeyAuth = require('../middleware/apiKeyAuth');
const pool = require('../config/db');
const bcrypt = require('bcrypt');

// Generate a serial number
function generateSerialNumber() {
    const prefix = 'NSCE25';
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    return `${prefix}${random}`;
}

// Generate a PIN
function generatePIN() {
    return Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
}

// Generate API key for vendor
router.post('/generate-api-key', async (req, res) => {
    try {
        const { vendorId } = req.body;
        
        if (!vendorId || typeof vendorId !== 'number' || vendorId <= 0) {
            return res.status(400).json({ 
                error: 'Invalid vendor ID format',
                details: 'Vendor ID must be a positive number'
            });
        }

        // Generate new API key
        const apiKey = await ApiKeyManager.createApiKey(vendorId);
        
        res.json({
            success: true,
            apiKey,
            message: 'API key generated successfully. Please store it securely as it won\'t be shown again.'
        });
    } catch (error) {
        console.error('Error generating API key:', error);
        
        // Handle specific error cases
        if (error.message === 'Vendor not found') {
            return res.status(404).json({ error: 'Vendor not found' });
        }
        
        if (error.message.includes('Maximum number of active API keys')) {
            return res.status(409).json({ 
                error: 'Maximum API keys reached',
                details: error.message
            });
        }
        
        if (error.message === 'Invalid vendor ID') {
            return res.status(400).json({ 
                error: 'Invalid vendor ID',
                details: 'Vendor ID must be a positive number'
            });
        }
        
        // Default error response
        res.status(500).json({ 
            error: 'Failed to generate API key',
            details: error.message
        });
    }
});

// Generate voucher (protected by API key)
router.post('/vouchers/generate', apiKeyAuth, async (req, res) => {
    try {
        const vendorId = req.vendor.vendorId;
        const connection = await pool.getConnection();
        
        try {
            await connection.beginTransaction();

            const serialNumber = generateSerialNumber();
            const pin = generatePIN();
            const pinHash = await bcrypt.hash(pin, 10);

            await connection.query(
                'INSERT INTO vouchers (serial_number, pin_hash, created_by) VALUES (?, ?, ?)',
                [serialNumber, pinHash, vendorId]
            );

            await connection.commit();
            
            res.json({
                success: true,
                voucher: {
                    serialNumber,
                    pin
                },
                message: 'Voucher generated successfully'
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error generating voucher:', error);
        res.status(500).json({ error: 'Failed to generate voucher' });
    }
});

// List vouchers (protected by API key)
router.get('/vouchers', apiKeyAuth, async (req, res) => {
    try {
        const { page = 1, limit = 10, status } = req.query;
        const vendorId = req.vendor.vendorId;
        const offset = (page - 1) * limit;

        let query = 'SELECT * FROM vouchers WHERE created_by = ?';
        const params = [vendorId];

        if (status) {
            query += ' AND is_used = ?';
            params.push(status === 'used' ? 1 : 0);
        }

        query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const [vouchers] = await pool.query(query, params);
        const [total] = await pool.query(
            'SELECT COUNT(*) as count FROM vouchers WHERE created_by = ?',
            [vendorId]
        );

        res.json({
            success: true,
            vouchers,
            pagination: {
                total: total[0].count,
                page: parseInt(page),
                limit: parseInt(limit),
                pages: Math.ceil(total[0].count / limit)
            }
        });
    } catch (error) {
        console.error('Error fetching vouchers:', error);
        res.status(500).json({ error: 'Failed to fetch vouchers' });
    }
});

// Revoke API key
router.post('/revoke-api-key', apiKeyAuth, async (req, res) => {
    try {
        const { apiKey } = req.body;
        const vendorId = req.vendor.vendorId;

        // Verify the API key belongs to the vendor
        const [keys] = await pool.query(
            'SELECT * FROM vendor_api_keys WHERE vendor_id = ? AND api_key_hash = ?',
            [vendorId, await ApiKeyManager.hashApiKey(apiKey)]
        );

        if (keys.length === 0) {
            return res.status(404).json({ error: 'API key not found' });
        }

        await ApiKeyManager.revokeApiKey(apiKey);
        
        res.json({
            success: true,
            message: 'API key revoked successfully'
        });
    } catch (error) {
        console.error('Error revoking API key:', error);
        res.status(500).json({ error: 'Failed to revoke API key' });
    }
});

// List API keys
router.get('/api-keys', apiKeyAuth, async (req, res) => {
    try {
        const vendorId = req.vendor.vendorId;
        const apiKeys = await ApiKeyManager.listApiKeys(vendorId);
        
        res.json({
            success: true,
            apiKeys
        });
    } catch (error) {
        console.error('Error listing API keys:', error);
        res.status(500).json({ error: 'Failed to list API keys' });
    }
});

// Mark voucher as used (protected by API key)
router.post('/vouchers/use', apiKeyAuth, async (req, res) => {
    try {
        const { serialNumber, pin } = req.body;
        const vendorId = req.vendor.vendorId;

        if (!serialNumber || !pin) {
            return res.status(400).json({
                success: false,
                message: 'Serial number and PIN are required'
            });
        }

        // Get the voucher
        const [vouchers] = await pool.query(
            'SELECT * FROM vouchers WHERE serial_number = ? AND created_by = ?',
            [serialNumber, vendorId]
        );

        if (vouchers.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Voucher not found'
            });
        }

        const voucher = vouchers[0];

        // Verify PIN
        const pinMatch = await bcrypt.compare(pin, voucher.pin_hash);
        if (!pinMatch) {
            return res.status(401).json({
                success: false,
                message: 'Invalid PIN'
            });
        }

        // Check if voucher is already used
        if (voucher.is_used) {
            return res.status(400).json({
                success: false,
                message: 'Voucher has already been used'
            });
        }

        // Mark voucher as used
        await pool.query(
            'UPDATE vouchers SET is_used = 1, used_at = CURRENT_TIMESTAMP WHERE id = ?',
            [voucher.id]
        );

        res.json({
            success: true,
            message: 'Voucher marked as used successfully'
        });
    } catch (error) {
        console.error('Error marking voucher as used:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to mark voucher as used'
        });
    }
});

module.exports = router; 