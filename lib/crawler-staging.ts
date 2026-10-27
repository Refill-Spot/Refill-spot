import { z } from "zod";

const eligibilityStatusSchema = z.enum([
  "confirmed",
  "needs_review",
  "ended",
  "unknown",
]);
const scopeSchema = z.enum(["main_meal", "buffet", "side_refill", "unknown"]);
const nullableString = z.string().nullable();

const sourceUrlSchema = z
  .string()
  .url()
  .refine((value) => {
    if (
      !/^https?:\/\//.test(value) ||
      /[\s\\\u0000-\u001f\u007f]/.test(value) ||
      /^https?:\/\/[^/?#]*@/.test(value)
    ) {
      return false;
    }
    try {
      const url = new URL(value);
      return (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.hostname.length > 0 &&
        url.username === "" &&
        url.password === ""
      );
    } catch {
      return false;
    }
  }, "Source URL must be HTTP(S) without credentials")
  .nullable();

const observedAtSchema = z
  .string()
  .datetime({ offset: true })
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/,
  )
  .refine((value) => Number.isFinite(Date.parse(value)), "Invalid observation time")
  .nullable();

const evidenceSchema = z
  .object({
    text: z.string().min(1),
    kind: z.enum(["menu", "mention", "review"]),
    status: eligibilityStatusSchema,
    scope: scopeSchema,
  })
  .strict();

const offeringSchema = z
  .object({
    name: z.string().min(1),
    price: z.string(),
    scope: z.enum(["main_meal", "buffet", "side_refill"]),
    evidenceText: z.string().min(1),
  })
  .strict();

const eligibilitySchema = z
  .object({
    sourceId: nullableString,
    sourceUrl: sourceUrlSchema,
    observedAt: observedAtSchema,
    status: eligibilityStatusSchema,
    scope: scopeSchema,
    parseStatus: z.enum([
      "parsed",
      "missing_section",
      "parse_error",
      "legacy_unverified",
    ]),
    currentness: z.literal("unverified"),
    evidence: z.array(evidenceSchema),
    conditions: z.array(z.string()),
    offerings: z.array(offeringSchema),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status !== "confirmed") {
      if (value.offerings.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["offerings"],
          message: "Only confirmed source evidence may have offerings",
        });
      }
      return;
    }
    for (const field of ["sourceId", "sourceUrl", "observedAt"] as const) {
      if (!value[field]) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Confirmed evidence requires source identity, URL and observation time",
        });
      }
    }
    if (value.parseStatus !== "parsed") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["parseStatus"],
        message: "Confirmed evidence must be parsed",
      });
    }
    for (const field of ["evidence", "offerings"] as const) {
      if (value[field].length === 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: "Confirmed evidence requires evidence and offerings",
        });
      }
    }
  });

const storeSchema = z
  .object({
    name: z.string().min(1),
    address: nullableString,
    latitude: z.number().finite().min(-90).max(90).nullable(),
    longitude: z.number().finite().min(-180).max(180).nullable(),
    phoneNumber: nullableString,
    // Opaque crawler menus remain menus, including all original object fields.
    menuItems: z.array(z.object({}).passthrough()),
    price: nullableString,
    priceDetails: z.array(z.unknown()),
    openHours: nullableString,
    openHoursRaw: nullableString,
    breakTime: nullableString,
    lastOrder: nullableString,
    holiday: nullableString,
    eligibility: eligibilitySchema,
  })
  .strict();

const crawlerStagingSchema = z
  .object({ schemaVersion: z.literal(1), stores: z.array(storeSchema) })
  .strict();

export type CrawlerStaging = z.infer<typeof crawlerStagingSchema>;
export type CrawlerStagingStore = CrawlerStaging["stores"][number];

// This validates local evidence, not source permission or current availability.
export function parseCrawlerStaging(
  input: unknown,
  now: Date = new Date(),
): CrawlerStaging {
  const nowTime = now.getTime();
  if (!Number.isFinite(nowTime)) throw Error("Invalid staging validation clock");
  return crawlerStagingSchema
    .superRefine((value, context) => {
      value.stores.forEach((store, index) => {
        const observedAt = store.eligibility.observedAt;
        if (observedAt !== null && Date.parse(observedAt) > nowTime) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["stores", index, "eligibility", "observedAt"],
            message: "Observation time must not be in the future",
          });
        }
      });
    })
    .parse(input);
}

const requiredPublicDetails = [
  "address",
  "latitude",
  "longitude",
  "phoneNumber",
  "price",
  "openHours",
] as const;
type PublicDetail = (typeof requiredPublicDetails)[number];
type ReviewReason =
  | "currentness_unverified"
  | "eligibility_unconfirmed"
  | "meal_scope_required"
  | "missing_public_details";

// Deliberately contains no source text, IDs, URLs or business details. It is a
// review queue, never a conversion to app stores/refill_items or a write plan.
export function buildStagingReview(data: CrawlerStaging) {
  const countsByEligibility = {
    confirmed: 0,
    needs_review: 0,
    ended: 0,
    unknown: 0,
  };
  const countsByScope = { main_meal: 0, buffet: 0, side_refill: 0, unknown: 0 };
  const missingRequiredPublicDetails: Record<PublicDetail, number> = {
    address: 0,
    latitude: 0,
    longitude: 0,
    phoneNumber: 0,
    price: 0,
    openHours: 0,
  };
  const records = data.stores.map((store, storeIndex) => {
    const { status, scope } = store.eligibility;
    countsByEligibility[status] += 1;
    countsByScope[scope] += 1;
    const missing = requiredPublicDetails.filter((field) => {
      const value = store[field];
      return value === null || (typeof value === "string" && !value.trim());
    });
    for (const field of missing) missingRequiredPublicDetails[field] += 1;
    const reviewReasons: ReviewReason[] = ["currentness_unverified"];
    if (status !== "confirmed") reviewReasons.push("eligibility_unconfirmed");
    if (scope !== "main_meal" && scope !== "buffet") {
      reviewReasons.push("meal_scope_required");
    }
    if (missing.length > 0) reviewReasons.push("missing_public_details");
    return {
      storeIndex,
      eligibilityStatus: status,
      scope,
      currentness: "unverified" as const,
      publicationStatus: "needs_review" as const,
      missingRequiredPublicDetails: missing,
      reviewReasons,
    };
  });
  return {
    totalStores: data.stores.length,
    countsByEligibility,
    countsByScope,
    missingRequiredPublicDetails,
    publicationStatusCounts: { needs_review: data.stores.length },
    publicationAllowed: false as const,
    reviewRequired: data.stores.length > 0,
    reviewRequiredFlags: {
      currentnessUnverified: data.stores.length > 0,
      unconfirmedEligibility: records.some(
        (record) => record.eligibilityStatus !== "confirmed",
      ),
      mealScopeRequired: records.some((record) =>
        record.reviewReasons.includes("meal_scope_required"),
      ),
      missingPublicDetails: records.some(
        (record) => record.missingRequiredPublicDetails.length > 0,
      ),
    },
    records,
  };
}
