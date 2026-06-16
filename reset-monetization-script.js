import mongoose from "mongoose";
import dotenv from "dotenv";
import { Artist } from "./modules/artist/models/artist.model.js";

// Load environment variables
dotenv.config();

console.log("MongoDB URL", process.env.MONGO_URL);

const resetMonetization = async () => {
  // Get artistId from command line arguments
  const artistId = process.argv[2];

  if (!artistId) {
    console.error("❌ Please provide an artistId. Example: node reset-monetization.js 64abc123...");
    process.exit(1);
  }

  try {
    console.log(`🔌 Connecting to MongoDB...`);
    await mongoose.connect(process.env.MONGO_URL);
    console.log(`✅ Connected to MongoDB`);

    console.log(`🔍 Looking for artist with ID: ${artistId}`);
    const artist = await Artist.findById(artistId);

    if (!artist) {
      console.error(`❌ Artist not found!`);
      process.exit(1);
    }

    // 🧹 Wipe out the previous plans and reset the flags
    artist.subscriptionPlans = [];
    artist.isMonetizationComplete = false;
    artist.monetizationStatus = "not_set";
    
    if (artist.monetization) {
      artist.monetization.enabled = false;
    }

    await artist.save();
    console.log(`🎉 Success! Monetization has been reset for artist: ${artist.name}`);

  } catch (error) {
    console.error("❌ Error resetting monetization:", error);
  } finally {
    // Always close the database connection
    await mongoose.connection.close();
    process.exit(0);
  }
};

resetMonetization();
