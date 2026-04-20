const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function generateApiKey() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        // Get the vendor ID
        const [vendors] = await pool.query('SELECT id FROM users WHERE user_type = "vendor" LIMIT 1');
        if (vendors.length === 0) {
            console.error('No vendor found in the database');
            process.exit(1);
        }

        const vendorId = vendors[0].id;

        // Generate API key
        const apiKey = crypto.randomBytes(32).toString('hex');
        const apiKeyHash = await bcrypt.hash(apiKey, 10);

        // Store API key in database
        await pool.query(
            'INSERT INTO vendor_api_keys (vendor_id, name, api_key, api_key_hash) VALUES (?, ?, ?, ?)',
            [vendorId, 'Default API Key', apiKey, apiKeyHash]
        );

        console.log('API Key generated successfully!');
        console.log('API Key:', apiKey);
        console.log('\nIMPORTANT: Save this API key securely. It will not be shown again.');

    } catch (error) {
        console.error('Error generating API key:', error);
    } finally {
        await pool.end();
    }
}

generateApiKey(); 