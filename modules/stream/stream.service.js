import {Song} from "../../models/song.model.js";
import { NotFoundError, ForbiddenError } from "../../errors/index.js";
import { canAccessSong } from "../../services/access.service.js";
import { getSignedCloudFrontUrl as getSignedUrl } from "../../utils/cdn/cloudfront.js";
import { extractUuidFromKey } from "../../utils/media/extractUuidFromKey.js";
import { createPlaybackSession } from "../../utils/playback/createPlaybackSession.js";

export const streamSongService = async ({ songId, userId }) => {

  const song = await Song.findById(songId)
    .select("audioKey isDeleted accessType artist albumOnly albumId")
    .lean();

  if (!song || !song.audioKey) {
    throw new NotFoundError("Song not found or missing audio key.");
  }

  if (song.isDeleted) {
    throw new ForbiddenError("This song is no longer available");
  }

  const uuid = extractUuidFromKey(song.audioKey);

  const session = await createPlaybackSession({
  userId,
  songId: song._id,
});

  const previewUrl = `https://${process.env.CLOUDFRONT_DOMAIN}/songs-preview/${uuid}/${uuid}_preview.m3u8`;

  if (!userId) {
    return {
      url: previewUrl,
       sessionId: session.sessionId,
      isPreview: true
    };
  }

  const allowed = await canAccessSong(userId, song);

  if (!allowed) {
    return {
      url: previewUrl,
       sessionId: session.sessionId,
      isPreview: true
    };
  }

  const signedUrl = await getSignedUrl(uuid);

  return {
    url: signedUrl,
    sessionId: session.sessionId,
    isPreview: false
  };
};
