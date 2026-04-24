import { Database } from "bun:sqlite";

const db = new Database("chatrix_core.sqlite", { create: true });
// WSL /mnt/c fix: WAL mode fails on Windows-mounted drives due to mmap restrictions.
// We force DELETE mode to avoid the need for .shm files.
db.exec("PRAGMA journal_mode = DELETE;");
db.exec("PRAGMA foreign_keys = ON;");

console.log("📦 SQLite Database connected");

export default db;