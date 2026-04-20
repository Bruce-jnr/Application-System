const pool = require('./config/db');

async function getVoucher() {
  try {
    const [rows] = await pool.execute('SELECT serial_number, pin FROM vouchers WHERE used = 0 LIMIT 1');
    console.log(JSON.stringify(rows[0]));
    process.exit(0);
  } catch (error) {
    console.error(error);
    process.exit(1);
  }
}

getVoucher();
