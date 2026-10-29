// modules/analytics/application/event-validator.js
import { validateAnalyticsEvent as validateSchemaEvent } from "../domain/event.schema.js";

export const validateAnalyticsEvent = (payload) => {
  const result = validateSchemaEvent(payload);
  return {
    ...result,
    isValid: result.valid,
  };
};

export default { validateAnalyticsEvent };
