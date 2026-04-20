function AvatarIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-7 w-7" aria-hidden="true">
            <rect x="1" y="1" width="22" height="22" fill="#0f172a" stroke="#000" strokeWidth="2" />
            <circle cx="12" cy="9" r="3" fill="#f2c38b" />
            <path d="M6 19c1.4-3.3 3.6-5 6-5s4.6 1.7 6 5" fill="#5b7ea8" />
        </svg>
    );
}

function BubbleIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <ellipse cx="11" cy="12" rx="8" ry="5.5" fill="#ded5f8" />
            <path d="M17 15.6l2.8 2-0.7-2.5" fill="#ded5f8" />
        </svg>
    );
}

function SearchIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <circle cx="11" cy="11" r="6" fill="none" stroke="#000" strokeWidth="2.5" />
            <line x1="16" y1="16" x2="22" y2="22" stroke="#000" strokeWidth="2.5" />
        </svg>
    );
}

function ThreadIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-12 w-12" aria-hidden="true">
            <rect x="3" y="4" width="12" height="9" rx="1" fill="#000" />
            <polygon points="8,13 8,18 13,13" fill="#000" />
            <rect x="14" y="8" width="7" height="11" rx="1" fill="#0d5a87" />
        </svg>
    );
}

function PersonTabIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <circle cx="12" cy="8" r="3.2" fill="#000" />
            <rect x="6.5" y="13" width="11" height="6" rx="3" fill="#000" />
        </svg>
    );
}

function RoomsTabIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <circle cx="7" cy="9" r="2" fill="#000" />
            <circle cx="17" cy="9" r="2" fill="#000" />
            <circle cx="12" cy="7" r="2" fill="#000" />
            <path d="M4 17c0-2 1.8-3.5 4-3.5" stroke="#000" strokeWidth="2" fill="none" />
            <path d="M20 17c0-2-1.8-3.5-4-3.5" stroke="#000" strokeWidth="2" fill="none" />
            <path d="M7.5 18c0-2.5 2-4.5 4.5-4.5S16.5 15.5 16.5 18" stroke="#000" strokeWidth="2" fill="none" />
        </svg>
    );
}

function SettingsTabIcon() {
    return (
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden="true">
            <circle cx="12" cy="12" r="3.2" fill="none" stroke="#000" strokeWidth="2" />
            <path
                d="M12 3.5v2.4M12 18.1v2.4M3.5 12h2.4M18.1 12h2.4M6.2 6.2l1.7 1.7M16.1 16.1l1.7 1.7M17.8 6.2l-1.7 1.7M7.9 16.1l-1.7 1.7"
                stroke="#000"
                strokeWidth="2"
            />
        </svg>
    );
}

