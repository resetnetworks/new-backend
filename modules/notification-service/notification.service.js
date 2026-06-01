import { enqueueNotification, enqueueEvent } from "./producers/notification.producer.js";
import { NOTIFICATION_TYPES } from "./utils/notification.constants.js";
import {
  resolveArtistUserId,
  resolveUserDetails,
  resolveItemDetails,
  // getArtistSubscribedUserIds
} from "./utils/notification.resolvers.js";


// ======================================================
// AUTH - welcome notification
// ======================================================
export const sendWelcomeNotification = async ({
  userId,
  name,
}) => {
  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.WELCOME,
    title: "Welcome",
    body: `Welcome aboard, ${name}!`,
    data: {},
    channels: ["web"],
  });
};


// ======================================================
// ARTIST APPLICATION - approved Successful
// ======================================================
export const sendArtistApplicationApprovedNotification = async ({
  userId,
}) => {
  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.ARTIST_APPLICATION_APPROVED,
    title: "Application Approved",
    body: "Your artist application has been approved.",
    data: {},
    channels: ["web"],
  });
};


// ======================================================
// ARTIST APPLICATION - rejected
// ======================================================
export const sendArtistApplicationRejectedNotification = async ({
  userId,
  reason,
}) => {
  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.ARTIST_APPLICATION_REJECTED,
    title: "Application Rejected",
    body: "Your artist application was rejected.",
    data: {
      reason,
    },
    channels: ["web"],
  });
};


// =================================================================
// TRACK UPLOAD - notify the artist about the track upload(singles)
// =================================================================
export const sendSongUploadedNotification = async ({
  userId,
  songTitle,
}) => {
  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.SONG_UPLOADED,
    title: "Song Uploaded",
    body: `${songTitle} was uploaded successfully.`,
    data: {
      songTitle,
    },
    channels: ["web"],
  });
};


// =========================================================
// ALBUM UPLOAD - notify the artist about the album upload
// =========================================================
export const sendAlbumUploadedNotification = async ({
  userId,
  albumTitle,
}) => {
  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.ALBUM_UPLOADED,
    title: "Album Uploaded",
    body: `${albumTitle} was uploaded successfully.`,
    data: {
      albumTitle,
    },
    channels: ["web"],
  });
};


// ======================================================
// FAN-OUT EVENT - NEW SONG RELEASE
// ======================================================
export const enqueueNewSongReleaseEvent = async ({
  artistId,
  artistName,
  songId,
  songTitle,
}) => {
  return enqueueEvent({
    type: NOTIFICATION_TYPES.FANOUT_NEW_SONG_RELEASE,
    title: "New Song Release",
    body: `${artistName} released a new song, ${songTitle}`,
    data: {
      artistId,
      artistName,
      songId,
      songTitle,
    },

    channels: ["web"],
  });
};


// ======================================================
// FAN-OUT EVENT - NEW ALBUM RELEASE
// ======================================================
export const enqueueNewAlbumReleaseEvent = async ({
  artistId,
  artistName,
  albumId,
  albumTitle,
}) => {
  return enqueueEvent({
    type: NOTIFICATION_TYPES.FANOUT_NEW_ALBUM_RELEASE,
    title: "New Album Release",
    body: `${artistName} released a new album, ${albumTitle}`,
    data: {
      artistId,
      artistName,
      albumId,
      albumTitle,
    },

    channels: ["web"],
  });
};


// ======================================================
// PURCHASES - notify the user about their purchase
// ======================================================
export const sendSongPurchaseSuccessNotification = async ({
  userId,
  amount,
  transactionId,
  itemId,
  itemType,
}) => {
  const item = await resolveItemDetails(itemId, itemType);
  // console.log("`````````````````~~~~~~~~~~artist item", item)

  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.SONG_PURCHASE_SUCCESS,
    title: "Purchase Successful",
    body: `You purchased "${item.itemTitle}" successfully.`,
    data: {
      transactionId,
      amount,

      itemId,
      itemType: item.itemType,
      itemTitle: item.itemTitle,
    },
    channels: ["web"],
  });
};

// export const sendSongPurchaseFailedNotification = async ({
//   userId,
//   songTitle,
// }) => {
//   return enqueueNotification({
//     userId,
//     type: NOTIFICATION_TYPES.SONG_PURCHASE_FAILED,
//     title: "Purchase Failed",
//     body: `Your purchase for "${songTitle}" failed.`,
//     data: {
//       songTitle,
//     },
//     channels: ["web"],
//   });
// };

/*console.log()*/


// ======================================================
// CREATOR SALES - notify the artist about the new sale
// ======================================================
export const sendNewSongPurchaseNotification = async ({
  artistId,
  buyerId,
  itemId,
  itemType,
}) => {
  const artistUserId = await resolveArtistUserId(artistId);
  const buyer = await resolveUserDetails(buyerId);
  const item = await resolveItemDetails(itemId, itemType);
  // console.log("`````````````````~~~~~~~~~~user item",item)

  return enqueueNotification({
    userId: artistUserId,
    type: NOTIFICATION_TYPES.NEW_SONG_PURCHASE,
    title: "New Purchase",
    body: `${buyer.name} purchased your ${item.itemType} "${item.itemTitle}".`,
    data: {
      artistId,
      buyerId,
      buyerName: buyer.name,

      itemId,
      itemType: item.itemType,
      itemTitle: item.itemTitle,
    },
    channels: ["web"],
  });
};


// ================================================================
// SUBSCRIPTIONS - notify the user about the subscription purchase
// ================================================================
export const sendArtistSubscriptionSuccessNotification = async ({
  userId,
  artistId,
  itemId,
  itemType,
}) => {
  const item = await resolveItemDetails(itemId, itemType);

  return enqueueNotification({
    userId,
    type: NOTIFICATION_TYPES.ARTIST_SUBSCRIPTION_SUCCESS,
    title: "Subscription Successful",
    body: `You subscribed to ${item.itemTitle}.`,
    data: {
      artistId,

      artistName: item.itemTitle,

      itemId,
      itemType: item.itemType,
      itemTitle: item.itemTitle,
    },
    channels: ["web"],
  });
};


// =============================================================
// SUBSCRIPTIONS - notify the artist about the new subscription
// =============================================================
export const sendNewArtistSubscriberNotification = async ({
  artistId,
  subscriberId,
}) => {
  const artistUserId = await resolveArtistUserId(artistId);
  const subscriber = await resolveUserDetails(subscriberId);

  return enqueueNotification({
    userId: artistUserId,
    type: NOTIFICATION_TYPES.NEW_ARTIST_SUBSCRIBER,
    title: "New Subscriber",
    body: `${subscriber.name} subscribed to you.`,
    data: {
      artistId,
      subscriberId,
      subscriberName: subscriber.name,
    },
    channels: ["web"],
  });
};
