import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: { root: import.meta.dirname },
  async redirects() {
    // short, memorable addresses for the help pages
    return [
      { source: "/faq", destination: "/policies/faq", permanent: false },
      { source: "/size-guide", destination: "/policies/size-guide", permanent: false },
      { source: "/sizing", destination: "/policies/size-guide", permanent: false },
    ]
  },
  images: {
    // product photos uploaded from the admin live in Supabase Storage
    remotePatterns: [{ protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/object/public/**" }],
  },
};

export default nextConfig;
