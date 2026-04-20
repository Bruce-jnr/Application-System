require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

async function verifyAdminUser() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME
    });

    try {
        // 1. Check if admin user exists
        console.log('Checking if admin user exists...');
        const [users] = await pool.query(
            'SELECT * FROM users WHERE username = ? AND user_type = "admin"',
            ['admin']
        );

        if (users.length === 0) {
            console.error('❌ Admin user not found!');
            return;
        }

        const admin = users[0];
        console.log('✅ Admin user found!');
        console.log('User details:');
        console.log('- Username:', admin.username);
        console.log('- Name:', admin.name);
        console.log('- User Type:', admin.user_type);
        console.log('- Created At:', admin.created_at);

        // 2. Verify password
        console.log('\nVerifying password...');
        const testPassword = 'NsacoeAdminPortal';
        const passwordMatch = await bcrypt.compare(testPassword, admin.password_hash);
        
        if (passwordMatch) {
            console.log('✅ Password verification successful!');
        } else {
            console.error('❌ Password verification failed!');
        }

        // 3. Check user permissions
        console.log('\nChecking user permissions...');
        if (admin.user_type === 'admin') {
            console.log('✅ User has admin privileges');
        } else {
            console.error('❌ User does not have admin privileges!');
        }

        // 4. Verify database access
        console.log('\nVerifying database access...');
        try {
            // Try to access admin-only tables
            const [applications] = await pool.query('SELECT COUNT(*) as count FROM applicants');
            const [vouchers] = await pool.query('SELECT COUNT(*) as count FROM vouchers');
            console.log('✅ Database access verified!');
            console.log('- Applications in database:', applications[0].count);
            console.log('- Vouchers in database:', vouchers[0].count);
        } catch (error) {
            console.error('❌ Database access verification failed:', error.message);
        }

        console.log('\nVerification complete!');
        if (passwordMatch && admin.user_type === 'admin') {
            console.log('✅ Admin user is properly configured and ready to use!');
            console.log('\nYou can now log in to the admin portal with:');
            console.log('Username: admin');
            console.log('Password: NsacoeAdminPortal');
        } else {
            console.error('❌ Admin user verification failed! Please check the issues above.');
        }

    } catch (error) {
        console.error('Error verifying admin user:', error);
    } finally {
        await pool.end();
    }
}

// Run the verification
verifyAdminUser(); 