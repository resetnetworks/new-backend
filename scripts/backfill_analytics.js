import dotenv from "dotenv";
dotenv.config();
import mongoose from "mongoose";
import connectDb from "../database/db.js";
import { AnalyticsEvent } from "../modules/analytics/domain/models/AnalyticsEvent.js";
import { Album } from "../models/album.model.js";
import { Song } from "../models/song.model.js";
import { Artist } from "../modules/artist/models/artist.model.js";

async function backfill() {
  await connectDb();
  console.log("Connected to MongoDB.");

  const events = await AnalyticsEvent.find({
    $or: [
      { "properties.albumSlug": { $exists: true }, albumId: null },
      { "properties.artistSlug": { $exists: true }, artistId: null },
      { "properties.songSlug": { $exists: true }, songId: null },
    ],
  });

  console.log(`Found ${events.length} events needing entity resolution.`);
  let updatedCount = 0;

  for (const ev of events) {
    let changed = false;
    const { properties = {} } = ev;

    // Album
    if (!ev.albumId && properties.albumSlug) {
      const isObjectId = mongoose.Types.ObjectId.isValid(properties.albumSlug);
      const album = await Album.findOne(
        isObjectId ? { $or: [{ slug: properties.albumSlug }, { _id: properties.albumSlug }] } : { slug: properties.albumSlug }
      ).select("_id artist").lean();

      if (album) {
        ev.albumId = album._id;
        if (!ev.artistId && album.artist) {
          ev.artistId = album.artist;
        }
        changed = true;
      }
    }

    // Artist
    if (!ev.artistId && properties.artistSlug) {
      const isObjectId = mongoose.Types.ObjectId.isValid(properties.artistSlug);
      const artist = await Artist.findOne(
        isObjectId ? { $or: [{ slug: properties.artistSlug }, { _id: properties.artistSlug }] } : { slug: properties.artistSlug }
      ).select("_id").lean();

      if (artist) {
        ev.artistId = artist._id;
        changed = true;
      }
    }

    // Song
    if (!ev.songId && properties.songSlug) {
      const isObjectId = mongoose.Types.ObjectId.isValid(properties.songSlug);
      const song = await Song.findOne(
        isObjectId ? { $or: [{ slug: properties.songSlug }, { _id: properties.songSlug }] } : { slug: properties.songSlug }
      ).select("_id artist album").lean();

      if (song) {
        ev.songId = song._id;
        if (!ev.artistId && song.artist) ev.artistId = song.artist;
        if (!ev.albumId && song.album) ev.albumId = song.album;
        changed = true;
      }
    }

    if (changed) {
      await ev.save();
      updatedCount++;
    }
  }

  console.log(`Successfully backfilled and resolved ${updatedCount} events!`);
  process.exit(0);
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
