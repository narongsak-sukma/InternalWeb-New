/**
 * KB J Capital Intranet — User Seeding Tool
 *
 * Creates (or resets) the administrator account in PostgreSQL, and optionally
 * the demo maker/checker/staff accounts for development environments.
 *
 * Usage:
 *   DATABASE_URL="postgresql://user:pass@localhost:5432/kbj_intranet" \
 *     ADMIN_USERNAME=admin ADMIN_PASSWORD='StrongPass!' node scripts/seed-users.js [--demo]
 *
 * - ADMIN_USERNAME defaults to "admin".
 * - ADMIN_PASSWORD: taken from env, or prompted interactively when the
 *   terminal supports it. Re-running the script RESETS the admin password to
 *   the provided value (that is the script's purpose).
 * - --demo additionally creates maker / checker / staff accounts with fixed
 *   development passwords (Maker@KBJ2026! / Checker@KBJ2026! / Staff@KBJ2026!).
 *   Never use --demo in production.
 *
 * Requires the schema to exist (scripts/schema.sql or server boot).
 */

import readline from 'node:readline';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { Client } from 'pg';

const BCRYPT_COST = 12;

const DEMO_USERS = [
  { username: 'maker', password: 'Maker@KBJ2026!', displayName: 'Demo Maker (Author)', email: 'maker.demo@kbjcapital.co.th', role: 'maker' },
  { username: 'checker', password: 'Checker@KBJ2026!', displayName: 'Demo Checker (Compliance)', email: 'checker.demo@kbjcapital.co.th', role: 'checker' },
  { username: 'staff', password: 'Staff@KBJ2026!', displayName: 'Demo Staff (Read-only)', email: 'staff.demo@kbjcapital.co.th', role: 'staff' },
];

function promptForPassword(username) {
  return new Promise((resolve, reject) => {
    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      return reject(new Error(`ADMIN_PASSWORD is not set and the terminal cannot prompt.`));
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.question(`Enter password for admin user "${username}": `, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function upsertUser(client, { username, password, displayName, email, role }) {
  if (!password || password.length < 8) {
    throw new Error(`Password for "${username}" must be at least 8 characters.`);
  }
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const result = await client.query(
    `INSERT INTO users (id, username, password_hash, display_name, email, role, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, true, now())
     ON CONFLICT (username) DO UPDATE SET
       password_hash = EXCLUDED.password_hash,
       display_name = EXCLUDED.display_name,
       email = EXCLUDED.email,
       role = EXCLUDED.role,
       is_active = true
     RETURNING (xmax = 0) AS inserted;`,
    [crypto.randomUUID(), username, passwordHash, displayName, email, role]
  );
  return result.rows[0].inserted ? 'created' : 'updated';
}

async function main() {
  const withDemo = process.argv.includes('--demo');
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log('Usage: node scripts/seed-users.js [--demo]');
    console.log('Env:   DATABASE_URL, ADMIN_USERNAME (default: admin), ADMIN_PASSWORD (prompted if missing)');
    process.exit(0);
  }

  const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/kbj_intranet';
  const username = (process.env.ADMIN_USERNAME || 'admin').trim();

  let password = process.env.ADMIN_PASSWORD || '';
  if (!password) {
    try {
      password = await promptForPassword(username);
    } catch (err) {
      console.error(`Error: ${err.message}`);
      process.exit(1);
    }
  }

  const client = new Client({ connectionString: dbUrl });
  try {
    await client.connect();
    const outcome = await upsertUser(client, {
      username,
      password,
      displayName: 'System Administrator',
      email: 'admin@kbjcapital.co.th',
      role: 'admin',
    });
    console.log(`Admin user "${username}" ${outcome}.`);

    if (withDemo) {
      for (const demo of DEMO_USERS) {
        const result = await upsertUser(client, demo);
        console.log(`Demo user "${demo.username}" (${demo.role}) ${result}.`);
      }
      console.log('Demo passwords: Maker@KBJ2026! / Checker@KBJ2026! / Staff@KBJ2026! (development only).');
    }
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
