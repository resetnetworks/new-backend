import Notification from "../models/notification.model.js";
import { getArtistSubscriberIds } from "./fanout.resolver.js";

const BATCH_SIZE = 500;

export const handleNewSongReleaseFanout = async ( payload ) => {

  const subscribers = await getArtistSubscriberIds(payload.data.artistId);
  if (!subscribers.length) return;

  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i,  i + BATCH_SIZE);

    const notifications = batch.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,

      data: payload.data,

      channels: payload.channels || ["web"],

      status: "sent",
    }));

    await Notification.insertMany(notifications, { ordered: false });

    console.log(
      `🚀 Song batch processed: ${i + 1} - ${Math.min(i + BATCH_SIZE, subscribers.length)
      }`
    );
  }

  console.log(`🚀 Song fan-out completed for ${subscribers.length} users`);
};


export const handleNewAlbumReleaseFanout = async ( payload ) => {

  const subscribers = await getArtistSubscriberIds(payload.data.artistId);
  if (!subscribers.length) return; 
  
  for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
    const batch = subscribers.slice(i, i + BATCH_SIZE);

    const notifications = batch.map((userId) => ({
      userId,
      type: payload.type,
      title: payload.title,
      body: payload.body,

      data: payload.data,

      channels: payload.channels || ["web"],

      status: "sent",
    }));

    await Notification.insertMany(notifications, { ordered: false });

    console.log(`🚀 Album batch processed: ${i + 1} - ${Math.min(i + BATCH_SIZE, subscribers.length)}` );
  }

  console.log(`🚀 Album fan-out completed for ${subscribers.length} users`);
};