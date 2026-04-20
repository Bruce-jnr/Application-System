const mysql = require('mysql2/promise');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
require('dotenv').config();

async function generateApiKey() {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || 'localhost',
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0
    });

    try {
        console.log('\n🔑 NSACoE Vendor API Key Generator');
        console.log('===================================\n');

        // Get vendor ID from command line or input
        let vendorId;
        if (process.argv[2]) {
            vendorId = parseInt(process.argv[2]);
            if (isNaN(vendorId)) {
                throw new Error('Vendor ID must be a number');
            }
        } else {
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });

            const question = (query) => new Promise((resolve) => readline.question(query, resolve));
            
            while (true) {
                const input = await question('Enter your vendor ID: ');
                vendorId = parseInt(input);
                if (!isNaN(vendorId)) {
                    break;
                }
                console.log('❌ Error: Please enter a valid number');
            }
            readline.close();
        }

        // Verify vendor exists
        const [vendors] = await pool.query(
            'SELECT id FROM users WHERE id = ? AND user_type = "vendor"',
            [vendorId]
        );

        if (vendors.length === 0) {
            throw new Error('Vendor not found');
        }

        // Check for existing active keys
        const [existingKeys] = await pool.query(
            'SELECT COUNT(*) as count FROM vendor_api_keys WHERE vendor_id = ? AND is_active = true',
            [vendorId]
        );

        if (existingKeys[0].count >= 5) {
            throw new Error('Maximum number of active API keys (5) reached for this vendor');
        }

        // Generate API key
        const apiKey = crypto.randomBytes(32).toString('hex');
        const apiKeyHash = await bcrypt.hash(apiKey, 10);
        const name = `API Key ${new Date().toISOString().split('T')[0]}`;
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 365); // Expires in 1 year

        // Store API key in database
        await pool.query(
            'INSERT INTO vendor_api_keys (vendor_id, name, api_key, api_key_hash, expires_at) VALUES (?, ?, ?, ?, ?)',
            [vendorId, name, apiKey, apiKeyHash, expiresAt]
        );

        // Save to file with timestamp
        const fs = require('fs').promises;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '');
        const filename = `vendor-api-key_${timestamp}.txt`;
        const content = [
            `API Key: ${apiKey}`,
            `Generated: ${new Date().toISOString()}`,
            `Vendor ID: ${vendorId}`,
            `Expires: ${expiresAt.toISOString()}`
        ].join('\n');
        
        await fs.writeFile(filename, content);

        console.log('\n✅ API Key generated successfully!');
        console.log('===================================');
        console.log('API Key:', apiKey);
        console.log('===================================');
        console.log(`\nAPI key saved to: ${filename}`);
        console.log('\nIMPORTANT: Store this API key securely. It won\'t be shown again!');

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    generateApiKey();
}

module.exports = generateApiKey; 