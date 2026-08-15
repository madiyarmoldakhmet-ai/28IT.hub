# 📁 Project Structure & Architectural Overview

## 📌 Architecture Philosophy
This project is designed as an **autonomous, offline-first / local-network messenger backend** built with **Node.js, Express, and WebSocket (ws / Socket.io)**, using **PostgreSQL or SQLite** for local data persistence without any reliance on third-party cloud infrastructure (Firebase, Supabase, etc.).

---

## 📂 Directory Layout

```
.
├── .env.example                # Template for environment variables
├── .gitignore                  # Git exclusions for Node, DB, and environment files
├── PROJECT_STRUCTURE.md        # Architecture and folder layout documentation
├── package.json                # Dependencies and scripts configuration
├── migrations/                 # SQL migration scripts
│   └── 001_initial_schema.sql  # Initial database DDL schema (users, chats, messages)
└── src/                        # Application source code
    ├── server.js               # Application entry point (HTTP + WebSocket server setup)
    ├── config/                 # Application configuration & DB client setup
    │   └── db.js               # Database connection pool / client (pg or sqlite3/better-sqlite3)
    ├── controllers/            # Request handlers (processes input, calls services, sends HTTP responses)
    │   ├── authController.js   # User registration, login, JWT issuance
    │   ├── chatController.js   # Create chat, list chats, manage members
    │   └── messageController.js# Get message history, send message REST fallback
    ├── middlewares/            # Express middlewares
    │   ├── authMiddleware.js   # JWT authentication & session validation
    │   └── errorHandler.js     # Centralized error handler
    ├── routes/                 # Express route declarations
    │   ├── authRoutes.js       # /api/auth endpoints
    │   ├── chatRoutes.js       # /api/chats endpoints
    │   └── messageRoutes.js    # /api/messages endpoints
    ├── services/               # Business logic layer & Database query operations
    │   ├── userService.js      # User CRUD & password hashing
    │   ├── chatService.js      # Chat creation, group logic, user membership
    │   └── messageService.js   # Message persistence & retrieval queries
    └── websocket/              # Real-time WebSocket communications
        ├── wsServer.js         # WebSocket server initialization & heartbeat
        └── wsHandler.js        # Event routing (send_message, read_receipt, typing_status)
```

---

## 🗄️ Database Schema Summary

| Table | Column | Type | Constraints / Description |
|---|---|---|---|
| **users** | `id` | `INTEGER / SERIAL` | Primary Key |
| | `username` | `VARCHAR(50)` | UNIQUE, NOT NULL |
| | `password_hash` | `VARCHAR(255)` | NOT NULL (Argon2id / bcrypt) |
| | `created_at` | `TIMESTAMP` | DEFAULT `CURRENT_TIMESTAMP` |
| **chats** | `id` | `INTEGER / SERIAL` | Primary Key |
| | `name` | `VARCHAR(100)` | NULL for 1-on-1 chats, Title for Groups |
| | `is_group` | `BOOLEAN` | DEFAULT `FALSE` |
| | `created_at` | `TIMESTAMP` | DEFAULT `CURRENT_TIMESTAMP` |
| **chat_members** | `chat_id` | `INTEGER` | FK -> `chats(id)` ON DELETE CASCADE |
| | `user_id` | `INTEGER` | FK -> `users(id)` ON DELETE CASCADE |
| | `joined_at` | `TIMESTAMP` | Composite Primary Key `(chat_id, user_id)` |
| **messages** | `id` | `INTEGER / SERIAL` | Primary Key |
| | `chat_id` | `INTEGER` | FK -> `chats(id)` ON DELETE CASCADE |
| | `sender_id` | `INTEGER` | FK -> `users(id)` ON DELETE CASCADE |
| | `text` | `TEXT` | NOT NULL |
| | `created_at` | `TIMESTAMP` | DEFAULT `CURRENT_TIMESTAMP` |
| | `is_read` | `BOOLEAN` | DEFAULT `FALSE` |
