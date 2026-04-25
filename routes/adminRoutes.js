const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const smsService = require('../utils/smsService');
const path = require('path');
// Session-based isAdmin is deprecated for admin APIs; JWT is used instead.
const { createObjectCsvWriter } = require('csv-writer');
const fs = require('fs');
const pool = require('../config/db');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const adminJwtAuth = require('../middleware/adminJwtAuth');
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

async function getVoucherPrice(pool) {
  const [rows] = await pool.query(
    "SELECT `value` FROM app_settings WHERE `key` = 'voucher_price' LIMIT 1"
  );
  const raw = rows?.[0]?.value;
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : 360.0;
}

// Admin login route
router.post('/login', async (req, res) => {
  console.log('Admin login attempt:', {
    host: req.header('host'),
    origin: req.header('origin'),
    userAgent: req.header('user-agent'),
    timestamp: new Date().toISOString(),
  });

  const { username, password } = req.body;
  const pool = req.app.get('mysqlPool');

  try {
    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND user_type = "admin"',
      [username]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const admin = users[0];
    const passwordMatch = await bcrypt.compare(password, admin.password_hash);

    if (!passwordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const token = jwt.sign(
      {
        adminId: admin.id,
        username: admin.username,
        userType: 'admin',
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.ADMIN_JWT_EXPIRES_IN || '12h' }
    );

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      host: req.header('host'),
      origin: req.header('origin'),
    });
    res.status(500).json({
      success: false,
      message: 'Server error during login',
    });
  }
});

// Generate voucher route
router.post('/generate-voucher', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');

  try {
    const voucherPrice = await getVoucherPrice(pool);
    // Get the last voucher number
    const [lastVoucher] = await pool.query(`
      SELECT serial_number 
      FROM vouchers 
      WHERE serial_number LIKE 'NSCE25%' 
      ORDER BY id DESC 
      LIMIT 1
    `);

    let sequenceNumber;
    if (lastVoucher.length === 0) {
      // If no vouchers exist, start with 45654
      sequenceNumber = 45654;
    } else {
      // Extract the sequence number from the last voucher and increment
      const lastNumber = parseInt(lastVoucher[0].serial_number.slice(6));
      sequenceNumber = lastNumber + 1;
    }

    // Generate serial number (format: NSCE25 + 6 sequential digits to make total length 12)
    const serialNumber = `NSCE25${sequenceNumber.toString().padStart(6, '0')}`;

    // Verify the length is exactly 12 characters
    if (serialNumber.length !== 12) {
      throw new Error('Generated serial number is not 12 characters long');
    }

    // Generate PIN (6 digits)
    const pin = Math.floor(100000 + Math.random() * 900000).toString();

    // Hash the PIN
    const pinHash = await bcrypt.hash(pin, 10);

    // Insert into database
    const [result] = await pool.query(
      'INSERT INTO vouchers (serial_number, pin_hash, created_by, price) VALUES (?, ?, ?, ?)',
      [serialNumber, pinHash, req.admin.adminId, voucherPrice]
    );

    res.json({
      success: true,
      voucher: {
        id: result.insertId,
        serial_number: serialNumber,
        pin: pin, // Send the plain PIN only once
        price: voucherPrice,
      },
    });
  } catch (error) {
    console.error('Voucher generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error generating voucher',
    });
  }
});

// Settings: voucher price
router.get('/settings', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  try {
    const voucherPrice = await getVoucherPrice(pool);
    res.json({ success: true, settings: { voucher_price: voucherPrice } });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load settings' });
  }
});

router.put('/settings/voucher-price', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const raw = req.body?.voucher_price ?? req.body?.price;
  const parsed = Number.parseFloat(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return res.status(400).json({
      success: false,
      message: 'voucher_price must be a positive number',
    });
  }

  try {
    await pool.query(
      "INSERT INTO app_settings (`key`, `value`) VALUES ('voucher_price', ?) ON DUPLICATE KEY UPDATE `value` = VALUES(`value`)",
      [parsed.toFixed(2)]
    );
    res.json({ success: true, voucher_price: parsed });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update voucher price' });
  }
});

