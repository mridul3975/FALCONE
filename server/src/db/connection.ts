import { Database } from "bun:sqlite";

// Changed the name to force a brand new database file!
const db = new Database("chatrix_core.sqlite", { create: true });
db.exec("PRAGMA journal_mode = WAL;");
db.exec("PRAGMA foreign_keys = ON;");

console.log("📦 SQLite Database connected");

export default db;