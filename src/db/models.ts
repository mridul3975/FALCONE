import db from "./connection";

function ensureUserTableColumns() {
    const columns = db
        .query("PRAGMA table_info(user)")
        .all() as Array<{ name: string }>;
    const columnNames = new Set(columns.map((column) => column.name.toLowerCase()));

    if (!columnNames.has("name")) {
        db.exec("ALTER TABLE user ADD COLUMN name TEXT");
    }

    if (!columnNames.has("emailverified")) {
        db.exec("ALTER TABLE user ADD COLUMN emailVerified INTEGER");
    }

    if (!columnNames.has("image")) {
        db.exec("ALTER TABLE user ADD COLUMN image TEXT");
    }

    if (!columnNames.has("createdat")) {
        db.exec("ALTER TABLE user ADD COLUMN createdAt DATETIME DEFAULT CURRENT_TIMESTAMP");
    }

    if (!columnNames.has("updatedat")) {
        db.exec("ALTER TABLE user ADD COLUMN updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP");
    }
}

export function initDb() {
    // User table
    db.query(`
        CREATE TABLE IF NOT EXISTS USER(
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        emailverified INTEGER,
        image TEXT,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedat DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // Room table
    db.query(`
        CREATE TABLE IF NOT EXISTS ROOM(    
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP
    )`).run();

    // 3. Room Members Table (Many-to-Many relationship for Rooms <-> Users)
    db.query(
        `CREATE TABLE IF NOT EXISTS room_members (
      roomId TEXT NOT NULL,
      userId TEXT NOT NULL,
      joinedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (roomId, userId),
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    )`
    ).run();

    // Messages table
    db.query(
        `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      senderId TEXT NOT NULL,
      receiverId TEXT, -- Nullable for group messages
      roomId TEXT, -- Nullable for private 1-to-1 messages
      text TEXT NOT NULL,
      status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read'
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (receiverId) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (roomId) REFERENCES rooms(id) ON DELETE CASCADE
    )`
    ).run();

    ensureUserTableColumns();

    console.log("Database tables initialized.");

}
export interface User {
    id: string;
    name: string;
    email: string;
    passwordHash: string;
    createdAt: Date;
}

export interface Message {
    id: string;
    senderId: string;
    receiverId: string | null; // Nullable for group messages
    roomId: string | null; // Nullable for private 1-to-1 messages
    text: string;
    status: "sent" | "delivered" | "read";
    timestamp: Date;
}

export interface Room {
    id: string;
    name: string;
    createdAt: Date;
}