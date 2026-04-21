const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
    });

    try {
        console.log('Adding admission_pin column to applicants table...');
        await pool.query('ALTER TABLE applicants ADD COLUMN admission_pin VARCHAR(6) NULL AFTER status');
        console.log('Migration successful!');
    } catch (error) {
        if (error.code === 'ER_DUP_COLUMN_NAME') {
            console.log('Column admission_pin already exists.');
        } else {
            console.error('Migration failed:', error);
        }
    } finally {
        await pool.end();
    }
}

migrate();
