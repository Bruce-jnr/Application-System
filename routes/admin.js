const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const path = require('path');

// Remove duplicate routes since they are handled by adminRoutes.js
// router.get('/applications', authenticateToken, async (req, res) => { ... });
// router.get('/api/admin/applications/:id', authenticateToken, async (req, res) => { ... });
// router.get('/applications/:id/preview', authenticateToken, async (req, res) => { ... });

module.exports = router; 