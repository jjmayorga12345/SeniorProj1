const express = require("express");
const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { authenticateToken, authorize } = require("../middleware/auth");

const router = express.Router();

function parseOptionalLimit(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return undefined;
  // Basic safety cap
  return Math.min(n, 200);
}

function parseRadius(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || Number.isNaN(n) || n <= 0) return undefined;
  // Valid radius values: 5, 10, 15, 20, 25, 30, 40, 50
  const validRadii = [5, 10, 15, 20, 25, 30, 40, 50];
  if (!validRadii.includes(n)) return undefined;
  return n;
}

// POST /api/events - Create a new event (organizer only)
router.post("/", authenticateToken, authorize(["organizer", "admin"]), async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      title,
      description,
      category,
      starts_at,
      ends_at,
      venue,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      location,
      tags,
      ticket_price,
      capacity,
      main_image,
      image_2,
      image_3,
      image_4,
      is_public = true,
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !starts_at) {
      return res.status(400).json({ message: "Title, description, category, and start date/time are required" });
    }

    // Validate dates
    const startDate = new Date(starts_at);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Invalid start date/time" });
    }

    let endDate = null;
    if (ends_at) {
      endDate = new Date(ends_at);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid end date/time" });
      }
      if (endDate < startDate) {
        return res.status(400).json({ message: "End date/time must be after start date/time" });
      }
    }

    // Validate ticket_price (must be >= 0)
    const price = parseFloat(ticket_price) || 0;
    if (price < 0) {
      return res.status(400).json({ message: "Ticket price cannot be negative" });
    }

    // Validate capacity (must be > 0 if provided)
    let capacityValue = null;
    if (capacity !== undefined && capacity !== null && capacity !== "") {
      capacityValue = parseInt(capacity, 10);
      if (isNaN(capacityValue) || capacityValue <= 0) {
        return res.status(400).json({ message: "Capacity must be a positive number" });
      }
    }

    // Prepare SQL insert (RETURNING id for Postgres)
    const sql = `
      INSERT INTO events (
        title, description, category, starts_at, ends_at,
        venue, address_line1, address_line2, city, state, zip_code, location,
        tags, ticket_price, capacity, main_image, image_2, image_3, image_4,
        is_public, created_by, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      RETURNING id
    `;

    // Ensure all string fields are properly truncated to match DB column sizes
    // Use 49 for state to be extra safe (VARCHAR(50) should handle 50, but let's be conservative)
    const safeState = state ? String(state).trim().substring(0, 49) : null;
    const safeCity = city ? String(city).trim().substring(0, 100) : null;
    const safeZip = zip_code ? String(zip_code).trim().substring(0, 10) : null;
    
    const params = [
      String(title).trim(),
      String(description || "").trim(),
      String(category).trim(),
      startDate.toISOString().slice(0, 19).replace("T", " "),
      endDate ? endDate.toISOString().slice(0, 19).replace("T", " ") : null,
      venue ? String(venue).trim() : null,
      address_line1 ? String(address_line1).trim() : null,
      address_line2 ? String(address_line2).trim() : null,
      safeCity,
      safeState,
      safeZip,
      location ? String(location).trim() : null, // location can be null
      tags ? String(tags).trim() : null,
      price,
      capacityValue,
      main_image ? String(main_image).trim().substring(0, 500) : null,
      image_2 ? String(image_2).trim().substring(0, 500) : null,
      image_3 ? String(image_3).trim().substring(0, 500) : null,
      image_4 ? String(image_4).trim().substring(0, 500) : null,
      !!is_public,
      userId,
    ];

    const [result] = await pool.execute(sql, params);
    const eventId = result.insertId ?? result?.[0]?.id;

    // Fetch the created event
    const [eventRows] = await pool.execute(
      "SELECT * FROM events WHERE id = ?",
      [eventId]
    );

    return res.status(201).json({
      message: "Event created successfully",
      event: eventRows[0],
    });
  } catch (error) {
    console.error("Failed to create event:", error.message);
    
    // Provide more detailed error messages
    let errorMessage = "Failed to create event";
    const code = error.code;
    if (code === "ER_NO_SUCH_TABLE" || code === "42P01") {
      errorMessage = "Database table not found. Please check database setup.";
    } else if (code === "ER_BAD_FIELD_ERROR" || code === "42703") {
      errorMessage = `Database column error: ${error.sqlMessage || error.message || "Missing required column"}. Run postgres_bootstrap.sql.`;
    } else if (code === "ER_DUP_ENTRY" || code === "23505") {
      errorMessage = "Duplicate entry. This event may already exist.";
    } else if (error.sqlMessage || error.message) {
      errorMessage = `Database error: ${error.sqlMessage || error.message}`;
    }
    
    return res.status(500).json({ message: errorMessage });
  }
});

