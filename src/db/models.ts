import db from "./connection";

export function initDb() {
    // User table
    db.query(`
        CREATE TABLE IF NOT EXISTS USER(
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        passwordHash TEXT NOT NULL,
        createdat DATETIME DEFAULT CURRENT_TIMESTAMP
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

    console.log("Database tables initialized.");

}
export interface User {
    id: string;
    username: string;
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