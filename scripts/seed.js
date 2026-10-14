/**
 * Run with: npm run seed
 * Creates the first admin account, default categories,
 * and store settings. Safe to re-run:
 *  - Admin and categories are skipped if they already exist.
 *  - Store settings are updated on every run so business info stays current.
 */
require('dotenv').config({ path: '.env' });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const slugify = require('slugify');

async function main() {
  if (!process.env.MONGODB_URI) {
    console.error('Missing MONGODB_URI in .env. Add your MongoDB Atlas connection string first.');
    process.exit(1);
  }
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const AdminSchema = new mongoose.Schema(
    { name: String, email: { type: String, unique: true }, passwordHash: String, role: String },
    { timestamps: true }
  );
  const CategorySchema = new mongoose.Schema(
    { name: String, slug: { type: String, unique: true }, image: String, description: String, sizes: [String], sortOrder: Number, isActive: Boolean },
    { timestamps: true }
  );
  const SettingsSchema = new mongoose.Schema({ key: { type: String, unique: true } }, { strict: false, timestamps: true });

  const Admin = mongoose.models.Admin || mongoose.model('Admin', AdminSchema);
  const Category = mongoose.models.Category || mongoose.model('Category', CategorySchema);
  const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

  // 1. Admin account
  const email = (process.env.ADMIN_EMAIL || 'purple.queen2512@gmail.com').toLowerCase();
  const existingAdmin = await Admin.findOne({ email });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10);
    await Admin.create({ name: 'Admin', email, passwordHash, role: 'owner' });
    console.log(`Created admin account: ${email}`);
  } else {
    console.log('Admin account already exists, skipping.');
  }

  // 2. Categories
  const categories = [
    { name: 'Salwar Set', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Rayon Umbrella Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Side Open Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Umbrella Kurtis', sizes: ['S', 'M', 'L', 'XL', 'XXL'] },
    { name: 'Nighties', sizes: ['M', 'L', 'XL', 'XXL', 'Free Size'] },
    { name: 'Innerwear', sizes: ['S', 'M', 'L', 'XL'] },
    { name: '2 Piece Set', sizes: ['S', 'M', 'L', 'XL', 'XXL'] }
  ];

  for (let i = 0; i < categories.length; i++) {
    const c = categories[i];
    const slug = slugify(c.name, { lower: true });
    const exists = await Category.findOne({ slug });
    if (!exists) {
      await Category.create({ ...c, slug, sortOrder: i, isActive: true });
      console.log(`Created category: ${c.name}`);
    }
  }

  // 3. Store settings (updated on every run)
  await Settings.findOneAndUpdate(
    { key: 'global' },
    {
      $set: {
        key: 'global',
        storeName: 'Purple Queen',
        tagline: 'Kids & Ladies Corner',
        whatsapp: '919791368249',
        phone: '9791368249',
        phone2: '8300770783',
        email: 'purple.queen2512@gmail.com',
        instagram: '', // add your handle (the bag's QR code looks like an Instagram link)
        address: 'Jino Complex, College Road, Nithiravilai',
        shippingFee: 49,
        freeShippingAbove: 999,
        seoTitle: 'Purple Queen | Kids & Ladies Corner, Nithiravilai',
        seoDescription: 'Shop trendy kids and ladies wear from Purple Queen, Jino Complex, College Road, Nithiravilai.'
      },
      // Remove old Shea Fashions fields so they don't linger in the database
      $unset: { businessUnitOf: '', sheaFashionsPhone: '' }
    },
    { upsert: true, new: true }
  );
  console.log('Store settings created/updated.');

  console.log('\nSeed complete! Admin login:');
  console.log(`  Email: ${email}`);
  console.log(`  Password: ${process.env.ADMIN_PASSWORD || 'ChangeMe123!'}`);
  console.log('  URL: /admin/login\n');

  await mongoose.disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });