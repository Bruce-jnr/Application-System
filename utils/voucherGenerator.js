const crypto = require('crypto');
const bcrypt = require('bcrypt');

function generateSerialNumber() {
  // Example: 10-character alphanumeric
  return 'NSC' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

function generatePin() {
  // Example: 6-digit numeric PIN
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function createVoucher(pool) {
  const serial = generateSerialNumber();
  const pin = generatePin();
  const pinHash = await bcrypt.hash(pin, 10);

  return new Promise((resolve, reject) => {
    pool.query(
      'INSERT INTO vouchers (serial_number, pin_hash, price, expires_at) VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 30 DAY))',
      [serial, pinHash, 100.0], // Set your price as needed
      (err, results) => {
        if (err) return reject(err);
        resolve({ serial, pin });
      }
    );
  });
}

module.exports = { createVoucher };