export default function DashboardPage() {
    const contacts = [
        { name: "Alex Rivera", note: "See you there!" },
        { name: "Sarah Chen", note: "The project is ready..." },
        { name: "Marcus Volt", note: "Sent a file." },
    ];

    return (
        <main className="min-h-screen bg-[#d9d9d9] font-['Courier_New',monospace] text-black">
            <div className="mx-auto hidden min-h-screen w-full max-w-305 overflow-hidden border-2 border-[#5f5cf0] bg-[#d9d9d9] lg:block">
                <header className="flex items-center justify-between border-b-[3px] border-black px-5 py-3">
                    <div className="flex items-center gap-3">
                        <AvatarIcon />
                        <div className="flex items-center gap-2">
                            <span className="text-4xl font-black uppercase tracking-tight">CHATRIX</span>
                            <BubbleIcon />
                        </div>
                    </div>
                    <button
                        type="button"
                        className="grid h-12 w-12 place-items-center border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000]"
                        aria-label="Search"
                    >
                        <SearchIcon />
                    </button>
                </header>

                <div className="grid min-h-175 grid-cols-[270px_1fr]">
                    <aside className="border-r-[3px] border-black px-4 py-4">
                        <div className="mb-6 border-b-2 border-black pb-3">
                            <p className="text-[34px] font-black leading-none">ChatrIX</p>
                            <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.2em]">Connected • Online</p>
                        </div>

                        <div className="space-y-3">
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 border-[3px] border-black bg-black px-3 py-3 text-[22px] font-black uppercase text-white"
                            >
                                <PersonTabIcon />
                                <span>Direct</span>
                            </button>
                            <button
                                type="button"
                                className="flex w-full items-center gap-3 border-2 border-black bg-transparent px-3 py-3 text-[22px] font-black uppercase"
                            >
                                <RoomsTabIcon />
                                <span>Rooms</span>
                            </button>
                        </div>

                        <div className="mt-6 border-t-2 border-black pt-4">
                            <p className="text-[15px] font-black uppercase tracking-[0.14em]">Recent Contacts</p>
                            <ul className="mt-4 space-y-5">
                                {contacts.map((contact) => (
                                    <li key={contact.name} className="flex items-center gap-3">
                                        <div className="h-11 w-11 border-2 border-black bg-[#1f2a3f] p-0.5">
                                            <AvatarIcon />
                                        </div>
                                        <div>
                                            <p className="text-[18px] font-black uppercase leading-tight">{contact.name}</p>
                                            <p className="text-[15px] font-bold leading-tight">{contact.note}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </aside>

                    <section className="px-8 py-6">
                        <div className="border-l-[6px] border-black pl-4">
                            <h1 className="text-[72px] font-black uppercase leading-none">Chats</h1>
                            <p className="mt-3 text-[26px] font-bold uppercase tracking-tight">Select a conversation to start messaging.</p>
                        </div>

                        <div className="mx-auto mt-8 max-w-195 border-4 border-black bg-[#dcdcdc] px-8 pb-10 pt-12 shadow-[7px_7px_0_0_#000]">
                            <div className="mx-auto mb-7 grid h-24 w-24 place-items-center border-4 border-black bg-white shadow-[4px_4px_0_0_#000]">
                                <ThreadIcon />
                            </div>

                            <h2 className="text-center text-[55px] font-black uppercase leading-none">No Active Thread</h2>

                            <p className="mx-auto mt-5 max-w-130 text-center text-[34px] font-bold uppercase leading-[1.2]">
                                Your workspace is quiet. Dive back into your recent conversations or start a new connection.
                            </p>

                            <button
                                type="button"
                                className="mx-auto mt-8 block border-4 border-black bg-black px-14 py-3.5 text-[44px] font-black uppercase text-white shadow-[4px_4px_0_0_#000]"
                            >
                                Start a Discussion
                            </button>
                        </div>

                        <div className="mt-8 flex items-center justify-between border-t-2 border-black pt-4">
                            <div className="flex items-center gap-3 text-[13px] font-black uppercase">
                                <span className="border-[3px] border-black bg-black px-2 py-1 text-white">Connected ✓</span>
                                <span className="border-2 border-black bg-white px-2 py-1">V 1.0.42-Stable</span>
                            </div>
                            <div className="flex items-center gap-4">
                                <button type="button" className="text-[13px] font-black uppercase underline">
                                    Privacy
                                </button>
                                <button
                                    type="button"
                                    className="grid h-14 w-14 place-items-center border-4 border-black bg-black text-[52px] font-black leading-none text-white shadow-[4px_4px_0_0_#000]"
                                >
                                    +
                                </button>
                            </div>
                        </div>
                    </section>
                </div>
            </div>

            <div className="mx-auto min-h-screen w-full max-w-97.5 border-x-[3px] border-black bg-[#d9d9d9] lg:hidden">
                <header className="flex items-center justify-between border-b-4 border-black px-4 py-3">
                    <div className="flex items-center gap-3">
                        <AvatarIcon />
                        <span className="flex items-center gap-2 text-[40px] leading-none">
                            <span className="text-[15px] font-bold tracking-tight">CHATRIX</span>
                            <BubbleIcon />
                        </span>
                    </div>

                    <button
                        type="button"
                        className="grid h-12 w-12 place-items-center border-[3px] border-black bg-white shadow-[4px_4px_0_0_#000]"
                        aria-label="Search"
                    >
                        <SearchIcon />
                    </button>
                </header>

                <section className="px-6 pb-6 pt-7">
                    <div className="border-l-8 border-black pl-4">
                        <h1 className="text-[62px] font-black uppercase leading-[0.92]">Chats</h1>
                        <p className="mt-3 max-w-70 text-[31px] font-bold uppercase leading-[1.18] tracking-tight">
                            Select a conversation to start messaging.
                        </p>
                    </div>

                    <div className="mt-8 border-4 border-black bg-[#dedede] p-4 shadow-[4px_4px_0_0_#000]">
                        <div className="mx-auto mb-7 grid h-24 w-24 place-items-center border-4 border-black bg-white shadow-[4px_4px_0_0_#000]">
                            <ThreadIcon />
                        </div>

                        <h2 className="text-center text-[52px] font-black uppercase leading-[0.94]">No Active Thread</h2>

                        <p className="mx-auto mt-5 max-w-70 text-center text-[34px] font-bold uppercase leading-[1.2] tracking-tight">
                            Your workspace is quiet. Dive back into your recent conversations or start a new connection.
                        </p>

                        <button
                            type="button"
                            className="mx-auto mt-8 block w-[82%] border-4 border-black bg-black py-4 text-[43px] font-black uppercase leading-tight text-white shadow-[4px_4px_0_0_#000]"
                        >
                            Start a Discussion
                        </button>
                    </div>
                </section>

                <nav className="grid grid-cols-3 border-t-4 border-black bg-[#d9d9d9] px-4 py-3">
                    <button
                        type="button"
                        className="mx-auto flex w-16 flex-col items-center gap-1 border-[3px] border-black bg-[#cfcfcf] px-2 py-1.5"
                    >
                        <PersonTabIcon />
                        <span className="text-[13px] font-bold">Direct</span>
                    </button>
                    <button type="button" className="mx-auto flex w-16 flex-col items-center gap-1 px-2 py-1.5">
                        <RoomsTabIcon />
                        <span className="text-[13px] font-bold">Rooms</span>
                    </button>
                    <button type="button" className="mx-auto flex w-16 flex-col items-center gap-1 px-2 py-1.5">
                        <SettingsTabIcon />
                        <span className="text-[13px] font-bold">Settings</span>
                    </button>
                </nav>
            </div>
        </main>
    );
}
