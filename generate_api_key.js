const axios = require('axios');
const fs = require('fs').promises;
const readline = require('readline');

class NSACoEVendorAPI {
    constructor(baseUrl = 'http://localhost:3000/api/vendor-api') {
        this.baseUrl = baseUrl;
        this.apiKey = null;
        this.maxRetries = 2;
        this.retryDelay = 1000; // milliseconds
        
        this.axios = axios.create({
            baseURL: baseUrl,
            headers: {
                'Content-Type': 'application/json'
            },
            timeout: 10000 // 10 seconds
        });
    }

    /**
     * Sleep for specified milliseconds
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise<void>}
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate a new API key for the vendor with retry logic
     * @param {number} vendorId - The vendor's ID number
     * @param {number} retryCount - Current retry attempt
     * @returns {Promise<string>} The generated API key
     * @throws {Error} If API key generation fails after retries
     */
    async generateApiKey(vendorId, retryCount = 0) {
        if (!Number.isInteger(vendorId) || vendorId <= 0) {
            throw new Error('Vendor ID must be a positive integer');
        }

        try {
            console.log(`\nAttempting to generate API key for vendor ID: ${vendorId}`);
            const response = await this.axios.post('/generate-api-key', {
                vendorId
            });

            if (response.data.success) {
                // Save the API key
                this.apiKey = response.data.apiKey;
                
                // Save to file with timestamp
                const timestamp = new Date().toISOString().replace(/[:.]/g, '');
                const filename = `vendor-api-key_${timestamp}.txt`;
                const content = [
                    `API Key: ${this.apiKey}`,
                    `Generated: ${new Date().toISOString()}`,
                    `Vendor ID: ${vendorId}`
                ].join('\n');
                
                await fs.writeFile(filename, content);
                console.log(`\n API key generated successfully!`);
                console.log(` API key saved to: ${filename}`);
                console.log('\n IMPORTANT: Store this API key securely. It won\'t be shown again!');
                
                return this.apiKey;
            } else {
                throw new Error(response.data.error || 'Unknown error occurred');
            }
        } catch (error) {
            if (retryCount < this.maxRetries) {
                console.log(`\n Retry ${retryCount + 1}/${this.maxRetries} after error: ${error.message}`);
                await this.sleep(this.retryDelay * Math.pow(2, retryCount));
                return this.generateApiKey(vendorId, retryCount + 1);
            }
            
            if (error.response) {
                throw new Error(`API Error: ${error.response.data.error || error.message}`);
            }
            throw new Error(`Failed to generate API key: ${error.message}`);
        }
    }
}

// Create readline interface for user input
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisify readline question
function question(query) {
    return new Promise((resolve) => {
        rl.question(query, resolve);
    });
}

async function main() {
    console.log('\n🔑 NSACoE Vendor API Key Generator');
    console.log('===================================');
    
    const api = new NSACoEVendorAPI();
    
    try {
        // Get vendor ID from command line or input
        let vendorId;
        if (process.argv[2]) {
            vendorId = parseInt(process.argv[2]);
            if (isNaN(vendorId)) {
                throw new Error('Vendor ID must be a number');
            }
        } else {
            while (true) {
                const input = await question('\nEnter your vendor ID: ');
                vendorId = parseInt(input);
                if (!isNaN(vendorId)) {
                    break;
                }
                console.log(' Error: Please enter a valid number');
            }
        }
        
        // Generate API key
        const apiKey = await api.generateApiKey(vendorId);
        
        // Print the API key in a box
        if (apiKey) {
            console.log('\n' + '='.repeat(50));
            console.log('Your API Key:');
            console.log('='.repeat(50));
            console.log(apiKey);
            console.log('='.repeat(50));
        }
        
    } catch (error) {
        console.error(`\n Error: ${error.message}`);
        process.exit(1);
    } finally {
        rl.close();
    }
}

// Run the script
if (require.main === module) {
    main().catch(error => {
        console.error('Fatal error:', error.message);
        process.exit(1);
    });
} 