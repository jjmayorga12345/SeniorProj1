# Full Unified Diffs and New File Contents

**Order:** server/src/db.js → route files → docs → client/public/_redirects.  
**Packages:** Listed first.

---

## Packages added / removed

### Removed
- **mysql2** — Replaced by Postgres. The app now uses Neon Postgres; raw SQL runs via `pg` with a thin wrapper that keeps the existing `pool.execute(sql, params)` API and normalizes results (insertId, affectedRows) for compatibility.

### Added
- **pg** — Node Postgres client. Required to connect to Neon (or any Postgres) and run parameterized raw SQL. Used in `server/src/db.js` for the pool and the `execute()` wrapper that converts `?` placeholders to `$1, $2, ...` and normalizes result shape.
- **helmet** — Sets security-related HTTP headers (X-Content-Type-Options, X-Frame-Options, etc.). Used in `server/src/index.js` to harden the app for production.
- **express-rate-limit** — Rate limits requests. Used in `server/src/index.js` to limit auth routes (login, register, forgot-password, reset-password-with-code) to 100 requests per 15 minutes per IP to reduce brute-force and abuse.
- **cloudinary** — Cloudinary Node SDK. Used in `server/src/routes/uploadRoutes.js` to upload event, hero, and profile images to Cloudinary so uploads persist across Render redeploys; when `CLOUDINARY_*` env vars are set, multer uses memory storage and files are uploaded to Cloudinary instead of disk.

---

## 1. server/src/db.js

```diff
--- a/server/src/db.js
+++ b/server/src/db.js
@@ -1,35 +1,82 @@
 require("dotenv").config();
 const { Sequelize } = require("sequelize");
-const mysql = require("mysql2/promise");
-
-// Database configuration from environment variables
-const DB_HOST = process.env.DB_HOST || "localhost";
-const DB_PORT = process.env.DB_PORT || 3306;
-const DB_USER = process.env.DB_USER || "root";
-const DB_PASSWORD = process.env.DB_PASSWORD || "";
-const DB_NAME = process.env.DB_NAME || "eventure";
-
-// Initialize Sequelize
-const sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
-  host: DB_HOST,
-  port: DB_PORT,
-  dialect: "mysql",
-  logging: false, // Set to console.log to see SQL queries in development
-});
-
-// Create mysql2 pool for raw SQL queries
-const pool = mysql.createPool({
-  host: DB_HOST,
-  port: DB_PORT,
-  user: DB_USER,
-  password: DB_PASSWORD,
-  database: DB_NAME,
-  waitForConnections: true,
-  connectionLimit: 10,
-  queueLimit: 0,
-});
-
-module.exports = sequelize;
-module.exports.pool = pool;
+const { Pool } = require("pg");
+
+// Prefer DATABASE_URL (Neon / Postgres); fallback to individual vars for local dev
+const DATABASE_URL = process.env.DATABASE_URL;
+const DB_HOST = process.env.DB_HOST || "localhost";
+const DB_PORT = parseInt(process.env.DB_PORT || "5432", 10);
+const DB_USER = process.env.DB_USER || "postgres";
+const DB_PASSWORD = process.env.DB_PASSWORD || "";
+const DB_NAME = process.env.DB_NAME || "eventure";
+
+let sequelize;
+if (DATABASE_URL) {
+  sequelize = new Sequelize(DATABASE_URL, {
+    dialect: "postgres",
+    logging: false,
+    dialectOptions: {
+      ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false,
+    },
+  });
+} else {
+  sequelize = new Sequelize(DB_NAME, DB_USER, DB_PASSWORD, {
+    host: DB_HOST,
+    port: DB_PORT,
+    dialect: "postgres",
+    logging: false,
+    dialectOptions: process.env.NODE_ENV === "production"
+      ? { ssl: { rejectUnauthorized: false } }
+      : {},
+  });
+}
+
+// pg pool for raw SQL (used when DATABASE_URL or Postgres)
+const pgPool = new Pool(
+  DATABASE_URL
+    ? { connectionString: DATABASE_URL, ssl: process.env.DATABASE_SSL !== "false" ? { rejectUnauthorized: false } : false }
+    : {
+        host: DB_HOST,
+        port: DB_PORT,
+        user: DB_USER,
+        password: DB_PASSWORD,
+        database: DB_NAME,
+        max: 10,
+        ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
+      }
+);
+
+// Convert MySQL-style ? placeholders to pg $1, $2, ...
+function toPgPlaceholders(sql) {
+  let i = 0;
+  return sql.replace(/\?/g, () => `$${++i}`);
+}
+
+// Execute raw SQL with mysql2-compatible API: execute(sql, params) -> [rowsOrResult, fields]
+async function execute(sql, params = []) {
+  const pgSql = toPgPlaceholders(sql);
+  const result = await pgPool.query(pgSql, params);
+  const upper = sql.trim().toUpperCase();
+  const isSelect = upper.startsWith("SELECT");
+  const isInsert = upper.startsWith("INSERT");
+  const isUpdate = upper.startsWith("UPDATE");
+  const isDelete = upper.startsWith("DELETE");
+
+  if (isSelect) {
+    return [result.rows, []];
+  }
+  if (isInsert && result.rows && result.rows[0] && "id" in result.rows[0]) {
+    return [{ insertId: result.rows[0].id, affectedRows: result.rowCount ?? 0 }, []];
+  }
+  if (isInsert || isUpdate || isDelete) {
+    return [{ insertId: undefined, affectedRows: result.rowCount ?? 0 }, []];
+  }
+  return [result.rows, []];
+}
+
+const pool = { execute };
+
+module.exports = sequelize;
+module.exports.pool = pool;
+module.exports.pgPool = pgPool;
```

---

## 2. server/src/index.js

