const mysql = require('mysql2/promise');
const logger = require('../utils/logger');
require('dotenv').config();

async function cleanupDatabase() {
  let pool = null;
  try {
    // Create connection pool
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Start transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      logger.info('Starting database cleanup...');

      // Disable foreign key checks temporarily
      await connection.query('SET FOREIGN_KEY_CHECKS = 0');

      // Store admin and vendor IDs to preserve them
      const [adminUsers] = await connection.query(
        'SELECT id FROM users WHERE user_type IN ("admin", "vendor")'
      );
      const adminIds = adminUsers.map(user => user.id);

      // Delete all data from tables in reverse order of dependencies
      const tables = [
        'application_documents',
        'applicant_languages',
        'emergency_contacts',
        'parents_guardians',
        'academic_records',
        'applicants',
        'vendor_api_keys',
        'vouchers'
      ];

      for (const table of tables) {
        await connection.query(`DELETE FROM ${table}`);
        logger.info(`Cleaned up ${table} table`);
      }

      // Delete all users except admin and vendor
      if (adminIds.length > 0) {
        await connection.query(
          'DELETE FROM users WHERE id NOT IN (?)',
          [adminIds]
        );
      }
      logger.info('Cleaned up users table');

      // Reset auto-increment counters
      for (const table of [...tables, 'users']) {
        await connection.query(`ALTER TABLE ${table} AUTO_INCREMENT = 1`);
        logger.info(`Reset auto-increment for ${table} table`);
      }

      // Re-enable foreign key checks
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');

      // Commit transaction
      await connection.commit();
      logger.info('Database cleanup completed successfully');

    } catch (error) {
      // Rollback transaction on error
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

  } catch (error) {
    logger.error('Error during database cleanup:', error);
    throw error;
  } finally {
    if (pool) await pool.end();
  }
}

// Run cleanup if this file is executed directly
if (require.main === module) {
  cleanupDatabase()
    .then(() => {
      logger.info('Database cleanup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Database cleanup failed:', error);
      process.exit(1);
    });
}

module.exports = cleanupDatabase; 