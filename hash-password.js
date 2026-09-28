// Utilitas sekali-pakai untuk membuat hash password admin.
// Cara pakai: node hash-password.js "PasswordRahasiaAnda"
const bcrypt = require('bcryptjs');

const plain = process.argv[2];
if (!plain) {
  console.error('Cara pakai: node hash-password.js "PasswordAnda"');
  process.exit(1);
}

const hash = bcrypt.hashSync(plain, 12);
console.log('\nTempel baris ini ke file .env Anda:\n');
console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
