const express = require('express');
const router = express.Router();
const smsService = require('../services/smsService');
const pool = require('../config/db');

// Test SMS endpoint
router.post('/test-sms', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        const message = 'This is a test message from NSA CoE Admissions System.';
        const result = await smsService.sendSms(phoneNumber, message);

        res.json({
            success: true,
            message: 'Test SMS sent',
            data: result
        });
    } catch (error) {
        console.error('Test SMS failed:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send test SMS',
            error: error.message
        });
    }
});

module.exports = router; 



// Public: news
router.get('/public/news', async (req, res) => {
    try {
        const limit = Math.min(parseInt(req.query.limit || '6', 10), 24);
        const [rows] = await pool.query(
            'SELECT id, title, excerpt, content, image_url, category, author, published_at FROM news WHERE is_published = 1 ORDER BY published_at DESC LIMIT ?',
            [limit]
        );
        res.json({ success: true, items: rows });
    } catch (e) {
        res.status(500).json({ success: false, error: 'Failed to load news' });
    }
});