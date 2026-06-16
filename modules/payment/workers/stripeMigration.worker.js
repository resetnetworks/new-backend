import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

import connectDb from "../../../database/db.js";
import { Worker } from "bullmq";
import { redisConnection } from "../queue/connection.js";
import { STRIPE_MIGRATION_QUEUE_NAME } from "../queue/stripeMigration.queue.js";
import { Subscription } from "../../../models/Subscription.js";
import Stripe from "stripe";

const startWorker = async () => {
  try {
    await connectDb();
    console.log("📨 Stripe Migration Worker started...");

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    const stripeMigrationWorker = new Worker(
      STRIPE_MIGRATION_QUEUE_NAME,
      async (job) => {
        const { artistId, newStripePlans } = job.data;
        console.log(`🚀 Starting Stripe price migration for artist ${artistId}...`);

        try {
          const activeSubs = await Subscription.find({
            artistId,
            gateway: "stripe",
            status: "active",
          });

          console.log(`Found ${activeSubs.length} active Stripe subscriptions to migrate.`);

          let successCount = 0;
          let failureCount = 0;

          for (const sub of activeSubs) {
            try {
              const stripeSub = await stripe.subscriptions.retrieve(sub.externalSubscriptionId);
              const subscriptionItemId = stripeSub.items.data[0].id;
              const currentCurrency = stripeSub.currency.toUpperCase();

              const newPlan = newStripePlans.find((p) => p.currency === currentCurrency);

              if (newPlan) {
                await stripe.subscriptions.update(sub.externalSubscriptionId, {
                  items: [
                    {
                      id: subscriptionItemId,
                      price: newPlan.stripePriceId,
                    },
                  ],
                  proration_behavior: "none",
                });

                console.log(`✅ Successfully migrated ${sub.externalSubscriptionId} to new price.`);
                successCount++;
              } else {
                console.warn(`⚠️ No matching new plan found for currency ${currentCurrency} on sub ${sub.externalSubscriptionId}`);
                failureCount++;
              }
            } catch (err) {
              console.error(`❌ Failed to migrate ${sub.externalSubscriptionId}:`, err.message);
              failureCount++;
            }
          }

          console.log(`🏁 Migration complete for artist ${artistId}. Success: ${successCount}, Failures: ${failureCount}`);
        } catch (error) {
          console.error(`🚨 Critical error during migration for artist ${artistId}:`, error);
          throw error;
        }
      },
      {
        connection: redisConnection,
        concurrency: 1,
      }
    );

    stripeMigrationWorker.on("completed", (job) => {
      console.log(`Job ${job.id} has completed!`);
    });

    stripeMigrationWorker.on("failed", (job, err) => {
      console.error(`Job ${job.id} has failed with ${err.message}`);
    });

  } catch (err) {
    console.error("💥 Worker startup failed:", err);
    process.exit(1);
  }
};

startWorker();
