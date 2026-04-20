import db from "../db/connection";

export interface ChatMessage {
    id: string;
    senderId: string;
    receiverId: string;
    roomId: string | null;
    text: string;
    status: string;
    timestamp: Date;
}

export const messageRepo = {
    savePrivateMessage: (senderId: string, receiverId: string, text: string): ChatMessage => {

        // 1. 🚨 DEBUG TRACKER: Let's see exactly what values are making it to this function!
        console.log("🛠️ DEBUG - Variables about to be saved:", { senderId, receiverId, text });

        // 2. Safety check: If text is lost, stop right here and tell us!
        if (text === undefined || text === null) {
            throw new Error("CRITICAL BUG: The text variable is null before hitting the database!");
        }

        const id = crypto.randomUUID();
        const timestamp = new Date();
        const status = "sent";

        try {
            // 3. Wrapping "text" in quotes to prevent SQLite from thinking it's a command.
            // 4. Using 7 explicit positional question marks to prevent any alignment bugs.
            const query = db.query(`
                INSERT INTO messages (id, senderId, receiverId, roomId, "text", status, timestamp)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            // 5. Passing exactly 7 variables in perfect order.
            query.run(id, senderId, receiverId, null, text, status, timestamp.toISOString());

            console.log(`✅ Message safely saved to DB!`);
        } catch (error) {
            console.error("❌ DB Insert Error:", error);
            throw error;
        }

        return { id, senderId, receiverId, roomId: null, text, status, timestamp };
    },
    getConversation: (userId: string, otherUserId: string): ChatMessage[] => {
        try {
            console.log(`🔍 Querying conversation between ${userId} and ${otherUserId}`);
            const query = db.query(`
            SELECT * FROM messages
            WHERE (senderId = ? AND receiverId = ?)
               OR (senderId = ? AND receiverId = ?)
            ORDER BY timestamp ASC
        `);
            const results = query.all(userId, otherUserId, otherUserId, userId) as ChatMessage[];
            console.log(`📨 Found ${results.length} messages:`, results);
            return results;
        } catch (error) {
            console.error("❌ DB Query Error:", error);
            throw error;
        }
    }
};