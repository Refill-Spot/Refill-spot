export const MAX_IMAGE_UPLOAD_BYTES = 5 * 1024 * 1024;

type ImageUploadFormData =
  | { valid: true; formData: FormData }
  | { valid: false; error: "invalid_request" | "body_too_large" };

export async function readImageUploadFormData(
  request: Request,
  maxFiles: number,
): Promise<ImageUploadFormData> {
  const contentType = request.headers.get("content-type");
  const contentLength = request.headers.get("content-length");
  const maxBytes = MAX_IMAGE_UPLOAD_BYTES * maxFiles + 64 * 1024;
  if (
    !contentType ||
    contentType.split(";")[0].trim().toLowerCase() !== "multipart/form-data" ||
    !request.body ||
    request.bodyUsed ||
    request.body.locked
  ) {
    return { valid: false, error: "invalid_request" };
  }
  if (
    contentLength !== null &&
    (!/^\d+$/.test(contentLength) ||
      !Number.isSafeInteger(Number(contentLength)))
  ) {
    return { valid: false, error: "invalid_request" };
  }
  if (contentLength !== null && Number(contentLength) > maxBytes) {
    return { valid: false, error: "body_too_large" };
  }

  const reader = request.body.getReader();
  let receivedBytes = 0;
  let tooLarge = false;
  const boundedBody = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      receivedBytes += value.byteLength;
      if (receivedBytes > maxBytes) {
        tooLarge = true;
        controller.error(new Error("Upload body exceeds the size limit"));
        return;
      }
      controller.enqueue(value);
    },
  });

  try {
    const formData = await new Response(boundedBody, {
      headers: { "content-type": contentType },
    }).formData();
    if (contentLength !== null && receivedBytes !== Number(contentLength)) {
      return { valid: false, error: "invalid_request" };
    }
    return { valid: true, formData };
  } catch {
    return {
      valid: false,
      error: tooLarge ? "body_too_large" : "invalid_request",
    };
  } finally {
    try {
      await reader.cancel();
    } catch {
      // A failed request stream is already closed and needs no further cleanup.
    }
    reader.releaseLock();
  }
}

type ImageUploadValidation =
  | {
      valid: true;
      file: File;
      contentType: "image/jpeg" | "image/png" | "image/webp";
      extension: "jpg" | "png" | "webp";
    }
  | {
      valid: false;
      error:
        | "invalid_file"
        | "unsupported_type"
        | "invalid_size"
        | "invalid_content";
    };

export async function validateImageUpload(
  value: unknown,
): Promise<ImageUploadValidation> {
  if (
    !(value instanceof Blob) ||
    !("name" in value) ||
    typeof value.name !== "string" ||
    !value.name
  ) {
    return { valid: false, error: "invalid_file" };
  }

  const file = value as File;
  const contentType = file.type === "image/jpg" ? "image/jpeg" : file.type;
  if (
    contentType !== "image/jpeg" &&
    contentType !== "image/png" &&
    contentType !== "image/webp"
  ) {
    return { valid: false, error: "unsupported_type" };
  }
  if (file.size === 0 || file.size > MAX_IMAGE_UPLOAD_BYTES) {
    return { valid: false, error: "invalid_size" };
  }

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer());
  } catch {
    return { valid: false, error: "invalid_content" };
  }

  const matchesType =
    contentType === "image/jpeg"
      ? bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      : contentType === "image/png"
        ? bytes.length >= 8 &&
          [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
            (byte, index) => bytes[index] === byte,
          )
        : bytes.length >= 12 &&
          bytes[0] === 0x52 &&
          bytes[1] === 0x49 &&
          bytes[2] === 0x46 &&
          bytes[3] === 0x46 &&
          bytes[8] === 0x57 &&
          bytes[9] === 0x45 &&
          bytes[10] === 0x42 &&
          bytes[11] === 0x50;

  if (!matchesType) {
    return { valid: false, error: "invalid_content" };
  }

  const extension =
    contentType === "image/jpeg"
      ? "jpg"
      : contentType === "image/png"
        ? "png"
        : "webp";
  return { valid: true, file, contentType, extension };
}

export function getOwnedProfileImagePath(
  avatarUrl: unknown,
  userId: string,
  bucketPublicUrl: string,
): string | null {
  if (typeof avatarUrl !== "string" || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return null;
  }

  try {
    const url = new URL(avatarUrl);
    const bucketUrl = new URL(bucketPublicUrl);
    const prefix = `${bucketUrl.pathname.replace(/\/$/, "")}/${userId}/`;
    if (
      url.origin !== bucketUrl.origin ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.startsWith(prefix)
    ) {
      return null;
    }

    const fileName = url.pathname.slice(prefix.length);
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpe?g|png|webp)$/i.test(
        fileName,
      )
    ) {
      return null;
    }

    return `${userId}/${fileName}`;
  } catch {
    return null;
  }
}

/**
 * Supabase Image Transform Options
 */
interface ImageTransformOptions {
  width?: number;
  height?: number;
  quality?: number; // 1-100
  resize?: "cover" | "contain" | "fill";
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
  options: ImageTransformOptions = {},
): string {
  // During build time or server-side rendering, return original URL
  if (typeof window === "undefined") {
    return originalUrl;
  }

  try {
    // Default thumbnail settings optimized for store list
    const defaultOptions: ImageTransformOptions = {
      width: 200,
      height: 150,
      quality: 80,
      resize: "cover",
    };

    const finalOptions = { ...defaultOptions, ...options };

    // Clean the URL by removing query parameters
    const cleanUrl = originalUrl.split("?")[0];

    // Parse the Supabase storage URL to extract bucket and file path
    const url = new URL(cleanUrl);
    const pathParts = url.pathname.split("/").filter((part) => part); // Remove empty parts

    // Expected structure: ['storage', 'v1', 'object', 'public', 'bucket-name', 'file-path']
    const storageIndex = pathParts.indexOf("storage");
    const publicIndex = pathParts.indexOf("public");

    if (storageIndex === -1 || publicIndex === -1) {
      console.warn("Unexpected Supabase URL structure:", originalUrl);
      return originalUrl;
    }

    const bucket = pathParts[publicIndex + 1];
    const filePathParts = pathParts.slice(publicIndex + 2);
    const filePath = filePathParts ? filePathParts.join("/") : "";

    if (!bucket || !filePath) {
      console.warn(
        "Could not extract bucket or file path from URL:",
        originalUrl,
      );
      return originalUrl;
    }

    // Public transformation URLs do not need a browser client or authentication.
    const storageUrl = new URL(
      process.env.NEXT_PUBLIC_SUPABASE_URL || url.origin,
    );
    storageUrl.pathname = `/storage/v1/render/image/public/${bucket}/${filePath}`;
    storageUrl.search = "";
    storageUrl.hash = "";
    for (const option of ["width", "height", "resize", "quality"] as const) {
      const value = finalOptions[option];
      if (value) {
        storageUrl.searchParams.set(option, String(value));
      }
    }

    return storageUrl.toString();
  } catch (error) {
    console.error("Error generating thumbnail URL:", error);
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
    resize: "cover",
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
    resize: "cover",
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
    resize: "cover",
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
export function shouldBeUnoptimized(
  width?: number,
  height?: number,
  src?: string,
): boolean {
  // Static images and placeholders should be unoptimized
  if (
    src &&
    (src.startsWith("/") || // Static files from public folder
      src.includes("placeholder") ||
      src.includes("icon") ||
      src.includes(".svg"))
  ) {
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
