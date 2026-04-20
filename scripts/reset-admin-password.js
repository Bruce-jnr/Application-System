const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function resetAdminPassword(newPassword) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // Hash the new password
        const passwordHash = await bcrypt.hash(newPassword, 10);

        // Update admin password
        const [result] = await pool.query(
            'UPDATE users SET password_hash = ? WHERE username = ? AND user_type = "admin"',
            [passwordHash, 'admin']
        );

        if (result.affectedRows === 0) {
            console.error('❌ Error: Admin user not found');
            return;
        }

        console.log('✅ Admin password reset successfully!');
        console.log('Username: admin');
        console.log('New Password:', newPassword);
        console.log('\n⚠️  IMPORTANT: Save these credentials securely');

    } catch (error) {
        console.error('Error resetting admin password:', error);
    } finally {
        await pool.end();
    }
}

// Get command line argument
const args = process.argv.slice(2);
if (args.length !== 1) {
    console.log('Usage: node reset-admin-password.js <new_password>');
    console.log('Example: node reset-admin-password.js newadminpass123');
    process.exit(1);
}

const newPassword = args[0];
resetAdminPassword(newPassword); 