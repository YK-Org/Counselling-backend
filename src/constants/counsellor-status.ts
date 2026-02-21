/**
 * Counsellor Status Thresholds
 * Used to determine counsellor performance and support needs
 */
export const COUNSELLOR_STATUS_THRESHOLDS = {
  NEEDS_SUPPORT: {
    MAX_COMPLETION_RATE: 30, // Below 30% completion rate needs support
    HIGH_WORKLOAD_THRESHOLD: 5, // More than 5 sessions is considered high workload
    HIGH_WORKLOAD_MAX_RATE: 50, // With high workload, below 50% completion needs support
  },
  EXCELLENT: {
    MIN_COMPLETION_RATE: 70, // 70% or above is considered excellent
  },
  GOOD: {
    // Everything between NEEDS_SUPPORT and EXCELLENT
  },
} as const;

/**
 * File Upload Limits
 */
export const FILE_UPLOAD_LIMITS = {
  PROFILE_PICTURE: {
    MAX_SIZE_MB: 5,
    MAX_SIZE_BYTES: 5 * 1024 * 1024, // 5MB in bytes
    ALLOWED_MIME_TYPES: [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/gif",
      "image/webp",
    ] as string[],
  },
};

/**
 * Age Distribution Ranges
 */
export const AGE_RANGES = {
  YOUNG_ADULT: { min: 20, max: 30, label: "20-30" },
  ADULT: { min: 31, max: 40, label: "31-40" },
  MIDDLE_AGE: { min: 41, max: 50, label: "41-50" },
  SENIOR: { min: 51, label: "51+" },
} as const;
