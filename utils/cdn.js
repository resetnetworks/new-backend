// utils/cdn.js
const CDN_DOMAIN = process.env.CLOUDFRONT_DOMAIN;

/**
 * Build a public CDN URL from a stored key
 * @param {string} key
 */
export const buildCdnUrl = (key) => {
  if (!key) return null;
  return `${CDN_DOMAIN}/${key}`;
};

