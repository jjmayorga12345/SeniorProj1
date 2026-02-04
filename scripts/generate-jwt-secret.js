#!/usr/bin/env node
/**
 * Generate a random hex string for JWT_SECRET.
 * Run: node scripts/generate-jwt-secret.js
 * Copy the output into Render env var JWT_SECRET.
 */
const crypto = require("crypto");
const secret = crypto.randomBytes(32).toString("hex");
console.log(secret);
