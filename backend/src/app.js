import express from "express";
import http from "node:http";
import cors from "cors";
import mongoose from "mongoose";
import { Server } from "socket.io";
import { handleGenAiChat } from "./module/genAi/controller/controller.js";
import authRouter from "./module/auth/controller/auth.controller.js";
import userRoutes from "./module/user/routes.js";
import doctorRoutes from "./module/doctor/routes/doctorRoutes.js";
import config from "./shared/config.js";
import { errorLogger } from "./shared/logger.js";
import {
  startRealtimeDatabaseEvents,
  stopRealtimeDatabaseEvents,
} from "./shared/realtime.js";

const app = express();
const port = Number(process.env.PORT || 5001);
const httpServer = http.createServer(app);

// Allow reverse proxy headers on Render / cloud hosts
app.set("trust proxy", 1);

// Flexible CORS setup for Render <-> Vercel deployments
const corsOptions = {
  origin: (origin, callback) => {
    // Allow server-to-server, curl, mobile apps, or any web client origin
    callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "x-user-id",
    "x-abha-number",
    "Accept",
    "Origin",
    "X-Requested-With",
  ],
};

const io = new Server(httpServer, {
  cors: {
    origin: (origin, callback) => callback(null, true),
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
});
let server;

io.on("connection", (socket) => {
  console.log(`Realtime client connected: ${socket.id}`);
  socket.on("disconnect", () =>
    console.log(`Realtime client disconnected: ${socket.id}`),
  );
});

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json({ limit: "22mb" }));

// Health check endpoints for Render and monitoring
app.get("/", (_req, res) =>
  res.json({ status: "ok", message: "AESIX Backend API is running" }),
);
app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.get("/api/genai/health", (_req, res) =>
  res.json({
    status: "ok",
    groqEndpoint:
      process.env.GROQ_ENDPOINT ||
      "https://api.groq.com/openai/v1/chat/completions",
    model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  }),
);
app.post("/api/genai/chat", handleGenAiChat);
app.post("/genai/chat", handleGenAiChat);

app.use("/api/auth", authRouter);
app.use("/auth", authRouter);

app.use("/api/users", userRoutes);
app.use("/users", userRoutes);

app.use("/api/doctor", doctorRoutes);
app.use("/doctor", doctorRoutes);

app.use(errorLogger);

function maskMongoUri(uri) {
  if (!uri) return "<missing>";
  try {
    // mongodb+srv://user:password@host/... -> mongodb+srv://user:****@host/...
    return uri.replace(/(\/\/[^:/\s]+:)([^@\s]+)(@)/, "$1****$3");
  } catch {
    return "<unparseable-uri>";
  }
}

export async function startServer() {
  if (server) return server;
  if (!config.database.uri)
    throw new Error("MONGODB_URI is required. Configure backend/.env.");
  console.log("Connecting to MongoDB...", maskMongoUri(config.database.uri));
  try {
    await mongoose.connect(config.database.uri, {
      dbName: config.database.dbName,
      serverSelectionTimeoutMS: 10_000,
    });
  } catch (error) {
    const reason = error?.reason?.message || error.message;
    console.error(`MongoDB connection failed: ${reason}`);
    console.error(
      [
        "",
        "Atlas fix (most common cause = IP not whitelisted):",
        "1. Atlas dashboard -> Network Access -> Add IP Address.",
        `2. Add your current public IP, or 0.0.0.0/0 for local dev.`,
        "3. Also check: Database Access (user exists), correct password,",
        "   and that MONGODB_URI ends with /<dbName>?retryWrites=true.",
        `   MONGODB_DB=${config.database.dbName}`,
        "Docs: https://www.mongodb.com/docs/atlas/security-whitelist/",
        "",
      ].join("\n"),
    );
    throw error;
  }
  startRealtimeDatabaseEvents(io);
  server = await new Promise((resolve, reject) => {
    const candidate = httpServer.listen(port);
    candidate.once("error", reject);
    candidate.once("listening", () => resolve(candidate));
  });
  console.log(`AESIX API listening on http://localhost:${port}`);
  return server;
}

export async function stopServer() {
  if (!server) return;
  await new Promise((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  server = undefined;
  await stopRealtimeDatabaseEvents();
  await mongoose.disconnect();
}

if (process.env.NODE_ENV !== "test") {
  startServer().catch((error) => {
    console.error(`Server startup failed: ${error.message}`);
    process.exitCode = 1;
  });
}

export default app;
