const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { authenticateToken, authorize } = require("../middleware/auth");

const router = express.Router();

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "../../uploads/events");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp-random-originalname
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
    cb(null, `${name}-${uniqueSuffix}${ext}`);
  },
});

// File filter - only allow images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)"), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// POST /api/upload/event-image - Upload a single event image
router.post("/event-image", authenticateToken, upload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    // Return the file path relative to the uploads directory
    // In production, this would be a full URL
    const fileUrl = `/uploads/events/${req.file.filename}`;

    return res.status(200).json({
      message: "Image uploaded successfully",
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload image" });
  }
});

// Ensure hero images directory exists
const heroImagesDir = path.join(__dirname, "../../uploads/hero");
if (!fs.existsSync(heroImagesDir)) {
  fs.mkdirSync(heroImagesDir, { recursive: true });
}

// Configure multer for hero images
const heroStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, heroImagesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
    cb(null, `hero-${uniqueSuffix}${ext}`);
  },
});

const heroUpload = multer({
  storage: heroStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: fileFilter,
});

// POST /api/upload/hero-image - Upload hero background image (admin only)
router.post("/hero-image", authenticateToken, authorize(["admin"]), heroUpload.single("image"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const fileUrl = `/uploads/hero/${req.file.filename}`;

    return res.status(200).json({
      message: "Hero image uploaded successfully",
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload hero image" });
  }
});

// Ensure profile pictures directory exists
const profilePicturesDir = path.join(__dirname, "../../uploads/profiles");
if (!fs.existsSync(profilePicturesDir)) {
  fs.mkdirSync(profilePicturesDir, { recursive: true });
}

// Configure multer for profile pictures
const profileStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, profilePicturesDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
    cb(null, `profile-${uniqueSuffix}${ext}`);
  },
});

const profileUpload = multer({
  storage: profileStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for profile pictures
  },
  fileFilter: fileFilter,
});

// POST /api/upload/profile-picture - Upload profile picture
router.post("/profile-picture", authenticateToken, profileUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }

    const userId = req.user.id;
    const fileUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user's profile_picture in database
    const { pool } = require("../db");
    await pool.execute(
      "UPDATE users SET profile_picture = ? WHERE id = ?",
      [fileUrl, userId]
    );

    return res.status(200).json({
      message: "Profile picture uploaded successfully",
      url: fileUrl,
      filename: req.file.filename,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload profile picture" });
  }
});

module.exports = router;
