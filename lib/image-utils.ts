import { supabaseBrowser } from "@/lib/supabase/client";

const STORE_IMAGES_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET_STORE_IMAGES || "store-images";

/**
 * Supabase Image Transform Options
 */
interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  format?: 'webp' | 'jpeg' | 'png';
  resize?: 'cover' | 'contain' | 'fill';
}

/**
 * Generate optimized thumbnail URL using Supabase image transformations
 * This reduces Vercel Image Transformations usage by using Supabase's built-in optimization
 * 
 * @param originalUrl - The original image URL from Supabase storage
 * @param options - Transform options for generating thumbnails
 * @returns Optimized image URL with Supabase transforms applied
 */
export function generateThumbnailUrl(
  originalUrl: string, 
  options: ImageTransformOptions = {}
): string {
  try {
    // Default thumbnail settings optimized for store list
    const defaultOptions: ImageTransformOptions = {
      width: 200,
      height: 150, 
      quality: 80,
      format: 'webp',
      resize: 'cover'
    };

    const finalOptions = { ...defaultOptions, ...options };
    
    // Clean the URL by removing query parameters
    const cleanUrl = originalUrl.split('?')[0];
    
    // Parse the Supabase storage URL to extract bucket and file path
    const url = new URL(cleanUrl);
    const pathParts = url.pathname.split('/').filter(part => part); // Remove empty parts
    
    // Expected structure: ['storage', 'v1', 'object', 'public', 'bucket-name', 'file-path']
    const storageIndex = pathParts.indexOf('storage');
    const publicIndex = pathParts.indexOf('public');
    
    if (storageIndex === -1 || publicIndex === -1) {
      console.warn('Unexpected Supabase URL structure:', originalUrl);
      return originalUrl;
    }

    const bucket = pathParts[publicIndex + 1];
    const filePath = pathParts.slice(publicIndex + 2).join('/');

    if (!bucket || !filePath) {
      console.warn('Could not extract bucket or file path from URL:', originalUrl);
      return originalUrl;
    }

    // Use Supabase client to generate public URL with transforms
    const { data } = supabaseBrowser.storage
      .from(bucket)
      .getPublicUrl(filePath, {
        transform: {
          width: finalOptions.width,
          height: finalOptions.height,
          quality: finalOptions.quality,
          format: finalOptions.format,
          resize: finalOptions.resize
        }
      });

    return data.publicUrl;
  } catch (error) {
    console.error('Error generating thumbnail URL:', error);
    // Fallback to original URL if transformation fails
    return originalUrl;
  }
}

/**
 * Generate store list thumbnail (small, optimized for list view)
 */
export function generateStoreListThumbnail(originalUrl: string): string {
  return generateThumbnailUrl(originalUrl, {
    width: 120,
    height: 120,
    quality: 75,
    format: 'webp',
    resize: 'cover'
  });
}

/**
 * Generate store detail thumbnail (medium, optimized for carousel)
 */
export function generateStoreDetailThumbnail(originalUrl: string): string {
  return generateThumbnailUrl(originalUrl, {
    width: 800,
    height: 400,
    quality: 85,
    format: 'webp',
    resize: 'cover'
  });
}

/**
 * Generate profile avatar thumbnail
 */
export function generateProfileThumbnail(originalUrl: string): string {
  return generateThumbnailUrl(originalUrl, {
    width: 80,
    height: 80,
    quality: 80,
    format: 'webp',
    resize: 'cover'
  });
}

/**
 * Check if URL is a Supabase storage URL that can be transformed
 * Note: Supabase image transforms require Pro plan, so we'll disable for now
 */
export function canTransformImage(url: string): boolean {
  // Disabled because Supabase image transforms require Pro plan
  return false;
}

/**
 * Check if an image should be unoptimized based on size or type
 * Strategy: Only unoptimize very small images and static assets
 * Large images use Vercel optimization with 31-day cache (set in next.config.mjs)
 */
export function shouldBeUnoptimized(width?: number, height?: number, src?: string): boolean {
  // Static images and placeholders should be unoptimized
  if (src && (
    src.startsWith('/') || // Static files from public folder
    src.includes('placeholder') ||
    src.includes('icon') ||
    src.includes('.svg')
  )) {
    return true;
  }

  // Only very small thumbnails should be unoptimized (under 80px)
  // This includes review thumbnails, preview images, etc.
  if (width && height && width <= 80 && height <= 80) {
    return true;
  }

  // Store list images (96px) and larger should use Vercel optimization
  // with 31-day cache for better quality and reduced transform count
  return false;
}