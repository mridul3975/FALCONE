type SidebarProps = {
    onSelect: (id: string, type: "direct" | "room") => void;
};

export default function Sidebar({ onSelect }: SidebarProps) {
    return (
        <div className="w-1/4 border-r border-zinc-800 p-4">
            {/* Example for a user contact */}
            <div
                className="cursor-pointer hover:bg-zinc-800 p-2"
                onClick={() => onSelect("USER_ID_123", "direct")}
            >
                Alex Rivera
            </div>

            {/* Example for a room */}
            <div
                className="cursor-pointer hover:bg-zinc-800 p-2"
                onClick={() => onSelect("ROOM_ID_ABC", "room")}
            >
                Project Room
            </div>
        </div>
    );
}