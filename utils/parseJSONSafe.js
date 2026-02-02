export const parseJSONSafe = (value, fieldName) => {
  if (!value) return null;

  if (typeof value === "object") return value;

  if (typeof value === "string") {
    try {
      // 🔥 IMPORTANT: trim + handle double-stringify
      let cleaned = value.trim();
      let parsed = JSON.parse(cleaned);

      if (typeof parsed === "string") {
        parsed = JSON.parse(parsed.trim());
      }

      return parsed;
    } catch (err) {
      console.error(`Invalid ${fieldName}:`, JSON.stringify(value));
      throw new BadRequestError(`${fieldName} must be valid JSON`);
    }
  }

  throw new BadRequestError(`${fieldName} has invalid type`);
};