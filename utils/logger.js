import pino from "pino";
import fs from "fs";
import path from "path";

const isProd = process.env.NODE_ENV === "production";

let transport;

// 🔹 DEV: pretty logs to stdout
if (!isProd) {
  transport = {
    target: "pino-pretty",
    options: {
      colorize: true,
      translateTime: "SYS:standard",
      ignore: "pid,hostname"
    }
  };
}

// 🔹 PROD: write JSON logs to file
if (isProd) {
  const logDir = path.join(process.cwd(), "logs");

  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  transport = {
    targets: [
      {
        target: "pino/file",
        options: {
          destination: path.join(logDir, "app.log")
        }
      }
    ]
  };
}

const logger = pino(
  {
    level: process.env.LOG_LEVEL || "info",
    redact: {
      paths: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.token",
        "req.body.card"
      ],
      remove: true
    }
  },
  pino.transport(transport)
);

export default logger;
