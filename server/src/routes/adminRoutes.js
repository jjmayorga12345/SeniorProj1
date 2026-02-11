const express = require("express");
const { pool } = require("../db");
const { authenticateToken, authorize } = require("../middleware/auth");

const router = express.Router();

// GET /api/admin/settings/hero - Public endpoint (no auth required for reading)
router.get("/settings/hero", async (req, res) => {
  try {
    // Check if settings table exists, if not return defaults
    const [settings] = await pool.execute(`
      SELECT setting_key, setting_value 
      FROM site_settings 
      WHERE setting_key IN ('hero_background_type', 'hero_background_color', 'hero_background_image')
    `).catch(() => [[{ setting_key: null, setting_value: null }]]);

    const settingsMap = {};
    settings.forEach(s => {
      settingsMap[s.setting_key] = s.setting_value;
    });

    return res.status(200).json({
      type: settingsMap.hero_background_type || "color",
      color: settingsMap.hero_background_color || "#2e6b4e",
      image: settingsMap.hero_background_image || null,
    });
  } catch (error) {
    console.error("Failed to fetch hero settings:", error);
    // Return defaults if table doesn't exist
    return res.status(200).json({
      type: "color",
      color: "#2e6b4e",
      image: null,
    });
  }
});

// GET /api/admin/settings/content - Public (editable text blocks for home etc.)
const CONTENT_KEYS = [
  "content_home_hero_headline",
  "content_home_hero_subheadline",
  "content_home_about_title",
  "content_home_about_body",
  "content_home_most_attended_title",
];
router.get("/settings/content", async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT setting_key, setting_value FROM site_settings WHERE setting_key IN (?, ?, ?, ?, ?)",
      CONTENT_KEYS
    ).catch(() => [[]]);
    const out = {
      home_hero_headline: "",
      home_hero_subheadline: "",
      home_about_title: "",
      home_about_body: "",
      home_most_attended_title: "",
    };
    (rows || []).forEach((r) => {
      const key = r.setting_key;
      const val = r.setting_value || "";
      if (key === "content_home_hero_headline") out.home_hero_headline = val;
      else if (key === "content_home_hero_subheadline") out.home_hero_subheadline = val;
      else if (key === "content_home_about_title") out.home_about_title = val;
      else if (key === "content_home_about_body") out.home_about_body = val;
      else if (key === "content_home_most_attended_title") out.home_most_attended_title = val;
    });
    return res.status(200).json(out);
  } catch (e) {
    return res.status(200).json({
      home_hero_headline: "",
      home_hero_subheadline: "",
      home_about_title: "",
      home_about_body: "",
      home_most_attended_title: "",
    });
  }
});

// All other admin routes require authentication and admin role
router.use(authenticateToken);
router.use(authorize(["admin"]));

