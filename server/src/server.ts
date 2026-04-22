import { serve } from "bun";
import { initDb } from "./db/models";
import { auth } from "./auth/auth";
import { messageRepo } from "./chat/messages.repo";
import { roomRepo } from "./chat/rooms.repo";
import { getRoomMessages } from "./chat/rooms.repo";
import { networkInterfaces } from "node:os";
import db from "./db/connection";
import { env } from "./config/env";


// Initialize Database Schema
initDb();

const PORT = env.PORT;
const HOST = env.HOST;

const DEV_CLIENT_PORTS = [3000, 4173, 5173, 5174, 5175, 5176, 5177, 5178, 5179, 5180];

function getLocalIPv4Hosts(): string[] {
    const interfaces = networkInterfaces();
    const hosts: string[] = [];

    for (const netInterface of Object.values(interfaces)) {
        for (const net of netInterface ?? []) {
            if (net.family === "IPv4" && !net.internal) {
                hosts.push(net.address);
            }
        }
    }

    return hosts;
}

const defaultHosts = ["localhost", "127.0.0.1", ...getLocalIPv4Hosts()];
const defaultAllowedOrigins = defaultHosts.flatMap((host) =>
    DEV_CLIENT_PORTS.map((port) => `http://${host}:${port}`),
);

const envAllowedOrigins = env.TRUSTED_ORIGINS;

const allowedOrigins = new Set([...defaultAllowedOrigins, ...envAllowedOrigins]);

function buildCorsHeaders(req: Request): Headers {
    const headers = new Headers();
    const origin = req.headers.get("origin");
    const isAllowedOrigin = origin !== null && allowedOrigins.has(origin);

    if (isAllowedOrigin && origin) {
        headers.set("Access-Control-Allow-Origin", origin);
        headers.set("Vary", "Origin");
        headers.set("Access-Control-Allow-Credentials", "true");
    }

    const requestedHeaders = req.headers.get("access-control-request-headers");
    headers.set("Access-Control-Allow-Headers", requestedHeaders ?? "Content-Type, Authorization");
    headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Max-Age", "86400");

    return headers;
}

function withCors(req: Request, res: Response): Response {
    const corsHeaders = buildCorsHeaders(req);

    if (!corsHeaders.has("Access-Control-Allow-Origin")) {
        return res;
    }

    const headers = new Headers(res.headers);
    corsHeaders.forEach((value, key) => headers.set(key, value));

    return new Response(res.body, {
        status: res.status,
        statusText: res.statusText,
        headers,
    });
}

type WSContext = {
    userId: string;
    username: string;
};

