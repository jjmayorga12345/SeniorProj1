const express = require("express");
const bcrypt = require("bcrypt");
const { Op } = require("sequelize");
const User = require("../models/User");
const PasswordResetCode = require("../models/PasswordResetCode");
const { signToken, setAuthCookie } = require("../utils/jwt");
const { sendMail, getMode } = require("../utils/mailer");
const { authenticateToken } = require("../middleware/auth");
const { pool } = require("../db");

const router = express.Router();

// Helper function to format user response
function formatUserResponse(user) {
  return {
    id: user.id.toString(),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    profilePicture: user.profilePicture || null,
    showContactInfo: user.showContactInfo === 1 || user.showContactInfo === true,
  };
}

// Email format validation
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Normalize email: trim and lowercase
function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

// Allowed roles for registration only (admin is created manually in DB)
const REGISTER_ALLOWED_ROLES = ["user", "organizer"];

// OTP helpers
function generate6DigitCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function hashCode(code) {
  return await bcrypt.hash(code, 10);
}

async function compareCode(code, codeHash) {
  return await bcrypt.compare(code, codeHash);
}

// POST /auth/register
router.post("/auth/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password, role: roleInput } = req.body;
    const emailNormalized = normalizeEmail(email);

    // Role: only "user" and "organizer" allowed; else force "user"
    const role = roleInput && REGISTER_ALLOWED_ROLES.includes(roleInput)
      ? roleInput
      : "user";

    // Validate required fields
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    // Validate email format
    if (!EMAIL_REGEX.test(emailNormalized)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate password length
    if (String(password).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({
      where: { email: emailNormalized },
    });
    if (existingUser) {
      return res.status(409).json({ message: "Email already in use" });
    }

    // Hash password with bcrypt (10 salt rounds)
    const passwordHash = await bcrypt.hash(password, 10);

    // Create user
    const user = await User.create({
      email: emailNormalized,
      passwordHash,
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      role,
    });

    return res.status(201).json({
      message: "Registered",
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Registration error:", error);
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "Email already in use" });
    }
    return res.status(500).json({ message: "Registration failed" });
  }
});

// POST /auth/login
router.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    const emailNormalized = normalizeEmail(email);

    // Find user by email
    const user = await User.findOne({
      where: { email: emailNormalized },
    });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Compare password with bcrypt.compare against passwordHash
    const validPassword = await bcrypt.compare(password, user.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    // Create JWT payload
    const payload = {
      id: user.id.toString(),
      role: user.role,
      email: user.email,
    };

    // Sign token
    const token = signToken(payload);

    // Set cookie "token" using setAuthCookie
    setAuthCookie(res, token);

    // Return success response
    return res.status(200).json({
      message: "Logged in",
      token: token,
      user: formatUserResponse(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ message: "Login failed" });
  }
});

// POST /auth/logout
router.post("/auth/logout", (req, res) => {
  res.clearCookie("token");
  return res.status(200).json({ message: "Logged out" });
});

// POST /auth/forgot-password
router.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const emailNormalized = normalizeEmail(email);

    // Always return generic success message (security: don't leak if email exists)
    const genericMessage = "If that email exists, a verification code was sent.";

    // Find user
    const user = await User.findOne({
      where: { email: emailNormalized },
    });

    if (!user) {
      // Still return 200 with generic message
      return res.status(200).json({ message: genericMessage });
    }

    // Rate limit: Check if a code was issued in the last 60 seconds
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
        created_at: { [Op.gte]: oneMinuteAgo },
      },
      order: [["created_at", "DESC"]],
    });

    if (recentCode) {
      // Code already sent recently, don't create a new one
      return res.status(200).json({ message: genericMessage });
    }

    // Generate 6-digit code
    const code = generate6DigitCode();
    const codeHash = await hashCode(code);

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Insert into password_reset_codes
    await PasswordResetCode.create({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
      used_at: null,
    });

    // Send email
    const emailSubject = "Eventure Password Reset Code";
    const emailText = `Your Eventure verification code is: ${code}. It expires in 10 minutes.`;

    const currentMode = getMode();
    console.log(`📧 Sending reset code email to ${emailNormalized} via ${currentMode === "SMTP" ? "smtp" : "fallback"}`);

    const mailResult = await sendMail({
      to: emailNormalized,
      subject: emailSubject,
      text: emailText,
    });

    // If in fallback mode, log the OTP clearly
    if (mailResult.mode === "fallback") {
      console.log(`🔑 DEV FALLBACK OTP for ${emailNormalized}: ${code}`);
    }

    return res.status(200).json({ message: genericMessage });
  } catch (error) {
    console.error("Forgot password error:", error);
    // Still return generic success to avoid leaking info
    return res.status(200).json({
      message: "If that email exists, a verification code was sent.",
    });
  }
});