// GET /api/admin/stats - Get admin dashboard statistics
router.get("/stats", async (req, res) => {
  try {
    // Get total users count
    const [userRows] = await pool.execute("SELECT COUNT(*) as count FROM users");
    const totalUsers = Number(userRows[0]?.count) || 0;

    // Get total events count
    const [eventRows] = await pool.execute("SELECT COUNT(*) as count FROM events");
    const totalEvents = Number(eventRows[0]?.count) || 0;

    // Get pending approvals count
    const [pendingRows] = await pool.execute(
      "SELECT COUNT(*) as count FROM events WHERE status = 'pending'"
    );
    const pendingApprovals = Number(pendingRows[0]?.count) || 0;

    // Get popular category
    const [categoryRows] = await pool.execute(`
      SELECT category, COUNT(*) as count
      FROM events
      WHERE status = 'approved'
      GROUP BY category
      ORDER BY count DESC
      LIMIT 1
    `);
    const popularCategory = categoryRows[0]
      ? { name: categoryRows[0].category, count: Number(categoryRows[0].count) || 0 }
      : { name: "N/A", count: 0 };

    return res.status(200).json({
      totalUsers,
      totalEvents,
      pendingApprovals,
      popularCategory,
    });
  } catch (error) {
    console.error("Failed to fetch admin stats:", error);
    console.error("Error details:", error.message, error.sqlMessage);
    return res.status(500).json({ 
      message: "Failed to fetch admin statistics",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

// GET /api/admin/events - Get all events (admin only, includes all statuses)
router.get("/events", async (req, res) => {
  try {
    console.log("Admin fetching all events - User:", req.user);
    
    // Use subquery to avoid GROUP BY issues
    const sql = `
      SELECT 
        e.id,
        e.title,
        e.description,
        e.starts_at,
        e.ends_at,
        e.venue,
        e.address_line1,
        e.city,
        e.state,
        e.zip_code,
        e.category,
        e.status,
        e.created_at,
        COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown') as organizer_name,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM events e
      LEFT JOIN users u ON e.created_by = u.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      ORDER BY e.created_at DESC
    `;

    console.log("Executing SQL query for admin events");
    const [rows] = await pool.execute(sql);
    
    console.log(`Fetched ${rows.length} events for admin`);

    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch all events:", error);
    console.error("Error details:", {
      message: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code,
      sql: error.sql,
      stack: error.stack,
    });
    return res.status(500).json({ 
      message: "Failed to fetch events",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined,
      sqlError: process.env.NODE_ENV !== "production" ? error.sqlMessage : undefined
    });
  }
});

// PUT /api/admin/events/:id/approve - Approve an event
router.put("/events/:id/approve", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Check if event exists
    const [eventRows] = await pool.execute("SELECT id, status FROM events WHERE id = ?", [eventId]);

    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Update event status to approved
    await pool.execute("UPDATE events SET status = 'approved' WHERE id = ?", [eventId]);

    return res.status(200).json({ message: "Event approved successfully" });
  } catch (error) {
    console.error("Failed to approve event:", error);
    return res.status(500).json({ message: "Failed to approve event" });
  }
});

// PUT /api/admin/events/:id/decline - Decline an event
router.put("/events/:id/decline", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Check if event exists
    const [eventRows] = await pool.execute("SELECT id, status FROM events WHERE id = ?", [eventId]);

    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Update event status to declined
    await pool.execute("UPDATE events SET status = 'declined' WHERE id = ?", [eventId]);

    return res.status(200).json({ message: "Event declined successfully" });
  } catch (error) {
    console.error("Failed to decline event:", error);
    return res.status(500).json({ message: "Failed to decline event" });
  }
});

// DELETE /api/admin/events/:id - Delete an event (admin can delete any event)
router.delete("/events/:id", async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Check if event exists
    const [eventRows] = await pool.execute("SELECT id FROM events WHERE id = ?", [eventId]);

    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Delete the event (cascade will handle related records)
    await pool.execute("DELETE FROM events WHERE id = ?", [eventId]);

    return res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return res.status(500).json({ message: "Failed to delete event" });
  }
});

