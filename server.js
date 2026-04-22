require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mysql = require('mysql2/promise');
const bodyParser = require('body-parser');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const initializeDatabase = require('./config/initDb');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const smsService = require('./utils/smsService');
const logger = require('./utils/logger');
const cors = require('cors');
const fs = require('fs');

const applicationRoutes = require('./routes/applicationRoutes');
const voucherRoutes = require('./routes/voucherRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const vendorApiRoutes = require('./routes/vendorApiRoutes');
const publicRoutes = require('./routes/publicRoutes');
const studentPortalRoutes = require('./routes/studentPortalRoutes');

const app = express();

// Trust reverse proxy (Apache/NGINX/Passenger) for correct IP and secure cookies
app.set('trust proxy', 1);

// Production-specific middleware
if (process.env.NODE_ENV === 'production') {
  // Log production requests for debugging
  app.use((req, res, next) => {
    if (process.env.DEBUG_LOGS === 'true') {
      console.log('Production request:', {
        method: req.method,
        url: req.url,
        host: req.header('host'),
        'x-forwarded-proto': req.header('x-forwarded-proto'),
        'user-agent': req.header('user-agent'),
      });
    }
    next();
  });
}

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // In production, specify your domain
    if (process.env.NODE_ENV === 'production') {
      const allowedOrigins = [
        'https://nsacoe.edu.gh',
        'https://www.nsacoe.edu.gh',
        'https://app.nsacoe.edu.gh',
        process.env.FRONTEND_URL,
      ].filter(Boolean);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

app.use(cors(corsOptions));

// Use a single shared MySQL pool from config/db.js
const pool = require('./config/db');

// Add connection error handling
pool.on('error', (err) => {
  logger.error('Database pool error:', err);
  if (err.code === 'PROTOCOL_CONNECTION_LOST') {
    logger.error('Database connection was closed. Attempting to reconnect...');
  } else if (err.code === 'ER_CON_COUNT_ERROR') {
    logger.error('Database has too many connections.');
  } else if (err.code === 'ECONNREFUSED') {
    logger.error('Database connection was refused.');
  } else if (err.code === 'ER_ACCESS_DENIED_ERROR') {
    logger.error('Database access denied. Please check credentials.');
  }
});

// Test database connection on startup
async function testDatabaseConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info('Database connection successful');
    connection.release();
  } catch (error) {
    logger.error('Database connection failed:', error);
    process.exit(1); // Exit if we can't connect to the database
  }
}

// Session store
const sessionStore = new MySQLStore(
  {
    expiration: 86400000, // 24 hours
    createDatabaseTable: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data',
      },
    },
  },
  pool
);

// Make pool available to routes
app.set('mysqlPool', pool);

// Middleware definitions
const isAdmin = (req, res, next) => {
  logger.debug('isAdmin middleware check:', {
    session: req.session,
    isAdmin: req.session.isAdmin,
    adminId: req.session.adminId,
    sessionId: req.session.id,
    headers: req.headers,
  });

  // Check if session exists and has required properties
  if (!req.session) {
    logger.debug('No session found');
    return res.status(403).json({ error: 'No session found' });
  }

  // Check if user is admin
  if (!req.session.isAdmin) {
    logger.debug('User is not admin');
    return res.status(403).json({ error: 'Not an admin user' });
  }

  // Check if adminId exists
  if (!req.session.adminId) {
    logger.debug('No adminId in session');
    return res.status(403).json({ error: 'No admin ID in session' });
  }

  // All checks passed
  logger.debug('Admin check passed');
  next();
};

const isVendor = (req, res, next) => {
  if (!req.session.userId || req.session.userType !== 'vendor') {
    return res.status(403).json({ error: 'Access denied' });
  }
  next();
};

// Initialize database
async function initDb() {
  try {
    logger.info('Force initializing database...');
    await initializeDatabase();
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize database:', error);
    process.exit(1);
  }
}

// Session middleware
app.use(
  session({
    key: process.env.SESSION_COOKIE_NAME || 'nsacoe_admin_session',
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    rolling: (process.env.SESSION_ROLLING || 'true').toLowerCase() === 'true',
    cookie: {
      maxAge: Number(process.env.SESSION_MAX_AGE_MS || 86400000), // 24 hours
      secure: process.env.NODE_ENV === 'production', // true for production HTTPS, false for development
      httpOnly: true,
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax', // 'none' for cross-site in production
      domain:
        process.env.SESSION_COOKIE_DOMAIN ||
        (process.env.NODE_ENV === 'production' ? '.nsacoe.edu.gh' : undefined),
    },
  })
);

// Add session debugging middleware (admin/api routes only)
app.use((req, res, next) => {
  if (process.env.NODE_ENV === 'development' && process.env.DEBUG_LOGS === 'true') {
    if (req.path.startsWith('/api/admin') || req.path.startsWith('/admin')) {
      logger.debug('Session data:', {
        id: req.session.id,
        isAdmin: req.session.isAdmin,
        adminId: req.session.adminId,
        username: req.session.username,
      });
    }
  }
  next();
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req, res) =>
    req.headers['cf-connecting-ip'] ||
    req.headers['x-real-ip'] ||
    (req.headers['x-forwarded-for']
      ? req.headers['x-forwarded-for'].split(',')[0].trim()
      : null) ||
    req.ip,
});

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          '/public/js/',
        ],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://cdn.jsdelivr.net',
          'https://unicons.iconscout.com',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com',
        ],
        fontSrc: [
          "'self'",
          'https://unicons.iconscout.com',
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com',
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
        ],
        imgSrc: [
          "'self'",
          'data:',
          'https://images.unsplash.com',
          'https://source.unsplash.com',
        ],
        frameSrc: [
          "'self'",
          'https://www.google.com',
          'https://www.google.com/maps',
        ],
        connectSrc: [
          "'self'",
          'https://nsacoe.edu.gh',
          'https://www.nsacoe.edu.gh',
          'https://app.nsacoe.edu.gh',
          'https://unicons.iconscout.com',
          'https://fonts.googleapis.com',
          'https://fonts.gstatic.com',
          'https://cdnjs.cloudflare.com',
          'https://cdn.jsdelivr.net',
        ],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Middleware
