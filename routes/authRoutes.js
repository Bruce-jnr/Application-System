const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const logger = require('../utils/logger');

// Add voucher login endpoint
router.post('/voucher-login', async (req, res) => {
  try {
    const { serial, pin } = req.body;
    const pool = req.app.get('mysqlPool'); // Get pool from app

    // Log the login attempt with more details
    logger.info('Voucher login attempt:', {
      serial,
      pinLength: pin ? pin.length : 0,
      formattedSerial: serial ? serial.toUpperCase().trim() : null,
    });

    // Validate input
    if (!serial || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Serial number and PIN are required',
      });
    }

    // Format serial number to match database format (NSCE25XXXXXX)
    const formattedSerial = serial.toUpperCase().trim();

    // First, let's check what vouchers exist in the database
    const [allVouchers] = await pool.query(
      'SELECT serial_number FROM vouchers'
    );
    logger.debug(
      'All vouchers in database:',
      allVouchers.map((v) => v.serial_number)
    );

    // Now check for the specific voucher
    const [vouchers] = await pool.query(
      'SELECT * FROM vouchers WHERE serial_number = ?',
      [formattedSerial]
    );

    logger.debug('Database query result:', {
      found: vouchers.length > 0,
      serial: formattedSerial,
      query: 'SELECT * FROM vouchers WHERE serial_number = ?',
      params: [formattedSerial],
    });

    if (vouchers.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid serial number',
      });
    }

    const voucher = vouchers[0];

    try {
      // Use bcrypt to compare the provided PIN with the stored pin_hash
      const pinMatch = await bcrypt.compare(pin, voucher.pin_hash);

      logger.debug('PIN verification:', {
        match: pinMatch,
        voucherId: voucher.id,
        hasPinHash: !!voucher.pin_hash,
      });

      if (!pinMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid PIN',
        });
      }

      // Check if voucher is already used
      if (voucher.is_used) {
        return res.status(401).json({
          success: false,
          message: 'This voucher has already been used',
        });
      }

      // Set up applicant session
      req.session.voucherId = voucher.id;
      req.session.serialNumber = voucher.serial_number;
      req.session.isApplicant = true;

      // Return success
      res.json({ 
        success: true,
        voucher: {
          id: voucher.id,
          serial_number: voucher.serial_number,
          is_used: voucher.is_used,
        },
      });
    } catch (bcryptError) {
      logger.error('Bcrypt error:', bcryptError);
      res.status(500).json({
        success: false,
        message: 'Error verifying PIN',
      });
    }
  } catch (err) {
    logger.error('Voucher login error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error during voucher login',
    });
  }
});

// Add route to check voucher session status
router.get('/check-voucher-session', (req, res) => {
  const hasValidSession = req.session.isApplicant && req.session.voucherId;
  res.json({
    success: hasValidSession,
    voucherId: req.session.voucherId,
    serialNumber: req.session.serialNumber
  });
});

// Add route to check if user is logged in as applicant
router.get('/check-applicant', (req, res) => {
  if (req.session.isApplicant) {
    res.json({ 
      success: true,
      voucherId: req.session.voucherId,
      serialNumber: req.session.serialNumber,
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Not logged in as applicant',
    });
  }
});

// Add applicant logout route
router.get('/applicant-logout', (req, res) => {
  // Clear the applicant session
  req.session.isApplicant = false;
  req.session.voucherId = null;
  req.session.serialNumber = null;
  
  // Destroy the session
  req.session.destroy((err) => {
    if (err) {
      logger.error('Error destroying session:', err);
      return res.status(500).json({
        success: false,
        message: 'Error logging out'
      });
    }
    res.json({ success: true });
  });
});

module.exports = router;
