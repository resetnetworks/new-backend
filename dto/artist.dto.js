// dtos/artist.dto.js
import { buildCdnUrl } from "../utils/cdn/cdn.js";

export const shapeArtistResponse = (artist) => {
  if (!artist) return null;

  const subscriptionPlans = Array.isArray(artist.subscriptionPlans)
    ? artist.subscriptionPlans.map((p) => ({
        cycle: p.cycle,
        basePrice: p.basePrice,
        convertedPrices: Array.isArray(p.convertedPrices)
          ? p.convertedPrices
          : [],
        razorpayPlanId: p.razorpayPlanId ?? null,
        stripePriceId: p.stripePriceId ?? null,
        paypalPlans: Array.isArray(p.paypalPlans)
          ? p.paypalPlans.map((pp) => ({
              currency: pp.currency,
              paypalPlanId: pp.paypalPlanId,
            }))
          : [],
      }))
    : [];

  return {
    id: artist._id, // safe: DTO boundary

    // identity
    name: artist.name,
    slug: artist.slug,

    // profile
    bio: artist.bio || "",
    location: artist.location || "",
    country: artist.country || null,

    profileImage: artist.profileImageKey
      ? buildCdnUrl(artist.profileImageKey)
      : null,

    coverImage: artist.coverImageKey
      ? buildCdnUrl(artist.coverImageKey)
      : null,

    socials: artist.socials || [],

    // monetization
    subscriptionPlans,
    monetizationStatus: artist.monetizationStatus,
    isMonetizationComplete: !!artist.isMonetizationComplete,

    // optional precomputed stats
    songCount: artist.songCount ?? 0,
    albumCount: artist.albumCount ?? 0,

    createdAt: artist.createdAt,
    updatedAt: artist.updatedAt,
  };
};