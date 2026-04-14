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
            try {
                const parsed = JSON.parse(message as string);
                if (parsed.type === "chat_message") {
                    const { to, text } = parsed;
                    const savedMsg = messageRepo.savePrivateMessage(ws.data.userId, to, text);
                    console.log(`💬 ${ws.data.username} sent a message to ${to}: "${text}"`);

                    ws.send(JSON.stringify({ type: "ack", data: { messageId: savedMsg.id, status: "sent" } }));

                    const receiverWS = activeClients.get(to);
                    if (receiverWS) {
                        receiverWS.send(JSON.stringify({
                            type: "incoming_message",
                            data: savedMsg
                        }));
                    }
                }
            } catch (err) {
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

