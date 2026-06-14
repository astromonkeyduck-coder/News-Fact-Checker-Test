/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // FFmpeg + ffprobe static binaries are native; keep them external to the server bundle.
    serverComponentsExternalPackages: ["fluent-ffmpeg", "ffmpeg-static", "ffprobe-static"],
  },
};

export default nextConfig;
