import type { GarmentType } from "@/lib/store"

/**
 * Flat technical-drawing garments, filled with the product colour.
 * Used as the placeholder until real product photography is added.
 */
const STROKE = "rgba(13,13,13,0.38)"

function Shape({ type }: { type: GarmentType }) {
  switch (type) {
    case "tee":
    case "longsleeve": {
      const long = type === "longsleeve"
      return (
        <>
          <path d={long ? "M80 34 Q120 62 160 34 L206 56 L228 232 L200 238 L172 108 L170 250 L70 250 L68 108 L40 238 L12 232 L34 56 Z" : "M80 34 Q120 62 160 34 L214 64 L194 104 L170 92 L170 250 L70 250 L70 92 L46 104 L26 64 Z"} />
          <path d="M92 33 Q120 58 148 33" fill="none" />
          {long && <path d="M16 214 L38 220 M224 214 L202 220" fill="none" />}
        </>
      )
    }
    case "hoodie":
    case "zip":
    case "sweat": {
      return (
        <>
          <path d="M82 40 Q120 62 158 40 L204 62 L226 232 L198 238 L172 112 L170 250 L70 250 L68 112 L42 238 L14 232 L36 62 Z" />
          {type !== "sweat" && <path d="M84 42 C86 4 154 4 156 42 Q120 66 84 42 Z" />}
          {type === "sweat" && <path d="M90 40 Q120 70 150 40" fill="none" />}
          {type === "zip" && <path d="M120 64 L120 250" fill="none" />}
          {type === "hoodie" && <path d="M82 188 L158 188 L168 232 L72 232 Z M108 66 L106 108 M132 66 L134 108" fill="none" />}
          <path d="M70 238 L170 238 M18 218 L42 224 M222 218 L198 224" fill="none" />
        </>
      )
    }
    case "jogger":
    case "cargo":
    case "straight":
    case "wide": {
      const d = {
        jogger: "M78 26 L162 26 L172 120 L156 250 L124 250 L120 100 L116 250 L84 250 L68 120 Z",
        cargo: "M72 26 L168 26 L182 252 L128 252 L120 98 L112 252 L58 252 Z",
        straight: "M74 26 L166 26 L178 252 L126 252 L120 98 L114 252 L62 252 Z",
        wide: "M68 26 L172 26 L210 252 L132 252 L120 96 L108 252 L30 252 Z",
      }[type]
      return (
        <>
          <path d={d} />
          <path d="M72 42 L168 42" fill="none" />
          <path d="M120 42 L120 98" fill="none" />
          {type === "cargo" && <path d="M64 150 L96 150 L96 186 L62 186 Z M176 150 L144 150 L144 186 L178 186 Z" fill="none" />}
          {type === "jogger" && <path d="M84 232 L116 232 M124 232 L156 232" fill="none" />}
          {type === "wide" && <path d="M92 42 L96 120 M148 42 L144 120" fill="none" />}
        </>
      )
    }
    case "shorts":
      return (
        <>
          <path d="M70 58 L170 58 L182 172 L126 172 L120 108 L114 172 L58 172 Z" />
          <path d="M72 74 L168 74 M120 74 L120 108" fill="none" />
        </>
      )
    case "coach":
    case "bomber":
    case "puffer": {
      return (
        <>
          <path d="M84 36 Q120 56 156 36 L206 58 L228 238 L198 244 L172 116 L170 252 L70 252 L68 116 L42 244 L12 238 L34 58 Z" />
          <path d={type === "puffer" ? "M84 36 L84 24 Q120 12 156 24 L156 36 Q120 56 84 36 Z" : "M84 36 Q120 56 156 36 L156 26 Q120 42 84 26 Z"} />
          <path d="M120 54 L120 252" fill="none" />
          {type === "bomber" && <path d="M70 232 L170 232 M18 222 L42 228 M222 222 L198 228" fill="none" />}
          {type === "puffer" && <path d="M70 100 L170 100 M70 150 L170 150 M70 200 L170 200 M42 112 L22 108 M198 112 L218 108" fill="none" />}
          {type === "coach" && <path d="M82 150 L104 150 M136 150 L158 150" fill="none" />}
        </>
      )
    }
    case "beanie":
      return (
        <>
          <path d="M62 176 Q60 58 120 56 Q180 58 178 176 Z" />
          <path d="M56 176 L184 176 L184 214 L56 214 Z" />
          <path d="M84 70 L84 176 M102 62 L102 176 M120 58 L120 176 M138 62 L138 176 M156 70 L156 176 M70 190 L170 190 M70 202 L170 202" fill="none" />
        </>
      )
    case "cap":
      return (
        <>
          <path d="M52 168 Q50 76 132 74 Q206 74 208 168 Z" />
          <path d="M196 166 Q238 166 246 186 L132 186 L132 166 Z" />
          <path d="M132 76 L132 168 M92 90 Q96 130 100 168 M172 90 Q168 130 164 168" fill="none" />
        </>
      )
    case "tote":
      return (
        <>
          <path d="M52 96 L188 96 L196 248 L44 248 Z" />
          <path d="M86 98 Q84 30 120 30 Q156 30 154 98" fill="none" />
          <path d="M60 120 L180 120" fill="none" />
        </>
      )
    case "socks":
      return (
        <>
          <path d="M70 34 L112 34 L112 156 Q160 164 176 202 L176 232 L56 232 L62 170 Z" />
          <path d="M70 52 L112 52 M70 60 L112 60" fill="none" />
          <path d="M132 40 L168 40 L168 140 Q204 150 214 184 L214 210" fill="none" opacity="0.5" />
        </>
      )
  }
}

export function Garment({ type, color, className }: { type: GarmentType; color: string; className?: string }) {
  return (
    <svg viewBox="0 0 240 280" className={className} fill={color} stroke={STROKE} strokeWidth={1.4} strokeLinejoin="round" strokeLinecap="round" aria-hidden>
      <Shape type={type} />
    </svg>
  )
}
