/**
 * Product photos. To use your own, drop files in /public/products and map them here by product id.
 * A product can have one image or several (first = main, the rest appear in the gallery).
 * Products without an entry fall back to a drawn garment in the product's colour.
 * Current photos are free-to-use Unsplash stock (Unsplash License) standing in for real brand shots.
 */
export const PRODUCT_IMAGES: Record<string, string | string[]> = {
  p05: "/products/p05.jpg", // Classic Pullover Hoodie
  p06: "/products/p06.jpg", // Zip-Up Hoodie
  p09: "/products/p09.jpg", // Utility Cargo Pants
  p10: "/products/p10.jpg", // Straight Fit Denim
  p12: "/products/p12.jpg", // Wide Leg Trousers
  p19: "/products/p19.jpg", // Crew Socks 3-Pack
}

export const getImages = (id: string): string[] => {
  const v = PRODUCT_IMAGES[id]
  return !v ? [] : Array.isArray(v) ? v : [v]
}
