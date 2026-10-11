export const REVIEW_IMAGES_BUCKET =
  process.env.SUPABASE_STORAGE_BUCKET_REVIEW_IMAGES || "review-images";

const GENERATED_IMAGE_NAME =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/;

function getUserBucketImagePath(
  imageUrl: unknown,
  userId: string,
  bucketPublicUrl: string,
): string | null {
  if (typeof imageUrl !== "string" || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    return null;
  }

  try {
    const bucketUrl = new URL(bucketPublicUrl);
    if (
      !["https:", "http:"].includes(bucketUrl.protocol) ||
      bucketUrl.username ||
      bucketUrl.password ||
      bucketUrl.search ||
      bucketUrl.hash
    ) {
      return null;
    }
    const prefix = `${bucketUrl.origin}${bucketUrl.pathname.replace(/\/$/, "")}/${userId}/`;
    if (!imageUrl.startsWith(prefix)) {
      return null;
    }
    const fileName = imageUrl.slice(prefix.length);
    // Match the literal URL, not a normalized URL that could hide traversal,
    // credentials, query strings, encoded separators or a different origin.
    if (!/^[a-zA-Z0-9_-]+\.(?:jpe?g|png|webp|gif)$/i.test(fileName)) {
      return null;
    }
    return `${userId}/${fileName}`;
  } catch {
    return null;
  }
}

export function getOwnedReviewImagePath(
  imageUrl: unknown,
  userId: string,
  bucketPublicUrl: string,
): string | null {
  const path = getUserBucketImagePath(imageUrl, userId, bucketPublicUrl);
  return path && GENERATED_IMAGE_NAME.test(path.slice(userId.length + 1))
    ? path
    : null;
}

export function validateReviewImageUrls(
  imageUrls: unknown,
  userId: string,
  bucketPublicUrl: string,
  previousImageUrls: unknown = [],
): { valid: true; imageUrls: string[] } | { valid: false } {
  if (imageUrls === undefined) {
    return { valid: true, imageUrls: [] };
  }
  if (!Array.isArray(imageUrls) || imageUrls.length > 5) {
    return { valid: false };
  }
  const previous = new Set(
    Array.isArray(previousImageUrls) ? previousImageUrls : [],
  );
  const validated: string[] = [];
  for (const imageUrl of imageUrls) {
    if (
      !getOwnedReviewImagePath(imageUrl, userId, bucketPublicUrl) &&
      !(
        previous.has(imageUrl) &&
        getUserBucketImagePath(imageUrl, userId, bucketPublicUrl)
      )
    ) {
      return { valid: false };
    }
    validated.push(imageUrl);
  }
  return { valid: true, imageUrls: validated };
}

export async function verifyNewReviewImages(
  imageUrls: string[],
  previousImageUrls: unknown,
  userId: string,
  bucketPublicUrl: string,
  storage: {
    info: (path: string) => Promise<{ data: unknown; error: unknown }>;
  },
): Promise<boolean> {
  const previous = new Set(
    Array.isArray(previousImageUrls) ? previousImageUrls : [],
  );
  for (const imageUrl of new Set(imageUrls)) {
    if (previous.has(imageUrl)) {
      continue;
    }
    const path = getOwnedReviewImagePath(imageUrl, userId, bucketPublicUrl);
    if (!path) {
      return false;
    }
    try {
      const { data, error } = await storage.info(path);
      if (error || !data || typeof data !== "object" || Array.isArray(data)) {
        return false;
      }
      const file = data as Record<string, unknown>;
      if (
        typeof file.id !== "string" ||
        !file.id ||
        file.name !== path ||
        file.bucketId !== REVIEW_IMAGES_BUCKET
      ) {
        return false;
      }
      // Info normally omits ownership. Use only authoritative top-level owner
      // fields when available, never uploader-controlled custom metadata.
      for (const key of ["owner", "ownerId", "owner_id"]) {
        if (Object.hasOwn(file, key) && file[key] !== userId) {
          return false;
        }
      }
      // In the usual owner-less response, authorization rests on the verified
      // identity and strict server-generated user namespace. Storage RLS must
      // separately prohibit cross-user uploads/overwrites in that namespace.
    } catch {
      return false;
    }
  }
  return true;
}

export function getReviewImageCleanup(
  previousImageUrls: unknown,
  persistedImageUrls: unknown,
  userId: string,
  bucketPublicUrl: string,
) {
  const ownedPaths = (value: unknown) =>
    new Set(
      (Array.isArray(value) ? value : [])
        .map((url) => getOwnedReviewImagePath(url, userId, bucketPublicUrl))
        .filter((path): path is string => path !== null),
    );
  const persisted = ownedPaths(persistedImageUrls);
  const detached = [...ownedPaths(previousImageUrls)].filter(
    (path) => !persisted.has(path),
  );
  if (detached.length === 0) {
    return { status: "not_needed" as const, count: 0 };
  }

  // A cookie/RLS-scoped SELECT cannot prove absence of global references, and
  // SELECT then Storage.remove races with reattachment. Until a DB-coordinated
  // cleanup protocol protects both, keep the files and report the pending work.
  return {
    status: "deferred" as const,
    count: detached.length,
    reason: "atomic_cleanup_unavailable" as const,
  };
}
