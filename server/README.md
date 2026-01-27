# 🖥️ Server - Backend API

Node.js/Express backend server for Eventure.

## 📁 Folder Structure

- **`src/routes/`** 🛣️ - API endpoints (auth, events, admin, etc.)
- **`src/models/`** 📊 - Database models
- **`src/middleware/`** 🔒 - Authentication & authorization
- **`src/utils/`** 🔧 - Helper functions (JWT, email, etc.)
- **`database/`** 💾 - SQL scripts and migrations
- **`uploads/`** 📁 - Uploaded event images

## 🚀 Running

```bash
npm run dev    # Development mode (auto-restart)
npm start      # Production mode
```

## 🔐 Environment Variables

Copy `.env.example` to `.env` and fill in your database credentials.
