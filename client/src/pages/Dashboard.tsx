import { useState, useEffect } from "react";

interface ActiveUser {
    id: string | null;
    type: "direct" | "room" | null;

}

interface UserItem {
    id: string;
    name?: string | null;
    email?: string | null;
}

interface RoomItem {
    id: string;
    name: string;
}

interface DashboardData {
    users: UserItem[];
    rooms: RoomItem[];
}

const DashboardPage = () => {
    //State Management
    const [activeChat, setActiveChat] = useState<ActiveUser>({ id: null, type: null });
    const [data, setData] = useState<DashboardData>({ users: [], rooms: [] });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [usersRes, roomsRes] = await Promise.all([
                    fetch("http://localhost:3000/api/users", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
                    fetch("http://localhost:3000/api/rooms", { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }),
                ]);
                if (!usersRes.ok || !roomsRes.ok) {
                    throw new Error("Failed to fetch data");
                }
                const users = (await usersRes.json()) as UserItem[];
                const rooms = (await roomsRes.json()) as RoomItem[];
                setData({ users, rooms });
                setIsLoading(false);
            }
            catch (err) {
                setError("Failed to load data");
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);
    return (
        <div className="flex h-screen w-full bg-gray-100">
            <aside className="w-64 border-r bg-white flex flex-col">
                <div className="p-4 border-b font-bold">Live Context</div>

                <div className="flex-1 overflow-y-auto p-4">
                    {isLoading && <p className="text-sm text-gray-400">Loading connections...</p>}
                    {error && <p className="text-sm text-red-500">Error: {error}</p>}

                    {/* Direct Section */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 mb-2">DIRECT</h3>
                        {data.users.map(u => (
                            <div
                                key={u.id}
                                onClick={() => setActiveChat({ id: u.id, type: 'direct' })}
                                className="cursor-pointer p-2 hover:bg-blue-50 rounded"
                            >
                                {u.name || u.email}
                            </div>
                        ))}
                    </div>

                    {/* Rooms Section */}
                    <div>
                        <h3 className="text-xs font-bold text-gray-400 mb-2">ROOMS</h3>
                        {data.rooms.map(r => (
                            <div
                                key={r.id}
                                onClick={() => setActiveChat({ id: r.id, type: 'room' })}
                                className="cursor-pointer p-2 hover:bg-green-50 rounded"
                            >
                                # {r.name}
                            </div>
                        ))}
                    </div>
                </div>
            </aside>

            <main className="flex-1 bg-white flex items-center justify-center">
                {activeChat.id ? (
                    <div className="text-center">
                        <h2 className="text-xl font-bold">Target: {activeChat.id}</h2>
                        <p className="text-green-500 italic">State is active. Ready for transport layer.</p>
                    </div>
                ) : (
                    <p className="text-gray-400">Select a real entity to verify state injection.</p>
                )}
            </main>
        </div>
    );
};

export default DashboardPage;
