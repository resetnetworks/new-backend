// server.js
import dotenv from 'dotenv';
dotenv.config();


import mongoose from 'mongoose';
import connectDb from './database/db.js';
import app from './app.js';
import gracefulShutdown from './middleware/gracefulShutdown.js';

const port = process.env.PORT || 4000;
let server;

const start = async () => {
  try {
    if (!process.env.MONGO_URL) {
      console.error('❌ Missing MONGO_URL in environment variables');
      process.exit(1);
    }

    await connectDb();

    // ✅ Don't start HTTP server when testing
    if (process.env.NODE_ENV !== 'test') {
      server = app.listen(port, '0.0.0.0', () => {
        console.log(`🚀 Server running at http://localhost:${port}`);
      });
    }

    return server;
  } catch (err) {
    console.error('❌ Failed to start server:', err.message);
    process.exit(1);
  }
};

// ✅ Only auto-start if NOT running tests
if (process.env.NODE_ENV !== 'test') {
  start();
}

// ✅ Export for Supertest / Jest
export { app, start, server };
