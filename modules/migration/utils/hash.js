import crypto from "crypto";

export function calculateMd5(buffer) {
  return crypto.createHash("md5").update(buffer).digest("hex");
}

export default { calculateMd5 };