// GET /api/events - Fetch public approved events
// Query params: limit, zip, radius, category, orderBy, order
router.get("/", async (req, res) => {
  try {
    const { limit, zip, radius, category, orderBy, order } = req.query;

    // Only show approved events (Postgres: is_public boolean)
    const whereClauses = ["e.status = ?", "e.is_public = ?"];
    const params = ["approved", true];

    // Category filter
    if (category && String(category).trim() !== "" && String(category).trim() !== "All") {
      whereClauses.push("e.category = ?");
      params.push(String(category).trim());
    }

    // Radius search with zip
    if (zip && String(zip).trim() !== "") {
      const zipCode = String(zip).trim();
      const radiusValue = parseRadius(radius);

      if (!radiusValue) {
        // If radius is not provided or invalid, return empty results
        return res.status(200).json([]);
      }

      // Look up zip in zip_locations table
      const zipQuery = "SELECT lat, lng FROM zip_locations WHERE zip_code = ? LIMIT 1";
      const [zipRows] = await pool.execute(zipQuery, [zipCode]);

      if (zipRows && zipRows.length > 0) {
        const centerLat = zipRows[0].lat;
        const centerLng = zipRows[0].lng;
        const radiusMeters = radiusValue * 1609.34; // Convert miles to meters

        // For radius search, require lat/lng to be NOT NULL
        whereClauses.push("e.lat IS NOT NULL", "e.lng IS NOT NULL");

        // Postgres: Haversine formula (meters). No ST_Distance_Sphere in Postgres.
        whereClauses.push(
          `( 6371000 * acos( LEAST(1.0, cos(radians(e.lat)) * cos(radians(?)) * cos(radians(?) - radians(e.lng)) + sin(radians(e.lat)) * sin(radians(?)) ) ) ) <= ?`
        );
        params.push(centerLat, centerLng, centerLat, radiusMeters);
      } else {
        // Zip not found in zip_locations, return empty results
        return res.status(200).json([]);
      }
    }

    const limitValue = parseOptionalLimit(limit);
    
    // Ensure limitValue is a number if it exists
    const finalLimitValue = limitValue !== undefined ? Number(limitValue) : undefined;

    // Determine order by clause
    let orderByClause = "e.starts_at ASC"; // Default
    
    if (orderBy === "created_at") {
      const orderDirection = order === "DESC" ? "DESC" : "ASC";
      orderByClause = `e.created_at ${orderDirection}`;
    } else if (orderBy === "starts_at") {
      const orderDirection = order === "DESC" ? "DESC" : "ASC";
      orderByClause = `e.starts_at ${orderDirection}`;
    }

    // Use a subquery approach to avoid GROUP BY issues with ONLY_FULL_GROUP_BY
    // First get the RSVP counts, then join back to get full event details
    // Build LIMIT clause separately to ensure it matches the parameter
    const limitClause = finalLimitValue !== undefined && finalLimitValue > 0 ? "LIMIT ?" : "";
    
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
        e.created_by,
        e.capacity,
        e.main_image,
        e.image_2,
        e.image_3,
        e.image_4,
        e.created_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE ${whereClauses.join(" AND ")}
      ORDER BY ${orderByClause}
      ${limitClause}
    `;

    // Build final params array - only add limit if we have a valid limit value
    const finalParams = finalLimitValue !== undefined && finalLimitValue > 0 
      ? [...params, finalLimitValue] 
      : params;
    
    const [rows] = await pool.execute(sql, finalParams);

    // Return empty array if no events found
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch events:", error);
    // Log more details in development
    if (process.env.NODE_ENV !== "production") {
      console.error("Error details:", {
        message: error.message,
        sqlMessage: error.sqlMessage,
        code: error.code,
        sql: error.sql,
        stack: error.stack,
      });
    }
    return res.status(500).json({ 
      message: "Failed to fetch events",
      ...(process.env.NODE_ENV !== "production" && { 
        error: error.message,
        sqlError: error.sqlMessage,
        code: error.code,
      })
    });
  }
});

// GET /api/events/my - Get events created by the current user (hosting)
router.get("/my", authenticateToken, async (req, res) => {
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
        e.status,
        e.is_public,
        e.capacity,
        e.main_image,
        e.image_2,
        e.image_3,
        e.image_4,
        e.created_at,
        e.updated_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM events e
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE e.created_by = ?
      ORDER BY e.starts_at ASC
    `;

    const [rows] = await pool.execute(sql, [userId]);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch my events:", error);
    return res.status(500).json({ message: "Failed to fetch events" });
  }
});

