// Seed data scope (per Phase 1 instructions): one admin account, two user
// accounts, three event categories. No events, registrations, donations, or
// certificates yet — those arrive with their respective feature phases.
//
// Idempotent: safe to run more than once (ON CONFLICT DO NOTHING on the
// unique columns already enforced by the schema).

const bcrypt = require('bcrypt');
const pool = require('../../src/config/db');
const logger = require('../../src/utils/logger');

const SALT_ROUNDS = 10;
const SEED_PASSWORD = 'ChangeMe123!';

async function seed() {
  const passwordHash = await bcrypt.hash(SEED_PASSWORD, SALT_ROUNDS);

  const users = [
    {
      name: 'Platform Admin',
      email: 'admin@communityconnect.local',
      role: 'admin',
    },
    {
      name: 'Aisha Khan',
      email: 'aisha.khan@communityconnect.local',
      role: 'user',
    },
    {
      name: 'Bilal Ahmed',
      email: 'bilal.ahmed@communityconnect.local',
      role: 'user',
    },
  ];

  for (const user of users) {
    await pool.query(
      `INSERT INTO users (name, email, password_hash, role, email_verified_at)
       VALUES ($1, $2, $3, $4, now())
       ON CONFLICT (email) DO NOTHING`,
      [user.name, user.email, passwordHash, user.role]
    );
  }

  const categories = ['Cleanup Drive', 'Fundraiser', 'Awareness Campaign'];

  for (const name of categories) {
    await pool.query(
      `INSERT INTO event_categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING`,
      [name]
    );
  }

  logger.info('Seed complete: 1 admin, 2 users, 3 event categories.');
  logger.info(`All seeded accounts share the password: ${SEED_PASSWORD} (change before real use).`);
}

seed()
  .catch((err) => {
    logger.error(`Seeding failed: ${err.message}`);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