app.use(limiter);
// Serve static assets from the public directory at the web root.
// This makes files available as /css/..., /js/..., /images/...
app.use(express.static(path.join(__dirname, 'public')));
// Keep the old /public mount for backward compatibility with existing
// templates that reference /public/... paths.
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Initialize multer with memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: function (req, file, cb) {
    // Accept common document and image types
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          'Invalid file type. Only JPEG, PNG, PDF and DOC files are allowed.'
        ),
        false
      );
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Update the route to handle file uploads
app.post(
  '/api/applications',
  upload.fields([
    { name: 'photo', maxCount: 1 },
    { name: 'idDocument', maxCount: 1 },
    { name: 'certificates', maxCount: 5 },
  ]),
  async (req, res) => {
    try {
      logger.info('Application submission received');
      logger.debug('Request body:', req.body);
      logger.debug(
        'Uploaded files:',
        req.files ? Object.keys(req.files) : 'None'
      );

      // Check if voucher exists and is valid
      const connection = await pool.getConnection();
      await connection.beginTransaction();

      try {
        // Check if voucher exists and is not used
        const [vouchers] = await connection.execute(
          'SELECT * FROM vouchers WHERE id = ? AND is_used = FALSE',
          [req.session.voucherId]
        );

        if (vouchers.length === 0) {
          await connection.rollback();
          return res.status(400).json({
            success: false,
            message:
              'Invalid or already used voucher. Please purchase a new voucher.',
          });
        }

        // Extract form data with proper field mapping
        const {
          title,
          firstName,
          middleName,
          lastName,
          dob,
          gender,
          'place-of-birth': placeOfBirth,
          'birth-region': birthRegion,
          'residence-region': residenceRegion,
          nationality,
          residence,
          address,
          city,
          district,
          country,
          gpsCode,
          phone,
          email,
          religion,
          disabilityStatus,
          idType,
          idNumber,
          howHeard,
          questions,
          agreeTerms,
          agreePolicy,
          // Academic records
          coreSubjects,
          coreIndexNumbers,
          coreGrades,
          electiveSubjects,
          electiveIndexNumbers,
          electiveGrades,
          // Parent/Guardian info
          parent1Name,
          parent1Relation,
          parent1Occupation,
          parent1Phone,
          parent1Email,
          parent2Name,
          parent2Relation,
          parent2Occupation,
          parent2Phone,
          parent2Email,
          // Emergency contact
          emergencyContact,
          emergencyPhone,
          emergencyRelation,
          // Languages
          languages,
        } = req.body;

        // Handle phone array - extract first phone number
        const phoneNumber = Array.isArray(phone)
          ? phone[0] || null
          : phone || null;
        const phoneNumber2 =
          Array.isArray(phone) && phone.length > 1 ? phone[1] || null : null;

        // Insert into applicants table
        const [result] = await connection.execute(
          `INSERT INTO applicants 
          (voucher_id, title, first_name, middle_name, last_name, date_of_birth, gender, place_of_birth, birth_region, nationality, 
          residence_address, address, city, residence_region, residence_district, country, 
          gps_code, phone_number, phone_number2, email, religion, disability_status, id_type, id_number, 
          how_heard, questions, agreed_to_terms, agreed_to_policy)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            req.session.voucherId,
            title || null,
            firstName || null,
            middleName || null,
            lastName || null,
            dob || null,
            gender || null,
            placeOfBirth || null,
            birthRegion || null,
            nationality || null,
            residence || null,
            address || null,
            city || null,
            residenceRegion || null,
            district || null,
            country || null,
            gpsCode || null,
            phoneNumber,
            phoneNumber2,
            email || null,
            religion || null,
            disabilityStatus || null,
            idType || null,
            idNumber || null,
            howHeard || null,
            questions || null,
            agreeTerms ? 1 : 0,
            agreePolicy ? 1 : 0,
          ]
        );

        const applicantId = result.insertId;

        // Get voucher serial number
        const [voucherData] = await connection.query(
          'SELECT serial_number FROM vouchers WHERE id = ?',
          [req.session.voucherId]
        );

        const serialNumber = voucherData[0]?.serial_number;

        // Send SMS notification
        const fullName = `${firstName} ${middleName || ''} ${lastName}`.trim();
        const message = smsService.getApplicationReceivedMessage(
          fullName,
          serialNumber
        );
        const smsResult = await smsService.sendSMS(phoneNumber, message);

        if (!smsResult.success) {
          logger.error(
            'Failed to send application received SMS:',
            smsResult.error
          );
          // Continue with the response even if SMS fails
        }

        // Insert academic records
        const academicRecords = [];

        // Add core subjects
        if (Array.isArray(coreSubjects)) {
          coreSubjects.forEach((subject, index) => {
            academicRecords.push([
              applicantId,
              'core',
              subject,
              coreIndexNumbers[index] || null,
              coreGrades[index] || null,
            ]);
          });
        }

        // Add elective subjects
        if (Array.isArray(electiveSubjects)) {
          electiveSubjects.forEach((subject, index) => {
            academicRecords.push([
              applicantId,
              'elective',
              subject,
              electiveIndexNumbers[index] || null,
              electiveGrades[index] || null,
            ]);
          });
        }

        if (academicRecords.length > 0) {
          await connection.query(
            `INSERT INTO academic_records 
            (applicant_id, subject_type, subject_name, index_number, grade) 
            VALUES ?`,
            [academicRecords]
          );
        }

        // Insert parent/guardian information
        const parents = [];

        // Add primary parent/guardian
        if (parent1Name) {
          parents.push([
            applicantId,
            parent1Relation || 'other',
            parent1Name,
            parent1Occupation || null,
            parent1Phone,
            parent1Email || null,
            1, // is_primary
          ]);
        }

        // Add secondary parent/guardian if provided
        if (parent2Name) {
          parents.push([
            applicantId,
            parent2Relation || 'other',
            parent2Name,
            parent2Occupation || null,
            parent2Phone,
            parent2Email || null,
            0, // is_primary
          ]);
        }

        if (parents.length > 0) {
          await connection.query(
            `INSERT INTO parents_guardians 
            (applicant_id, relation, full_name, occupation, phone_number, email, is_primary) 
            VALUES ?`,
            [parents]
          );
        }

        // Insert emergency contact
        if (emergencyContact && emergencyPhone) {
          await connection.query(
            `INSERT INTO emergency_contacts 
            (applicant_id, full_name, phone_number, relationship) 
            VALUES (?, ?, ?, ?)`,
            [
              applicantId,
              emergencyContact,
              emergencyPhone,
              emergencyRelation || 'Other',
            ]
          );
        }

        // Insert languages
        if (Array.isArray(languages) && languages.length > 0) {
          const languageRecords = languages.map((language) => [
            applicantId,
            language,
          ]);
          await connection.query(
            `INSERT INTO applicant_languages 
            (applicant_id, language_name) 
            VALUES ?`,
            [languageRecords]
          );
        }

        // Handle uploaded files
        const uploadedFiles = req.files || {};
        const documents = [];

        // Process photo
        if (uploadedFiles.photo && uploadedFiles.photo.length > 0) {
          const file = uploadedFiles.photo[0];
          documents.push([
            applicantId,
            'photo',
            file.originalname,
            file.mimetype,
            file.buffer,
          ]);
        }

        // Process ID document
        if (uploadedFiles.idDocument && uploadedFiles.idDocument.length > 0) {
          const file = uploadedFiles.idDocument[0];
          documents.push([
            applicantId,
            'id_document',
            file.originalname,
            file.mimetype,
            file.buffer,
          ]);
        }

        // Process certificates
        if (
          uploadedFiles.certificates &&
          uploadedFiles.certificates.length > 0
        ) {
          uploadedFiles.certificates.forEach((file) => {
            documents.push([
              applicantId,
              'certificate',
              file.originalname,
              file.mimetype,
              file.buffer,
            ]);
          });
        }

        // Insert documents
        if (documents.length > 0) {
          await connection.query(
            `INSERT INTO application_documents 
            (applicant_id, document_type, file_name, file_type, file_data) 
            VALUES ?`,
            [documents]
          );
        }

        // Mark the voucher as used
        await connection.execute(
          'UPDATE vouchers SET is_used = TRUE, used_at = CURRENT_TIMESTAMP WHERE id = ?',
          [req.session.voucherId]
        );

        // Commit the transaction
        await connection.commit();
        res.json({
          success: true,
          applicantId,
          redirectUrl: `/application-success?ref=${applicantId}`,
        });
      } catch (error) {
        await connection.rollback();
        throw error;
      } finally {
        connection.release();
      }
    } catch (error) {
      logger.error('Error submitting application:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to submit application',
      });
    }
  }
);

// Routes
app.use('/api/applications', applicationRoutes);
app.use('/api/vouchers', voucherRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/vendor', vendorApiRoutes);
app.use('/api/public', publicRoutes);

// Admin session check route
app.get('/api/admin/check-session', (req, res) => {
  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_LOGS === 'true'
  ) {
    console.log('Checking admin session:', {
      sessionExists: !!req.session,
      sessionId: req.session?.id,
      isAdmin: req.session?.isAdmin,
      adminId: req.session?.adminId,
      username: req.session?.username,
      headers: req.headers,
    });
  }

  // Check if session exists
  if (!req.session) {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_LOGS === 'true'
    ) {
      console.log('No session found');
    }
    return res.json({
      isAdmin: false,
      adminId: null,
      username: null,
      error: 'No session found',
    });
  }

  // Check if session has required properties
  if (!req.session.isAdmin || !req.session.adminId) {
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_LOGS === 'true'
    ) {
      console.log('Invalid admin session - missing required properties');
    }
    return res.json({
      isAdmin: false,
      adminId: null,
      username: null,
      error: 'Invalid admin session',
    });
  }

  if (
    process.env.NODE_ENV === 'development' ||
    process.env.DEBUG_LOGS === 'true'
  ) {
    console.log('Valid admin session found');
  }
  res.json({
    isAdmin: req.session.isAdmin,
    adminId: req.session.adminId,
    username: req.session.username,
  });
});

// HTML Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'apply-now-login.html'));
});

app.get('/admin', (req, res) => {
  if (process.env.NODE_ENV === 'development') {
    console.log('Admin route accessed:', {
      session: req.session,
      isAdmin: req.session.isAdmin,
      adminId: req.session.adminId,
      sessionId: req.session.id,
    });
  }

  if (!req.session.isAdmin) {
    if (process.env.NODE_ENV === 'development') {
      console.log('Not admin, redirecting to login');
    }
    return res.redirect('/admin-login');
  }

  if (process.env.NODE_ENV === 'development') {
    console.log('Admin access granted');
  }
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

// Add route for admin dashboard
app.get('/admin/dashboard', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-dashboard.html'));
});

app.get('/admin/vouchers', isAdmin, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/admin-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin-login.html'));
});

// Student Portal Routes
app.use('/student', studentPortalRoutes);

// Student Admission Letter route
app.get('/student/admission-letter', (req, res) => {
  if (!req.session || !req.session.isStudent) return res.redirect('/student/login');
  res.sendFile(path.join(__dirname, 'views', 'student-admission-letter.html'));
});

// Student Logout
app.post('/student/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/student/login'));
});


app.get('/apply-now', (req, res, next) => {
  // Check if user has a valid voucher session
  if (!req.session.isApplicant || !req.session.voucherId) {
    logger.debug('No valid voucher session, redirecting to login');
    return res.redirect('/apply-now-login');
  }
  logger.debug('Valid voucher session found, proceeding to application form');
  res.sendFile(path.join(__dirname, 'views', 'apply-now.html'));
});

app.get('/apply-now-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'apply-now-login.html'));
});

// Add routes for remaining pages


// Add route for application success page (handle both with and without .html extension)
app.get(['/application-success', '/application-success.html'], (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'application-success.html'));
});

// Add route for voucher template
app.get('/voucher-template', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'voucher-template.html'));
});

// Add route to get voucher details
app.get('/api/vouchers/details', async (req, res) => {
  try {
    const { serial, pin } = req.query;

    if (!serial || !pin) {
      return res.status(400).json({
        success: false,
        message: 'Serial number and PIN are required',
      });
    }

    // Query the database for voucher details
    const [vouchers] = await pool.query(
      'SELECT * FROM vouchers WHERE serial_number = ?',
      [serial]
    );

    if (vouchers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Voucher not found',
      });
    }

    const voucher = vouchers[0];

    // Verify PIN
    const bcrypt = require('bcrypt');
    const pinMatch = await bcrypt.compare(pin, voucher.pin_hash);

    if (!pinMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid PIN',
      });
    }

    // Return voucher details
    res.json({
      success: true,
      voucher: {
        serial_number: voucher.serial_number,
        pin: pin, // Only return the PIN if it matches
        created_at: voucher.created_at,
        expires_at: voucher.expires_at,
        is_used: voucher.is_used,
      },
    });
  } catch (error) {
    logger.error('Error fetching voucher details:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching voucher details',
    });
  }
});

// Add route to get voucher statistics
app.get('/api/admin/vouchers/statistics', isAdmin, async (req, res) => {
  try {
    const [stats] = await pool.query(`
            SELECT 
                COUNT(*) as total_vouchers,
                SUM(CASE WHEN is_used = 1 THEN 1 ELSE 0 END) as used_vouchers,
                SUM(CASE WHEN is_used = 0 THEN 1 ELSE 0 END) as unused_vouchers,
                SUM(price) as total_value
            FROM vouchers
        `);

    // Format the response
    const formattedStats = [
      {
        totalVouchers: stats[0].total_vouchers,
        usedVouchers: stats[0].used_vouchers,
        unusedVouchers: stats[0].unused_vouchers,
        totalValue: stats[0].total_value,
      },
    ];

    res.json({
      success: true,
      statistics: formattedStats,
    });
  } catch (error) {
    logger.error('Error fetching voucher statistics:', error);
    res.status(500).json({ error: 'Failed to fetch voucher statistics' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler - must be after all other routes
app.use((req, res) => {
  logger.info('404 Not Found:', req.path);
  res.status(404).sendFile(path.join(__dirname, 'views', '404.html'));
});

// Health endpoint for liveness checks
app.get('/health', async (req, res) => {
  try {
    const connection = await pool.getConnection();
    await connection.ping();
    connection.release();
    res.json({ status: 'ok' });
  } catch (e) {
    res.status(500).json({ status: 'error', error: e.message });
  }
});

// Initialize database before starting the server
async function startServer() {
  try {
    // Test database connection first
    await testDatabaseConnection();

    // Check if we should force reinitialize the database
    const forceInit = process.env.FORCE_DB_INIT === 'true';

    if (forceInit) {
      logger.info('Force initializing database...');
      await initDb();
      logger.info('Database initialized successfully');
    } else {
      logger.info(
        'Skipping database initialization. Set FORCE_DB_INIT=true to force initialization.'
      );
    }

    const port = process.env.PORT || 3000;
    app
      .listen(port, () => {
        logger.info(`Server is running on port ${port}`);
      })
      .on('error', (error) => {
        logger.error('Failed to start server:', error);
        process.exit(1);
      });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Add a route to handle login requests
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Log the login attempt
    logger.info('Login attempt:', email);

    // Check if the user exists in the database
    const [users] = await pool.execute(
      'SELECT * FROM applicants WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
      });
    }

    const user = users[0];

    // Return success with user info
    res.json({
      success: true,
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
      },
    });
  } catch (err) {
    logger.error('Login error:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error during login',
    });
  }
});

// Add admin logout route
app.all('/api/admin/logout', (req, res) => {
  req.session.isAdmin = false;
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    if (req.xhr || req.headers.accept.includes('application/json')) {
      res.json({ success: true });
    } else {
      res.redirect('/admin-login');
    }
  });
});

// Function to generate a serial number
function generateSerialNumber() {
  const prefix = 'NSCE25';
  const random = Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
  return `${prefix}${random}`;
}

// Function to generate a PIN
function generatePIN() {
  return Math.floor(Math.random() * 1000000)
    .toString()
    .padStart(6, '0');
}

// Admin login route
// NOTE: Admin login route is handled in routes/adminRoutes.js at POST /api/admin/login

// Vendor routes
app.get('/vendor-login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'vendor-login.html'));
});

app.get('/vendor', isVendor, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'vendor.html'));
});

// Vendor API routes mounted above

// Vendor authentication routes
app.post('/api/vendor/login', async (req, res) => {
  try {
    logger.info('Vendor login attempt:', {
      username: req.body.username,
      hasPassword: !!req.body.password,
      sessionId: req.session.id,
    });

    const { username, password } = req.body;
    const pool = req.app.get('mysqlPool');

    if (!username || !password) {
      logger.info('Missing username or password');
      return res
        .status(400)
        .json({ error: 'Username and password are required' });
    }

    const [users] = await pool.query(
      'SELECT * FROM users WHERE username = ? AND user_type = "vendor"',
      [username]
    );

    logger.debug('Database query result:', {
      found: users.length > 0,
      username: username,
      userType: users[0]?.user_type,
    });

    if (users.length === 0) {
      logger.info('No vendor found with username:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const user = users[0];
    const passwordMatch = await bcrypt.compare(password, user.password_hash);

    logger.debug('Password verification:', {
      match: passwordMatch,
      userId: user.id,
      username: user.username,
    });

    if (!passwordMatch) {
      logger.info('Password mismatch for user:', username);
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userType = 'vendor';
    req.session.username = user.username;

    // Force session save
    req.session.save((err) => {
      if (err) {
        logger.error('Session save error:', err);
        return res.status(500).json({ error: 'Failed to save session' });
      }

      logger.info('Login successful:', {
        userId: user.id,
        username: user.username,
        sessionId: req.session.id,
        userType: req.session.userType,
      });

      res.json({ success: true });
    });
  } catch (error) {
    logger.error('Login error details:', {
      error: error.message,
      stack: error.stack,
      code: error.code,
    });
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/vendor/check-session', (req, res) => {
  res.json({
    isVendor: req.session.userType === 'vendor',
    username: req.session.username,
  });
});

app.get('/api/vendor/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      logger.error('Logout error:', err);
      return res.status(500).json({ error: 'Failed to logout' });
    }
    res.json({ success: true });
  });
});
