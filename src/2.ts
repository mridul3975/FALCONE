const server = Bun.serve<{ username: string }>({
    port: 3000,
    fetch(req, server) {
        const url = new URL(req.url);
        // Extract a username from the query string (e.g., ws://localhost:3000?username=Alice)
        const username = url.searchParams.get("username") || "Anonymous";

        // Upgrade the request to a WebSocket, attaching the username as contextual data
        if (server.upgrade(req, { data: { username } })) {
            return; // Successful upgrade, stop HTTP execution
        }
        return new Response("Upgrade failed", { status: 500 });
    },

    websocket: {
        open(ws) {
            // 1. Subscribe this specific connection to a channel
            ws.subscribe("global-chat");

            // 2. Broadcast to all OTHER subscribers that someone joined
            server.publish("global-chat", `System: ${ws.data.username} has entered the chat.`);

            // (Optional) Send a private welcome message only to the user who just connected
            ws.send("System: Welcome to the group chat!");
        },

        message(ws, message) {
            // 3. When a message is received, broadcast it to the channel
            // server.publish sends it to everyone in the channel, including the sender
            server.publish("global-chat", `${ws.data.username}: ${message}`);
        },

        close(ws, _code, _message) {
            // 4. Unsubscribe and notify others of the departure
            ws.unsubscribe("global-chat");
            server.publish("global-chat", `System: ${ws.data.username} has left the chat.`);
        },
    },
});

console.log(`Server listening on ws://localhost:${server.port}`);