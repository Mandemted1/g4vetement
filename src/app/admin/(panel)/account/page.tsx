import { MyAccount } from "@/components/team/my-account"
import { requireStaff } from "@/lib/auth"

export const metadata = { title: "My account" }

export default async function Page() {
  const me = await requireStaff()
  return <MyAccount email={me?.email ?? "demo"} role={me?.role ?? "owner"} />
}
