import fs from "fs";
import path from "path";
import { PlayEvent } from "./playEvents.model.js";
import { Song } from "../../song/models/song.model.js";

const TMP_DIR = path.resolve("tmp");

if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

/* =========================================
   Generate interactions.csv
========================================= */
export const generateInteractionsCsv = async () => {
  const filePath = path.join(TMP_DIR, "interactions.csv");
  const writeStream = fs.createWriteStream(filePath);

  writeStream.write("USER_ID,ITEM_ID,TIMESTAMP\n");

  const cursor = PlayEvent.find({})
    .select("userId songId playedAt")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    writeStream.write(
      `${doc.userId.toString()},${doc.songId.toString()},${doc.playedAt}\n`
    );
  }

  writeStream.end();

  return filePath;
};

/* =========================================
   Generate items.csv
========================================= */
export const generateItemsCsv = async () => {
  const filePath = path.join(TMP_DIR, "items.csv");
  const writeStream = fs.createWriteStream(filePath);

  writeStream.write("ITEM_ID,TITLE,GENRE,ARTIST,ALBUM\n");

  const cursor = Song.find({
    status: "ready",
    isDeleted: false,
  })
    .select("title genre artist album")
    .lean()
    .cursor();

  for await (const doc of cursor) {
    const genre = (doc.genre || []).join("|");
    const album = doc.album ? doc.album.toString() : "";

    writeStream.write(
      `${doc._id.toString()},"${doc.title.replace(/"/g, '""')}",${genre},${doc.artist.toString()},${album}\n`
    );
  }

  writeStream.end();

  return filePath;
};