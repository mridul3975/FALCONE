# 🎨 **Frontend Project Requirement Document (PRD)**
### Project Title: **ChatrIX Frontend (React + Tailwind)**  
A real‑time chat UI for the Bun/Better‑Auth/SQLite backend using Bun’s native WebSockets.

---

## 1. **Project Overview**

The ChatrIX frontend delivers a **real‑time chat interface** built with **React** and styled using **Tailwind CSS**.  
It connects to a Bun backend with **Better Auth** and **Bun WebSockets**, providing intuitive authentication, private/group messaging, message history, and live updates.

The design goal:  
> **Clean, fast, scalable, developer‑pleasant.**

---

## 2. **Objectives**

- Build a minimal, modular React app communicating with the Bun backend using REST + native WebSocket.  
- Use Better Auth’s endpoints for signup/login handling.  
- Style interface elegantly with Tailwind.  
- Implement robust real‑time message UX: live sending, status updates, and auto‑reconnect.

---

## 3. **Functional Requirements**

### 3.1 **Authentication**
- Use Better Auth backend endpoints for:
  - `POST /auth/signup` → Create user  
  - `POST /auth/login` → Authenticate  
  - `GET /auth/session` → Validate token  
- Store JWT/session token in `localStorage` (or `cookie` per Better Auth config).
- Redirect unauthenticated users to `/login`.

### 3.2 **Dashboard UI**
- Sidebar: list of users and rooms.  
- Top bar: username and online status indicator.  
- Main view: chat window + message history.  
- Input bar: form for message input and send button.  

### 3.3 **Chat Features**
| Feature | Description |
|----------|--------------|
| Send private messages | Send to one user; instantly shown; backend ACK marks as delivered |
| Group rooms | Join rooms, send group messages |
| Message persistence | Fetch via REST from SQLite database |
| Real‑time updates | Receive `chat_message` and `room_message` through Bun WebSocket |
| Reconnect | Retry every 3–5 seconds on connection loss |
| Message history | Fetched on chat open |

### 3.4 **UI Feedback**
- Sent → "✓"  
- Delivered → "✓✓"  
- Pending/offline → “...”  
- Connection banner: “Online ✅”, “Reconnecting... 🔄”, “Offline ❌”.

---

## 4. **Non‑Functional Requirements**

| Category | Specification |
|-----------|----------------|
| **Framework** | React 18+ (with Vite or Bun bundler) |
| **Styling** | Tailwind CSS 3+ |
| **Performance** | Initial load under 2 s on localhost |
| **Security** | Use HTTPS in production; validate JWT before WebSocket connect |
| **Code Quality** | Functional components, hooks, PropTypes/TypeScript checks |
| **Resilience** | Graceful reconnects + error toasts |
| **Aesthetics** | Minimalist; 3–4 color theme; responsive grid/flex layout |

---

## 5. **User Flow (Step‑by‑Step)**

### 🪪 Step 1 – Landing / Auth Pages
- **/signup**: Sign‑up form (username, email, password). Calls Better Auth `POST /auth/signup`.
- **/login**: Login form; on success → Save JWT/session and redirect to `/dashboard`.

### ⚡ Step 2 – Establish WebSocket
- In `App.tsx`, create a hook `useChatSocket(jwt)` that:
  - Connects: `new WebSocket(ws://localhost:3000?token=<jwt>)`
  - Listens to messages.
  - Reconnects automatically on drop.
- Show status badge in header.

### 💬 Step 3 – Chat Dashboard
- Sidebar: list of users/rooms (fetched via REST from `/rooms` and `/users`).
- On selection:  
  - Load old messages (`GET /messages/:id`).
  - Render them in `ChatWindow`.

### ✉️ Step 4 – Send Message
- Typing message → press **Enter** → push local “sending” message → emit WebSocket message:
  ```ts
  ws.send(JSON.stringify({
    type: "chat_message",
    data: { to: activeUserId, text: message }
  }));
  ```
- On backend `ack`, status updates to “delivered”.

### 📡 Step 5 – Receive Message
- Listen for:
  - `"incoming_message"` for private chats
  - `"room_broadcast"` for room chats
- Update React state → render new message bottom of list → scroll.

### ♻️ Step 6 – Reconnect & Resume
- On disconnect: transient overlay: “Connection lost, retrying…”.
- Auto-reconnect until success → flush pending messages.

### 🚪 Step 7 – Logout
- Clear `localStorage` token; close socket; redirect to login.

---

## 6. **Frontend Architecture**

