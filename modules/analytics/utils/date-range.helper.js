// modules/analytics/utils/date-range.helper.js

/**
 * Parses query parameters (range preset, startDate, endDate) into consistent ISO date strings & Date objects.
 * Supports presets: today, 7d, 30d, 90d, 1y. Default is 30d.
 */
export const parseDateRange = (query = {}) => {
  const { range, startDate, endDate } = query;
  const now = new Date();

  const toDateString = (d) => {
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  if (startDate && endDate) {
    return {
      startDate,
      endDate,
      startDateTime: new Date(`${startDate}T00:00:00.000Z`),
      endDateTime: new Date(`${endDate}T23:59:59.999Z`),
    };
  }

  const end = new Date(now);
  const start = new Date(now);

  switch (range) {
    case "today":
      break;
    case "7d":
      start.setUTCDate(start.getUTCDate() - 6);
      break;
    case "30d":
      start.setUTCDate(start.getUTCDate() - 29);
      break;
    case "90d":
      start.setUTCDate(start.getUTCDate() - 89);
      break;
    case "1y":
      start.setUTCDate(start.getUTCDate() - 364);
      break;
    default:
      start.setUTCDate(start.getUTCDate() - 29);
      break;
  }

  const startStr = toDateString(start);
  const endStr = toDateString(end);

  return {
    startDate: startStr,
    endDate: endStr,
    startDateTime: new Date(`${startStr}T00:00:00.000Z`),
    endDateTime: new Date(`${endStr}T23:59:59.999Z`),
  };
};

/**
 * Generates an array of date strings ["YYYY-MM-DD", ...] between startDate and endDate inclusive.
 */
export const generateDateList = (startDateStr, endDateStr) => {
  const dates = [];
  const current = new Date(`${startDateStr}T00:00:00.000Z`);
  const end = new Date(`${endDateStr}T00:00:00.000Z`);

  while (current <= end) {
    const year = current.getUTCFullYear();
    const month = String(current.getUTCMonth() + 1).padStart(2, "0");
    const day = String(current.getUTCDate()).padStart(2, "0");
    dates.push(`${year}-${month}-${day}`);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
};
