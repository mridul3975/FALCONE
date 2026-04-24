import { serve } from "bun";
import { initDb } from "./db/models";
import { auth } from "./auth/auth";
import { messageRepo } from "./chat/messages.repo";
import { roomRepo } from "./chat/rooms.repo";
import { getRoomMessages } from "./chat/rooms.repo";
import { networkInterfaces } from "node:os";
import db from "./db/connection";
import { askGemini } from "../gemini.ts";
import type { Database } from "bun:sqlite";




// Initialize Database Schema
initDb();

const PORT = Number(process.env.PORT ?? 3000);
const HOST = process.env.HOST ?? "0.0.0.0";

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


const GEMINI_BOT_ID = "gemini-bot";

const defaultHosts = ["localhost", "127.0.0.1", ...getLocalIPv4Hosts()];
const defaultAllowedOrigins = defaultHosts.flatMap((host) =>
    DEV_CLIENT_PORTS.map((port) => `http://${host}:${port}`),
);

const envAllowedOrigins = (process.env.TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
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

//get relationship status

type RelationshipStatus = "ACCEPTED" | "PENDING" | "NONE";

function getRelationshipStatus(
  db: Database,
  userId: string,
  otherUserId: string,
): RelationshipStatus {
  // Prevent self-conversation edge case from behaving like "no relation"
  if (userId === otherUserId) return "ACCEPTED";

  // friendships is stored in canonical order (user_a_id, user_b_id)
  const [a, b] = userId < otherUserId
    ? [userId, otherUserId]
    : [otherUserId, userId];

  const friendship = db
    .query(
      `
      SELECT 1
      FROM friendships
      WHERE user_a_id = ? AND user_b_id = ?
      LIMIT 1
      `,
    )
    .get(a, b);

  if (friendship) return "ACCEPTED";

  const pendingRequest = db
    .query(
      `
      SELECT 1
      FROM friend_requests
      WHERE (
        (from_user_id = ? AND to_user_id = ?)
        OR
        (from_user_id = ? AND to_user_id = ?)
      )
      AND status = 'pending'
      LIMIT 1
      `,
    )
    .get(userId, otherUserId, otherUserId, userId);

  if (pendingRequest) return "PENDING";

  return "NONE";
}

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
            const userLookupKey = rawUserId ? decodeURIComponent(rawUserId).trim() : "";

            console.log("rawUserId:", rawUserId);
            console.log("decoded userId:", userLookupKey);
            console.log("current session user:", session.user.id);

            if (!userLookupKey) {
                console.log("missing user id");
                return withCors(req, new Response("Bad Request: Missing user ID", { status: 400 }));
            }

            const user = db
                .query(`
        SELECT id, name, email, image
        FROM user
        WHERE id = $lookup
            OR LOWER(name) LIKE LOWER($likeLookup)
            OR LOWER(email) LIKE LOWER($likeLookup)
        ORDER BY
            CASE WHEN id = $lookup THEN 0 ELSE 1 END,
            updatedAt DESC
        LIMIT 1
    `)
                .get({
                    $lookup: userLookupKey,
                    $likeLookup: `%${userLookupKey}%`,
                }) as {
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

        if (url.pathname.match(/^\/api\/users\/([^/]+)\/social$/) && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const userId = decodeURIComponent(url.pathname.split("/").filter(Boolean)[2] ?? "").trim();
            if (!userId) {
                return withCors(req, new Response("Bad Request: Missing user ID", { status: 400 }));
            }

            const target = db
                .query("SELECT id FROM user WHERE id = ? LIMIT 1")
                .get(userId) as { id: string } | null;
            if (!target) {
                return withCors(req, new Response("Not Found", { status: 404 }));
            }

            const friendCountRow = db
                .query(
                    `
                    SELECT COUNT(*) AS friendCount
                    FROM friendships
                    WHERE user_a_id = ? OR user_b_id = ?
                    `,
                )
                .get(userId, userId) as { friendCount: number | string };
            const friendCount = Number(friendCountRow?.friendCount ?? 0);

            const relationshipStatus =
                userId === session.user.id ? "ACCEPTED" : getRelationshipStatus(db, session.user.id, userId);

            return withCors(
                req,
                new Response(
                    JSON.stringify({
                        friendCount,
                        relationshipStatus,
                        isSelf: userId === session.user.id,
                    }),
                    { headers: { "Content-Type": "application/json" } },
                ),
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
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) return withCors(req, new Response("Unauthorized", { status: 401 }));

            const pathParts = url.pathname.split("/").filter(Boolean);
            const otherUserId = pathParts[pathParts.length - 1];

            if (!otherUserId) {
                return withCors(req, new Response("Bad Request: Missing ID", { status: 400 }));
            }

            // 1. Check Relationship Status FIRST
            const status = getRelationshipStatus(db, session.user.id, otherUserId);

            // 2. Handle GET Request (Fetching History)
            if (req.method === "GET") {
                // Always return existing history, even when relationship is not accepted.
                // This keeps old chats visible unless users explicitly delete them.
                if (status !== "ACCEPTED") {
                    const history = messageRepo.getConversation(session.user.id, otherUserId);
                    return withCors(req, new Response(JSON.stringify({
                        status: status,
                        history,
                        restricted: true
                    }), { status: 200 }));
                }

                const history = messageRepo.getConversation(session.user.id, otherUserId);
                const deliveredCount = messageRepo.markconversationAsDelivered(session.user.id, otherUserId);

                // Notify other user that messages were seen/delivered
                if (deliveredCount > 0) {
                    server.publish(otherUserId, JSON.stringify({
                        type: "message-status",
                        data: { fromUserId: session.user.id, status: "delivered", updatedCount: deliveredCount }
                    }));
                }

                return withCors(req, new Response(JSON.stringify(history), {
                    headers: { "Content-Type": "application/json" },
                }));
            }

            // 3. Handle POST Request (Sending Message/Request)
            if (req.method === "POST") {
                const body = await req.json() as { content?: unknown };
                const content = typeof body.content === "string" ? body.content.trim() : "";

                if (!content) return withCors(req, new Response("Missing content", { status: 400 }));

                if (status === "NONE") {
                    db.run(`
                INSERT INTO message_requests (id, from_user_id, to_user_id, content, status)
                VALUES (?, ?, ?, ?, 'pending')
            `, [crypto.randomUUID(), session.user.id, otherUserId, content]);

                    return withCors(req, new Response(JSON.stringify({
                        status: "request_sent",
                        message: "Message request sent."
                    }), { status: 201 }));
                }

                if (status === "PENDING") {
                    return withCors(req, new Response("Request already pending", { status: 403 }));
                }

                // If status is ACCEPTED, your normal message saving logic goes here...
            }
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
                    const normalizedContent = content.trim();
                    if (!normalizedContent) {
                        return withCors(req, new Response("Bad Request: Empty content", { status: 400 }));
                    }

                    const userMessage = messageRepo.savePrivateMessage(
                        session.user.id,
                        targetId,
                        normalizedContent,
                    );

                    const isGeminiTarget = targetId === GEMINI_BOT_ID;
                    const geminiMatch = normalizedContent.match(/^@gemini\s+(.+)$/i);
                    const promptFromTag = geminiMatch?.[1]?.trim();
                    const shouldTriggerGemini = isGeminiTarget || Boolean(promptFromTag);

                    if (!shouldTriggerGemini) {
                        return withCors(
                            req,
                            new Response(JSON.stringify(userMessage), {
                                headers: { "Content-Type": "application/json" },
                            }),
                        );
                    }

                    const prompt = isGeminiTarget
                        ? normalizedContent.replace(/^@gemini\s+/i, "").trim() || normalizedContent
                        : (promptFromTag as string);

                    const aiText = await askGemini(prompt);
                    const aiReplyText = aiText || "Sorry, I could not generate a response right now.";

                    const aiSenderId = isGeminiTarget ? GEMINI_BOT_ID : session.user.id;
                    const aiReceiverId = isGeminiTarget ? session.user.id : targetId;
                    const aiMessageContent = aiReplyText;

                    const aiMessage = messageRepo.savePrivateMessage(
                        aiSenderId,
                        aiReceiverId,
                        aiMessageContent,
                        { aiSource: "gemini" },
                    );

                    return withCors(
                        req,
                        new Response(
                            JSON.stringify({
                                userMessage,
                                aiMessage,
                            }),
                            { headers: { "Content-Type": "application/json" } },
                        ),
                    );
                }
                if (type === "room") {
                    const normalizedContent = content.trim();
                    if (!normalizedContent) {
                        return withCors(req, new Response("Bad Request: Empty content", { status: 400 }));
                    }

                    const userMessage = roomRepo.saveRoomMessage(session.user.id, targetId, normalizedContent);

                    const geminiMatch = normalizedContent.match(/^@gemini\s+(.+)$/i);

                    if (!geminiMatch) {
                        return withCors(req, new Response(JSON.stringify(userMessage), {
                            headers: { "Content-Type": "application/json" },
                        }));
                    }

                    const prompt = geminiMatch[1]?.trim();
                    if (!prompt) {
                        return withCors(req, new Response(JSON.stringify(userMessage), {
                            headers: { "Content-Type": "application/json" },
                        }));
                    }

                    const aiText = await askGemini(prompt);
                    const aiMessage = roomRepo.saveRoomMessage(
                        GEMINI_BOT_ID,
                        targetId,
                        aiText || "Sorry, I could not generate a response right now.",
                        { aiSource: "gemini" },
                    );

                    return withCors(
                        req,
                        new Response(
                            JSON.stringify({
                                userMessage,
                                aiMessage,
                            }),
                            { headers: { "Content-Type": "application/json" } },
                        ),
                    );
                }

                return withCors(req, new Response("Bad Request: Invalid message type", { status: 400 }));
            } catch (error) {
                console.error("Error processing message:", error);
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

        // send friend request
        if (url.pathname === "/api/friend-requests/send" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const body = (await req.json().catch(() => null)) as { toUserId?: unknown } | null;
            const toUserId = typeof body?.toUserId === "string" ? body.toUserId.trim() : "";

            if (!toUserId) {
                return withCors(req, new Response("Bad Request: Missing toUserId", { status: 400 }));
            }
            if (toUserId === session.user.id) {
                return withCors(req, new Response("Bad Request: Cannot friend yourself", { status: 400 }));
            }

            const target = db.query("SELECT id FROM user WHERE id = ? LIMIT 1").get(toUserId) as { id: string } | null;
            if (!target) {
                return withCors(req, new Response("Not Found: User does not exist", { status: 404 }));
            }

            const status = getRelationshipStatus(db, session.user.id, toUserId);
            if (status === "ACCEPTED") {
                return withCors(req, new Response("Already friends", { status: 409 }));
            }
            if (status === "PENDING") {
                return withCors(req, new Response("Friend request already pending", { status: 409 }));
            }

            const requestId = crypto.randomUUID();
            db.run(
                "INSERT INTO friend_requests (id, from_user_id, to_user_id, status) VALUES (?, ?, ?, 'pending')",
                [requestId, session.user.id, toUserId],
            );

            server.publish(
                toUserId,
                JSON.stringify({
                    type: "friend-request-updated",
                    data: {
                        requestId,
                        fromUserId: session.user.id,
                        toUserId,
                        status: "pending",
                    },
                }),
            );

            return withCors(req, new Response(JSON.stringify({ id: requestId, status: "pending" }), {
                status: 201,
                headers: { "Content-Type": "application/json" },
            }));
        }

        // incoming/outgoing friend requests
        if (url.pathname === "/api/friend-requests" && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const privacy = db
  .query(
    `SELECT allow_message_requests
     FROM user_privacy
     WHERE user_id = ?
     LIMIT 1`,
  )
  .get(session.user.id) as { allow_message_requests: number } | null;

// No row => allow by default
const allowsRequests = privacy ? privacy.allow_message_requests === 1 : true;

if (!allowsRequests) {
  return withCors(req, new Response("User does not allow requests", { status: 403 }));
}

            const incoming = db
                .query("SELECT * FROM friend_requests WHERE to_user_id = ? AND status = 'pending' ORDER BY created_at DESC")
                .all(session.user.id);
            const outgoing = db
                .query("SELECT * FROM friend_requests WHERE from_user_id = ? AND status = 'pending' ORDER BY created_at DESC")
                .all(session.user.id);

            return withCors(req, new Response(JSON.stringify({ incoming, outgoing }), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        // accept friend request
        if (url.pathname === "/api/friend-requests/accept" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }

            const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
            const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";

            if (!requestId) {
                return withCors(req, new Response("Bad Request: Missing requestId", { status: 400 }));
            }

            const request = db
                .query("SELECT * FROM friend_requests WHERE id = ? AND to_user_id = ? AND status = 'pending' LIMIT 1")
                .get(requestId, session.user.id) as { from_user_id: string; to_user_id: string } | null;
            if (!request) {
                return withCors(req, new Response("Not Found: Pending request not found", { status: 404 }));
            }

            const [a, b] =
                request.from_user_id < request.to_user_id
                    ? [request.from_user_id, request.to_user_id]
                    : [request.to_user_id, request.from_user_id];

            db.run("UPDATE friend_requests SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?", [requestId]);
            db.run(
                `UPDATE friend_requests
                 SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
                 WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
                [request.to_user_id, request.from_user_id],
              );
            db.run("INSERT OR IGNORE INTO friendships (user_a_id, user_b_id) VALUES (?, ?)", [a, b]);

            server.publish(
                request.from_user_id,
                JSON.stringify({
                    type: "friend-request-updated",
                    data: {
                        requestId,
                        fromUserId: request.from_user_id,
                        toUserId: request.to_user_id,
                        status: "accepted",
                    },
                }),
            );
            server.publish(
                request.to_user_id,
                JSON.stringify({
                    type: "friend-request-updated",
                    data: {
                        requestId,
                        fromUserId: request.from_user_id,
                        toUserId: request.to_user_id,
                        status: "accepted",
                    },
                }),
            );

            return withCors(req, new Response(JSON.stringify({ ok: true, status: "accepted" }), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        // reject friend request
        if (url.pathname === "/api/friend-requests/reject" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
            const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
            if (!requestId) {
                return withCors(req, new Response("Bad Request: Missing requestId", { status: 400 }));
            }

            const result = db.run(
                "UPDATE friend_requests SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND to_user_id = ? AND status = 'pending'",
                [requestId, session.user.id],
            );
            if (result.changes === 0) {
                return withCors(req, new Response("Not Found: Pending request not found", { status: 404 }));
            }

            const request = db
                .query("SELECT from_user_id, to_user_id FROM friend_requests WHERE id = ? LIMIT 1")
                .get(requestId) as { from_user_id: string; to_user_id: string } | null;
            if (request) {
                server.publish(
                    request.from_user_id,
                    JSON.stringify({
                        type: "friend-request-updated",
                        data: {
                            requestId,
                            fromUserId: request.from_user_id,
                            toUserId: request.to_user_id,
                            status: "rejected",
                        },
                    }),
                );
            }

            return withCors(req, new Response(JSON.stringify({ ok: true, status: "rejected" }), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        // cancel friend request
        if (url.pathname === "/api/friend-requests/cancel" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
            const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
            if (!requestId) {
                return withCors(req, new Response("Bad Request: Missing requestId", { status: 400 }));
            }

            const result = db.run(
                "UPDATE friend_requests SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND from_user_id = ? AND status = 'pending'",
                [requestId, session.user.id],
            );
            if (result.changes === 0) {
                return withCors(req, new Response("Not Found: Pending request not found", { status: 404 }));
            }

            const request = db
                .query("SELECT from_user_id, to_user_id FROM friend_requests WHERE id = ? LIMIT 1")
                .get(requestId) as { from_user_id: string; to_user_id: string } | null;
            if (request) {
                server.publish(
                    request.to_user_id,
                    JSON.stringify({
                        type: "friend-request-updated",
                        data: {
                            requestId,
                            fromUserId: request.from_user_id,
                            toUserId: request.to_user_id,
                            status: "cancelled",
                        },
                    }),
                );
            }

            return withCors(req, new Response(JSON.stringify({ ok: true, status: "cancelled" }), {
                headers: { "Content-Type": "application/json" },
            }));
        }

 

        // get friends
        if (url.pathname === "/api/friends" && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const friends = db.query(`
                SELECT
                    u.id,
                    u.name,
                    u.email,
                    u.image,
                    f.created_at AS friendedAt
                FROM friendships f
                JOIN user u
                  ON u.id = CASE
                      WHEN f.user_a_id = ? THEN f.user_b_id
                      ELSE f.user_a_id
                  END
                WHERE f.user_a_id = ? OR f.user_b_id = ?
                ORDER BY f.created_at DESC
            `).all(session.user.id, session.user.id, session.user.id);
            return withCors(req, new Response(JSON.stringify(friends), {
                headers: { "Content-Type": "application/json" },
            }));
        }
        //message requests
        if (url.pathname === "/api/message-requests" && req.method === "GET") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const messageRequests = db.query("SELECT * FROM message_requests WHERE to_user_id = ?").all(session.user.id);
            return withCors(req, new Response(JSON.stringify(messageRequests), {
                headers: { "Content-Type": "application/json" },
            }));
        }
        //message request send
        if (url.pathname === "/api/message-requests/send" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = (await req.json().catch(() => null)) as { toUserId?: unknown } | null;
            const toUserId = typeof body?.toUserId === "string" ? body.toUserId.trim() : "";
            if (!toUserId) {
                return withCors(req, new Response("Bad Request: Missing toUserId", { status: 400 }));
            }
            const requestId = crypto.randomUUID();
            db.run(
                "INSERT INTO message_requests (id, from_user_id, to_user_id, content, status) VALUES (?, ?, ?, ?, 'pending')",
                [requestId, session.user.id, toUserId, ""],
            );

            server.publish(
                toUserId,
                JSON.stringify({
                    type: "message-request-updated",
                    data: {
                        requestId,
                        fromUserId: session.user.id,
                        toUserId,
                        status: "pending",
                    },
                }),
            );

            return withCors(req, new Response(JSON.stringify({ id: requestId, status: "pending" }), {
                headers: { "Content-Type": "application/json" },
            }));
        }

        //message request accept
        if (url.pathname === "/api/message-requests/accept" && req.method === "POST") {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) return withCors(req, new Response("Unauthorized", { status: 401 }));
          
            const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
            const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
            if (!requestId) return withCors(req, new Response("Bad Request: Missing requestId", { status: 400 }));
          
            const request = db
              .query(
                `SELECT id, from_user_id, to_user_id, content
                 FROM message_requests
                 WHERE id = ? AND to_user_id = ? AND status = 'pending'
                 LIMIT 1`,
              )
              .get(requestId, session.user.id) as
              | { id: string; from_user_id: string; to_user_id: string; content: string }
              | null;
          
            if (!request) return withCors(req, new Response("Not Found", { status: 404 }));
          
            db.run(
              `UPDATE message_requests
               SET status = 'accepted'
               WHERE id = ?`,
              [requestId],
            );
          
            const [a, b] =
              request.from_user_id < request.to_user_id
                ? [request.from_user_id, request.to_user_id]
                : [request.to_user_id, request.from_user_id];
          
            db.run(
              `INSERT OR IGNORE INTO friendships (user_a_id, user_b_id)
               VALUES (?, ?)`,
              [a, b],
            );

            server.publish(
              request.from_user_id,
              JSON.stringify({
                type: "message-request-updated",
                data: {
                  requestId,
                  fromUserId: request.from_user_id,
                  toUserId: request.to_user_id,
                  status: "accepted",
                },
              }),
            );
            server.publish(
              request.to_user_id,
              JSON.stringify({
                type: "message-request-updated",
                data: {
                  requestId,
                  fromUserId: request.from_user_id,
                  toUserId: request.to_user_id,
                  status: "accepted",
                },
              }),
            );
          
            return withCors(
              req,
              new Response(JSON.stringify({ ok: true, status: "accepted" }), {
                headers: { "Content-Type": "application/json" },
              }),
            );
          }

        //message request reject
        if (url.pathname === "/api/message-requests/reject" && req.method === "POST") {
            const session = await auth.api.getSession({ headers: req.headers });
            if (!session) return withCors(req, new Response("Unauthorized", { status: 401 }));
          
            const body = (await req.json().catch(() => null)) as { requestId?: unknown } | null;
            const requestId = typeof body?.requestId === "string" ? body.requestId.trim() : "";
            if (!requestId) return withCors(req, new Response("Bad Request: Missing requestId", { status: 400 }));
          
            const result = db.run(
              `UPDATE message_requests
               SET status = 'rejected'
               WHERE id = ? AND to_user_id = ? AND status = 'pending'`,
              [requestId, session.user.id],
            );
          
            if (result.changes === 0) {
              return withCors(req, new Response("Not Found", { status: 404 }));
            }

            const request = db
              .query("SELECT from_user_id, to_user_id FROM message_requests WHERE id = ? LIMIT 1")
              .get(requestId) as { from_user_id: string; to_user_id: string } | null;
            if (request) {
              server.publish(
                request.from_user_id,
                JSON.stringify({
                  type: "message-request-updated",
                  data: {
                    requestId,
                    fromUserId: request.from_user_id,
                    toUserId: request.to_user_id,
                    status: "rejected",
                  },
                }),
              );
            }
          
            return withCors(
              req,
              new Response(JSON.stringify({ ok: true, status: "rejected" }), {
                headers: { "Content-Type": "application/json" },
              }),
            );
          }

        // unfriend
        if (url.pathname === "/api/friends/unfriend" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = (await req.json().catch(() => null)) as { userId?: unknown } | null;
            const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
            if (!userId) {
                return withCors(req, new Response("Bad Request: Missing userId", { status: 400 }));
            }

            const [a, b] = session.user.id < userId ? [session.user.id, userId] : [userId, session.user.id];
            const result = db.run("DELETE FROM friendships WHERE user_a_id = ? AND user_b_id = ?", [a, b]);
            if (result.changes === 0) {
                return withCors(req, new Response("Not Found: Friendship not found", { status: 404 }));
            }

            return withCors(req, new Response(JSON.stringify({ ok: true, unfriended: true }), {
                headers: { "Content-Type": "application/json" },
            }));
        }
        //block user
        if (url.pathname === "/api/friends/block" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = await req.json() as { userId?: string } | null;
            const userId = body?.userId?.trim();
            if (!userId) {
                return withCors(req, new Response("Bad Request: Missing userId", { status: 400 }));
            }
            const blockedUser = db.run("INSERT INTO blocked_users (user_id, blocked_user_id) VALUES (?, ?)", [session.user.id, userId]);
            return withCors(req, new Response(JSON.stringify(blockedUser), {
                headers: { "Content-Type": "application/json" },
            }));
        }
        //unblock user
        if (url.pathname === "/api/friends/unblock" && req.method === "POST") {
            const session = await auth.api.getSession({
                headers: req.headers,
            });
            if (!session) {
                return withCors(req, new Response("Unauthorized", { status: 401 }));
            }
            const body = await req.json() as { userId?: string } | null;
            const userId = body?.userId?.trim();
            if (!userId) {
                return withCors(req, new Response("Bad Request: Missing userId", { status: 400 }));
            }
            const blockedUser = db.run("DELETE FROM blocked_users WHERE user_id = ? AND blocked_user_id = ?", [session.user.id, userId]);
            return withCors(req, new Response(JSON.stringify(blockedUser), {
                headers: { "Content-Type": "application/json" },
            }));
        }
        if (url.pathname.startsWith("/api/")) {
            return withCors(req, new Response("Not Found", { status: 404 }));
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