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
### 3.3.1 **AI Chatbot Integration** ⭐ NEW
The ChatrIX app integrates an intelligent AI assistant (Gemini, GPT, or Claude) that users can:

| Feature | Description |
|----------|--------------|
| **Tag AI in private chat** | Use `@AI` or `@Chatrix-Bot` syntax in 1-to-1 chats to request answers |
| **Tag AI in group chat** | Use `@AI` in rooms to ask questions; AI responds in the thread |
| **Direct AI chat** | Start a dedicated "AI Assistant" chat for private conversations without tagging |
| **Contextual responses** | AI reads recent conversation context (last 5–10 messages) for relevant answers |
| **Thinking indicator** | Show typing bubble "AI is thinking..." while processing |
| **Response format** | AI responses marked with special badge (🤖 AI Response) and distinct styling |
| **Message citations** | Optional: AI can cite relevant prior messages or user context |
| **Rate limiting** | Max 50 requests/day per user to prevent abuse |
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

## 4.1 **AI Chatbot Non‑Functional Requirements**

| Category | Specification |
|-----------|----------------|
| **AI Provider** | Gemini API, OpenAI GPT-4, or Claude (configurable via env) |
| **Response latency** | < 5 seconds (including API call + processing) |
| **Token limit** | 50 requests/day per user (configurable) |
| **Context window** | Last 5–10 messages from active chat as context |
| **Error handling** | Graceful fallback messages if API fails; no crashes |
| **Privacy** | Do NOT send user IDs or sensitive metadata to AI provider; sanitize context |
| **Rate limiting** | Server-side enforcement; show "limit reached" message when exceeded |
| **Caching** | Optional: Cache identical prompts within 1 hour to reduce API calls |

---

## 4.2 **AI Chatbot Architecture**

### Backend Changes
```
src/
 ├── ai/
 │    ├── ai.service.ts        # AI provider integration (Gemini/GPT/Claude)
 │    ├── ai.controller.ts     # Routes for AI tagging + direct chat
 │    ├── ai.cache.ts          # Simple request deduplication
 │    └── ai.types.ts          # TypeScript interfaces
 ├── chat/
 │    ├── messages.repo.ts     # Add AI message storage + tagging
 │    └── rooms.repo.ts        # Mark AI responses in room context
 └── db/
      └── models.ts            # Add ai_requests table for rate limiting
```

### Frontend Changes
```
src/
 ├── components/
 │    ├── Chat/
 │    │   └── AIResponseBubble.tsx   # Styled AI message display
 │    ├── Shared/
 │    │   └── AIIndicator.tsx        # "AI is thinking..." animation
 ├── hooks/
 │    └── useAIChat.ts              # Send tagged messages to AI endpoint
 └── utils/
      └── aiPromptBuilder.ts         # Extract context + build prompts
```

### New REST Endpoints
```
POST /api/ai/ask
  Body: { message: string, chatId: string, type: "direct"|"room", context?: string[] }
  Response: { id: string, text: string, sourceMessageIds?: string[] }

GET /api/ai/quota
  Response: { used: number, remaining: number, resetAt: string }

POST /api/ai/chat (Direct AI chat)
  Body: { message: string, conversationId: string }
  Response: { id: string, text: string }
```

### Message Schema Extension
```ts
// Add to MessageItem
interface MessageItem {
  // ... existing fields
  isAIResponse?: boolean;           // Mark AI-generated message
  isAITagged?: boolean;             // Message mentioned @AI
  aiSourceMessageIds?: string[];    // Messages AI used for context
  aiProvider?: "gemini" | "gpt-4" | "claude";
}
```

---

## 4.3 **AI Chatbot User Experience**

### Direct Tagging in Chat
```
User: @AI What's the best way to optimize React performance?
[AI is thinking... 🤖]
AI Response: "React performance can be optimized by...
  • Using React.memo for component memoization
  • useCallback to prevent unnecessary re-renders
  • Code splitting with React.lazy()
  ...more context from your recent messages..."
```

### Group Room AI Question
```
User (in #engineering): @AI summarize the last 5 messages
[AI is thinking...]
AI Response: [appears in thread with 🤖 badge]
  "Based on your conversation:
  - John proposed using TypeScript
  - Sarah suggested Tailwind for styling
  - Summary: The team decided on React + TypeScript + Tailwind..."
```

### Direct AI Chat (Dedicated)
```
Sidebar shows "🤖 AI Assistant" as special contact
Click → Opens direct chat with AI (no tagging needed)
User: "How do I implement WebSocket in Bun?"
[AI is thinking...]
AI Response: Full explanation with code examples
```

---

## 4.4 **Implementation Steps**

| Phase | Task | Est. Time |
|-------|------|-----------|
| **Phase 1** | Integrate AI provider API (Gemini/OpenAI) | 2 hrs |
| **Phase 2** | Add rate limiting + quota tracking | 1 hr |
| **Phase 3** | Create `/api/ai/ask` endpoint | 1.5 hrs |
| **Phase 4** | Build frontend hook `useAIChat` | 1 hr |
| **Phase 5** | Style AI responses + typing indicator | 1.5 hrs |
| **Phase 6** | Add direct AI chat section to sidebar | 1 hr |
| **Phase 7** | Test tagging in private & group chats | 1 hr |

**Total: ~9 hours** (can run in parallel with existing features)

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

## 9. **Development Phases**

| Phase | Deliverable | Description |
|--------|--------------|-------------|
| 1 | Project setup | Vite + React + Tailwind + routing |
| 2 | Auth pages | Integrate Better Auth's REST endpoints |
| 3 | Socket hook | Core WebSocket logic (connect/reconnect/send) |
| 4 | Private chat | Real-time 1‑to‑1 messages |
| 5 | Group chat | Room-based messaging |
| 6 | Styling | Tailwind UI pass, responsive polish |
| 7 | AI Chatbot | Gemini/GPT integration + tagging + rate limiting |
| 8 | QA | Cross-tab test, refresh persistence, AI functionality |
| 9 | Docs | Component & event schema documentation |

---

## 10. **Testing Plan**

- **Functional Tests**
  - Register/login → token stored.  
  - Valid JWT → socket authenticates.  
  - Message send/receive sync tested with multiple tabs.
  - **AI Chatbot Tests**:
    - Tag AI in private chat (`@AI What is...?`) → receives response.
    - Tag AI in room chat → AI responds in thread.
    - Direct AI chat → messages sent/received without tagging.
    - Rate limit enforcement (50/day cap).
    - Quota endpoint returns correct remaining count.
- **UX Tests**
  - Connection indicator behavior under network off/on.  
  - Scroll behavior auto‑scroll to latest message.  
  - Light/dark uniform Tailwind styling.
  - **AI Response styling**: AI messages visually distinct (badge + color).
  - Typing indicator shows during AI processing.
- **Performance**
  - Ensure minimal re‑renders (React.memo where needed).  
  - Socket responds < 50 ms under local host test.
  - **AI response latency**: < 5 seconds end-to-end.

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