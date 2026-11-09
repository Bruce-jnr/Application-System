const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const adminJwtAuth = require('../middleware/adminJwtAuth');

// Get all vouchers
router.get('/', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  try {
    const [results] = await pool.query('SELECT id, serial_number, is_used, used_at, created_by, created_at, expires_at, price FROM vouchers');
    res.json(results);
  } catch (err) {
    res.status(500).json({ error: 'Database error' });
  }
});

// Create a new voucher
router.post('/', adminJwtAuth, async (req, res) => {
  const { serialNumber, pin } = req.body;
  const pool = req.app.get('mysqlPool');
  
  try {
    if (typeof serialNumber !== 'string' || !serialNumber.trim() || serialNumber.length > 12 ||
        typeof pin !== 'string' || !/^\d{6}$/.test(pin)) {
      return res.status(400).json({ error: 'A serial number and six-digit PIN are required' });
    }
    const pinHash = await bcrypt.hash(pin, 10);
    await pool.query(
      'INSERT INTO vouchers (serial_number, pin_hash) VALUES (?, ?)',
      [serialNumber, pinHash]
    );
    res.status(201).json({ message: 'Voucher created successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Error creating voucher' });
  }
});

module.exports = router; 
