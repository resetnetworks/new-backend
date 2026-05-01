import IORedis from "ioredis";
import redis from "../../../utils/redisClient.js"
// export const redisConnection = new IORedis(process.env.REDIS_URL, {
//   maxRetriesPerRequest: null,
// });


export const redisConnection = redis;

redisConnection.on("connect", () => {
  console.log("✅ Connected to Redis");
});

redisConnection.on("error", (err) => {
  console.error("❌ Redis connection error:", err);
});