import { serve } from "bun";
import { initDb } from "./db/models";

// Initialize Database Schema
initDb();

const PORT = process.env.PORT || 3000;

const server = serve({
    port: PORT,
    fetch(req, server) {
        const url = new URL(req.url);

        // Upgrade the request to a WebSocket
        if (url.pathname === "/chat") {
            const upgraded = server.upgrade(req);
            if (!upgraded) {
                return new Response("Upgrade failed", { status: 400 });
            }
            return;
        }

        // Health check
        if (url.pathname === "/health") {
            return new Response(JSON.stringify({ status: "ok" }), {
                headers: { "Content-Type": "application/json" },
            });
        }

        return new Response("Not Found", { status: 404 });
    },

    // WebSocket Handlers
    websocket: {
        open(ws) {
            console.log("🟢 Client connected!");
            ws.send(JSON.stringify({ type: "connected", message: "Welcome to ChatrIX!" }));
        },
        message(ws, message) {
            console.log(`📩 Received: ${message}`);
            ws.send(`Echo: ${message}`);
        },
        close(ws, code, message) {
            console.log("🔴 Client disconnected");
        },
    },
});

console.log(`🚀 ChatrIX Server running at http://localhost:${server.port}`);