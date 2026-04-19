import { serve, type ServerWebSocket } from "bun";
import { initDb } from "./db/models";
import { auth } from "./auth/auth";
import { messageRepo } from "./chat/messages.repo";

// Initialize Database Schema
initDb();

const PORT = process.env.PORT || 3000;

type WSContext = {
    userId: string;
    username: string;
};

const server = serve<WSContext>({
    port: PORT,
    hostname: "127.0.0.1",
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
                    if (!to && !text) {
                        ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
                        return;
                    }
                
                    const savedMsg = messageRepo.savePrivateMessage(ws.data.userId, to, text );
                    ws.send(JSON.stringify({ type: "ack", data: { messageId: savedMsg.id, status: "sent" } }));

                    server.publish(to, JSON.stringify({
                        type: "chat-message",
                        data: savedMsg
                    }));
                } 
            } catch (err) {
                if (err instanceof SyntaxError) {
                    ws.send(JSON.stringify({ type: "error", message: "Malformed JSON payload" }));
                    return;
                }

                console.error("Error processing message:", err);
                ws.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
            }
        },
        close(ws) {
            ws.unsubscribe(ws.data.userId);
            console.log(`User ${ws.data.username} disconnected`);
        }
        },
        });
console.log(`🚀 ChatrIX Server running at http://${server.hostname}:${server.port}`);