// POST /api/auth/reset-password-with-code
router.post("/auth/reset-password-with-code", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required" });
    }

    const emailNormalized = normalizeEmail(email);

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Validate password length
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Find user
    const user = await User.findOne({
      where: { email: emailNormalized },
    });

    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Find latest valid code for this user
    const resetCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    if (!resetCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Compare code
    const isValidCode = await compareCode(String(code), resetCode.code_hash);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ passwordHash: newPasswordHash });

    // Mark code as used
    await resetCode.update({ used_at: new Date() });

    return res.status(200).json({ message: "Password reset successful" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
});

// POST /api/auth/verify-reset-code
router.post("/auth/verify-reset-code", async (req, res) => {
  try {
    const { email, code } = req.body;

    // Validate required fields
    if (!email || !code) {
      return res.status(400).json({ message: "Email and code are required" });
    }

    const emailNormalized = normalizeEmail(email);

    // Validate email format
    if (!EMAIL_REGEX.test(emailNormalized)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Find user by normalized email
    const user = await User.findOne({
      where: { email: emailNormalized },
    });

    // Security: Don't leak if email exists - return generic error
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Find latest valid reset code for this user
    const resetCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    // If no valid code found, return generic error
    if (!resetCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Compare code with hash
    const isValidCode = await compareCode(String(code), resetCode.code_hash);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Code is valid - return success (do NOT mark as used yet)
    return res.status(200).json({ ok: true, message: "Code verified" });
  } catch (error) {
    console.error("Verify reset code error:", error);
    return res.status(500).json({ message: "Verification failed" });
  }
});

// POST /api/auth/reset-password
router.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;

    // Validate required fields
    if (!email || !code || !newPassword) {
      return res.status(400).json({ message: "Email, code, and new password are required" });
    }

    const emailNormalized = normalizeEmail(email);

    // Validate email format
    if (!EMAIL_REGEX.test(emailNormalized)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Validate password length
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Find user by normalized email
    const user = await User.findOne({
      where: { email: emailNormalized },
    });

    // Security: Don't leak if email exists - return generic message
    if (!user) {
      if (process.env.NODE_ENV !== "production") {
        console.log(`[DEV] Reset password attempt for non-existent email: ${emailNormalized}`);
      }
      return res.status(200).json({ message: "Password updated" });
    }

    // Find latest valid reset code for this user
    const resetCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    // If no valid code found, return generic error
    if (!resetCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Compare code with hash
    const isValidCode = await compareCode(String(code), resetCode.code_hash);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Hash new password using bcrypt (10 rounds)
    const newPasswordHash = await bcrypt.hash(newPassword, 10);

    // Update user's password
    await user.update({ passwordHash: newPasswordHash });

    // Mark reset code as used
    await resetCode.update({ used_at: new Date() });

    if (process.env.NODE_ENV !== "production") {
      console.log(`[DEV] Password reset successful for: ${emailNormalized}`);
    }

    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ message: "Password reset failed" });
  }
});

// GET /api/auth/profile - Get current user profile with stats
router.get("/auth/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // Get user info with profile_picture and show_contact_info
    const [userRows] = await pool.execute(
      "SELECT id, email, first_name, last_name, role, profile_picture, show_contact_info FROM users WHERE id = ?",
      [userId]
    );
    
    if (!userRows || userRows.length === 0) {
      return res.status(404).json({ message: "User not found" });
    }

    const userRow = userRows[0];
    const user = {
      id: userRow.id.toString(),
      email: userRow.email,
      firstName: userRow.first_name,
      lastName: userRow.last_name,
      role: userRow.role,
      profilePicture: userRow.profile_picture || null,
      showContactInfo: userRow.show_contact_info === 1 || userRow.show_contact_info === true,
    };

    // Get stats
    const [eventsHosted] = await pool.execute(
      "SELECT COUNT(*) as count FROM events WHERE created_by = ?",
      [userId]
    );
    const [eventsAttending] = await pool.execute(
      "SELECT COUNT(DISTINCT event_id) as count FROM rsvps WHERE user_id = ? AND status = 'going'",
      [userId]
    );
    const [favoritesCount] = await pool.execute(
      "SELECT COUNT(*) as count FROM favorites WHERE user_id = ?",
      [userId]
    );

    return res.status(200).json({
      user: user,
      stats: {
        eventsHosted: parseInt(eventsHosted[0]?.count || 0, 10),
        eventsAttending: parseInt(eventsAttending[0]?.count || 0, 10),
        favorites: parseInt(favoritesCount[0]?.count || 0, 10),
      },
    });
  } catch (error) {
    console.error("Failed to fetch profile:", error);
    return res.status(500).json({ message: "Failed to fetch profile" });
  }
});