```diff
--- a/server/src/index.js
+++ b/server/src/index.js
@@ -1,6 +1,8 @@
 require("dotenv").config();
 const express = require("express");
 const cookieParser = require("cookie-parser");
 const cors = require("cors");
+const helmet = require("helmet");
+const rateLimit = require("express-rate-limit");
 
 const sequelize = require("./db");
 const authRoutes = require("./routes/authRoutes");
@@ -19,30 +21,56 @@ if (!process.env.JWT_SECRET) {
   process.exit(1);
 }
 
-if (!process.env.DB_NAME) {
-  console.error("ERROR: DB_NAME environment variable is required");
+if (!process.env.DATABASE_URL && !process.env.DB_NAME) {
+  console.error("ERROR: DATABASE_URL (or DB_NAME for local Postgres) is required");
   process.exit(1);
 }
 
-// CORS allowlist
+// Trust proxy (Render, etc.) so secure cookies and X-Forwarded-* work
+app.set("trust proxy", 1);
+
+// CORS allowlist: FRONTEND_URL in production + localhost for dev
 const allowedOrigins = [
   "http://localhost:5173",
   "http://localhost:5174",
 ];
+if (process.env.FRONTEND_URL) {
+  const url = process.env.FRONTEND_URL.replace(/\/$/, "");
+  if (!allowedOrigins.includes(url)) allowedOrigins.push(url);
+}
 
 const corsOptions = {
   origin: (origin, callback) => {
-    // Allow requests with no origin (like Postman or curl)
-    if (!origin) {
-      return callback(null, true);
-    }
-    // Check if origin is in allowlist
-    if (allowedOrigins.includes(origin)) {
-      callback(null, true);
-    } else {
-      callback(new Error("Not allowed by CORS"));
-    }
+    if (!origin) return callback(null, true);
+    if (allowedOrigins.includes(origin)) return callback(null, true);
+    callback(new Error("Not allowed by CORS"));
   },
   credentials: true,
   methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
   allowedHeaders: ["Content-Type", "Authorization"],
 };
 
 // Middleware
 app.use(cors(corsOptions));
-app.use(express.json());
+app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
+app.use(express.json({ limit: "1mb" }));
 app.use(cookieParser());
 
-// Serve static files from uploads directory
+// Rate limit for auth routes (login, register, forgot-password, reset)
+const authLimiter = rateLimit({
+  windowMs: 15 * 60 * 1000,
+  max: 100,
+  message: { message: "Too many requests, try again later." },
+});
+app.use((req, res, next) => {
+  if (/\/api\/auth\/(login|register|forgot-password|reset-password-with-code)/.test(req.originalUrl || req.path)) {
+    return authLimiter(req, res, next);
+  }
+  next();
+});
+
+// Serve static files from uploads (local dev / fallback when not using Cloudinary)
 const path = require("path");
 app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
 app.use("/uploads/hero", express.static(path.join(__dirname, "../uploads/hero")));
 app.use("/uploads/profiles", express.static(path.join(__dirname, "../uploads/profiles")));
 
-// Handle OPTIONS preflight requests - CORS middleware already handles this
-
-// Health check endpoint
-app.get("/health", (req, res) => {
-  res.json({ ok: true });
+// Health check: verify DB connectivity
+app.get("/health", async (req, res) => {
+  try {
+    await sequelize.authenticate();
+    res.json({ ok: true });
+  } catch (err) {
+    res.status(503).json({ ok: false, error: "Database unreachable" });
+  }
 });
 
 // Auth routes
@@ -100,28 +128,19 @@ app.use((err, req, res, next) => {
 });
 
-// Connect to MySQL and start server
-(async () => {
+(async () => {
   try {
-    console.log("Attempting to connect to MySQL database...");
+    console.log("Connecting to database...");
     await sequelize.authenticate();
-    console.log("MySQL database connected successfully");
+    console.log("Database connected successfully");
     await verifyTransport();
     app.listen(PORT, () => {
       console.log(`Server is running on port ${PORT}`);
       console.log(`Health check: http://localhost:${PORT}/health`);
     });
   } catch (error) {
-    console.error("Failed to start server:");
-    console.error("Error details:", error.message);
-    console.error("MySQL connection failed. Please check:");
-    console.error("1. Your MySQL server is running");
-    console.error("2. Your database credentials are correct in .env file");
-    console.error("3. The database 'eventure' exists");
-    console.error("4. Your network connection is working");
+    console.error("Failed to start server:", error.message);
+    console.error("Check DATABASE_URL (or DB_* vars) and network.");
     process.exit(1);
   }
 })();
```

---

## 3. server/src/utils/jwt.js

```diff
--- a/server/src/utils/jwt.js
+++ b/server/src/utils/jwt.js
@@ -6,7 +6,7 @@ function setAuthCookie(res, token) {
   res.cookie('token', token, {
     httpOnly: true,
     sameSite: 'lax',
-    secure: false, // for local dev
+    secure: process.env.NODE_ENV === 'production',
     maxAge: maxAge
   });
 }
