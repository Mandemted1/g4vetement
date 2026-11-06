import type { GarmentType } from "./data"

/**
 * Demo-mode copy + spec sheet per product, and the source for `npm run seed`.
 * Once Supabase is connected, this text lives in the database and is edited from the admin.
 */
export const META: Record<string, { type: GarmentType; desc: string; fabric: string; fit: string }> = {
  p01: { type: "tee", desc: "The everyday tee, cut from dense jersey that holds its shape wash after wash.", fabric: "100% cotton, 240 gsm", fit: "Relaxed. True to size." },
  p02: { type: "tee", desc: "Boxy through the body with a dropped shoulder and a quiet front graphic.", fabric: "100% cotton, 220 gsm", fit: "Boxy. Size down for a closer fit." },
  p03: { type: "tee", desc: "Oversized pocket tee with a single chest pocket and a ribbed collar.", fabric: "100% cotton, 230 gsm", fit: "Oversized. True to size for the intended drape." },
  p04: { type: "longsleeve", desc: "Long sleeve in a fine rib that sits close without clinging.", fabric: "95% cotton, 5% elastane rib", fit: "Slim. Size up for a looser fit." },
  p05: { type: "hoodie", desc: "Heavyweight pullover with a double-lined hood and a brushed back.", fabric: "100% cotton fleece, 400 gsm", fit: "Regular. True to size." },
  p06: { type: "zip", desc: "Full-zip hoodie with a metal zip and ribbed cuffs and hem.", fabric: "100% cotton fleece, 380 gsm", fit: "Regular. True to size." },
  p07: { type: "sweat", desc: "Clean crewneck with a flat-lock seam and nothing on the chest.", fabric: "100% cotton terry, 360 gsm", fit: "Relaxed. True to size." },
  p08: { type: "jogger", desc: "Fleece joggers with a tapered leg, ribbed ankle and deep pockets.", fabric: "100% cotton fleece, 340 gsm", fit: "Tapered. True to size." },
  p09: { type: "cargo", desc: "Utility cargos with articulated knees and four pockets.", fabric: "Cotton ripstop", fit: "Relaxed. True to size." },
  p10: { type: "straight", desc: "Straight-leg denim in a heavy rigid weave.", fabric: "100% cotton denim, 13 oz", fit: "Straight. True to size." },
  p11: { type: "shorts", desc: "Knee-length shorts in a washed cotton twill.", fabric: "100% cotton twill", fit: "Relaxed. True to size." },
  p12: { type: "wide", desc: "Pleated wide-leg trousers with a high rise and a long break.", fabric: "Cotton-wool blend", fit: "Wide. True to size." },
  p13: { type: "coach", desc: "Lightweight coach jacket with snap placket and an unlined body.", fabric: "Water-resistant nylon", fit: "Regular. True to size." },
  p14: { type: "bomber", desc: "Varsity bomber with a ribbed collar, cuffs and hem.", fabric: "Wool-blend body, rib trims", fit: "Boxy. True to size." },
  p15: { type: "puffer", desc: "Quilted puffer with a high collar and a matte shell.", fabric: "Recycled nylon, synthetic fill", fit: "Roomy. True to size." },
  p16: { type: "beanie", desc: "Ribbed knit beanie that folds once or twice.", fabric: "100% acrylic rib", fit: "One size." },
  p17: { type: "cap", desc: "Unstructured six-panel cap with an adjustable strap.", fabric: "100% cotton twill", fit: "One size, adjustable." },
  p18: { type: "tote", desc: "Heavy canvas tote with reinforced handles and an inner pocket.", fabric: "100% cotton canvas, 12 oz", fit: "38 x 40 cm." },
  p19: { type: "socks", desc: "Three pairs of cushioned crew socks.", fabric: "80% cotton, 18% nylon, 2% elastane", fit: "One size, fits US 7–12." },
}
