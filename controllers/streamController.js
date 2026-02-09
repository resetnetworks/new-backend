import { Song } from "../models/song.model.js";
import { Album } from "../models/album.model.js";
import { getSignedCloudFrontUrl as getSignedUrl } from "../utils/cloudfront.js";
import { canStreamSong, canStreamAlbum } from "../helpers/accessControl.js";
import { UnauthorizedError, NotFoundError, ForbiddenError } from "../errors/index.js";
import { extractUuidFromKey } from "../utils/cdn/mediaKey.js";

// ✅ Stream a single song
export const streamSong = async (req, res) => {

  const { id: songId } = req.params;
  const userId = req.user._id;

  const allowed = await canStreamSong(userId, songId);
  if (!allowed) throw new ForbiddenError("You do not have access to stream this song.");

  const song = await Song.findById(songId).lean();
  if (!song || !song.audioKey) throw new NotFoundError("Song not found or missing audio key.");

  if (song.isDeleted) {
  throw new ForbiddenError("This song is no longer available");
}


const songuuid = extractUuidFromKey(song.audioKey);


  const signedUrl = await getSignedUrl(songuuid); // e.g., songs-hls/{key}.m3u8
  res.json({ url: signedUrl, uuid: songuuid });
  console.log("Signed URL generated:", signedUrl);
};

// ✅ Stream all songs in an album
export const streamAlbum = async (req, res) => {
  const { id: albumId } = req.params;
  const userId = req.user._id;

  const allowed = await canStreamAlbum(userId, albumId);
  if (!allowed) throw new UnauthorizedError("You do not have access to stream this album.");

  const album = await Album.findById(albumId).populate("songs").lean();
  if (!album || !album.songs?.length) throw new NotFoundError("Album not found or has no songs.");

  const urls = await Promise.all(
    album.songs.map((song) => getSignedUrl(song.audioKey))
  );

  res.json({ urls });
};