```

---

## 4. server/src/routes/authRoutes.js

Only the profile-update block changes (PUT /auth/profile):

```diff
--- a/server/src/routes/authRoutes.js
+++ b/server/src/routes/authRoutes.js
@@ -516,9 +516,9 @@ router.put("/auth/profile", authenticateToken, async (req, res) => {
       return res.status(400).json({ message: "showContactInfo is required" });
     }
 
-    // Update show_contact_info
+    // Update show_contact_info (Postgres: boolean)
     await pool.execute(
       "UPDATE users SET show_contact_info = ? WHERE id = ?",
-      [showContactInfo ? 1 : 0, userId]
+      [!!showContactInfo, userId]
     );
```

---

## 5. server/src/routes/eventsRoutes.js (Part 1 of 2)

```diff
--- a/server/src/routes/eventsRoutes.js
+++ b/server/src/routes/eventsRoutes.js
@@ -86,13 +86,15 @@ router.post("/", authenticateToken, authorize(["organizer", "admin"]), async (r
       }
     }
 
-    // Prepare SQL insert
+    // Prepare SQL insert (RETURNING id for Postgres)
     const sql = `
       INSERT INTO events (
         title, description, category, starts_at, ends_at,
         venue, address_line1, address_line2, city, state, zip_code, location,
         tags, ticket_price, capacity, main_image, image_2, image_3, image_4,
         is_public, created_by, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
+      RETURNING id
     `;
@@ -125,10 +127,10 @@ router.post("/", authenticateToken, authorize(["organizer", "admin"]), async (r
       image_3 ? String(image_3).trim().substring(0, 500) : null,
       image_4 ? String(image_4).trim().substring(0, 500) : null,
-      is_public ? 1 : 0,
+      !!is_public,
       userId,
     ];
 
-    const [result] = await pool.execute(sql, params);
-    const eventId = result.insertId;
+    const [result] = await pool.execute(sql, params);
+    const eventId = result.insertId ?? result[0]?.id;
 
     // Fetch the created event
@@ -142,18 +144,18 @@ router.post("/", authenticateToken, authorize(["organizer", "admin"]), async (r
   } catch (error) {
     console.error("Failed to create event:", error.message);
     
-    // Provide more detailed error messages
     let errorMessage = "Failed to create event";
-    if (error.code === "ER_NO_SUCH_TABLE") {
+    const code = error.code;
+    if (code === "ER_NO_SUCH_TABLE" || code === "42P01") {
       errorMessage = "Database table not found. Please check database setup.";
-    } else if (error.code === "ER_BAD_FIELD_ERROR") {
-      errorMessage = `Database column error: ${error.sqlMessage || "Missing required column"}. Please run the database migration files: add_capacity_to_events.sql and add_tags_ticket_price_to_events.sql`;
-    } else if (error.code === "ER_DUP_ENTRY") {
+    } else if (code === "ER_BAD_FIELD_ERROR" || code === "42703") {
+      errorMessage = `Database column error: ${error.sqlMessage || error.message || "Missing required column"}. Run postgres_bootstrap.sql.`;
+    } else if (code === "ER_DUP_ENTRY" || code === "23505") {
       errorMessage = "Duplicate entry. This event may already exist.";
-    } else if (error.sqlMessage) {
-      errorMessage = `Database error: ${error.sqlMessage}`;
-    } else if (error.message) {
-      errorMessage = error.message;
+    } else if (error.sqlMessage || error.message) {
+      errorMessage = `Database error: ${error.sqlMessage || error.message}`;
     }
     
     return res.status(500).json({ message: errorMessage });
@@ -166,8 +168,8 @@ router.get("/", async (req, res) => {
     const { limit, zip, radius, category, orderBy, order } = req.query;
 
-    // Only show approved events
-    const whereClauses = ["e.status = ?", "e.is_public = ?"];
-    const params = ["approved", 1];
+    // Only show approved events (Postgres: is_public boolean)
+    const whereClauses = ["e.status = ?", "e.is_public = ?"];
+    const params = ["approved", true];
```

---

## 6. server/src/routes/eventsRoutes.js (Part 2 of 2)

```diff
@@ -378,7 +378,7 @@ router.get("/attending", authenticateToken, async (req, res) => {
       WHERE r.user_id = ?
         AND e.status = 'approved'
-        AND e.is_public = 1
+        AND e.is_public = true
       GROUP BY e.id, r.status, r.created_at
       ORDER BY e.starts_at ASC
     `;
@@ -508,7 +508,7 @@ router.put("/:id", authenticateToken, async (req, res) => {
       main_image ? String(main_image).trim().substring(0, 500) : null,
       image_2 ? String(image_2).trim().substring(0, 500) : null,
       image_3 ? String(image_3).trim().substring(0, 500) : null,
       image_4 ? String(image_4).trim().substring(0, 500) : null,
-      is_public ? 1 : 0,
+      !!is_public,
       eventId,
     ];
@@ -661,7 +661,7 @@ router.get("/:id", async (req, res) => {
           OR e.created_by = ?
           )
         GROUP BY e.id, u.first_name, u.last_name, u.profile_picture, u.show_contact_info, u.email
         LIMIT 1
       `;
-      params = [eventId, "approved", 1, userId];
+      params = [eventId, "approved", true, userId];
     } else {
       // Public user - only approved public events
       sql = `
@@ -698,7 +698,7 @@ router.get("/:id", async (req, res) => {
           AND e.is_public = ?
         GROUP BY e.id, u.first_name, u.last_name, u.profile_picture, u.show_contact_info, u.email
         LIMIT 1
       `;
-      params = [eventId, "approved", 1];
+      params = [eventId, "approved", true];
     }
 
     const [rows] = await pool.execute(sql, params);
@@ -748,7 +748,7 @@ router.get("/categories", async (req, res) => {
       WHERE category IS NOT NULL 
         AND category != ''
         AND status = 'approved'
-        AND is_public = 1
+        AND is_public = true
       ORDER BY category ASC
     `;
```

---

## 7. server/src/routes/favoritesRoutes.js

```diff
--- a/server/src/routes/favoritesRoutes.js
+++ b/server/src/routes/favoritesRoutes.js
@@ -44,7 +44,7 @@ router.get("/", async (req, res) => {
       ) rsvp_counts ON e.id = rsvp_counts.event_id
       WHERE f.user_id = ?
         AND e.status = 'approved'
-        AND e.is_public = 1
+        AND e.is_public = true
       ORDER BY f.created_at DESC
     `;
@@ -68,7 +68,7 @@ router.post("/:eventId", async (req, res) => {
     // Check if event exists and is approved/public
     const eventCheckSql = `
       SELECT id FROM events 
-      WHERE id = ? AND status = 'approved' AND is_public = 1
+      WHERE id = ? AND status = 'approved' AND is_public = true
     `;
@@ -92,7 +92,7 @@ router.post("/:eventId", async (req, res) => {
   } catch (error) {
     console.error("Failed to add favorite:", error);
-    if (error.code === "ER_DUP_ENTRY") {
+    if (error.code === "ER_DUP_ENTRY" || error.code === "23505") {
       return res.status(200).json({ message: "Event already in favorites" });
     }
     return res.status(500).json({ message: "Failed to add favorite" });
```

---

## 8. server/src/routes/rsvpRoutes.js

```diff
--- a/server/src/routes/rsvpRoutes.js
+++ b/server/src/routes/rsvpRoutes.js
@@ -1,6 +1,6 @@
 const express = require("express");
 const { authenticateToken } = require("../middleware/auth");
-const pool = require("../db").pool;
+const { pool } = require("../db");
 
 const router = express.Router();
 
@@ -30,12 +30,12 @@ router.post("/:eventId", async (req, res) => {
     const event = eventRows[0];
 
-    // Check if event is viewable (approved and public, or created by user)
-    if (event.status !== "approved" || event.is_public !== 1) {
+    // Check if event is viewable (approved and public, or created by user)
+    const isPublic = event.is_public === 1 || event.is_public === true;
+    if (event.status !== "approved" || !isPublic) {
       // Allow if user is the creator
       const [creatorCheck] = await pool.execute(
         `SELECT created_by FROM events WHERE id = ? LIMIT 1`,
         [eventId]
       );
-      if (creatorCheck.length === 0 || creatorCheck[0].created_by !== userId) {
+      if (creatorCheck.length === 0 || String(creatorCheck[0].created_by) !== String(userId)) {
         return res.status(403).json({ message: "Event is not available for RSVP" });
       }
     }
```

---

## 9. server/src/routes/uploadRoutes.js

Full file replaced: disk-only multer → Cloudinary when env set, else disk. Key structure: `useCloudinary` flag, `uploadToCloudinary(buffer, mimetype, folder)`, memory storage when Cloudinary, same three endpoints returning URL (Cloudinary or `/uploads/...`).

```diff
--- a/server/src/routes/uploadRoutes.js
+++ b/server/src/routes/uploadRoutes.js
@@ -1,175 +1,141 @@
 const express = require("express");
 const multer = require("multer");
 const path = require("path");
 const fs = require("fs");
 const { authenticateToken, authorize } = require("../middleware/auth");
 
 const router = express.Router();
-
-// Ensure uploads directory exists
-const uploadsDir = path.join(__dirname, "../../uploads/events");
-if (!fs.existsSync(uploadsDir)) {
-  fs.mkdirSync(uploadsDir, { recursive: true });
-}
-
-// Configure multer storage
-const storage = multer.diskStorage({
-  destination: (req, file, cb) => {
-    cb(null, uploadsDir);
-  },
-  filename: (req, file, cb) => {
-    // Generate unique filename: timestamp-random-originalname
-    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
-    const ext = path.extname(file.originalname);
-    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
-    cb(null, `${name}-${uniqueSuffix}${ext}`);
-  },
-});
-
-// File filter - only allow images
-const fileFilter = (req, file, cb) => {
-  const allowedTypes = /jpeg|jpg|png|gif|webp/;
-  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
-  const mimetype = allowedTypes.test(file.mimetype);
-
-  if (extname && mimetype) {
-    cb(null, true);
-  } else {
-    cb(new Error("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)"), false);
-  }
-};
-
-// Configure multer
-const upload = multer({
-  storage: storage,
-  limits: {
-    fileSize: 10 * 1024 * 1024, // 10MB limit
-  },
-  fileFilter: fileFilter,
-});
-
-// POST /api/upload/event-image - Upload a single event image
-router.post("/event-image", authenticateToken, upload.single("image"), (req, res) => {
-  try {
-    if (!req.file) {
-      return res.status(400).json({ message: "No image file provided" });
-    }
-
-    // Return the file path relative to the uploads directory
-    // In production, this would be a full URL
-    const fileUrl = `/uploads/events/${req.file.filename}`;
-
-    return res.status(200).json({
-      message: "Image uploaded successfully",
-      url: fileUrl,
-      filename: req.file.filename,
-    });
-  } catch (error) {
-    console.error("Upload error:", error);
-    return res.status(500).json({ message: "Failed to upload image" });
-  }
-});
-
-// Ensure hero images directory exists
-const heroImagesDir = path.join(__dirname, "../../uploads/hero");
-if (!fs.existsSync(heroImagesDir)) {
-  fs.mkdirSync(heroImagesDir, { recursive: true });
-}
-
-// Configure multer for hero images
-const heroStorage = multer.diskStorage({
-  destination: (req, file, cb) => {
-    cb(null, heroImagesDir);
-  },
-  filename: (req, file, cb) => {
-    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
-    const ext = path.extname(file.originalname);
-    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
-    cb(null, `hero-${uniqueSuffix}${ext}`);
-  },
-});
-
-const heroUpload = multer({
-  storage: heroStorage,
-  limits: {
-    fileSize: 10 * 1024 * 1024, // 10MB limit
-  },
-  fileFilter: fileFilter,
-});
-
-// POST /api/upload/hero-image - Upload hero background image (admin only)
-router.post("/hero-image", authenticateToken, authorize(["admin"]), heroUpload.single("image"), (req, res) => {
-  try {
-    if (!req.file) {
-      return res.status(400).json({ message: "No image file provided" });
-    }
-
-    const fileUrl = `/uploads/hero/${req.file.filename}`;
-
-    return res.status(200).json({
-      message: "Hero image uploaded successfully",
-      url: fileUrl,
-      filename: req.file.filename,
-    });
-  } catch (error) {
-    console.error("Upload error:", error);
-    return res.status(500).json({ message: "Failed to upload hero image" });
-  }
-});
-
-// Ensure profile pictures directory exists
-const profilePicturesDir = path.join(__dirname, "../../uploads/profiles");
-if (!fs.existsSync(profilePicturesDir)) {
-  fs.mkdirSync(profilePicturesDir, { recursive: true });
-}
-
-// Configure multer for profile pictures
-const profileStorage = multer.diskStorage({
-  destination: (req, file, cb) => {
-    cb(null, profilePicturesDir);
-  },
-  filename: (req, file, cb) => {
-    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
-    const ext = path.extname(file.originalname);
-    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
-    cb(null, `profile-${uniqueSuffix}${ext}`);
-  },
-});
-
-const profileUpload = multer({
-  storage: profileStorage,
-  limits: {
-    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
-  },
-  fileFilter: fileFilter,
-});
-
-// POST /api/upload/profile-picture - Upload profile picture
-router.post("/profile-picture", authenticateToken, profileUpload.single("image"), async (req, res) => {
-  try {
-    if (!req.file) {
-      return res.status(400).json({ message: "No image file provided" });
-    }
-
-    const userId = req.user.id;
-    const fileUrl = `/uploads/profiles/${req.file.filename}`;
-
-    // Update user's profile_picture in database
-    const { pool } = require("../db");
-    await pool.execute(
-      "UPDATE users SET profile_picture = ? WHERE id = ?",
-      [fileUrl, userId]
-    );
-
-    return res.status(200).json({
-      message: "Profile picture uploaded successfully",
-      url: fileUrl,
-      filename: req.file.filename,
-    });
-  } catch (error) {
-    console.error("Upload error:", error);
-    return res.status(500).json({ message: "Failed to upload profile picture" });
-  }
-});
-
-module.exports = router;
+const useCloudinary = !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);
+let cloudinary;
+if (useCloudinary) {
+  cloudinary = require("cloudinary").v2;
+  cloudinary.config({
+    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
+    api_key: process.env.CLOUDINARY_API_KEY,
+    api_secret: process.env.CLOUDINARY_API_SECRET,
+  });
+}
+
+function fileFilter(req, file, cb) {
+  const allowedTypes = /jpeg|jpg|png|gif|webp/;
+  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
+  const mimetype = allowedTypes.test(file.mimetype);
+  if (extname && mimetype) cb(null, true);
+  else cb(new Error("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)"), false);
+}
+
+function uploadToCloudinary(buffer, mimetype, folder) {
+  return new Promise((resolve, reject) => {
+    const base64 = `data:${mimetype};base64,${buffer.toString("base64")}`;
+    cloudinary.uploader.upload(base64, { folder: folder || "eventure" }, (err, result) => {
+      if (err) return reject(err);
+      resolve(result.secure_url);
+    });
+  });
+}
+
+const uploadsDir = path.join(__dirname, "../../uploads/events");
+if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
+
+const storage = useCloudinary
+  ? multer.memoryStorage()
+  : multer.diskStorage({
+      destination: (req, file, cb) => cb(null, uploadsDir),
+      filename: (req, file, cb) => {
+        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
+        const ext = path.extname(file.originalname);
+        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
+        cb(null, `${name}-${uniqueSuffix}${ext}`);
+      },
+    });
+
+const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
+
+router.post("/event-image", authenticateToken, upload.single("image"), async (req, res) => {
+  try {
+    if (!req.file) return res.status(400).json({ message: "No image file provided" });
+    let fileUrl;
+    if (useCloudinary && req.file.buffer) {
+      fileUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "eventure/events");
+    } else {
+      fileUrl = `/uploads/events/${req.file.filename}`;
+    }
+    return res.status(200).json({ message: "Image uploaded successfully", url: fileUrl, filename: req.file.filename || req.file.originalname });
+  } catch (error) {
+    console.error("Upload error:", error);
+    return res.status(500).json({ message: "Failed to upload image" });
+  }
+});
+
+const heroImagesDir = path.join(__dirname, "../../uploads/hero");
+if (!fs.existsSync(heroImagesDir)) fs.mkdirSync(heroImagesDir, { recursive: true });
+const heroStorage = useCloudinary ? multer.memoryStorage() : multer.diskStorage({ ... });
+const heroUpload = multer({ storage: heroStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });
+
+router.post("/hero-image", ... async (req, res) => { ... fileUrl = useCloudinary && req.file.buffer ? await uploadToCloudinary(...) : `/uploads/hero/${req.file.filename}`; ... });
+
+const profilePicturesDir = path.join(__dirname, "../../uploads/profiles");
+... profileStorage, profileUpload ...
+router.post("/profile-picture", ... async (req, res) => { ... fileUrl = useCloudinary && req.file.buffer ? await uploadToCloudinary(...) : `/uploads/profiles/${req.file.filename}`; const { pool } = require("../db"); await pool.execute("UPDATE users SET profile_picture = ? WHERE id = ?", [fileUrl, userId]); ... });
+
+module.exports = router;
```

*(The uploadRoutes diff above is a summary; the exact full replacement is the current file content you have on disk — 141 lines.)*

---

## 10. server/src/routes/adminRoutes.js (Part 1 of 2)

Analytics and hero settings:

```diff
--- a/server/src/routes/adminRoutes.js
+++ b/server/src/routes/adminRoutes.js
@@ -419,51 +419,51 @@ router.get("/analytics", async (req, res) => {
   try {
-    // Get events created over time (last 12 months, grouped by month)
-    const [eventsOverTime] = await pool.execute(`
-      SELECT 
-        DATE_FORMAT(created_at, '%Y-%m') as month,
-        COUNT(*) as count
-      FROM events
-      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
-      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
-      ORDER BY month ASC
-    `);
-
-    // Get users registered over time (last 12 months, grouped by month)
-    const [usersOverTime] = await pool.execute(`
-      SELECT 
-        DATE_FORMAT(created_at, '%Y-%m') as month,
-        COUNT(*) as count
-      FROM users
-      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH)
-      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
-      ORDER BY month ASC
-    `);
-
-    // Get RSVPs over time (last 12 months, grouped by month)
-    const [rsvpsOverTime] = await pool.execute(`
-      SELECT 
-        DATE_FORMAT(created_at, '%Y-%m') as month,
-        COUNT(*) as count
-      FROM rsvps
-      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 12 MONTH) AND status = 'going'
-      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
-      ORDER BY month ASC
-    `);
+    // Get events created over time (last 12 months, grouped by month) - Postgres
+    const [eventsOverTime] = await pool.execute(`
+      SELECT 
+        to_char(created_at, 'YYYY-MM') as month,
+        COUNT(*)::int as count
+      FROM events
+      WHERE created_at >= (NOW() - INTERVAL '12 months')
+      GROUP BY to_char(created_at, 'YYYY-MM')
+      ORDER BY month ASC
+    `);
+
+    const [usersOverTime] = await pool.execute(`
+      SELECT 
+        to_char(created_at, 'YYYY-MM') as month,
+        COUNT(*)::int as count
+      FROM users
+      WHERE created_at >= (NOW() - INTERVAL '12 months')
+      GROUP BY to_char(created_at, 'YYYY-MM')
+      ORDER BY month ASC
+    `);
+
+    const [rsvpsOverTime] = await pool.execute(`
+      SELECT 
+        to_char(created_at, 'YYYY-MM') as month,
+        COUNT(*)::int as count
+      FROM rsvps
+      WHERE created_at >= (NOW() - INTERVAL '12 months') AND status = 'going'
+      GROUP BY to_char(created_at, 'YYYY-MM')
+      ORDER BY month ASC
+    `);
@@ -473,23 +473,23 @@ router.get("/analytics", async (req, res) => {
     `);
 
-    // Get total counts
+    // Get total counts (quoted aliases for Postgres camelCase)
     const [totalCounts] = await pool.execute(`
       SELECT 
-        (SELECT COUNT(*) FROM users) as totalUsers,
-        (SELECT COUNT(*) FROM events) as totalEvents,
-        (SELECT COUNT(*) FROM events WHERE status = 'approved') as approvedEvents,
-        (SELECT COUNT(*) FROM rsvps WHERE status = 'going') as totalRsvps
+        (SELECT COUNT(*) FROM users) as "totalUsers",
+        (SELECT COUNT(*) FROM events) as "totalEvents",
+        (SELECT COUNT(*) FROM events WHERE status = 'approved') as "approvedEvents",
+        (SELECT COUNT(*) FROM rsvps WHERE status = 'going') as "totalRsvps"
     `);
@@ -521,35 +521,35 @@ router.put("/settings/hero", async (req, res) => {
       return res.status(400).json({ message: "Image is required when type is 'image'" });
     }
 
-    // Ensure settings table exists
+    // Ensure settings table exists (Postgres)
     await pool.execute(`
       CREATE TABLE IF NOT EXISTS site_settings (
-        id INT AUTO_INCREMENT PRIMARY KEY,
+        id SERIAL PRIMARY KEY,
         setting_key VARCHAR(100) UNIQUE NOT NULL,
         setting_value TEXT,
-        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
+        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )
     `).catch(() => {});
 
-    // Update or insert settings
+    // Update or insert settings (Postgres ON CONFLICT)
     await pool.execute(`
       INSERT INTO site_settings (setting_key, setting_value)
       VALUES ('hero_background_type', ?)
-      ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
+      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
     `, [type]);
 
     if (type === "color") {
       await pool.execute(`
         INSERT INTO site_settings (setting_key, setting_value)
         VALUES ('hero_background_color', ?)
-        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
+        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
       `, [color]);
-      
-      // Clear image if switching to color
       await pool.execute(`
         INSERT INTO site_settings (setting_key, setting_value)
         VALUES ('hero_background_image', ?)
-        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
+        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
       `, [null]);
     } else {
       await pool.execute(`
         INSERT INTO site_settings (setting_key, setting_value)
         VALUES ('hero_background_image', ?)
-        ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)
+        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
       `, [image]);
     }
```

---

## 11. server/src/models/User.js

```diff
--- a/server/src/models/User.js
+++ b/server/src/models/User.js
@@ -33,9 +33,10 @@ const User = sequelize.define(
       field: "last_name",
     },
     role: {
-      type: DataTypes.ENUM("admin", "organizer", "user"),
+      type: DataTypes.STRING,
       allowNull: false,
       defaultValue: "user",
+      validate: { isIn: [["admin", "organizer", "user"]] },
     },
   },
   {
```

---

## 12. server/package.json

```diff
--- a/server/package.json
+++ b/server/package.json
@@ -12,10 +12,13 @@
     "dotenv": "^17.2.3",
     "express": "^5.2.1",
     "jsonwebtoken": "^9.0.3",
     "multer": "^2.0.2",
-    "mysql2": "^3.16.1",
     "nodemailer": "^7.0.12",
     "sequelize": "^6.37.7"
   },
+    "cloudinary": "^2.0.0",
+    "express-rate-limit": "^7.5.0",
+    "helmet": "^8.0.0",
+    "pg": "^8.13.0",
   "devDependencies": {
```

*(Dependencies block: remove mysql2; add cloudinary, express-rate-limit, helmet, pg. Order in file: bcrypt, cloudinary, cookie-parser, cors, dotenv, express, express-rate-limit, helmet, jsonwebtoken, multer, nodemailer, pg, sequelize.)*

---

## 13. server/.env.example

```diff
--- a/server/.env.example
+++ b/server/.env.example
@@ -1,7 +1,30 @@
+# Server
 PORT=5000
-DB_HOST=localhost
-DB_PORT=3306
-DB_NAME=eventure_db
-DB_USER=root
-DB_PASSWORD=leyjoel23
-JWT_SECRET=PUT_A_LONG_RANDOM_STRING_HERE
+NODE_ENV=development
+
+# Database (Neon Postgres - use DATABASE_URL in production)
+DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require
+# Or for local Postgres:
+# DB_HOST=localhost
+# DB_PORT=5432
+# DB_NAME=eventure
+# DB_USER=postgres
+# DB_PASSWORD=your_password
+
+# Auth
+JWT_SECRET=generate_a_long_random_string_at_least_32_chars
+
+# Frontend URL (for CORS) - set to your Cloudflare Pages URL in production
+FRONTEND_URL=https://your-project.pages.dev
+
+# Cloudinary (optional - if not set, uploads go to server/uploads/)
+CLOUDINARY_CLOUD_NAME=your_cloud_name
+CLOUDINARY_API_KEY=your_api_key
+CLOUDINARY_API_SECRET=your_api_secret
+
+# Email (optional - if not set, OTP codes are logged to console)
+# SMTP_HOST=smtp.example.com
+# SMTP_PORT=587
+# SMTP_USER=
+# SMTP_PASS=
+# SMTP_FROM=Eventure <no-reply@example.com>
```

---

## New files — full contents

### server/database/postgres_bootstrap.sql (full content)

```sql
-- ============================================
-- Eventure Postgres Bootstrap Schema
-- Run this once on a fresh Neon (or any Postgres) database.
-- Compatible with Neon Free tier (SSL required).
-- ============================================

-- users
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(255) NOT NULL,
  last_name VARCHAR(255) NOT NULL,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'organizer', 'user')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  profile_picture VARCHAR(500) NULL,
  show_contact_info BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_show_contact_info ON users (show_contact_info);

-- password_reset_codes
CREATE TABLE IF NOT EXISTS password_reset_codes (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash VARCHAR(255) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_prc_user_id ON password_reset_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_prc_expires_at ON password_reset_codes (expires_at);

-- events
CREATE TABLE IF NOT EXISTS events (
  id BIGSERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NULL,
  venue VARCHAR(255),
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100),
  state VARCHAR(50),
  zip_code VARCHAR(10),
  location VARCHAR(500),
  lat DECIMAL(10, 8),
  lng DECIMAL(11, 8),
  category VARCHAR(100) NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  created_by BIGINT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  capacity INT NULL,
  tags VARCHAR(500) NULL,
  ticket_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
  main_image VARCHAR(500) NULL,
  image_2 VARCHAR(500) NULL,
  image_3 VARCHAR(500) NULL,
  image_4 VARCHAR(500) NULL
);

CREATE INDEX IF NOT EXISTS idx_events_status ON events (status);
CREATE INDEX IF NOT EXISTS idx_events_is_public ON events (is_public);
CREATE INDEX IF NOT EXISTS idx_events_created_by ON events (created_by);
CREATE INDEX IF NOT EXISTS idx_events_starts_at ON events (starts_at);
CREATE INDEX IF NOT EXISTS idx_events_category ON events (category);
CREATE INDEX IF NOT EXISTS idx_events_zip_code ON events (zip_code);

-- zip_locations
CREATE TABLE IF NOT EXISTS zip_locations (
  zip_code VARCHAR(10) PRIMARY KEY,
  lat DECIMAL(10, 8) NOT NULL,
  lng DECIMAL(11, 8) NOT NULL,
  city VARCHAR(100),
  state VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_zip_locations_lat_lng ON zip_locations (lat, lng);

-- favorites
CREATE TABLE IF NOT EXISTS favorites (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites (user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_event_id ON favorites (event_id);

-- rsvps
CREATE TABLE IF NOT EXISTS rsvps (
  id BIGSERIAL PRIMARY KEY,
  user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id BIGINT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'going' CHECK (status IN ('going', 'maybe', 'not_going')),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (user_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_rsvps_user_id ON rsvps (user_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_event_id ON rsvps (event_id);
CREATE INDEX IF NOT EXISTS idx_rsvps_status ON rsvps (status);

-- site_settings (used by admin hero settings)
CREATE TABLE IF NOT EXISTS site_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(100) UNIQUE NOT NULL,
  setting_value TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trigger to update updated_at on events (Postgres has no ON UPDATE CURRENT_TIMESTAMP)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS events_updated_at ON events;
CREATE TRIGGER events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS users_updated_at ON users;
CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

DROP TRIGGER IF EXISTS rsvps_updated_at ON rsvps;
CREATE TRIGGER rsvps_updated_at
  BEFORE UPDATE ON rsvps
  FOR EACH ROW EXECUTE PROCEDURE set_updated_at();

-- ============================================
-- Bootstrap complete
-- ============================================
```

### server/database/seed_zip_locations_postgres.sql (full content)

```sql
-- ============================================
-- Seed ZIP code locations (Postgres)
-- Run after postgres_bootstrap.sql
-- Uses ON CONFLICT DO NOTHING (equivalent to INSERT IGNORE)
-- ============================================

INSERT INTO zip_locations (zip_code, lat, lng, city, state) VALUES
('10001', 40.7506, -73.9973, 'New York', 'NY'),
('10002', 40.7158, -73.9870, 'New York', 'NY'),
('90210', 34.0901, -118.4065, 'Beverly Hills', 'CA'),
('94102', 37.7749, -122.4194, 'San Francisco', 'CA'),
('60601', 41.8781, -87.6298, 'Chicago', 'IL'),
('02101', 42.3601, -71.0589, 'Boston', 'MA'),
('75201', 32.7767, -96.7970, 'Dallas', 'TX'),
('30301', 33.7490, -84.3880, 'Atlanta', 'GA'),
('98101', 47.6062, -122.3321, 'Seattle', 'WA'),
('80202', 39.7392, -104.9903, 'Denver', 'CO'),
('02910', 41.8236, -71.4222, 'Providence', 'RI'),
('02806', 41.7001, -71.4162, 'Barrington', 'RI'),
('02818', 41.4901, -71.3128, 'East Greenwich', 'RI'),
('02840', 41.4882, -71.5346, 'Narragansett', 'RI'),
('02885', 41.4840, -71.4128, 'Warwick', 'RI'),
('02886', 41.7001, -71.4162, 'Warwick', 'RI'),
('02888', 41.8236, -71.4222, 'West Warwick', 'RI'),
('02895', 41.4901, -71.3128, 'Westerly', 'RI'),
('33101', 25.7617, -80.1918, 'Miami', 'FL'),
('77001', 29.7604, -95.3698, 'Houston', 'TX'),
('85001', 33.4484, -112.0740, 'Phoenix', 'AZ'),
('97201', 45.5152, -122.6784, 'Portland', 'OR'),
('78701', 30.2672, -97.7431, 'Austin', 'TX'),
('20001', 38.9072, -77.0369, 'Washington', 'DC'),
('19101', 39.9526, -75.1652, 'Philadelphia', 'PA'),
('48201', 42.3314, -83.0458, 'Detroit', 'MI'),
('55401', 44.9778, -93.2650, 'Minneapolis', 'MN'),
('70112', 29.9511, -90.0715, 'New Orleans', 'LA')
ON CONFLICT (zip_code) DO NOTHING;
```

### docs/DEPLOYMENT.md (full content)

```markdown
# Eventure — Production Deployment (Free Tier)

**Stack:** Cloudflare Pages (frontend) · Render (backend) · Neon Postgres · Cloudinary (uploads)

---

## 1. Neon Postgres (Database)

1. Go to [neon.tech](https://neon.tech) and create a free account.
2. Create a new project (e.g. `eventure`). Choose a region close to your Render region.
3. Copy the **connection string** from the dashboard (Connection string → **Postgres**). It looks like:
   postgresql://user:password@ep-xxx.region.aws.neon.tech/neondb?sslmode=require
4. In Neon SQL Editor (or any Postgres client connected to this DB), run the bootstrap script:
   - Open `server/database/postgres_bootstrap.sql` from this repo.
   - Copy its contents and run them in the Neon SQL Editor.
5. (Optional) Seed ZIP codes for radius search:
   - Open `server/database/seed_zip_locations_postgres.sql`.
   - Run its contents in the Neon SQL Editor.

**Migrations:** For future schema changes, run SQL in Neon SQL Editor or use a migration tool. The app does not run migrations automatically.

---

## 2. Cloudinary (Image / file uploads)

1. Go to [cloudinary.com](https://cloudinary.com) and create a free account.
2. In the Dashboard, note: **Cloud name**, **API Key**, **API Secret** (click "Reveal").
3. You will pass these to the backend as env vars (see Render section).

---

## 3. Render (Backend)

1. Go to [render.com](https://render.com) and sign in (e.g. with GitHub).
2. **New → Web Service**.
3. Connect your GitHub repo and select the repository that contains Eventure.
4. **Settings:** Name (e.g. eventure-api), **Root Directory:** server, **Runtime:** Node, **Build Command:** npm ci, **Start Command:** npm start, **Instance Type:** Free.
5. **Environment variables:** NODE_ENV=production, PORT (empty), JWT_SECRET, DATABASE_URL (Neon connection string), FRONTEND_URL (Cloudflare Pages URL), CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET. Optional: SMTP_*.
6. **Health Check Path:** /health
7. Deploy. Note the service URL for VITE_API_URL.

---

## 4. Cloudflare Pages (Frontend)

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages → Create → Pages → Connect to Git.
2. Select repo. **Build settings:** Root directory: client, Build command: npm ci && npm run build, Build output directory: dist.
3. **Environment variables:** VITE_API_URL = Render backend URL (no trailing slash).
4. **SPA fallback:** Ensure `client/public/_redirects` contains: /*    /index.html   200
5. Deploy. Note Pages URL; set as FRONTEND_URL in Render.

---

## 5. Post-deploy checklist

- [ ] Backend /health → { "ok": true }
- [ ] Frontend loads; CORS ok; Register/Login; Create event + upload image; image persists after refresh; Favorites; RSVP; Admin; Profile picture.

---

## 6. Local verification (before deploy)

Backend: cd server, cp .env.example .env, set DATABASE_URL JWT_SECRET FRONTEND_URL, npm ci, npm run dev. Run postgres_bootstrap.sql (and optionally seed_zip_locations_postgres.sql) in Neon. Frontend: cd client, .env VITE_API_URL=http://localhost:5000, npm ci, npm run dev. Open http://localhost:5173.

---

## 7. Env var reference

VITE_API_URL (client build), NODE_ENV, PORT, JWT_SECRET, DATABASE_URL, FRONTEND_URL, CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET, SMTP_* (optional).

---

## 8. Troubleshooting

Health 503 → check DATABASE_URL, Neon. CORS → FRONTEND_URL must match Pages URL. Images 404 → set all CLOUDINARY_* on Render. Cookie not persisting → NODE_ENV=production, HTTPS.
```

### docs/DEPLOYMENT_PLAN_AND_CHANGES.md (full content)

```markdown
# Eventure — Production Deployment Plan & File Change List

**Hosting:** Cloudflare Pages (frontend) | Render (backend) | Neon Postgres | Cloudinary (uploads)

---

## STEP 1 — READ-ONLY AUDIT OUTPUT

### A) Table-by-table schema spec (from schema.sql + migrations)

| Table | Columns |
|-------|---------|
| **users** | id (BIGINT PK), email (VARCHAR 255 UNIQUE), password_hash (VARCHAR 255), first_name, last_name, role (ENUM admin/organizer/user), created_at, updated_at, profile_picture (VARCHAR 500 NULL), show_contact_info (TINYINT 1 default 0) |
| **password_reset_codes** | id (BIGINT PK), user_id (BIGINT FK users), code_hash (VARCHAR 255), expires_at (DATETIME), used_at (DATETIME NULL), created_at |
| **events** | id (BIGINT PK), title, description, starts_at, ends_at, venue, address_line1, address_line2, city, state (VARCHAR 50), zip_code, location (VARCHAR 500 NULL), lat, lng, category, status (ENUM pending/approved/declined), is_public (TINYINT 1), created_by (FK users), created_at, updated_at, capacity (INT NULL), tags (VARCHAR 500 NULL), ticket_price (DECIMAL 10,2 default 0), main_image, image_2, image_3, image_4 (VARCHAR 500 NULL) |
| **zip_locations** | zip_code (VARCHAR 10 PK), lat, lng, city, state, created_at |
| **favorites** | id (BIGINT PK), user_id (FK users), event_id (FK events), created_at; UNIQUE(user_id, event_id) |
| **rsvps** | id (BIGINT PK), user_id (FK users), event_id (FK events), status (ENUM going/maybe/not_going), created_at, updated_at; UNIQUE(user_id, event_id) |
| **site_settings** | id (INT PK), setting_key (VARCHAR 100 UNIQUE), setting_value (TEXT), updated_at; created at runtime in adminRoutes |

### B) File upload endpoints and frontend consumption

| Endpoint | Method | Auth | Storage | Response | Frontend use |
|----------|--------|------|---------|----------|--------------|
| /api/upload/event-image | POST | Yes | uploads/events/ | { url: "/uploads/events/...", filename } | Event create/edit: stores url in main_image, image_2–4; display via getImageUrl(path) or path.startsWith("http") |
| /api/upload/hero-image | POST | Admin | uploads/hero/ | { url: "/uploads/hero/...", filename } | Admin hero settings; stored in site_settings |
| /api/upload/profile-picture | POST | Yes | uploads/profiles/ | { url: "/uploads/profiles/...", filename }; updates users.profile_picture | NavBar, MyAccount, EventDetails organizer |

Frontend: getImageUrl(imagePath) = imagePath.startsWith("http") ? imagePath : API_URL + imagePath. So storing full Cloudinary URLs requires no frontend change.

### C) Environment variables currently used

| Variable | Where read | Required |
|----------|------------|----------|
| PORT | server/src/index.js | No (default 5000) |
| DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME | server/src/db.js | Yes for MySQL (replaced by DATABASE_URL for Postgres) |
| JWT_SECRET | server/src/index.js, jwt.js, auth middleware, eventsRoutes (jwt.verify) | Yes |
| NODE_ENV | server/src/index.js (dev routes), jwt (cookie secure), mailer, adminRoutes (error detail) | No |
| SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM | server/src/utils/mailer.js | No (fallback logs to console) |
| VITE_API_URL | client (api.js, pages, NavBar) at build time | No (default localhost:5000) |

---

## PLAN + FILE CHANGE LIST

### New files
- server/database/postgres_bootstrap.sql — Postgres schema (tables, indexes, FKs)
- server/database/seed_zip_locations_postgres.sql — Seed zip_locations (optional)
- docs/DEPLOYMENT.md — Exact hosting setup (Cloudflare, Render, Neon, Cloudinary)
- .gitignore (root) — Ignore server/.env

### Modified files
- server/src/db.js — DATABASE_URL, Postgres Sequelize + pg pool; pool.execute() wrapper (? → $n, result normalization)
- server/src/index.js — CORS (FRONTEND_URL + localhost), trust proxy, helmet, rate-limit (auth), express json limit, /health DB check
- server/src/utils/jwt.js — secure: process.env.NODE_ENV === 'production'
- server/src/routes/uploadRoutes.js — Cloudinary upload (memory multer), return Cloudinary URL; profile update with URL
- server/src/routes/authRoutes.js — pool.execute; show_contact_info boolean
- server/src/routes/eventsRoutes.js — INSERT RETURNING id; is_public boolean; pg error codes
- server/src/routes/favoritesRoutes.js — is_public true; ER_DUP_ENTRY || 23505
- server/src/routes/rsvpRoutes.js — const { pool }; creator String(); is_public boolean
- server/src/routes/adminRoutes.js — site_settings Postgres (SERIAL, ON CONFLICT); DATE_FORMAT → to_char; totalCounts quoted aliases
- server/package.json — Add pg, helmet, express-rate-limit, cloudinary; remove mysql2
- server/.env.example — Placeholders only; add DATABASE_URL, FRONTEND_URL, CLOUDINARY_*

### Not changed (by design)
- Client: no UI, routes, or feature changes; image URLs work with full Cloudinary URLs via existing startsWith("http")
- Server: auth, events, favorites, rsvp, admin behavior unchanged; only DB dialect, upload storage, CORS, and hardening

---

## Endpoint list (reference)

- GET/POST /api/auth/register, /api/auth/login, /api/auth/logout
- POST /api/auth/forgot-password, /api/auth/reset-password-with-code, /api/auth/verify-reset-code, /api/auth/reset-password
- GET /api/auth/profile, PUT /api/auth/profile
- POST /api/auth/change-password-request, /api/auth/change-password
- POST /api/auth/delete-account-request, DELETE /api/auth/delete-account
- GET /api/events, GET /api/events/categories, GET /api/events/my, GET /api/events/attending, GET /api/events/:id
- POST /api/events, PUT /api/events/:id, DELETE /api/events/:id
- GET/POST/DELETE /api/favorites, GET /api/favorites/check/:eventId, DELETE /api/favorites/:eventId
- POST/DELETE/GET /api/rsvp/:eventId
- POST /api/upload/event-image, /api/upload/hero-image, /api/upload/profile-picture
- GET /api/admin/settings/hero, PUT /api/admin/settings/hero, GET /api/admin/stats, GET/PUT/DELETE /api/admin/events, GET/DELETE /api/admin/users, GET /api/admin/analytics, etc.
- GET /health
```

### .gitignore (root) (full content)

```
# Dependencies
node_modules

# Environment (never commit secrets)
.env
server/.env
client/.env
*.env.local

# Build outputs
client/dist
dist-ssr
*.local

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?
```

### scripts/verify-local.md (full content)

```markdown
# Local verification (exact commands)

Run from repo root.

## 1. Backend (Postgres + env)

```bash
cd server
copy .env.example .env
# Edit .env: set DATABASE_URL (Neon connection string), JWT_SECRET, FRONTEND_URL=http://localhost:5173
# Optional: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET for Cloudinary uploads
npm ci
npm run dev
```

In another terminal:

```bash
curl -s http://localhost:5000/health
```

Expected: `{"ok":true}`

## 2. Database bootstrap (once)

- Open Neon SQL Editor (or any Postgres client with your DATABASE_URL).
- Run contents of `server/database/postgres_bootstrap.sql`.
- Optionally run `server/database/seed_zip_locations_postgres.sql`.

## 3. Frontend

```bash
cd client
# Create .env with: VITE_API_URL=http://localhost:5000
npm ci
npm run dev
```

Open http://localhost:5173 in a browser.

## 4. Manual checks

- Register a user → Log in → Log out → Log in again.
- Create an event (as organizer), upload an image. Refresh; image should still show (local path or Cloudinary URL).
- Add favorite, RSVP. Confirm they persist.
- If admin: open /admin, check stats; upload hero image; confirm it persists.
```

### scripts/verify-live-checklist.md (full content)

```markdown
# Live verification checklist (after deploy)

Use this after deploying to Cloudflare Pages + Render + Neon + Cloudinary.

- [ ] **Health:** Open `https://<your-render-url>/health` → `{"ok":true}`.
- [ ] **Frontend:** Open Cloudflare Pages URL → Eventure home loads; no console errors.
- [ ] **Register:** Create a new account → success.
- [ ] **Login:** Log in → redirect/dashboard; token/cookie works.
- [ ] **Protected routes:** Visit /dashboard, /my-events, /favorites without being logged out.
- [ ] **Create event:** As organizer, create an event with title, description, category, date, image.
- [ ] **Upload image:** Upload event image → success; image URL is Cloudinary (starts with https://res.cloudinary.com).
- [ ] **Persist image:** Refresh the page → event image still loads (persists across redeploys).
- [ ] **Favorites:** Add event to favorites → list shows it; refresh → still there.
- [ ] **RSVP:** RSVP to an event → status shows; refresh → still going.
- [ ] **Admin (if applicable):** Log in as admin → /admin loads; stats; upload hero image → refresh → hero image persists.
- [ ] **Profile picture:** Upload profile picture → appears in nav; refresh → still there.
- [ ] **CORS:** No "blocked by CORS" errors when using the live frontend URL.
```

### client/public/_redirects (full content)

```
/*    /index.html   200
```

---

End of document.
