import db from "../db/connection";

export const roomRepo = {
    // 1. Create a new room
    createRoom: (name: string, creatorId: string) => {
        const id = crypto.randomUUID();
        try {
            db.query(`INSERT INTO rooms (id, name, creatorId) VALUES ($id, $name, $creatorId)`).run({
                $id: id,
                $name: name,
                $creatorId: creatorId
            });
            // Automatically join the creator
            db.query(`INSERT INTO room_members (roomId, userId) VALUES (?, ?)`).run(id, creatorId);
            console.log(`🏠 Created new room: ${name} by ${creatorId}`);
            return { id, name, creatorId };
        } catch (error) {
            console.error("❌ Error creating room:", error);
            throw error;
        }
    },

    // 2. Get a list of all rooms
    getAllRooms: () => {
        return db.query(`SELECT id, name, creatorId, createdAt FROM rooms ORDER BY createdAt DESC`).all();
    },

    // 3. Save a message sent to a room
    saveRoomMessage: (
        senderId: string,
        roomId: string,
        text: string,
        options?: { aiSource?: string | null, replyToId?: string | null },
    ) => {
        const id = crypto.randomUUID();
        const timestamp = new Date().toISOString();
        const status = "sent";
        const aiSource = options?.aiSource || null;

        try {
            db.query(`
                INSERT INTO messages (id, senderId, receiverId, roomId, "text", status, timestamp, aiSource, replyToId)
                VALUES ($id, $senderId, NULL, $roomId, $text, $status, $timestamp, $aiSource, $replyToId)
            `).run({
                $id: id,
                $senderId: senderId,
                $roomId: roomId,
                $text: text,
                $status: status,
                $timestamp: timestamp,
                $aiSource: aiSource,
                $replyToId: options?.replyToId || null,
            });
        } catch (error) {
            console.error("❌ Error saving room message:", error);
            throw error;
        }

        return { id, senderId, receiverId: null, roomId, text, status, timestamp, aiSource, replyToId: options?.replyToId || null };
    }
};

export function getRoomMessages(roomId: string, limit = 100) {
    try {
        const messages = db.query(`
            SELECT 
                m.id, m.senderId, m.roomId, m.text, m.status, m.timestamp, m.aiSource, m.replyToId
            FROM messages m
            WHERE m.roomId = $roomId
            ORDER BY m.timestamp ASC
            LIMIT $limit
        `).all({ $roomId: roomId, $limit: limit }) as any[];

        return messages.map(m => ({
            ...m,
            reactions: db.query("SELECT emoji, userId FROM message_reactions WHERE messageId = ?").all(m.id)
        }));
    } catch (error) {
        console.error("❌ Error fetching room messages:", error);
        throw error;
    }
}