// GET /api/admin/users - Get all users
router.get("/users", async (req, res) => {
  try {
    const sql = `
      SELECT 
        id,
        first_name,
        last_name,
        email,
        role,
        created_at
      FROM users
      ORDER BY created_at DESC
    `;

    const [rows] = await pool.execute(sql);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch users:", error);
    return res.status(500).json({ 
      message: "Failed to fetch users",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

// GET /api/admin/users/:id - Get user details with events
router.get("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Get user info
    const [userRows] = await pool.execute(
      "SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = ?",
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    // Get events created by user (active listings - approved events)
    const [createdEvents] = await pool.execute(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.status,
        e.starts_at,
        e.created_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE e.created_by = ? AND e.status = 'approved'
      ORDER BY e.created_at DESC
    `, [userId]);

    // Get pending events created by user
    const [pendingEvents] = await pool.execute(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.status,
        e.starts_at,
        e.created_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE e.created_by = ? AND e.status = 'pending'
      ORDER BY e.created_at DESC
    `, [userId]);

    // Get events user is attending
    const [attendingEvents] = await pool.execute(`
      SELECT 
        e.id,
        e.title,
        e.category,
        e.status,
        e.starts_at,
        r.created_at as rsvp_date
      FROM rsvps r
      INNER JOIN events e ON r.event_id = e.id
      WHERE r.user_id = ? AND r.status = 'going'
      ORDER BY r.created_at DESC
    `, [userId]);

    return res.status(200).json({
      user: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        email: user.email,
        role: user.role,
        createdAt: user.created_at,
      },
      createdEvents: createdEvents || [],
      pendingEvents: pendingEvents || [],
      attendingEvents: attendingEvents || [],
    });
  } catch (error) {
    console.error("Failed to fetch user details:", error);
    return res.status(500).json({ 
      message: "Failed to fetch user details",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

// DELETE /api/admin/users/:id - Delete a user (only organizers/users, not admins)
router.delete("/users/:id", async (req, res) => {
  try {
    const userId = parseInt(req.params.id, 10);

    if (!userId || isNaN(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    // Check if user exists and get their role
    const [userRows] = await pool.execute(
      "SELECT id, role FROM users WHERE id = ?",
      [userId]
    );

    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const user = userRows[0];

    // Prevent deletion of admin users
    if (user.role === "admin") {
      return res.status(403).json({ message: "Cannot delete admin users" });
    }

    // Delete user (cascade will handle related records like events, rsvps, favorites)
    await pool.execute("DELETE FROM users WHERE id = ?", [userId]);

    return res.status(200).json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Failed to delete user:", error);
    return res.status(500).json({ 
      message: "Failed to delete user",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

// DELETE /api/admin/users/:userId/unattend/:eventId - Unattend a user from an event
router.delete("/users/:userId/unattend/:eventId", async (req, res) => {
  try {
    const userId = parseInt(req.params.userId, 10);
    const eventId = parseInt(req.params.eventId, 10);

    if (!userId || isNaN(userId) || !eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid user ID or event ID" });
    }

    // Delete RSVP
    const [result] = await pool.execute(
      "DELETE FROM rsvps WHERE user_id = ? AND event_id = ?",
      [userId, eventId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "RSVP not found" });
    }

    return res.status(200).json({ message: "User unattended from event successfully" });
  } catch (error) {
    console.error("Failed to unattend user from event:", error);
    return res.status(500).json({ 
      message: "Failed to unattend user from event",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

// GET /api/admin/analytics - Get analytics data
router.get("/analytics", async (req, res) => {
  try {
    // Get events created over time (last 12 months, grouped by month) - Postgres
    const [eventsOverTime] = await pool.execute(`
      SELECT 
        to_char(created_at, 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM events
      WHERE created_at >= (NOW() - INTERVAL '12 months')
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    // Get users registered over time (last 12 months, grouped by month)
    const [usersOverTime] = await pool.execute(`
      SELECT 
        to_char(created_at, 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM users
      WHERE created_at >= (NOW() - INTERVAL '12 months')
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    // Get RSVPs over time (last 12 months, grouped by month)
    const [rsvpsOverTime] = await pool.execute(`
      SELECT 
        to_char(created_at, 'YYYY-MM') as month,
        COUNT(*)::int as count
      FROM rsvps
      WHERE created_at >= (NOW() - INTERVAL '12 months') AND status = 'going'
      GROUP BY to_char(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `);

    // Get events by category
    const [eventsByCategory] = await pool.execute(`
      SELECT 
        category,
        COUNT(*) as count
      FROM events
      WHERE status = 'approved'
      GROUP BY category
      ORDER BY count DESC
    `);

    // Get events by status
    const [eventsByStatus] = await pool.execute(`
      SELECT 
        status,
        COUNT(*) as count
      FROM events
      GROUP BY status
      ORDER BY count DESC
    `);

    // Get total counts (quoted aliases for Postgres camelCase)
    const [totalCounts] = await pool.execute(`
      SELECT 
        (SELECT COUNT(*) FROM users) as "totalUsers",
        (SELECT COUNT(*) FROM events) as "totalEvents",
        (SELECT COUNT(*) FROM events WHERE status = 'approved') as "approvedEvents",
        (SELECT COUNT(*) FROM rsvps WHERE status = 'going') as "totalRsvps"
    `);

    return res.status(200).json({
      eventsOverTime: eventsOverTime || [],
      usersOverTime: usersOverTime || [],
      rsvpsOverTime: rsvpsOverTime || [],
      eventsByCategory: eventsByCategory || [],
      eventsByStatus: eventsByStatus || [],
      totals: totalCounts[0] || {
        totalUsers: 0,
        totalEvents: 0,
        approvedEvents: 0,
        totalRsvps: 0,
      },
    });
  } catch (error) {
    console.error("Failed to fetch analytics:", error);
    return res.status(500).json({ 
      message: "Failed to fetch analytics",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});


// PUT /api/admin/settings/content - Update editable text blocks
router.put("/settings/content", async (req, res) => {
  try {
    const { home_hero_headline, home_hero_subheadline, home_about_title, home_about_body, home_most_attended_title } = req.body;
    const updates = [
      ["content_home_hero_headline", home_hero_headline],
      ["content_home_hero_subheadline", home_hero_subheadline],
      ["content_home_about_title", home_about_title],
      ["content_home_about_body", home_about_body],
      ["content_home_most_attended_title", home_most_attended_title],
    ];
    for (const [key, value] of updates) {
      const val = value != null ? String(value).substring(0, 10000) : "";
      await pool.execute(
        `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
         ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value`,
        [key, val]
      );
    }
    return res.status(200).json({ message: "Content updated" });
  } catch (e) {
    console.error("Update content error:", e);
    return res.status(500).json({ message: "Failed to update content" });
  }
});

// GET /api/admin/categories - List categories (admin)
router.get("/categories", async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, name, sort_order FROM categories ORDER BY sort_order ASC, name ASC").catch(() => [[]]);
    return res.status(200).json(rows || []);
  } catch (e) {
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// POST /api/admin/categories - Add category
router.post("/categories", async (req, res) => {
  try {
    const name = req.body.name != null ? String(req.body.name).trim().substring(0, 100) : "";
    if (!name) return res.status(400).json({ message: "Category name is required" });
    await pool.execute("INSERT INTO categories (name, sort_order) VALUES (?, 0)", [name]);
    const [rows] = await pool.execute("SELECT id, name, sort_order FROM categories WHERE name = ? ORDER BY id DESC LIMIT 1", [name]);
    const row = rows && rows[0] ? rows[0] : null;
    if (!row) return res.status(500).json({ message: "Failed to create category" });
    return res.status(201).json({ id: row.id, name: row.name, sort_order: row.sort_order || 0 });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ message: "Category already exists" });
    return res.status(500).json({ message: "Failed to add category" });
  }
});

// PUT /api/admin/categories/:id - Update category
router.put("/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const name = req.body.name != null ? String(req.body.name).trim().substring(0, 100) : "";
    if (!name) return res.status(400).json({ message: "Category name is required" });
    const [r] = await pool.execute("UPDATE categories SET name = ? WHERE id = ?", [name, id]);
    if (!r || r.affectedRows === 0) return res.status(404).json({ message: "Category not found" });
    return res.status(200).json({ message: "Updated", id, name });
  } catch (e) {
    if (e.code === "23505") return res.status(400).json({ message: "Category already exists" });
    return res.status(500).json({ message: "Failed to update category" });
  }
});

// DELETE /api/admin/categories/:id - Delete category
router.delete("/categories/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    await pool.execute("DELETE FROM categories WHERE id = ?", [id]);
    return res.status(200).json({ message: "Deleted" });
  } catch (e) {
    return res.status(500).json({ message: "Failed to delete category" });
  }
});

// PUT /api/admin/settings/hero - Update hero background settings
router.put("/settings/hero", async (req, res) => {
  try {
    const { type, color, image } = req.body;

    if (!type || (type !== "color" && type !== "image")) {
      return res.status(400).json({ message: "Invalid background type. Must be 'color' or 'image'" });
    }

    if (type === "color" && !color) {
      return res.status(400).json({ message: "Color is required when type is 'color'" });
    }

    if (type === "image" && !image) {
      return res.status(400).json({ message: "Image is required when type is 'image'" });
    }

    // Ensure settings table exists (Postgres)
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS site_settings (
        id SERIAL PRIMARY KEY,
        setting_key VARCHAR(100) UNIQUE NOT NULL,
        setting_value TEXT,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `).catch(() => {});

    // Update or insert settings (Postgres ON CONFLICT)
    await pool.execute(`
      INSERT INTO site_settings (setting_key, setting_value)
      VALUES ('hero_background_type', ?)
      ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
    `, [type]);

    if (type === "color") {
      await pool.execute(`
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES ('hero_background_color', ?)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `, [color]);
      await pool.execute(`
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES ('hero_background_image', ?)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `, [null]);
    } else {
      await pool.execute(`
        INSERT INTO site_settings (setting_key, setting_value)
        VALUES ('hero_background_image', ?)
        ON CONFLICT (setting_key) DO UPDATE SET setting_value = EXCLUDED.setting_value
      `, [image]);
    }

    return res.status(200).json({ 
      message: "Hero background updated successfully",
      settings: {
        type,
        color: type === "color" ? color : null,
        image: type === "image" ? image : null,
      }
    });
  } catch (error) {
    console.error("Failed to update hero settings:", error);
    return res.status(500).json({ 
      message: "Failed to update hero background",
      error: process.env.NODE_ENV !== "production" ? error.message : undefined
    });
  }
});

module.exports = router;
