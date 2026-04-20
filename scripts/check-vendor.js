const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkVendor() {
    try {
        const pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        });

        const [rows] = await pool.query('SELECT * FROM users WHERE user_type = "vendor"');
        console.log('Vendors:', JSON.stringify(rows, null, 2));
        await pool.end();
    } catch (error) {
        console.error('Error:', error);
    }
}

checkVendor(); 