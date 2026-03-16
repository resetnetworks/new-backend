import { streamSongService } from "./stream.service.js";

export const streamSong = async (req, res) => {

  const { id: songId } = req.params;
  const userId = req.user?._id || null;

  const data = await streamSongService({
    songId,
    userId
  });

  res.json(data);
};