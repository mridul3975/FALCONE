import db from "./connection";

export function initDb() {
  // ==========================================
  // 1. BETTER AUTH TABLES
  // ==========================================
  db.query(`
    CREATE TABLE IF NOT EXISTS user (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      emailVerified INTEGER NOT NULL,
      image TEXT,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS session (
      id TEXT PRIMARY KEY,
      expiresAt DATETIME NOT NULL,
      token TEXT NOT NULL UNIQUE,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL,
      ipAddress TEXT,
      userAgent TEXT,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS account (
      id TEXT PRIMARY KEY,
      accountId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
      user TEXT,
      accessToken TEXT,
      refreshToken TEXT,
      idToken TEXT,
      accessTokenExpiresAt DATETIME,
      refreshTokenExpiresAt DATETIME,
      scope TEXT,
      password TEXT,
      createdAt DATETIME NOT NULL,
      updatedAt DATETIME NOT NULL
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS verification (
      id TEXT PRIMARY KEY,
      identifier TEXT NOT NULL,
      value TEXT NOT NULL,
      expiresAt DATETIME NOT NULL,
      createdAt DATETIME,
      updatedAt DATETIME
    )
  `).run();

  // ==========================================
  // 2. CHAT APP TABLES
  // ==========================================
  db.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      creatorId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (creatorId) REFERENCES user(id) ON DELETE SET NULL
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS room_join_requests (
      id TEXT PRIMARY KEY,
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      status TEXT DEFAULT 'pending', -- pending, accepted, rejected
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS room_members (
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (roomId, userId),
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE
    )
  `).run();

  db.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      receiverId TEXT,
      roomId TEXT,
      text TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (senderId) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (receiverId) REFERENCES user(id) ON DELETE CASCADE,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    )
  `).run();

  ensureMessageColumns();

  function ensureSystemUsers() {
    const now = new Date().toISOString();

    db.query(
      `
    INSERT OR IGNORE INTO user
      (id, name, email, emailVerified, image, createdAt, updatedAt)
    VALUES
      ($id, $name, $email, $emailVerified, $image, $createdAt, $updatedAt)
  `
    ).run({
      $id: "gemini-bot",
      $name: "Gemini",
      $email: "gemini-bot@local.ai",
      $emailVerified: 1,
      $image: null,
      $createdAt: now,
      $updatedAt: now,
    });
  }

  ensureSystemUsers();
  ensureUserColumns();
  ensureRoomColumns();
  ensureMessageColumns();
  initReactionsTable();
  console.log("🗄️  Database schema initialized (Auth + Chat Tables complete)");
}

function ensureUserColumns() {
  const columns = db
    .query(`PRAGMA table_info(user)`)
    .all() as Array<{ name: string }>;

  const existing = new Set(columns.map((c) => c.name));

  if (!existing.has("lastSeen")) {
    db.query(`ALTER TABLE user ADD COLUMN lastSeen DATETIME`).run();
  }
}

function ensureRoomColumns() {
  const columns = db
    .query(`PRAGMA table_info(rooms)`)
    .all() as Array<{ name: string }>;

  const existing = new Set(columns.map((c) => c.name));

  if (!existing.has("creatorId")) {
    db.query(`ALTER TABLE rooms ADD COLUMN creatorId TEXT REFERENCES user(id)`).run();
  }
}

function ensureMessageColumns() {
  const columns = db
    .query(`PRAGMA table_info(messages)`)
    .all() as Array<{ name: string }>;

  const existing = new Set(columns.map((c) => c.name));

  const alters: string[] = [];
  if (!existing.has("contentType")) alters.push(`ALTER TABLE messages ADD COLUMN contentType TEXT NOT NULL DEFAULT 'text'`);
  if (!existing.has("fileUrl")) alters.push(`ALTER TABLE messages ADD COLUMN fileUrl TEXT`);
  if (!existing.has("fileName")) alters.push(`ALTER TABLE messages ADD COLUMN fileName TEXT`);
  if (!existing.has("fileSize")) alters.push(`ALTER TABLE messages ADD COLUMN fileSize INTEGER`);
  if (!existing.has("deliveredAt")) alters.push(`ALTER TABLE messages ADD COLUMN deliveredAt DATETIME`);
  if (!existing.has("readAt")) alters.push(`ALTER TABLE messages ADD COLUMN readAt DATETIME`);
  if (!existing.has("aiSource")) alters.push(`ALTER TABLE messages ADD COLUMN aiSource TEXT`);
  if (!existing.has("replyToId")) alters.push(`ALTER TABLE messages ADD COLUMN replyToId TEXT`);

  for (const sql of alters) {
    db.query(sql).run();
  }

  db.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_status ON messages(receiverId, senderId, status)`).run();
  db.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_readAt ON messages(receiverId, senderId, readAt)`).run();
}



function initReactionsTable() {
  db.run(`
    CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY,
      messageId TEXT NOT NULL,
      userId TEXT NOT NULL,
      emoji TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(messageId, userId, emoji)
    )
  `);
}

// 1. Friendships: The final "Accepted" state
// Using a unique index on (min, max) IDs prevents duplicate A-B and B-A rows.
db.run(`
    CREATE TABLE IF NOT EXISTS friendships (
      user_a_id TEXT NOT NULL,
      user_b_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_a_id, user_b_id),
      FOREIGN KEY (user_a_id) REFERENCES user(id),
      FOREIGN KEY (user_b_id) REFERENCES user(id)
    )
  `);

// 2. Friend Requests: The "Handshake" state
db.run(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'accepted', 'rejected', 'cancelled')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    )
  `);

// 3. User Privacy: Individual settings
db.run(`
    CREATE TABLE IF NOT EXISTS user_privacy (
      user_id TEXT PRIMARY KEY,
      allow_message_requests INTEGER DEFAULT 1, -- 1 for true, 0 for false
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES user(id)
    )
  `);

// 4. Message Requests: The "First Contact"
// Useful if you want to allow someone to send a message WITHOUT being a friend yet.
db.run(`
    CREATE TABLE IF NOT EXISTS message_requests (
      id TEXT PRIMARY KEY,
      from_user_id TEXT NOT NULL,
      to_user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT CHECK(status IN ('pending', 'accepted', 'rejected')) DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(from_user_id, to_user_id)
    )
  `);

// 5. Blocked users
db.run(`
    CREATE TABLE IF NOT EXISTS blocked_users (
      user_id TEXT NOT NULL,
      blocked_user_id TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, blocked_user_id),
      FOREIGN KEY (user_id) REFERENCES user(id),
      FOREIGN KEY (blocked_user_id) REFERENCES user(id)
    )
  `);
