import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/supabase";
import {
  MANAGED_IMAGE_BUCKETS,
  MANAGED_IMAGE_RPC,
  parseManagedImageFinalization,
  parseManagedImageReservation,
  type ManagedImageBucket,
  type ManagedImageFinalization,
} from "./image-lifecycle";
import { validateImageUpload } from "./image-utils";

type ManagedImageUploadStage = "validation" | "reserve" | "upload" | "finalize";
type ManagedImageUploadState = "not_attempted" | "unknown" | "confirmed";

export class ManagedImageUploadError extends Error {
  constructor(
    readonly stage: ManagedImageUploadStage,
    readonly uploadState: ManagedImageUploadState,
    cause: unknown,
  ) {
    super(`Managed image ${stage} failed.`, { cause });
    this.name = "ManagedImageUploadError";
  }
}

// The caller supplies its authenticated, cookie-scoped client. This helper
// neither constructs a privileged client nor falls back to an unmanaged key.
export async function uploadManagedImage(
  supabase: Pick<SupabaseClient<Database>, "rpc" | "storage">,
  options: { ownerId: string; bucketId: string; file: unknown },
): Promise<ManagedImageFinalization> {
  let stage: ManagedImageUploadStage = "validation";
  let uploadState: ManagedImageUploadState = "not_attempted";
  try {
    const validation = await validateImageUpload(options.file);
    if (!validation.valid) {
      throw new Error(`Invalid image: ${validation.error}`);
    }
    if (!MANAGED_IMAGE_BUCKETS.some((bucket) => bucket === options.bucketId)) {
      throw new Error("Unsupported managed image bucket");
    }
    const bucketId = options.bucketId as ManagedImageBucket;

    stage = "reserve";
    const { data: reserveData, error: reserveError } = await supabase.rpc(
      MANAGED_IMAGE_RPC.reserve,
      { p_bucket_id: bucketId, p_extension: validation.extension },
    );
    if (reserveError) {
      throw reserveError;
    }
    const reservation = parseManagedImageReservation(reserveData, {
      ownerId: options.ownerId,
      bucketId,
      extension: validation.extension,
    });
    if (!reservation) {
      throw new Error("Invalid managed image reservation");
    }

    stage = "upload";
    const storage = supabase.storage.from(reservation.bucket_id);
    // Any unacknowledged Storage operation may have committed. Never infer
    // absence from a rejection/timeout and never remove an object on rollback.
    uploadState = "unknown";
    const { data: uploadData, error: uploadError } = await storage.upload(
      reservation.object_path,
      validation.file,
      {
        contentType: validation.contentType,
        cacheControl: "3600",
        upsert: false,
      },
    );
    if (uploadError || uploadData?.path !== reservation.object_path) {
      throw uploadError ?? new Error("Storage upload was not acknowledged");
    }
    uploadState = "confirmed";

    stage = "finalize";
    const { data: finalizeData, error: finalizeError } = await supabase.rpc(
      MANAGED_IMAGE_RPC.finalize,
      { p_asset_id: reservation.asset_id },
    );
    if (finalizeError) {
      throw finalizeError;
    }
    const finalization = parseManagedImageFinalization(
      finalizeData,
      reservation,
    );
    if (!finalization) {
      throw new Error("Invalid managed image finalization");
    }
    return finalization;
  } catch (cause) {
    throw new ManagedImageUploadError(stage, uploadState, cause);
  }
}