// GET /api/events/attending - Get events the current user is attending
router.get("/attending", authenticateToken, async (req, res) => {
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
        e.capacity,
        e.main_image,
        e.image_2,
        e.image_3,
        e.image_4,
        e.created_at,
        r.status as rsvp_status,
        r.created_at as rsvp_created_at,
        COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count
      FROM rsvps r
      INNER JOIN events e ON r.event_id = e.id
      LEFT JOIN (
        SELECT event_id, COUNT(*) as rsvp_count
        FROM rsvps
        WHERE status = 'going'
        GROUP BY event_id
      ) rsvp_counts ON e.id = rsvp_counts.event_id
      WHERE r.user_id = ?
        AND e.status = 'approved'
        AND e.is_public = true
      ORDER BY e.starts_at ASC
    `;

    const [rows] = await pool.execute(sql, [userId]);
    return res.status(200).json(rows || []);
  } catch (error) {
    console.error("Failed to fetch attending events:", error);
    return res.status(500).json({ message: "Failed to fetch events" });
  }
});

// PUT /api/events/:id - Update an event (creator only)
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;
    const eventId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(eventId) || Number.isNaN(eventId)) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Check if event exists and user is the creator
    const [eventRows] = await pool.execute(
      "SELECT created_by FROM events WHERE id = ? LIMIT 1",
      [eventId]
    );

    if (eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventRows[0];
    if (event.created_by.toString() !== userId) {
      return res.status(403).json({ message: "You can only edit your own events" });
    }

    const {
      title,
      description,
      category,
      starts_at,
      ends_at,
      venue,
      address_line1,
      address_line2,
      city,
      state,
      zip_code,
      location,
      tags,
      ticket_price,
      capacity,
      main_image,
      image_2,
      image_3,
      image_4,
      is_public = true,
    } = req.body;

    // Validate required fields
    if (!title || !description || !category || !starts_at) {
      return res.status(400).json({ message: "Title, description, category, and start date/time are required" });
    }

    // Validate dates
    const startDate = new Date(starts_at);
    if (isNaN(startDate.getTime())) {
      return res.status(400).json({ message: "Invalid start date/time" });
    }

    let endDate = null;
    if (ends_at) {
      endDate = new Date(ends_at);
      if (isNaN(endDate.getTime())) {
        return res.status(400).json({ message: "Invalid end date/time" });
      }
      if (endDate < startDate) {
        return res.status(400).json({ message: "End date/time must be after start date/time" });
      }
    }

    // Validate ticket_price (must be >= 0)
    const price = parseFloat(ticket_price) || 0;
    if (price < 0) {
      return res.status(400).json({ message: "Ticket price cannot be negative" });
    }

    // Validate capacity (must be > 0 if provided)
    let capacityValue = null;
    if (capacity !== undefined && capacity !== null && capacity !== "") {
      capacityValue = parseInt(capacity, 10);
      if (isNaN(capacityValue) || capacityValue <= 0) {
        return res.status(400).json({ message: "Capacity must be a positive number" });
      }
    }

    // Prepare SQL update
    const safeState = state ? String(state).trim().substring(0, 49) : null;
    const safeCity = city ? String(city).trim().substring(0, 100) : null;
    const safeZip = zip_code ? String(zip_code).trim().substring(0, 10) : null;

    const sql = `
      UPDATE events SET
        title = ?,
        description = ?,
        category = ?,
        starts_at = ?,
        ends_at = ?,
        venue = ?,
        address_line1 = ?,
        address_line2 = ?,
        city = ?,
        state = ?,
        zip_code = ?,
        location = ?,
        tags = ?,
        ticket_price = ?,
        capacity = ?,
        main_image = ?,
        image_2 = ?,
        image_3 = ?,
        image_4 = ?,
        is_public = ?,
        updated_at = NOW()
      WHERE id = ?
    `;

    const params = [
      String(title).trim().substring(0, 255),
      String(description || "").trim(),
      String(category).trim().substring(0, 100),
      startDate.toISOString().slice(0, 19).replace("T", " "),
      endDate ? endDate.toISOString().slice(0, 19).replace("T", " ") : null,
      venue ? String(venue).trim().substring(0, 255) : null,
      address_line1 ? String(address_line1).trim().substring(0, 255) : null,
      address_line2 ? String(address_line2).trim().substring(0, 255) : null,
      safeCity,
      safeState,
      safeZip,
      location ? String(location).trim() : null,
      tags ? String(tags).trim().substring(0, 500) : null,
      price,
      capacityValue,
      main_image ? String(main_image).trim().substring(0, 500) : null,
      image_2 ? String(image_2).trim().substring(0, 500) : null,
      image_3 ? String(image_3).trim().substring(0, 500) : null,
      image_4 ? String(image_4).trim().substring(0, 500) : null,
      !!is_public,
      eventId,
    ];

    await pool.execute(sql, params);

    // Fetch updated event
    const [updatedRows] = await pool.execute(
      `SELECT * FROM events WHERE id = ? LIMIT 1`,
      [eventId]
    );

    return res.status(200).json({
      message: "Event updated successfully",
      event: updatedRows[0],
    });
  } catch (error) {
    console.error("Failed to update event:", error.message);
    let errorMessage = "Failed to update event";
    if (error.code) {
      errorMessage = `Database error: ${error.sqlMessage || error.message}`;
    } else if (error.message) {
      errorMessage = error.message;
    }
    return res.status(500).json({ message: errorMessage });
  }
});

// DELETE /api/events/:id - Delete an event (only if user is the creator)
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const eventId = parseInt(req.params.id, 10);

    if (!eventId || isNaN(eventId)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    // Check if event exists and user is the creator
    const checkSql = "SELECT id, created_by FROM events WHERE id = ?";
    const [eventRows] = await pool.execute(checkSql, [eventId]);

    if (!eventRows || eventRows.length === 0) {
      return res.status(404).json({ message: "Event not found" });
    }

    const event = eventRows[0];
    if (event.created_by.toString() !== userId) {
      return res.status(403).json({ message: "You can only delete your own events" });
    }

    // Delete the event (cascade will handle related records)
    const deleteSql = "DELETE FROM events WHERE id = ?";
    await pool.execute(deleteSql, [eventId]);

    return res.status(200).json({ message: "Event deleted successfully" });
  } catch (error) {
    console.error("Failed to delete event:", error);
    return res.status(500).json({ message: "Failed to delete event" });
  }
});

// GET /api/events/categories - Get all unique categories (must be above /:id)
router.get("/categories", async (req, res) => {
  try {
    const sql = `
      SELECT DISTINCT category 
      FROM events 
      WHERE category IS NOT NULL 
        AND category != ''
        AND status = 'approved'
        AND is_public = true
      ORDER BY category ASC
    `;
    const [rows] = await pool.execute(sql);
    const categories = rows.map((row) => row.category).filter(Boolean);
    return res.status(200).json(categories || []);
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// GET /api/events/:id - Fetch single event
// Public: only approved, public events
// Authenticated: can view own events regardless of status, or approved public events
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const eventId = Number.parseInt(String(id), 10);
    if (!Number.isFinite(eventId) || Number.isNaN(eventId)) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Try to get user from token (optional - for checking if user is creator)
    let userId = null;
    try {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      }
    } catch (authError) {
      // Not authenticated or invalid token - that's okay, continue as public user
    }

    // Build query - allow creator to see their own events, or show approved public events
    let sql = '';
    let params = [];

    if (userId) {
      // Authenticated user - can see own events or approved public events
      sql = `
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
          e.created_by,
          e.status,
          e.is_public,
          e.capacity,
          e.ticket_price,
          e.tags,
          e.main_image,
          e.image_2,
          e.image_3,
          e.image_4,
          e.created_at,
          e.lat,
          e.lng,
          COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count,
          u.first_name as organizer_first_name,
          u.last_name as organizer_last_name,
          u.profile_picture as organizer_profile_picture,
          u.show_contact_info as organizer_show_contact_info,
          CASE WHEN u.show_contact_info IS TRUE THEN u.email ELSE NULL END as organizer_email
        FROM events e
        LEFT JOIN (
          SELECT event_id, COUNT(*) as rsvp_count
          FROM rsvps
          WHERE status = 'going'
          GROUP BY event_id
        ) rsvp_counts ON e.id = rsvp_counts.event_id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = ?
          AND (
            (e.status = ? AND e.is_public = ?)
            OR e.created_by = ?
          )
        LIMIT 1
      `;
      params = [eventId, "approved", true, userId];
    } else {
      // Public user - only approved public events
      sql = `
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
          e.created_by,
          e.status,
          e.is_public,
          e.capacity,
          e.ticket_price,
          e.tags,
          e.main_image,
          e.image_2,
          e.image_3,
          e.image_4,
          e.created_at,
          e.lat,
          e.lng,
          COALESCE(rsvp_counts.rsvp_count, 0) as rsvp_count,
          u.first_name as organizer_first_name,
          u.last_name as organizer_last_name,
          u.profile_picture as organizer_profile_picture,
          u.show_contact_info as organizer_show_contact_info,
          CASE WHEN u.show_contact_info IS TRUE THEN u.email ELSE NULL END as organizer_email
        FROM events e
        LEFT JOIN (
          SELECT event_id, COUNT(*) as rsvp_count
          FROM rsvps
          WHERE status = 'going'
          GROUP BY event_id
        ) rsvp_counts ON e.id = rsvp_counts.event_id
        LEFT JOIN users u ON e.created_by = u.id
        WHERE e.id = ?
          AND e.status = ?
          AND e.is_public = ?
        LIMIT 1
      `;
      params = [eventId, "approved", true];
    }

    const [rows] = await pool.execute(sql, params);
    const event = rows && rows[0] ? rows[0] : null;

    if (!event) {
      return res.status(404).json({ message: "Event not found" });
    }

    // Format organizer info
    const organizer = {
      firstName: event.organizer_first_name || null,
      lastName: event.organizer_last_name || null,
      profilePicture: event.organizer_profile_picture || null,
      email: event.organizer_email || null,
      showContactInfo: event.organizer_show_contact_info === 1 || event.organizer_show_contact_info === true,
    };

    // Remove organizer fields from event object
    delete event.organizer_first_name;
    delete event.organizer_last_name;
    delete event.organizer_profile_picture;
    delete event.organizer_show_contact_info;
    delete event.organizer_email;

    return res.status(200).json({
      ...event,
      organizer,
    });
  } catch (error) {
    console.error("Failed to fetch event by id:", error);
    return res.status(500).json({ message: "Failed to fetch events" });
  }
});

module.exports = router;
