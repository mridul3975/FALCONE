import { serve } from "bun";
import { initDb } from "./db/models";
import { auth } from "./auth/auth";

// Initialize Database Schema
initDb();

const PORT = process.env.PORT || 3000;

const server = serve({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/api/auth")) {
            return auth.handler(req);
        }
        if (url.pathname === "/chat") {
            const upgraded = server.upgrade(req);
            if (!upgraded) {
                return new Response("WebSocket upgrade failed", { status: 400 });
            }
            return;
        }
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok" }), {
                headers: { "Content-Type": "application/json" },
            });
        }
        return new Response("Not Found", { status: 404 });
    },
    websocket: {
        open(ws) {
            console.log("🟢 Client connected!");
            ws.send(JSON.stringify({ type: "connected", message: "Welcome to ChatrIX!" }));
        },
        message(ws, message) {
            console.log(`📩 Received: ${message}`);
            ws.send(`Echo: ${message}`);
        },
        close(_ws, _code, _message) {
            console.log("🔴 Client disconnected");
        },
    },
});

