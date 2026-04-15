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
const activeClients = new Map<string, ServerWebSocket<WSContext>>();

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
            activeClients.set(ws.data.userId, ws);
            console.log(`🟢 ${ws.data.userId} (${ws.data.username}) connected`);

            ws.send(JSON.stringify({ type: "connected", message: `Welcome ${ws.data.username}!` }));

        },
        message(ws, message) {
            // 1. Safely convert Buffer to String
            const msgString = typeof message === "string"
                ? message
                : new TextDecoder().decode(message as Uint8Array);

            try {
                // 2. Parse the JSON
                const parsed = JSON.parse(msgString);
                console.log(`\n📩 Incoming JSON from ${ws.data.username}:`, parsed);

                if (parsed.type === "chat_message") {

                    // 3. FOOLPROOF EXTRACTION: Check inside `data`, but also check the root level just in case!
                    const to = parsed.data?.to || parsed.to;
                    const text = parsed.data?.text || parsed.text;

                    // 4. If they are STILL undefined, stop and throw an error back to Postman!
                    if (!to || !text) {
                        console.log("❌ Missing 'to' or 'text' in the JSON!", parsed);
                        ws.send(JSON.stringify({ type: "error", message: "Your JSON is missing 'to' or 'text'." }));
                        return;
                    }

                    // 5. Save it to the database!
                    const savedMsg = messageRepo.savePrivateMessage(ws.data.userId, to, text);

                    // 6. Send success ACK to sender
                    ws.send(JSON.stringify({ type: "ack", data: { messageId: savedMsg.id, status: "sent" } }));

                    // 7. Forward to receiver if they are online
                    const receiverWS = activeClients.get(to);
                    if (receiverWS) {
                        receiverWS.send(JSON.stringify({
                            type: "incoming_message",
                            data: savedMsg
                        }));
                    }
                }
            } catch (err) {
                console.error("❌ JSON Parse Error:", err);
                ws.send(JSON.stringify({ type: "error", message: "Invalid JSON format" }));
            }
        },
        close(ws) {
            activeClients.delete(ws.data.userId);
            console.log(`🔴 ${ws.data.userId} (${ws.data.username}) disconnected`);
        },
    },
});
console.log(`🚀 ChatrIX Server running at http://${server.hostname}:${server.port}`);

