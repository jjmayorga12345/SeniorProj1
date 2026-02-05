const express = require("express");
const { pool } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// POST /api/follows/:organizerId - Follow an organizer (auth)
router.post("/:organizerId", authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const organizerId = parseInt(req.params.organizerId, 10);
    if (isNaN(organizerId) || organizerId <= 0) {
      return res.status(400).json({ message: "Invalid organizer ID" });
    }
    if (followerId === organizerId) {
      return res.status(400).json({ message: "You cannot follow yourself" });
    }

    const [userRows] = await pool.execute(
      "SELECT id, role FROM users WHERE id = ? LIMIT 1",
      [organizerId]
    );
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }
    const role = userRows[0].role;
    if (role !== "organizer" && role !== "admin") {
      return res.status(400).json({ message: "You can only follow organizers" });
    }

    await pool.execute(
      "INSERT INTO follows (follower_id, following_id) VALUES (?, ?) ON CONFLICT (follower_id, following_id) DO NOTHING",
      [followerId, organizerId]
    );
    return res.status(201).json({ message: "Following", following: true });
  } catch (err) {
    if (err.code === "23505") return res.status(200).json({ message: "Already following", following: true });
    console.error("Follow error:", err);
    return res.status(500).json({ message: "Failed to follow" });
  }
});

// DELETE /api/follows/:organizerId - Unfollow (auth)
router.delete("/:organizerId", authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const organizerId = parseInt(req.params.organizerId, 10);
    if (isNaN(organizerId) || organizerId <= 0) {
      return res.status(400).json({ message: "Invalid organizer ID" });
    }

    const [result] = await pool.execute(
      "DELETE FROM follows WHERE follower_id = ? AND following_id = ?",
      [followerId, organizerId]
    );
    return res.status(200).json({ message: "Unfollowed", following: false });
  } catch (err) {
    console.error("Unfollow error:", err);
    return res.status(500).json({ message: "Failed to unfollow" });
  }
});

// GET /api/follows/check/:organizerId - Check if current user follows organizer (auth)
router.get("/check/:organizerId", authenticateToken, async (req, res) => {
  try {
    const followerId = req.user.id;
    const organizerId = parseInt(req.params.organizerId, 10);
    if (isNaN(organizerId) || organizerId <= 0) {
      return res.status(400).json({ message: "Invalid organizer ID" });
    }

    const [rows] = await pool.execute(
      "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ? LIMIT 1",
      [followerId, organizerId]
    );
    return res.status(200).json({ following: rows && rows.length > 0 });
  } catch (err) {
    console.error("Check follow error:", err);
    return res.status(500).json({ message: "Failed to check follow status" });
  }
});

// GET /api/follows/me - List organizers I follow (auth)
router.get("/me", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const [rows] = await pool.execute(
      `SELECT u.id, u.first_name, u.last_name, u.profile_picture, u.email
       FROM follows f
       INNER JOIN users u ON f.following_id = u.id
       WHERE f.follower_id = ?
       ORDER BY f.created_at DESC`,
      [userId]
    );
    const list = (rows || []).map((r) => ({
      id: r.id,
      firstName: r.first_name,
      lastName: r.last_name,
      profilePicture: r.profile_picture,
      email: r.email,
    }));
    return res.status(200).json({ following: list });
  } catch (err) {
    console.error("List following error:", err);
    return res.status(500).json({ message: "Failed to list following" });
  }
});

module.exports = router;
