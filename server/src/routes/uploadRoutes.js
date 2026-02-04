const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { pool } = require("../db");
const { authenticateToken, authorize } = require("../middleware/auth");

const router = express.Router();

const useCloudinary = !!(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);
let cloudinary;
if (useCloudinary) {
  cloudinary = require("cloudinary").v2;
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

function fileFilter(req, file, cb) {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);
  if (extname && mimetype) cb(null, true);
  else cb(new Error("Only image files are allowed (JPEG, JPG, PNG, GIF, WEBP)"), false);
}

function uploadToCloudinary(buffer, mimetype, folder) {
  return new Promise((resolve, reject) => {
    const base64 = `data:${mimetype};base64,${buffer.toString("base64")}`;
    cloudinary.uploader.upload(base64, { folder: folder || "eventure" }, (err, result) => {
      if (err) return reject(err);
      resolve(result.secure_url);
    });
  });
}

const uploadsDir = path.join(__dirname, "../../uploads/events");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, uploadsDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, "-");
        cb(null, `${name}-${uniqueSuffix}${ext}`);
      },
    });

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter,
});

router.post("/event-image", authenticateToken, upload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    let fileUrl;
    if (useCloudinary && req.file.buffer) {
      fileUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "eventure/events");
    } else {
      fileUrl = `/uploads/events/${req.file.filename}`;
    }
    const filename = req.file.filename || req.file.originalname;
    return res.status(200).json({ message: "Image uploaded successfully", url: fileUrl, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload image" });
  }
});

const heroImagesDir = path.join(__dirname, "../../uploads/hero");
if (!fs.existsSync(heroImagesDir)) fs.mkdirSync(heroImagesDir, { recursive: true });
const heroStorage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, heroImagesDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `hero-${uniqueSuffix}${ext}`);
      },
    });
const heroUpload = multer({ storage: heroStorage, limits: { fileSize: 10 * 1024 * 1024 }, fileFilter });

router.post("/hero-image", authenticateToken, authorize(["admin"]), heroUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    let fileUrl;
    if (useCloudinary && req.file.buffer) {
      fileUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "eventure/hero");
    } else {
      fileUrl = `/uploads/hero/${req.file.filename}`;
    }
    const filename = req.file.filename || req.file.originalname;
    return res.status(200).json({ message: "Hero image uploaded successfully", url: fileUrl, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload hero image" });
  }
});

const profilePicturesDir = path.join(__dirname, "../../uploads/profiles");
if (!fs.existsSync(profilePicturesDir)) fs.mkdirSync(profilePicturesDir, { recursive: true });
const profileStorage = useCloudinary
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: (req, file, cb) => cb(null, profilePicturesDir),
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `profile-${uniqueSuffix}${ext}`);
      },
    });
const profileUpload = multer({ storage: profileStorage, limits: { fileSize: 5 * 1024 * 1024 }, fileFilter });

router.post("/profile-picture", authenticateToken, profileUpload.single("image"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "No image file provided" });
    const userId = req.user.id;
    let fileUrl;
    if (useCloudinary && req.file.buffer) {
      fileUrl = await uploadToCloudinary(req.file.buffer, req.file.mimetype, "eventure/profiles");
    } else {
      fileUrl = `/uploads/profiles/${req.file.filename}`;
    }
    await pool.execute("UPDATE users SET profile_picture = ? WHERE id = ?", [fileUrl, userId]);
    const filename = req.file.filename || req.file.originalname;
    return res.status(200).json({ message: "Profile picture uploaded successfully", url: fileUrl, filename });
  } catch (error) {
    console.error("Upload error:", error);
    return res.status(500).json({ message: "Failed to upload profile picture" });
  }
});

module.exports = router;
