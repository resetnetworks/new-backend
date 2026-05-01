import path from "path";
import { fileURLToPath } from "url";

/**
 * Anchor this file at project root.
 * utils/ sits directly inside the root folder.
 */
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Project root = parent of /utils
export const ROOT = path.resolve(__dirname, "..");

/**
 * Build absolute path from project root
 * Usage: fromRoot("assets","images","logo.png")
 */
export const fromRoot = (...segments) => {
  return path.join(ROOT, ...segments);
};