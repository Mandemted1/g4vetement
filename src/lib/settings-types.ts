export interface LoginSettings {
  /** image URL (Cloudinary recommended); empty = plain background */
  image: string
  /** 0–0.9, how dark the layer over the image is */
  overlay: number
  layout: "full" | "split"
  tagline: string
}

export const DEFAULT_LOGIN: LoginSettings = {
  image: "",
  overlay: 0.5,
  layout: "full",
  tagline: "Sign in to manage orders, products and customers.",
}
