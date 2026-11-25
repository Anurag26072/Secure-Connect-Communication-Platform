require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 5000,
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  saltRounds: parseInt(process.env.BCRYPT_SALT_ROUNDS, 10) || 10,
  adminEmail: (process.env.ADMIN_EMAIL || '').toLowerCase(),
  dbFile: process.env.DB_FILE || './data/db.json',
};

if (!config.jwtSecret) {
  console.error('FATAL: JWT_SECRET is missing. Create a .env file (see .env.example).');
  process.exit(1);
}

module.exports = config;
