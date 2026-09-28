// import { streamSongService } from "./stream.service.js";

// export const streamSong = async (req, res) => {

//   const { id: songId } = req.params;
//   const userId = req.user?._id || null;

//   const data = await streamSongService({
//     songId,
//     userId
//   });

//   res.json(data);
// };


import { streamSongService } from "./stream.service.js";
import crypto from "crypto";
import { BadRequestError, AppError } from "../../errors/index.js";

const UUID_V4_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const streamSong = async (req, res, next) => {
  try {
    const { id: songId } = req.params;
    const userId = req.user?._id || null;

    const data = await streamSongService({
      songId,
      userId,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getStreamKey = (req, res, next) => {
  try {
    const { uuid } = req.params;

    if (!uuid || !UUID_V4_REGEX.test(uuid)) {
      throw new BadRequestError("Invalid stream key identifier.");
    }

    const HLS_SECRET = process.env.HLS_SECRET;
    if (!HLS_SECRET) {
      throw new AppError("Streaming encryption secret is not configured on server", 500);
    }

    // Create a 16-byte buffer for the AES-128 key
    const key = crypto
      .createHmac("sha256", HLS_SECRET)
      .update(uuid)
      .digest()
      .slice(0, 16);

    // Send the raw binary buffer with strict no-cache headers
    res.set({
      "Content-Type": "application/octet-stream",
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
      Pragma: "no-cache",
      Expires: "0",
    });

    res.send(key);
  } catch (error) {
    next(error);
  }
};
