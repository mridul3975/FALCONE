import { serve } from "bun";
import { initDb } from "./db/models";
import { auth } from "./auth/auth";

// Initialize Database Schema
initDb();

const PORT = process.env.PORT || 3000;

type websocketData = {
    userId: string;
    username: string;
};

const server = serve<websocketData>({
    port: PORT,
    async fetch(req) {
        const url = new URL(req.url);
        if (url.pathname.startsWith("/api/auth")) {
            return auth.handler(req);
        }
        if (url.pathname === "/chat") {

            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return new Response("Unauthorized", { status: 401 });
            }

            const upgraded = server.upgrade(req, {
                data: {
                    userId: session.user.id,
                    username: session.user.name
                }
            });
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
            console.log(`🟢 ${ws.data.userId} (${ws.data.username}) connected!`);
            ws.send(JSON.stringify({ type: "connected", message: "Welcome to ChatrIX!" }));
        },
        message(ws, message) {
            console.log(`📩 Received from ${ws.data.userId} (${ws.data.username}): ${message}`);
            ws.send(`Echo: ${message}`);
        },
        close(_ws, _code, _message) {
            console.log(`🔴 ${_ws.data.userId} (${_ws.data.username}) disconnected`);
        },
    },
});

