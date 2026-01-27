const express = require("express");
const { pool } = require("../db");
const { authenticateToken } = require("../middleware/auth");

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// GET /api/favorites - Get all favorites for the current user
router.get("/", async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.starts_at,
        e.ends_at,
        e.venue,
        e.address_line1,
        e.address_line2,
        e.city,
        e.state,
        e.zip_code,
        e.location,
        e.category,
        e.main_image,
        e.ticket_price,
        e.capacity,
        e.created_at,
        f.created_at as favorited_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM favorites f
      INNER JOIN events e ON f.event_id = e.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE f.user_id = ?
        AND e.status = 'approved'
        AND e.is_public = 1
      ORDER BY f.created_at DESC
    `;

    const [rows] = await pool.execute(sql, [userId]);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch favorites:", error);
    return res.status(500).json({ message: "Failed to fetch favorites" });
  }
});

// POST /api/favorites/:eventId - Add event to favorites
router.post("/:eventId", async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = parseInt(req.params.eventId, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Check if event exists and is approved/public
    const eventCheckSql = `
      SELECT id FROM events 
      WHERE id = ? AND status = 'approved' AND is_public = 1
    `;
    const [eventRows] = await pool.execute(eventCheckSql, [eventId]);
    
    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found or not available" });
    }

    // Check if already favorited
    const checkSql = "SELECT id FROM favorites WHERE user_id = ? AND event_id = ?";
    const [existing] = await pool.execute(checkSql, [userId, eventId]);
    
    if (existing && existing.length > 0) {
      return res.status(200).json({ message: "Event already in favorites" });
    }

    // Add to favorites
    const insertSql = "INSERT INTO favorites (user_id, event_id) VALUES (?, ?)";
    await pool.execute(insertSql, [userId, eventId]);

    return res.status(201).json({ message: "Event added to favorites" });
  } catch (error) {
    console.error("Failed to add favorite:", error);
    if (error.code === "ER_DUP_ENTRY") {
      return res.status(200).json({ message: "Event already in favorites" });
    }
    return res.status(500).json({ message: "Failed to add favorite" });
  }
});

// DELETE /api/favorites/:eventId - Remove event from favorites
router.delete("/:eventId", async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = parseInt(req.params.eventId, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const sql = "DELETE FROM favorites WHERE user_id = ? AND event_id = ?";
    const [result] = await pool.execute(sql, [userId, eventId]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Favorite not found" });
    }

    return res.status(200).json({ message: "Event removed from favorites" });
  } catch (error) {
    console.error("Failed to remove favorite:", error);
    return res.status(500).json({ message: "Failed to remove favorite" });
  }
});

// GET /api/favorites/check/:eventId - Check if event is favorited
router.get("/check/:eventId", async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = parseInt(req.params.eventId, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const sql = "SELECT id FROM favorites WHERE user_id = ? AND event_id = ?";
    const [rows] = await pool.execute(sql, [userId, eventId]);

    return res.status(200).json({ isFavorited: rows && rows.length > 0 });
  } catch (error) {
    console.error("Failed to check favorite:", error);
    return res.status(500).json({ message: "Failed to check favorite" });
  }
});

// DELETE /api/favorites - Clear all favorites for the current user
router.delete("/", async (req, res) => {
  try {
    const userId = req.user.id;

    const sql = "DELETE FROM favorites WHERE user_id = ?";
    const [result] = await pool.execute(sql, [userId]);

    return res.status(200).json({ 
      message: "All favorites cleared",
      count: result.affectedRows 
    });
  } catch (error) {
    console.error("Failed to clear favorites:", error);
    return res.status(500).json({ message: "Failed to clear favorites" });
  }
});

module.exports = router;
