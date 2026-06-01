import { Artist } from "../../../models/Artist.js";
import { User } from "../../../models/User.js";
import { Song } from "../../../models/song.model.js";
import { Album } from "../../../models/album.model.js";
import { Subscription } from "../../../models/Subscription.js";

// ======================================================
// Resolve and return the user ID associated with an artist
// ======================================================
export const resolveArtistUserId = async (artistId) => {
  const artist = await Artist.findById(artistId).select("createdBy");

  if (!artist) {
    throw new Error(`Artist userId not found for artistId: ${artistId}`);
  }

  return artist.createdBy;
};
// ======================================================
// Fetch and return basic user details by user ID
// ======================================================
export const resolveUserDetails = async (userId) => {
  const user = await User.findById(userId).select("name username email");

  if (!user) {
    throw new Error(`User not found for userId: ${userId}`);
  }

  return user;
};

// ======================================================
// Resolve and return item details dynamically based on item type
// ======================================================
export const resolveItemDetails = async (itemId, itemType) => {

  switch (itemType) {

    case "song": {
      const song = await Song.findById(itemId).select("title");

      if (!song) {
        throw new Error(`Song not found: ${itemId}`);
      }

      return {
        itemType: "song",
        itemTitle: song.title,
        item: song,
      };
    }

    case "album": {
      const album = await Album.findById(itemId).select("title");

      if (!album) {
        throw new Error(`Album not found: ${itemId}`);
      }

      return {
        itemType: "album",
        itemTitle: album.title,
        item: album,
      };
    }

    case "artist-subscription": {
      const artist = await Artist.findById(itemId).select("name");

      if (!artist) {
        throw new Error(`Artist not found: ${itemId}`);
      }

      return {
        itemType: "artist-subscription",
        itemTitle: artist.name,
        item: artist,
      };
    }

    default:
      throw new Error(`Unsupported itemType: ${itemType}`);
  }
};


// ======================================================
// Get all artist supporter user ids
// ======================================================
// export const getArtistSubscribedUserIds = async (
//   artistId
// ) => {
//   const subscribedUsers =
//     await Subscription.distinct("userId", {
//       artistId,
//       status: "active",
//       validUntil: { $gt: new Date() },
//     });

//   return subscribedUsers.map(String);
// };
