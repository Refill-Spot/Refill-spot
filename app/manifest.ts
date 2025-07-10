import { MetadataRoute } from 'next'
 
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Refill-spot - 무한리필 가게 찾기',
    short_name: 'Refill-spot',
    description: '주변의 무한리필 가게를 쉽게 찾아보세요',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#f97316',
    icons: [
      {
        src: '/icon',
        sizes: '32x32',
        type: 'image/png',
      },
      {
        src: '/apple-icon',
        sizes: '180x180',
        type: 'image/png',
      },
      {
        src: '/android-chrome-192x192',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/android-chrome-512x512',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
  }
}