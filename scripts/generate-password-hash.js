const bcrypt = require('bcrypt');

async function generateHash(password) {
    const hash = await bcrypt.hash(password, 10);
    console.log(`Password hash for ${password}:`, hash);
}

async function generateAllHashes() {
    await generateHash('admin123');
    await generateHash('vendor123');
}

generateAllHashes(); 