const server = serve<WSContext>({
    port: PORT,
    hostname: HOST,
    async fetch(req) {
        const url = new URL(req.url);

        if (req.method === "OPTIONS" && url.pathname.startsWith("/api/")) {
            const origin = req.headers.get("origin");
            if (origin && !allowedOrigins.has(origin)) {
                return new Response("CORS origin not allowed", { status: 403 });
            }
            return new Response(null, {
                status: 204,
                headers: buildCorsHeaders(req),
            });
        }

        if (url.pathname.startsWith("/api/auth")) {
            const authResponse = await auth.handler(req);
            return withCors(req, authResponse);
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

        if (url.pathname === "/api/users" && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });

            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            //users i have direct messages only

            const users = db
                .query(
                    `
SELECT
u.id, u.name, u.email, u.image,
MAX(m.timestamp) AS lastMessageAt
FROM user u
JOIN messages m
ON (
(m.senderId = $currentUserId AND m.receiverId = u.id)
OR
(m.receiverId = $currentUserId AND m.senderId = u.id)
)
WHERE u.id != $currentUserId
AND m.receiverId IS NOT NULL
GROUP BY u.id, u.name, u.email, u.image
ORDER BY lastMessageAt DESC
LIMIT 50
                    `,
                )
                .all({ $currentUserId: session.user.id }) as Array<{
                    id: string;
                    name: string;
                    email: string;
                    image: string | null;
                }>;

            return withCors(
                req,
                new Response(JSON.stringify(users), {
                    headers: { "Content-Type": "application/json" },
                }),
            );
        }
        if (url.pathname.match(/^\/api\/users\/([^/]+)$/) && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });

            console.log("GET /api/users/:id hit");
            console.log("request path:", url.pathname);
            console.log("raw auth header:", req.headers.get("authorization"));

            if (!session) {
                console.log("no session found");
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const rawUserId = url.pathname.split("/").filter(Boolean).pop();
            const userId = rawUserId ? decodeURIComponent(rawUserId).trim() : "";

            console.log("rawUserId:", rawUserId);
            console.log("decoded userId:", userId);
            console.log("current session user:", session.user.id);

            if (!userId) {
                console.log("missing user id");
                return withCors(req, new Response("Bad Request: Missing user ID", { status: 400 }));
            }

            const user = db
                .query(`
    SELECT id, name, email, image
    FROM user
    WHERE id = $userId
    LIMIT 1
  `)
                .get({ $userId: userId }) as { // Added the $ to the key here
                    id: string;
                    name: string;
                    email: string;
                    image: string | null;
                } | null;

            console.log("lookup result:", user);

            if (!user) {
                return withCors(req, new Response("Not Found", { status: 404 }));
            }

            return withCors(
                req,
                new Response(JSON.stringify(user), {
                    headers: { "Content-Type": "application/json" },
                }),
            );
        }

        if (url.pathname === "/api/messages/mark-read" && req.method === "POST") {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const body = (await req.json().catch(() => null)) as { otherUserId?: string } | null;
            const otherUserId = body?.otherUserId?.trim();

            if (!otherUserId) {
                return withCors(req, new Response("Bad Request: Missing otherUserId", { status: 400 }));
            }

            const updated = messageRepo.markconversationAsRead(session.user.id, otherUserId);

            server.publish(otherUserId, JSON.stringify({
                type: "message-status",
                data: {
                    fromUserId: session.user.id,
                    status: "read",
                    updatedCount: updated,
                },
            }));

            return withCors(
                req,
                new Response(JSON.stringify({ updated }), {
                    headers: { "Content-Type": "application/json" },
                }),
            );
        }

        if (url.pathname.startsWith("/api/messages/")) {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const pathParts = url.pathname.split("/").filter(Boolean);
            const otherUserId = pathParts[pathParts.length - 1];

            // --- 🚨 ADD THESE DEBUG LOGS ---
            console.log(`\n🔍 DEBUG: Fetching history between Me(${session.user.id}) and Them(${otherUserId})`);



            if (!otherUserId) {
                return withCors(req, new Response("Bad Request: Missing other user ID", { status: 400 }));
            }
            const history = messageRepo.getConversation(session.user.id, otherUserId);
            const deliveredCount = messageRepo.markconversationAsDelivered(session.user.id, otherUserId);

            if (deliveredCount > 0) {
                server.publish(otherUserId, JSON.stringify({
                    type: "message-status",
                    data: {
                        fromUserId: session.user.id,
                        status: "delivered",
                        updatedCount: deliveredCount,
                    },
                }));
            }

            return withCors(req, new Response(JSON.stringify(history), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        if (url.pathname === "/api/rooms" && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const rooms = roomRepo.getAllRooms();
            return withCors(req, new Response(JSON.stringify(rooms), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        if (url.pathname === "/api/rooms/create" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const body = (await req.json()) as { name?: string } | null;
            if (!body || typeof body.name !== "string" || !body.name.trim()) {
                return withCors(req, new Response("Bad Request: Missing room name", { status: 400 }));
            }

            const newRoom = roomRepo.createRoom(body.name.trim());
            return withCors(req, new Response(JSON.stringify(newRoom), {
                headers: { "Content-Type": "application/json" },
            }));
        }



        if (url.pathname === "/api/messages" && req.method === "POST") {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) return withCors(req, new Response("Unauthorized", { status: 401 }));

            type MessageRequest = { targetId?: string; content?: string; type?: "direct" | "room" };
            const body = (await req.json().catch(() => null)) as MessageRequest | null;
            const targetId = body?.targetId;
            const content = body?.content;
            const type = body?.type; // "direct" or "room"

            if (!targetId || typeof content !== "string" || !type) {
                return withCors(req, new Response("Bad Request", { status: 400 }));
            }

            try {
                if (type === "direct") {
                    const saved = messageRepo.savePrivateMessage(session.user.id, targetId, content);
                    const payload = saved
                    return withCors(req, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
                } else if (type === "room") {
                    const saved = roomRepo.saveRoomMessage(session.user.id, targetId, content);
                    const payload = saved;
                    return withCors(req, new Response(JSON.stringify(payload), { headers: { "Content-Type": "application/json" } }));
                } else {
                    return withCors(req, new Response("Bad Request: unknown message type", { status: 400 }));
                }
            } catch (err) {
                console.error("❌ Error saving message:", err);
                return withCors(req, new Response("Internal Server Error", { status: 500 }));
            }
        }

        const roomMessageMatch = url.pathname.match(/^\/api\/rooms\/([^\/]+)\/messages$/);
        if (roomMessageMatch && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const roomId = roomMessageMatch[1];
            if (!roomId) {
                return withCors(req, new Response("Bad Request: Missing room ID", { status: 400 }));
            }
            try {
                const messages = getRoomMessages(roomId);
                return withCors(req, new Response(JSON.stringify(messages), {
                    headers: { "Content-Type": "application/json" },
                }));
            } catch (error) {
                console.error("❌ Error fetching room messages:", error);
                return withCors(req, new Response("Internal Server Error", { status: 500 }));
            }
        }

        return new Response("Not Found", { status: 404 });
    },
    websocket: {
        open(ws) {
            ws.subscribe(ws.data.userId); // Subscribe to a channel specific to the user
            console.log(`User ${ws.data.username} connected with ID ${ws.data.userId}`);
            ws.send(JSON.stringify({ type: "welcome", message: `Welcome ${ws.data.username}!` }));
        },
        message(ws, message) {
            const msgString = (typeof message === "string" ? message : new TextDecoder().decode(message)).trim();

            // Ignore keepalive or empty websocket frames.
            if (!msgString) {
                return;
            }

            try {
                const parsed = JSON.parse(msgString);
                if (typeof parsed !== "object" || parsed === null) {
                    ws.send(JSON.stringify({ type: "error", message: "Invalid message payload" }));
                    return;
                }

                console.log(`Received message from ${ws.data.username}:`, parsed);
                if (parsed.type === "chat-message") {
                    const to = parsed.data.to || parsed.to; // recipient userId
                    const text = parsed.data.text || parsed.text;
                    if (!to || !text) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
                        return;
                    }

                    const savedMsg = messageRepo.savePrivateMessage(ws.data.userId, to, text);
                    ws.send(JSON.stringify({ type: "ack", data: { messageId: savedMsg.id, status: "sent" } }));

                    server.publish(to, JSON.stringify({
                        type: "chat-message",
                        data: savedMsg
                    }));
                }
                // --- JOIN A ROOM ---
                if (parsed.type === "room_join") {
                    const roomId = parsed.data?.roomId || parsed.roomId;
                    if (!roomId) {
                        ws.send(JSON.stringify({ type: "error", message: "Missing roomId" }));
                        return;
                    }

                    ws.subscribe(roomId); // Bun's native PubSub makes this ONE LINE!
                    console.log(`📢 ${ws.data.username} joined room ${roomId}`);
                    ws.send(JSON.stringify({ type: "system", message: `Successfully joined room ${roomId}` }));
                    return;
                }

                // --- SEND MESSAGE TO A ROOM ---
                if (parsed.type === "room_message") {
                    const roomId = parsed.data?.roomId || parsed.roomId;
                    const text = parsed.data?.text || parsed.text;

                    if (!roomId || !text) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid room message format" }));
                        return;
                    }

                    // Save it to the DB
                    const savedMsg = roomRepo.saveRoomMessage(ws.data.userId, roomId, text);

                    // Ack back to the sender
                    ws.send(JSON.stringify({ type: "ack", data: { messageId: savedMsg.id, status: "sent" } }));

                    // Broadcast to EVERYONE subscribed to this room!
                    server.publish(roomId, JSON.stringify({
                        type: "room_message",
                        data: savedMsg
                    }));
                    return;
                }
            } catch (error) {
                console.error("Error processing message:", error);
                ws.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
            }
        },
        close(ws) {
            ws.unsubscribe(ws.data.userId);
            console.log(`User ${ws.data.username} disconnected`);
        }
    },
});
console.log(`🚀 ChatrIX Server running at http://${HOST}:${PORT}`);