// Vendors + API keys management
router.get('/vendors', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  try {
    const [vendors] = await pool.query(
      'SELECT id, username, name, created_at FROM users WHERE user_type = "vendor" ORDER BY created_at DESC'
    );
    res.json({ success: true, vendors });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load vendors' });
  }
});

router.get('/vendors/:vendorId/api-keys', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const vendorId = Number.parseInt(req.params.vendorId, 10);
  if (!Number.isFinite(vendorId)) {
    return res.status(400).json({ success: false, message: 'Invalid vendorId' });
  }
  try {
    const [keys] = await pool.query(
      `SELECT id, vendor_id, name, is_active, created_at, last_used_at, expires_at
       FROM vendor_api_keys
       WHERE vendor_id = ?
       ORDER BY created_at DESC`,
      [vendorId]
    );
    res.json({ success: true, apiKeys: keys });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to load API keys' });
  }
});

router.patch('/api-keys/:keyId', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const keyId = Number.parseInt(req.params.keyId, 10);
  const isActive = req.body?.is_active;
  if (!Number.isFinite(keyId)) {
    return res.status(400).json({ success: false, message: 'Invalid keyId' });
  }
  if (typeof isActive !== 'boolean') {
    return res.status(400).json({ success: false, message: 'is_active must be boolean' });
  }
  try {
    const [result] = await pool.query(
      'UPDATE vendor_api_keys SET is_active = ? WHERE id = ?',
      [isActive ? 1 : 0, keyId]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: 'API key not found' });
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Failed to update API key' });
  }
});

// Token-based "who am I" helper
router.get('/me', adminJwtAuth, async (req, res) => {
  res.json({ success: true, admin: { id: req.admin.adminId, username: req.admin.username } });
});

// JWT logout is client-side; keep endpoint for compatibility
router.post('/logout', async (req, res) => {
  res.json({ success: true });
});

// Get all vouchers route
router.get('/vouchers', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');

  try {
    const [vouchers] = await pool.query(`
      SELECT 
        v.id,
        v.serial_number,
        v.is_used,
        v.used_at,
        v.created_at,
        v.created_by,
        COALESCE(u.username, 'System') as created_by_username
      FROM vouchers v 
      LEFT JOIN users u ON v.created_by = u.id 
      ORDER BY v.created_at DESC
    `);

    res.json({
      success: true,
      vouchers: vouchers.map((v) => ({
        id: v.id,
        serial_number: v.serial_number,
        is_used: v.is_used,
        used_at: v.used_at,
        created_at: v.created_at,
        created_by: v.created_by_username,
      })),
    });
  } catch (error) {
    console.error('Error fetching vouchers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching vouchers',
    });
  }
});

// Get voucher statistics
router.get('/vouchers/statistics', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');

  try {
    const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_vouchers,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_vouchers,
                SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as unused_vouchers
            FROM vouchers
        `);

    res.json({
      success: true,
      statistics: stats[0],
    });
  } catch (error) {
    console.error('Error fetching voucher statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching voucher statistics',
    });
  }
});

// Get application statistics
router.get('/statistics', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');

  try {
    // First check if status column exists
    const [columns] = await pool.query(`
            SELECT COLUMN_NAME 
            FROM INFORMATION_SCHEMA.COLUMNS 
            WHERE TABLE_NAME = 'applicants' 
            AND COLUMN_NAME = 'status'
        `);

    let stats;
    if (columns.length > 0) {
      // Status column exists, get detailed statistics
      [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected
                FROM applicants
            `);
    } else {
      // Status column doesn't exist yet, just get total count
      [stats] = await pool.query(`
                SELECT 
                    COUNT(*) as total,
                    0 as pending,
                    0 as approved,
                    0 as rejected
                FROM applicants
            `);
    }

    res.json({
      success: true,
      ...stats[0],
    });
  } catch (error) {
    console.error('Error fetching statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching statistics',
    });
  }
});

