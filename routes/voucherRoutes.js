const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Get all vouchers
router.get('/', (req, res) => {
  const pool = req.app.get('mysqlPool');
  pool.query('SELECT * FROM vouchers', (err, results) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(results);
  });
});

// Create a new voucher
router.post('/', async (req, res) => {
  const { serialNumber, pin } = req.body;
  const pool = req.app.get('mysqlPool');
  
  try {
    const pinHash = await bcrypt.hash(pin, 10);
    pool.query(
      'INSERT INTO vouchers (serial_number, pin_hash) VALUES (?, ?)',
      [serialNumber, pinHash],
      (err, result) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ message: 'Voucher created successfully' });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Error creating voucher' });
  }
});

module.exports = router; 