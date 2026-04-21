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
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
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

  console.log("🗄️  Database schema initialized (Auth + Chat Tables complete)");
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

  for (const sql of alters) {
    db.query(sql).run();
  }

  db.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_status ON messages(receiverId, senderId, status)`).run();
  db.query(`CREATE INDEX IF NOT EXISTS idx_messages_receiver_sender_readAt ON messages(receiverId, senderId, readAt)`).run();
}