// Get all applications with pagination and filters
router.get('/applications', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const offset = (page - 1) * limit;

  try {
    // Build WHERE clause based on filters
    let whereClause = '';
    const params = [];

    if (req.query.status && req.query.status !== 'all') {
      whereClause += ' AND a.status = ?';
      params.push(req.query.status);
    }

    if (req.query.search) {
      whereClause +=
        ' AND (CONCAT(a.first_name, " ", COALESCE(a.middle_name, ""), " ", a.last_name) LIKE ? OR a.email LIKE ? OR a.phone_number LIKE ?)';
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (req.query.dateFrom) {
      whereClause += ' AND DATE(a.created_at) >= ?';
      params.push(req.query.dateFrom);
    }

    if (req.query.dateTo) {
      whereClause += ' AND DATE(a.created_at) <= ?';
      params.push(req.query.dateTo);
    }

    // Get total count - simplified to just count applicants
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total 
            FROM applicants a 
            WHERE 1=1 ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // Get applications with pagination
    const [applications] = await pool.query(
      `SELECT 
                a.id as applicant_id,
                CONCAT(a.first_name, ' ', COALESCE(a.middle_name, ''), ' ', a.last_name) as fullName,
                v.serial_number as referenceNumber,
                a.status,
                a.created_at as createdAt
            FROM applicants a
            LEFT JOIN vouchers v ON a.voucher_id = v.id
            WHERE 1=1 ${whereClause}
            ORDER BY a.created_at DESC
            LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    res.json({
      success: true,
      applications: applications,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch applications',
    });
  }
});

// Export applications to CSV - MOVED BEFORE /applications/:id
router.get('/applications/export', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');

  try {
    // Build WHERE clause based on filters
    let whereClause = '';
    const params = [];

    if (req.query.status && req.query.status !== 'all') {
      whereClause += ' AND a.status = ?';
      params.push(req.query.status);
    }

    if (req.query.search) {
      whereClause +=
        ' AND (CONCAT(a.first_name, " ", COALESCE(a.middle_name, ""), " ", a.last_name) LIKE ? OR a.email LIKE ? OR a.phone_number LIKE ?)';
      const searchTerm = `%${req.query.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (req.query.dateFrom) {
      whereClause += ' AND DATE(a.created_at) >= ?';
      params.push(req.query.dateFrom);
    }

    if (req.query.dateTo) {
      whereClause += ' AND DATE(a.created_at) <= ?';
      params.push(req.query.dateTo);
    }

    // Get all applications without pagination - only selected fields
    const [applications] = await pool.query(
      `SELECT 
        v.serial_number as reference_number,
        a.first_name,
        a.middle_name,
        a.last_name,
        a.email,
        a.phone_number,
        a.status,
        a.created_at
      FROM applicants a
      LEFT JOIN vouchers v ON a.voucher_id = v.id
      WHERE 1=1 ${whereClause}
      ORDER BY a.created_at DESC`,
      params
    );

    // Create a temporary file path
    const tempFilePath = path.join(
      __dirname,
      '..',
      'temp',
      `applications-${Date.now()}.csv`
    );

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '..', 'temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Create CSV writer with only the requested fields
    const csvWriter = createObjectCsvWriter({
      path: tempFilePath,
      header: [
        { id: 'reference_number', title: 'Reference Number' },
        { id: 'full_name', title: 'Full Name' },
        { id: 'phone_number', title: 'Phone Number' },
        { id: 'email', title: 'Email' },
        { id: 'status', title: 'Status' },
        { id: 'created_at', title: 'Date Submitted' },
      ],
    });

    // Format the data for CSV
    const records = applications.map((app) => ({
      reference_number: app.reference_number,
      full_name: `${app.first_name} ${app.middle_name || ''} ${
        app.last_name
      }`.trim(),
      phone_number: app.phone_number,
      email: app.email,
      status: app.status,
      created_at: new Date(app.created_at).toLocaleDateString('en-GB'),
    }));

    // Write to CSV file
    await csvWriter.writeRecords(records);

    console.log('CSV file written:', tempFilePath);

    // Send the file
    res.download(
      tempFilePath,
      `applications-${new Date().toISOString().split('T')[0]}.csv`,
      (err) => {
        if (err) {
          console.error('Error sending file:', err);
        }
        // Clean up: delete the temporary file
        fs.unlink(tempFilePath, (unlinkErr) => {
          if (unlinkErr) {
            console.error('Error deleting temporary file:', unlinkErr);
          }
        });
      }
    );
  } catch (error) {
    console.error('Error exporting applications:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export applications',
    });
  }
});

// Get single application details - MOVED AFTER /applications/export
router.get('/applications/:id', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const connection = await pool.getConnection();

  try {

    // Get application details with all related information except documents
    const [applications] = await connection.query(
      `
            SELECT 
                a.*,
                v.serial_number as reference_number,
                GROUP_CONCAT(DISTINCT al.language_name) as languages,
                pg1.full_name as parent1_name,
                pg1.relation as parent1_relation,
                pg1.occupation as parent1_occupation,
                pg1.phone_number as parent1_phone,
                pg1.email as parent1_email,
                pg2.full_name as parent2_name,
                pg2.relation as parent2_relation,
                pg2.occupation as parent2_occupation,
                pg2.phone_number as parent2_phone,
                pg2.email as parent2_email,
                ec.full_name as emergency_contact,
                ec.phone_number as emergency_phone,
                ec.relationship as emergency_relation
            FROM applicants a
            LEFT JOIN vouchers v ON a.voucher_id = v.id
            LEFT JOIN applicant_languages al ON a.id = al.applicant_id
            LEFT JOIN parents_guardians pg1 ON a.id = pg1.applicant_id AND pg1.is_primary = 1
            LEFT JOIN parents_guardians pg2 ON a.id = pg2.applicant_id AND pg2.is_primary = 0
            LEFT JOIN emergency_contacts ec ON a.id = ec.applicant_id
            WHERE a.id = ?
            GROUP BY a.id, v.serial_number, 
                     pg1.full_name, pg1.relation, pg1.occupation, pg1.phone_number, pg1.email,
                     pg2.full_name, pg2.relation, pg2.occupation, pg2.phone_number, pg2.email,
                     ec.full_name, ec.phone_number, ec.relationship
        `,
      [req.params.id]
    );

    if (!applications || applications.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Application not found',
      });
    }

    // Get academic records separately
    const [academicRecords] = await connection.query(
      `
            SELECT 
                subject_type,
                subject_name,
                index_number,
                grade
            FROM academic_records 
            WHERE applicant_id = ?
            ORDER BY subject_type, subject_name
        `,
      [req.params.id]
    );

    // Get documents separately
    const [documents] = await connection.query(
      `
            SELECT 
                document_type,
                file_type,
                file_data
            FROM application_documents
            WHERE applicant_id = ?
        `,
      [req.params.id]
    );

    // Process the application data
    const application = applications[0];

    // Format academic records directly from the query result
    application.core_subjects = academicRecords
      .filter((record) => record.subject_type === 'core')
      .map((record) => ({
        subject_name: record.subject_name,
        index_number: record.index_number || 'N/A',
        grade: record.grade,
      }));

    application.elective_subjects = academicRecords
      .filter((record) => record.subject_type === 'elective')
      .map((record) => ({
        subject_name: record.subject_name,
        index_number: record.index_number || 'N/A',
        grade: record.grade,
      }));

    // Format languages array
    application.languages = application.languages
      ? application.languages.split(',')
      : [];

    // Format phone numbers array
    application.phone = [
      application.phone_number,
      application.phone_number2,
    ].filter(Boolean);

    // Format parent/guardian information
    application.parent1 = application.parent1_name
      ? {
          name: application.parent1_name,
          relationship: application.parent1_relation,
          occupation: application.parent1_occupation,
          phone: application.parent1_phone,
          email: application.parent1_email,
        }
      : null;

    application.parent2 = application.parent2_name
      ? {
          name: application.parent2_name,
          relationship: application.parent2_relation,
          occupation: application.parent2_occupation,
          phone: application.parent2_phone,
          email: application.parent2_email,
        }
      : null;

    // Format emergency contact information
    application.emergency_contact = application.emergency_contact
      ? {
          name: application.emergency_contact,
          phone: application.emergency_phone,
          relationship: application.emergency_relation,
        }
      : null;

    // Format documents for frontend
    application.documents = {};
    documents.forEach((doc) => {
      if (doc.file_data) {
        const base64Data = doc.file_data.toString('base64');
        const dataUrl = `data:${doc.file_type};base64,${base64Data}`;
        application.documents[doc.document_type] = dataUrl;
      }
    });

    // Remove sensitive data before sending
    delete application.file_data;
    delete application.password;
    delete application.password_reset_token;
    delete application.password_reset_expires;

    res.json({
      success: true,
      application: application,
    });
  } catch (error) {
    console.error('Error fetching application details:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch application details',
      error: error.message,
    });
  } finally {
    connection.release();
  }
});

