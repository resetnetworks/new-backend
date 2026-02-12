import mongoose from "mongoose";
import dotenv from "dotenv";
import {Song} from "./models/song.model.js";

dotenv.config();

const MONGO_URL = process.env.MONGO_URL;

if (!MONGO_URL) {
  console.error("❌ Missing MONGO_URL in environment variables");
  process.exit(1);
}

const runMigration = async () => {
  try {
    await mongoose.connect(MONGO_URL);
    console.log("✅ Connected to MongoDB");

    const result = await Song.updateMany(
      {},
      [
        {
          $set: {
            genre: {
              $map: {
                input: "$genre",
                as: "g",
                in: { $toLower: "$$g" }
              }
            }
          }
        }
      ]
    );

    console.log(`✅ Updated ${result.modifiedCount} documents`);

    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
};

runMigration();
