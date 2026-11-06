import { TeamView } from "@/components/team/team-view"
import { requireCap } from "@/lib/auth"
import { getTeam } from "@/lib/team"

export const metadata = { title: "Team" }

export default async function Page() {
  const me = await requireCap("staff.manage")
  return <TeamView team={await getTeam()} you={me?.id ?? ""} demo={!me} />
}
