const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function addVendor(username, password, name) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Check if username already exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE username = ?',
            [username]
        );

        if (existingUsers.length > 0) {
            console.error('❌ Error: Username already exists');
            return;
        }

        // Hash the password
        const passwordHash = await bcrypt.hash(password, 10);

        // Insert new vendor
        const [result] = await pool.query(
            'INSERT INTO users (username, password_hash, name, user_type) VALUES (?, ?, ?, ?)',
            [username, passwordHash, name, 'vendor']
        );

        console.log('✅ New vendor added successfully!');
        console.log('Vendor ID:', result.insertId);
        console.log('Username:', username);
        console.log('Name:', name);
        console.log('Password:', password);
        console.log('\n⚠️  IMPORTANT: Save these credentials securely');

    } catch (error) {
        console.error('Error adding vendor:', error);
    } finally {
        await pool.end();
    }
}

// Get command line arguments
const args = process.argv.slice(2);
if (args.length !== 3) {
    console.log('Usage: node add-vendor.js <username> <password> <name>');
    console.log('Example: node add-vendor.js new_vendor vendorpass "New Vendor Name"');
    process.exit(1);
}

const [username, password, name] = args;
addVendor(username, password, name); 