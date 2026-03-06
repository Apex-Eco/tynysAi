import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "../lib/db/schema";

dotenv.config({ path: ".env.local" });
dotenv.config();

async function main() {
  const args = process.argv.slice(2);
  const emailArgIndex = args.findIndex((a) => a === "--email" || a === "-e");
  const passArgIndex = args.findIndex((a) => a === "--password" || a === "-p");

  const email =
    (emailArgIndex >= 0 && args[emailArgIndex + 1]) || process.env.OWNER_EMAIL;
  const password =
    (passArgIndex >= 0 && args[passArgIndex + 1]) || process.env.NEW_PASSWORD;

  if (!email) {
    console.error("Provide --email or set OWNER_EMAIL env var");
    process.exit(2);
  }
  if (!password) {
    console.error("Provide --password or set NEW_PASSWORD env var");
    process.exit(2);
  }

  const connectionString = process.env.DATABASE_URL ?? process.env.DB_URL;
  if (!connectionString) {
    console.error("DATABASE_URL/DB_URL is not set. Add it to .env.local or environment variables.");
    process.exit(2);
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  try {
    const users = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (users.length === 0) {
      console.error(`No user found for ${email}`);
      process.exit(1);
    }

    const hash = await bcrypt.hash(password, 12);

    await db
      .update(schema.users)
      .set({ password: hash })
      .where(eq(schema.users.email, email));

    console.log(`Password updated for ${email}`);
  } finally {
    await pool.end();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