// PUT /api/auth/profile - Update profile settings (show_contact_info toggle)
router.put("/auth/profile", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { showContactInfo } = req.body;

    if (showContactInfo === undefined) {
      return res.status(400).json({ message: "showContactInfo is required" });
    }

    // Update show_contact_info (Postgres: boolean)
    await pool.execute(
      "UPDATE users SET show_contact_info = ? WHERE id = ?",
      [!!showContactInfo, userId]
    );

    return res.status(200).json({ 
      message: "Profile updated successfully",
      showContactInfo: showContactInfo ? true : false,
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
});

// POST /api/auth/change-password-request - Request password change code
router.post("/auth/change-password-request", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const emailNormalized = user.email;

    // Generate 6-digit code
    const code = generate6DigitCode();
    const codeHash = await hashCode(code);

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Insert into password_reset_codes
    await PasswordResetCode.create({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
      used_at: null,
    });

    // Send email
    const emailSubject = "Eventure Password Change Verification Code";
    const emailText = `Your Eventure verification code for changing your password is: ${code}. It expires in 10 minutes.`;

    const currentMode = getMode();
    if (process.env.NODE_ENV !== "production") {
      console.log(`📧 Sending password change code to ${emailNormalized} via ${currentMode === "SMTP" ? "smtp" : "fallback"}`);
    }

    const mailResult = await sendMail({
      to: emailNormalized,
      subject: emailSubject,
      text: emailText,
    });

    // If in fallback mode, log the OTP clearly
    if (mailResult.mode === "fallback") {
      console.log(`🔑 DEV FALLBACK OTP for ${emailNormalized}: ${code}`);
    }

    return res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error("Change password request error:", error);
    return res.status(500).json({ message: "Failed to send verification code" });
  }
});

// POST /api/auth/change-password - Change password with code verification
router.post("/auth/change-password", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code, newPassword } = req.body;

    if (!code || !newPassword) {
      return res.status(400).json({ message: "Code and new password are required" });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Validate password length
    if (String(newPassword).length < 8) {
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find latest valid code for this user
    const resetCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    if (!resetCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Compare code
    const isValidCode = await compareCode(String(code), resetCode.code_hash);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Update password
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await user.update({ passwordHash: newPasswordHash });

    // Mark code as used
    await resetCode.update({ used_at: new Date() });

    return res.status(200).json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Failed to change password" });
  }
});

// POST /api/auth/delete-account-request - Request account deletion code
router.post("/auth/delete-account-request", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const emailNormalized = user.email;

    // Generate 6-digit code
    const code = generate6DigitCode();
    const codeHash = await hashCode(code);

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Insert into password_reset_codes (reusing the same table)
    await PasswordResetCode.create({
      user_id: user.id,
      code_hash: codeHash,
      expires_at: expiresAt,
      used_at: null,
    });

    // Send email
    const emailSubject = "Eventure Account Deletion Verification Code";
    const emailText = `Your Eventure verification code for deleting your account is: ${code}. It expires in 10 minutes. WARNING: This action cannot be undone.`;

    const currentMode = getMode();
    if (process.env.NODE_ENV !== "production") {
      console.log(`📧 Sending account deletion code to ${emailNormalized} via ${currentMode === "SMTP" ? "smtp" : "fallback"}`);
    }

    const mailResult = await sendMail({
      to: emailNormalized,
      subject: emailSubject,
      text: emailText,
    });

    // If in fallback mode, log the OTP clearly
    if (mailResult.mode === "fallback") {
      console.log(`🔑 DEV FALLBACK OTP for ${emailNormalized}: ${code}`);
    }

    return res.status(200).json({ message: "Verification code sent to your email" });
  } catch (error) {
    console.error("Delete account request error:", error);
    return res.status(500).json({ message: "Failed to send verification code" });
  }
});

// POST /api/auth/delete-account - Delete account with code verification
router.post("/auth/delete-account", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    // Validate code format (6 digits)
    if (!/^\d{6}$/.test(String(code))) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Find user
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Find latest valid code for this user
    const resetCode = await PasswordResetCode.findOne({
      where: {
        user_id: user.id,
        used_at: null,
        expires_at: { [Op.gt]: new Date() },
      },
      order: [["created_at", "DESC"]],
    });

    if (!resetCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Compare code
    const isValidCode = await compareCode(String(code), resetCode.code_hash);
    if (!isValidCode) {
      return res.status(400).json({ message: "Invalid or expired code" });
    }

    // Mark code as used
    await resetCode.update({ used_at: new Date() });

    // Delete user (cascade will handle related records if foreign keys are set up)
    await user.destroy();

    return res.status(200).json({ message: "Account deleted successfully" });
  } catch (error) {
    console.error("Delete account error:", error);
    return res.status(500).json({ message: "Failed to delete account" });
  }
});

module.exports = router;
