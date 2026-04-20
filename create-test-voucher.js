const pool = require('./config/db');
const bcrypt = require('bcrypt');

async function createTestVoucher() {
  const serial = 'NSCE25TEST99';
  const pin = '12345678';
  try {
    const pinHash = await bcrypt.hash(pin, 10);
    await pool.execute(
      'INSERT INTO vouchers (serial_number, pin_hash, is_used) VALUES (?, ?, 0) ON DUPLICATE KEY UPDATE pin_hash = ?, is_used = 0',
      [serial, pinHash, pinHash]
    );
    console.log(`Test Voucher Created: Serial=${serial}, PIN=${pin}`);
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

createTestVoucher();
