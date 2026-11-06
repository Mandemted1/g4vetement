/**
 * Applies the SQL files in /supabase to your database.   Run: npm run migrate
 *
 * Needs DATABASE_URL in .env.local (Supabase > Connect > "Session pooler" connection string,
 * with your database password filled in). Every file is idempotent, so re-running is safe.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import pg from "pg"

const url = process.env.DATABASE_URL
if (!url) {
  console.error("DATABASE_URL is missing in .env.local (Supabase > Connect > Session pooler URI).")
  process.exit(1)
}

const dir = join(process.cwd(), "supabase")
const files = readdirSync(dir).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort()
// schema.sql (the original) first, then numbered migrations
const order = ["schema.sql", ...files]

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  for (const f of order) {
    const sql = readFileSync(join(dir, f), "utf8")
    process.stdout.write(`→ ${f} … `)
    await client.query(sql)
    console.log("ok")
  }
  await client.query("notify pgrst, 'reload schema'") // make the API see new functions immediately
  console.log("Done. Schema cache reloaded.")
} catch (e) {
  console.error("\nFailed:", (e as Error).message)
  process.exitCode = 1
} finally {
  await client.end()
}