// Approve application
router.post('/applications/:id/approve', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    console.log('Starting approval process for application:', req.params.id);

    // Get application details with voucher information
    const [applications] = await connection.query(
      `SELECT a.*, v.serial_number 
       FROM applicants a 
       LEFT JOIN vouchers v ON a.voucher_id = v.id 
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (!applications || applications.length === 0) {
      throw new Error('Application not found');
    }

    const application = applications[0];

    if (application.status === 'approved') {
      throw new Error('Application is already approved');
    }

    // Generate a 6-digit PIN
    const admissionPin = Math.floor(100000 + Math.random() * 900000).toString();

    // Update application status and add approval metadata
    await connection.query(
      `UPDATE applicants 
      SET 
        status = 'approved',
        admission_pin = ?,
        approved_by = ?,
        approved_at = NOW(),
        updated_at = NOW()
      WHERE id = ?`,
      [admissionPin, req.session.adminId, req.params.id]
    );

    // Send SMS notification
    const fullName = `${application.first_name} ${
      application.middle_name || ''
    } ${application.last_name}`.trim();
    const message = smsService.getApplicationApprovedMessage(
      fullName,
      application.serial_number,
      admissionPin
    );
    const smsResult = await smsService.sendSMS(
      application.phone_number,
      message
    );

    if (!smsResult.success) {
      console.error('Failed to send approval SMS:', smsResult.error);
      // Continue with the response even if SMS fails
    }

    await connection.commit();
    console.log('Application approved successfully');
    res.json({
      success: true,
      message: 'Application approved successfully',
      smsSent: smsResult.success,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error in approval process:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve application',
    });
  } finally {
    connection.release();
  }
});

// Reject application
router.post('/applications/:id/reject', adminJwtAuth, async (req, res) => {
  const pool = req.app.get('mysqlPool');
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    // Get application details with voucher information
    const [applications] = await connection.query(
      `SELECT a.*, v.serial_number 
       FROM applicants a 
       LEFT JOIN vouchers v ON a.voucher_id = v.id 
       WHERE a.id = ?`,
      [req.params.id]
    );

    if (!applications || applications.length === 0) {
      throw new Error('Application not found');
    }

    const application = applications[0];

    if (application.status !== 'pending') {
      throw new Error('Application is not in pending status');
    }

    // Update status to rejected
    await connection.query(
      'UPDATE applicants SET status = "rejected" WHERE id = ?',
      [req.params.id]
    );

    // Send SMS notification
    const fullName = `${application.first_name} ${
      application.middle_name || ''
    } ${application.last_name}`.trim();
    const message = smsService.getApplicationRejectedMessage(
      fullName,
      application.serial_number
    );
    const smsResult = await smsService.sendSMS(
      application.phone_number,
      message
    );

    if (!smsResult.success) {
      console.error('Failed to send rejection SMS:', smsResult.error);
      // Continue with the response even if SMS fails
    }

    await connection.commit();
    res.json({
      success: true,
      smsSent: smsResult.success,
    });
  } catch (error) {
    await connection.rollback();
    console.error('Error rejecting application:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error rejecting application',
    });
  } finally {
    connection.release();
  }
});

// Add route to check SMS balance
router.get('/sms/balance', adminJwtAuth, async (req, res) => {
  try {
    const result = await smsService.checkBalance();
    if (result.success) {
      res.json({
        success: true,
        balance: result.balance,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error checking SMS balance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check SMS balance',
    });
  }
});

// Add route to check message status
router.get('/sms/status/:messageId', adminJwtAuth, async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await smsService.checkMessageStatus(messageId);
    if (result.success) {
      res.json({
        success: true,
        status: result.status,
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error checking message status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check message status',
    });
  }
});

// Application preview page route
router.get('/application-preview/:id', adminJwtAuth, (req, res) => {
  res.sendFile(
    path.join(__dirname, '..', 'views', 'admin-application-preview.html')
  );
});

// Temporary: admin-only SMS test endpoint
router.post('/sms/test', adminJwtAuth, async (req, res) => {
  try {
    const { phone, message } = req.body || {};

    if (!phone) {
      return res
        .status(400)
        .json({ success: false, error: 'Phone is required' });
    }

    const text =
      message && String(message).trim().length > 0
        ? String(message).trim()
        : 'NSACoE test message: This is a test of the SMS delivery pipeline.';

    const result = await smsService.sendSMS(phone, text);

    if (result.success) {
      return res.json({ success: true, data: result.data || null });
    }

    return res
      .status(502)
      .json({ success: false, error: result.error || 'Failed to send SMS' });
  } catch (error) {
    console.error('SMS test error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
// Admin: CRUD for news with image upload (stored in DB)
router.post('/news', adminJwtAuth, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      excerpt = null,
      content,
      category = 'General',
      author = 'Admin',
      is_published = true,
    } = req.body;
    const file = req.file;
    const image_url = null; // not used when storing blob
    const image_mime = file ? file.mimetype : null;
    const image_data = file ? file.buffer : null;
    const [result] = await pool.query(
      'INSERT INTO news (title, excerpt, content, image_url, image_mime, image_data, category, author, is_published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        title,
        excerpt,
        content,
        image_url,
        image_mime,
        image_data,
        category,
        author,
        is_published ? 1 : 0,
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create news' });
  }
});

router.put('/news/:id', adminJwtAuth, upload.single('image'), async (req, res) => {
  try {
    const {
      title,
      excerpt = null,
      content,
      category = 'General',
      author = 'Admin',
      is_published = true,
    } = req.body;
    const file = req.file;
    if (file) {
      await pool.query(
        'UPDATE news SET title=?, excerpt=?, content=?, image_url=?, image_mime=?, image_data=?, category=?, author=?, is_published=? WHERE id=?',
        [
          title,
          excerpt,
          content,
          null,
          file.mimetype,
          file.buffer,
          category,
          author,
          is_published ? 1 : 0,
          req.params.id,
        ]
      );
    } else {
      await pool.query(
        'UPDATE news SET title=?, excerpt=?, content=?, category=?, author=?, is_published=? WHERE id=?',
        [
          title,
          excerpt,
          content,
          category,
          author,
          is_published ? 1 : 0,
          req.params.id,
        ]
      );
    }
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update news' });
  }
});

router.delete('/news/:id', adminJwtAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete news' });
  }
});



// Admin: CRUD for news
router.post('/news', adminJwtAuth, async (req, res) => {
  try {
    const {
      title,
      excerpt = null,
      content,
      image_url = null,
      category = 'General',
      author = 'Admin',
      is_published = true,
    } = req.body;
    const [result] = await pool.query(
      'INSERT INTO news (title, excerpt, content, image_url, category, author, is_published) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        title,
        excerpt,
        content,
        image_url,
        category,
        author,
        is_published ? 1 : 0,
      ]
    );
    res.json({ success: true, id: result.insertId });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to create news' });
  }
});

router.put('/news/:id', adminJwtAuth, async (req, res) => {
  try {
    const {
      title,
      excerpt,
      content,
      image_url,
      category,
      author,
      is_published,
    } = req.body;
    await pool.query(
      'UPDATE news SET title = ?, excerpt = ?, content = ?, image_url = ?, category = ?, author = ?, is_published = ? WHERE id = ?',
      [
        title,
        excerpt,
        content,
        image_url,
        category,
        author,
        is_published ? 1 : 0,
        req.params.id,
      ]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to update news' });
  }
});

router.delete('/news/:id', adminJwtAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM news WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to delete news' });
  }
});
