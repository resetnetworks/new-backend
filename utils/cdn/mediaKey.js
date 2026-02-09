import path from "path";

/**
 * Strict UUID v4 regex
 */
const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Extract UUID from an S3 object key
 *
 * @example
 *  songs/cc55bf0f-32a0-4c3d-b6d2-c51315860be9.wav
 *
 * @throws Error if UUID is missing or invalid
 */
export function extractUuidFromKey(key) {
  if (!key || typeof key !== "string") {
    throw new Error("Invalid media key: must be a non-empty string");
  }

  // Remove directories + extension
  const filename = path.parse(key).name;

  if (!UUID_V4_REGEX.test(filename)) {
    throw new Error(`Invalid UUID in media key: ${key}`);
  }

  return filename;
}