"use client"

import Image, { type ImageLoaderProps, type ImageProps } from "next/image"
import { cloudinaryUrl, isCloudinary } from "@/lib/images"

/**
 * next/image that lets Cloudinary resize and crop its own images; everything else uses Next's optimiser.
 * `ar` sets the crop shape for Cloudinary images (default 4:5, `false` keeps the original shape).
 */
export function SmartImage({ ar, ...props }: ImageProps & { ar?: string | false }) {
  const src = typeof props.src === "string" ? props.src : ""
  const loader = ({ src: s, width }: ImageLoaderProps) => cloudinaryUrl(s, { w: width, ar })
  // eslint-disable-next-line jsx-a11y/alt-text
  return <Image {...props} loader={isCloudinary(src) ? loader : undefined} />
}
