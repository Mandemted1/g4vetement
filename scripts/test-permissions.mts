/** Checks the staff permission matrix, and that the app and the database agree on it.   npm run test-permissions */
import pg from "pg"
import { CAPS, CAP_LABEL, ROLES, ROLE_INFO, capsOf, deniedMessage, isRole, roleCan, type Cap, type Role } from "../src/lib/permissions"

const ok = (name: string, cond: boolean, extra = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name} ${extra}`)
  if (!cond) process.exitCode = 1
}

// ---- the rules as designed
ok("four roles", ROLES.join() === "owner,manager,fulfilment,viewer")
ok("an owner can do everything", CAPS.every((c) => roleCan("owner", c)))
ok("a manager can do everything except settings and the team", CAPS.every((c) => roleCan("manager", c) === !["settings.manage", "staff.manage"].includes(c)))
ok("fulfilment can only manage orders", CAPS.every((c) => roleCan("fulfilment", c) === (c === "orders.manage")))
ok("a viewer can only look at analytics (and nothing can be changed)", CAPS.every((c) => roleCan("viewer", c) === (c === "analytics.view")))
ok("only an owner can manage the team or settings", ROLES.filter((r) => roleCan(r, "staff.manage")).join() === "owner" && ROLES.filter((r) => roleCan(r, "settings.manage")).join() === "owner")
ok("nobody below owner can export or import by accident: export is owner and manager only", ROLES.filter((r) => roleCan(r, "data.export")).join() === "owner,manager")
ok("someone who isn't on the team can do nothing", CAPS.every((c) => !roleCan(null, c) && !roleCan(undefined, c)) && capsOf(null).length === 0)
ok("a made-up role can do nothing", !roleCan("admin" as Role, "orders.manage") && !isRole("admin") && isRole("manager") && !isRole(undefined))
ok("every role has a label and summary, and every permission a plain-English name", ROLES.every((r) => ROLE_INFO[r].label.length > 2 && ROLE_INFO[r].summary.length > 20) && CAPS.every((c) => CAP_LABEL[c].length > 3))
ok("the 'not allowed' message names what they tried", /manage the team/.test(deniedMessage("staff.manage")) && /ask an owner/i.test(deniedMessage("orders.manage")))

// ---- the database enforces the same matrix
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  const diffs: string[] = []
  for (const role of ROLES) for (const cap of CAPS) {
    const db = (await c.query("select role_can($1, $2) as v", [role, cap])).rows[0].v as boolean
    if (db !== roleCan(role, cap as Cap)) diffs.push(`${role}/${cap}: app ${roleCan(role, cap as Cap)} db ${db}`)
  }
  ok(`the database agrees with the app on all ${ROLES.length * CAPS.length} role and permission pairs`, diffs.length === 0, diffs.join("; "))
  ok("the database also refuses unknown roles and nulls", (await c.query("select role_can('hacker', 'orders.manage') as a, role_can(null, 'orders.manage') as b")).rows[0].a === false)
  const roles = (await c.query("select pg_get_constraintdef(oid) as d from pg_constraint where conname = 'admins_role_check'")).rows[0]?.d as string
  ok("the database only accepts these four roles", ROLES.every((r) => roles.includes(`'${r}'`)), roles)
} finally {
  await c.end()
}
