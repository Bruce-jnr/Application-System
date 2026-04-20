require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function createAdminUser() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Admin credentials
        const adminUser = {
            username: 'admin', // Change this to your desired admin username
            password: 'NsacoeAdminPortal', // Change this to your desired password
            name: 'System Administrator',
            user_type: 'admin'
        };

        // Hash the password
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(adminUser.password, saltRounds);

        // Check if admin user already exists
        const [existingUsers] = await pool.query(
            'SELECT * FROM users WHERE username = ? AND user_type = "admin"',
            [adminUser.username]
        );

        if (existingUsers.length > 0) {
            console.log('Admin user already exists. Updating password...');
            // Update existing admin user
            await pool.query(
                'UPDATE users SET password_hash = ?, name = ? WHERE username = ? AND user_type = "admin"',
                [passwordHash, adminUser.name, adminUser.username]
            );
            console.log('Admin user updated successfully!');
        } else {
            console.log('Creating new admin user...');
            // Create new admin user
            await pool.query(
                'INSERT INTO users (username, password_hash, name, user_type) VALUES (?, ?, ?, ?)',
                [adminUser.username, passwordHash, adminUser.name, adminUser.user_type]
            );
            console.log('Admin user created successfully!');
        }

        console.log('\nAdmin credentials:');
        console.log('Username:', adminUser.username);
        console.log('Password:', adminUser.password);
        console.log('\nIMPORTANT: Please change these credentials after first login!');

    } catch (error) {
        console.error('Error creating admin user:', error);
    } finally {
        await pool.end();
    }
}

// Run the function
createAdminUser(); 