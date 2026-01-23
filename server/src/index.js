require("dotenv").config();
const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");

const connectDB = require("./config/db");
const authRoutes = require("./routes/authRoutes");

const app = express();
const PORT = process.env.PORT || 5000;

// Validate required environment variables
if (!process.env.JWT_SECRET) {
  console.error("ERROR: JWT_SECRET environment variable is required");
  process.exit(1);
}

if (!process.env.MONGO_URI) {
  console.error("ERROR: MONGO_URI environment variable is required");
  process.exit(1);
}

// CORS allowlist
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:5174",
];

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman or curl)
    if (!origin) {
      return callback(null, true);
    }
    // Check if origin is in allowlist
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Handle OPTIONS preflight requests
app.options("*", cors(corsOptions));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ ok: true });
});

// Auth routes
app.use("/api", authRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Error:", err);
  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({ message: "CORS error: Origin not allowed" });
  }
  res.status(500).json({ message: "Internal server error" });
});

// Connect to MongoDB and start server
(async () => {
  try {
    console.log("Attempting to connect to MongoDB...");
    await connectDB();
    console.log("MongoDB connected successfully");
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error("Failed to start server:");
    console.error("Error details:", error.message);
    if (error.message.includes("MONGO_URI")) {
      console.error("Please check your .env file and ensure MONGO_URI is set correctly");
    } else if (error.message.includes("authentication failed") || error.message.includes("connection")) {
      console.error("MongoDB connection failed. Please check:");
      console.error("1. Your MongoDB Atlas connection string is correct");
      console.error("2. Your IP address is whitelisted in MongoDB Atlas");
      console.error("3. Your network connection is working");
    }
    process.exit(1);
  }
})();

module.exports = app;
