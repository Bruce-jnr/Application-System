const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function initializeDatabase() {
  let tempPool = null;
  let pool = null;

  try {
    // First create a connection without database
    tempPool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // Create database if it doesn't exist
    await tempPool.query(
      `CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME}`
    );
    console.log(`Database ${process.env.DB_NAME} created or already exists`);

    // Close temporary connection
    await tempPool.end();
    tempPool = null;

    // Create connection pool with database
    pool = mysql.createPool({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    });

    // First, disable foreign key checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 0');
    console.log('Foreign key checks disabled');

    // Drop existing tables in reverse order of dependencies
    const tables = [
      'application_documents',
      'applicant_languages',
      'emergency_contacts',
      'parents_guardians',
      'academic_records',
      'applicants',
      'vouchers',
      'users',
    ];

    for (const table of tables) {
      try {
        await pool.query(`DROP TABLE IF EXISTS ${table}`);
        console.log(`Dropped table ${table} if it existed`);
      } catch (error) {
        console.warn(`Warning: Could not drop table ${table}:`, error.message);
      }
    }

    // Re-enable foreign key checks
    await pool.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create users table for both admins and vendors
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT PRIMARY KEY AUTO_INCREMENT,
        username VARCHAR(50) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(100) NOT NULL,
        user_type ENUM('admin', 'vendor') NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create vouchers table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vouchers (
        id INT PRIMARY KEY AUTO_INCREMENT,
        serial_number VARCHAR(12) UNIQUE NOT NULL,
        pin_hash VARCHAR(255) NOT NULL,
        is_used BOOLEAN DEFAULT FALSE,
        used_at TIMESTAMP NULL,
        created_by INT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NULL,
        price DECIMAL(10,2) DEFAULT 360.00,
        FOREIGN KEY (created_by) REFERENCES users(id)
      )
    `);

    // Create applicants table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applicants (
        id INT PRIMARY KEY AUTO_INCREMENT,
        voucher_id INT,
        title VARCHAR(10),
        first_name VARCHAR(100),
        middle_name VARCHAR(100),
        last_name VARCHAR(100),
        date_of_birth DATE,
        gender VARCHAR(20),
        place_of_birth VARCHAR(100),
        birth_region VARCHAR(100),
        nationality VARCHAR(100),
        residence_address VARCHAR(255),
        address VARCHAR(255),
        city VARCHAR(100),
        residence_region VARCHAR(100),
        residence_district VARCHAR(100),
        country VARCHAR(100),
        gps_code VARCHAR(50),
        phone_number VARCHAR(20),
        phone_number2 VARCHAR(20),
        email VARCHAR(100),
        religion VARCHAR(50),
        disability_status VARCHAR(10),
        disability_type VARCHAR(100),
        id_type VARCHAR(50),
        id_number VARCHAR(50),
        id_document_path VARCHAR(255),
        photo_path VARCHAR(255),
        how_heard VARCHAR(100),
        questions TEXT,
        agreed_to_terms BOOLEAN,
        agreed_to_policy BOOLEAN,
        status ENUM('pending', 'shortlisted', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
        admission_pin VARCHAR(6) NULL,
        approved_by INT,
        approved_at TIMESTAMP NULL,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (voucher_id) REFERENCES vouchers(id),
        FOREIGN KEY (approved_by) REFERENCES users(id)
      )
    `);

    // Create academic_records table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS academic_records (
        id INT PRIMARY KEY AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        subject_type ENUM('core', 'elective') NOT NULL,
        subject_name VARCHAR(50) NOT NULL,
        index_number VARCHAR(50),
        grade VARCHAR(2) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      )
    `);

    // Create parents_guardians table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS parents_guardians (
        id INT PRIMARY KEY AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        relation VARCHAR(50) NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        occupation VARCHAR(100),
        phone_number VARCHAR(20) NOT NULL,
        email VARCHAR(100),
        is_primary BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      )
    `);

    // Create emergency_contacts table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS emergency_contacts (
        id INT PRIMARY KEY AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        full_name VARCHAR(100) NOT NULL,
        phone_number VARCHAR(20) NOT NULL,
        relationship VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      )
    `);

    // Create applicant_languages table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS applicant_languages (
        id INT PRIMARY KEY AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        language_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      )
    `);

    // Create application_documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS application_documents (
        id INT PRIMARY KEY AUTO_INCREMENT,
        applicant_id INT NOT NULL,
        document_type ENUM('id_document', 'photo', 'certificate', 'other') NOT NULL,
        file_path VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (applicant_id) REFERENCES applicants(id) ON DELETE CASCADE
      )
    `);

    // Create sessions table for express-session
    await pool.query(`
      CREATE TABLE IF NOT EXISTS sessions (
        session_id VARCHAR(255) PRIMARY KEY,
        expires TIMESTAMP NOT NULL,
        data TEXT
      )
    `);

    // Create announcements table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS announcements (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        body TEXT NOT NULL,
        category VARCHAR(50) DEFAULT 'General',
        author VARCHAR(100) DEFAULT 'Admin',
        is_published BOOLEAN DEFAULT TRUE,
        published_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_ann_published (is_published, published_at)
      )
    `);

    // Create news table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS news (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(200) NOT NULL,
        excerpt VARCHAR(500) NULL,
        content TEXT NOT NULL,
        image_url VARCHAR(255) NULL,
        image_mime VARCHAR(100) NULL,
        image_data LONGBLOB NULL,
        category VARCHAR(50) DEFAULT 'General',
        author VARCHAR(100) DEFAULT 'Admin',
        is_published BOOLEAN DEFAULT TRUE,
        published_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_news_published (is_published, published_at)
      )
    `);

    // Create vendor_api_keys table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS vendor_api_keys (
        id INT PRIMARY KEY AUTO_INCREMENT,
        vendor_id INT NOT NULL,
        api_key VARCHAR(64) NOT NULL,
        api_key_hash VARCHAR(255) NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_used_at TIMESTAMP NULL,
        expires_at TIMESTAMP NULL,
        FOREIGN KEY (vendor_id) REFERENCES users(id),
        UNIQUE KEY unique_api_key (api_key_hash)
      )
    `);

    // Check if default admin exists, if not create one
    const [admins] = await pool.query(
      'SELECT * FROM users WHERE user_type = "admin" LIMIT 1'
    );
    if (admins.length === 0) {
      const passwordHash = await bcrypt.hash('admin123', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, name, user_type) VALUES (?, ?, ?, ?)',
        ['admin', passwordHash, 'System Administrator', 'admin']
      );
      console.log('Default admin account created');
    }

    // Check if default vendor exists, if not create one
    const [vendors] = await pool.query(
      'SELECT * FROM users WHERE user_type = "vendor" LIMIT 1'
    );
    if (vendors.length === 0) {
      const passwordHash = await bcrypt.hash('vendor123', 10);
      await pool.query(
        'INSERT INTO users (username, password_hash, name, user_type) VALUES (?, ?, ?, ?)',
        ['bank_vendor', passwordHash, 'Bank Vendor', 'vendor']
      );
      console.log('Default vendor account created');
    }

    console.log('Database initialized successfully');
    return true;
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  } finally {
    if (tempPool) await tempPool.end();
    if (pool) await pool.end();
  }
}

// Run the initialization if this file is run directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      console.log('Database initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Database initialization failed:', error);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
