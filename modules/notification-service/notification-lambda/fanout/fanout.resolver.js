import { Subscription } from "../models/subscription.model.js";

export const getArtistSubscriberIds = async ( artistId ) => {
  const subscriptions = await Subscription.find({
    artistId,
    status: "active",
  }).select("userId");

  return subscriptions.map((s) => s.userId);
};