```
src/
 ├── api/
 │    ├── auth.ts          // signup/login requests
 │    ├── chat.ts          // message fetch
 ├── hooks/
 │    ├── useChatSocket.ts // socket manager hook (connect, reconnect, send)
 │    └── useAuth.ts       // token/session logic
 ├── components/
 │    ├── Auth/
 │    │   ├── LoginForm.tsx
 │    │   └── SignupForm.tsx
 │    ├── Chat/
 │    │   ├── ChatWindow.tsx
 │    │   ├── ChatHeader.tsx
 │    │   ├── MessageInput.tsx
 │    │   └── Sidebar.tsx
 │    └── Shared/
 │        ├── Button.tsx
 │        ├── Loader.tsx
 │        └── StatusBar.tsx
 ├── pages/
 │    ├── LoginPage.tsx
 │    ├── SignupPage.tsx
 │    └── DashboardPage.tsx
 ├── utils/
 │    ├── request.ts       // fetch helper (adds auth header)
 │    └── storage.ts       // JWT/localStorage
 ├── App.tsx
 ├── main.tsx
 └── index.css
```

---

## 7. **Design System / Tailwind Layout**

### Colors  
- Primary: `indigo‑500`  
- Accent: `emerald‑400`  
- Background: `zinc‑900`  
- Text: `zinc‑100`

### Layout  
- Flex container: `flex h-screen`
- Sidebar: `w-1/4 bg-zinc-800 p-4`  
- Chat panel: `flex-grow bg-zinc-900 flex flex-col`  
- Message bubble: rounded, `bg-indigo-600 text-white px-3 py-1 max-w-sm`

### Responsive
- Collapsible sidebar < 768 px.
- Sticky input bar bottom.

---

## 8. **Component Responsibilities**

| Component | Role |
|------------|------|
| **LoginForm / SignupForm** | Handle auth via Better Auth endpoints |
| **Sidebar** | Display users/rooms, handle selection |
| **ChatWindow** | Render message history & stream |
| **MessageInput** | Manage local message state and sending |
| **StatusBar** | Connection + user status |
| **useChatSocket** | Manage WebSocket lifecycle, send/receive events |
| **useAuth** | Persist JWT, auto‑fetch user profile |

---

## 9. **API & WebSocket Coordination**

| Operation | REST API | WebSocket Event |
|------------|-----------|-----------------|
| Fetch messages | `GET /messages/:id` | N/A |
| Send private message | N/A | `chat_message` |
| Receive message | N/A | `incoming_message` |
| Send group message | N/A | `room_message` |
| Receive group message | N/A | `room_broadcast` |
| Acknowledgment | N/A | `ack` |

---

## 10. **Development Phases**

| Phase | Deliverable | Description |
|--------|--------------|-------------|
| 1 | Project setup | Vite + React + Tailwind + routing |
| 2 | Auth pages | Integrate Better Auth’s REST endpoints |
| 3 | Socket hook | Core WebSocket logic (connect/reconnect/send) |
| 4 | Private chat | Real-time 1‑to‑1 messages |
| 5 | Group chat | Room-based messaging |
| 6 | Styling | Tailwind UI pass, responsive polish |
| 7 | QA | Cross-tab test, refresh persistence |
| 8 | Docs | Component & event schema documentation |

---

## 11. **Testing Plan**

- **Functional Tests**
  - Register/login → token stored.  
  - Valid JWT → socket authenticates.  
  - Message send/receive sync tested with multiple tabs.  
- **UX Tests**
  - Connection indicator behavior under network off/on.  
  - Scroll behavior auto‑scroll to latest message.  
  - Light/dark uniform Tailwind styling.  
- **Performance**
  - Ensure minimal re‑renders (React.memo where needed).  
  - Socket responds < 50 ms under local host test.

---

## 12. **Tech Stack Summary**

| Layer | Tool |
|-------|------|
| Framework | **React 18 (Vite or Bun bundler)** |
| Styling | **Tailwind CSS** |
| Auth | **Better Auth endpoints** |
| Real‑time | **Native WebSocket client (Browser)** |
| State | **React hooks + useReducer/useContext** |
| Storage | **localStorage** (JWT/session) |
| Testing | **Vitest + React Testing Library** (optional) |

---

## 13. **Deliverables**

1. Fully functional React app communicating with Bun backend.  
2. Auth flow (login/signup/logout) via Better Auth.  
3. Real‑time chat UI (private + group).  
4. Tailwind responsive interface with status display.  
5. Reconnect logic + message persistence from SQLite.  
6. Documentation:  
   - Setup guide  
   - Component map  
   - WS event schema

---

## 14. **Expected Outcome**

- Frontend and backend seamlessly synchronized in real‑time.  
- Stunningly responsive UI using Tailwind.  
- You’ll master React’s custom hook ecosystem through a live WebSocket use‑case.  
- Professional codebase ready for deployment on Bun’s web server or any static host.

---

This PRD aligns 1:1 with your **Better Auth + Bun SQLite + Bun WebSockets** backend — modern, efficient, and technically elegant.  
When you’re done, you’ll have *a production‑ready real‑time stack built almost entirely native to Bun.*