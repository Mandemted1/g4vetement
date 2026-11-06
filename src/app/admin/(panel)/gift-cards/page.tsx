import { requireCap } from "@/lib/auth"
import { GiftCardsView } from "@/components/gift-cards/gift-cards-view"
import { getGiftCards } from "@/lib/gift-cards"

export const metadata = { title: "Gift cards" }

export default async function Page() {
  await requireCap("giftcards.manage")
  return <GiftCardsView data={await getGiftCards()} />
}
