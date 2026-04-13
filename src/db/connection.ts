import { Database } from "bun:sqlite";

const db = new Database("chatrix.db");

db.exec("PRAGMA journal_mode = WAL;");

db.exec("PRAGMA foreign_keys = ON;");

console.log("Database connection established.");

export default db;