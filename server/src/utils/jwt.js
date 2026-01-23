const jwt = require('jsonwebtoken');

function signToken(payload) {
  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
}

function setAuthCookie(res, token) {
  const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // for local dev
    maxAge: maxAge
  });
}

module.exports = {
  signToken,
  setAuthCookie
};
