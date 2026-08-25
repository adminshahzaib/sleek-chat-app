# Architecture & Data Flow Guide — SleekChat Workspace

Welcome to **SleekChat**! This documentation is designed to guide a beginner web developer through the full-stack MERN (MongoDB, Express, React, Node.js) codebase, explaining how directories are organized, what each file does, and how data flows through the application in real-time.

---

## 1. What is the MERN Stack?
Before diving in, here is how the four technologies connect:
*   **M (MongoDB)**: The database where your data (users, messages, channels) is stored.
*   **E (Express.js)**: The backend web application framework that manages HTTP routes/APIs.
*   **R (React)**: The frontend user interface library running in the user's browser.
*   **N (Node.js)**: The server environment running Javascript on your computer or host server.

---

## 2. Directory Structure & Architecture

Here is a map of the repository, highlighting the role and purpose of each directory and file:

### Backend Structure (`/server`)

The backend manages the database, authenticates tokens, and coordinates Socket.io events.

```
server/
├── config/                 # Configurations
│   ├── db.js               # Connects to MongoDB Atlas
│   └── firebaseAdmin.js    # Initializes Firebase Admin SDK for backend verification
├── middleware/             # Route interceptors
│   └── auth.js             # Verifies client Firebase tokens for API routes
├── models/                 # Database Schemas (Mongoose models)
│   ├── User.js             # User profiles, online status, contacts list
│   ├── Room.js             # Channels/DMs, members list, join requests
│   └── Message.js          # Messages, reactions list, reply reference
├── routes/                 # REST HTTP Endpoints
│   ├── authRoutes.js       # Syncs users, manages contacts profile settings
│   └── roomRoutes.js       # Handles listing, creating, joining channels
├── socket/                 # Real-time WebSocket handlers
│   ├── socketAuth.js       # Authenticates socket connections on handshake
│   └── socketHandler.js    # Listens & broadcasts messages, reactions, typing state
├── server.js               # Entry point of the Node/Express server
└── serviceAccountKey.json  # Firebase Admin Private Key credentials (IGNORED BY GIT)
```

#### Detailed Backend Files Explanation

*   **`server.js`**
    *   *Purpose*: The core of the server. It imports Express, connects to MongoDB, configures CORS (Cross-Origin Resource Sharing) middleware, registers REST routes, and bootstraps the Socket.io WebSocket server.
    *   *Exports*: None (runs automatically).
*   **`config/db.js`**
    *   *Imports*: `mongoose`
    *   *Purpose*: Connects the backend server to MongoDB (local or Atlas) using Mongoose.
    *   *Exports*: `connectDB()` function.
*   **`config/firebaseAdmin.js`**
    *   *Imports*: `firebase-admin`
    *   *Purpose*: Initializes the Firebase Admin SDK using `serviceAccountKey.json` or environment variables, allowing the backend to decrypt and verify the ID tokens sent by the client.
    *   *Exports*: The initialized `admin` instance.
*   **`middleware/auth.js`**
    *   *Imports*: `firebaseAdmin.js`, `models/User.js`
    *   *Purpose*: Intercepts incoming HTTP requests. It reads the `Authorization: Bearer <token>` header, verifies it with Firebase, extracts the user details, looks them up in MongoDB, and attaches them to `req.user` for subsequent route handlers.
    *   *Exports*: `protect` middleware function.
*   **`models/User.js`, `Room.js`, `Message.js`**
    *   *Imports*: `mongoose`
    *   *Purpose*: Define the blueprint ("schemas") of the documents stored in MongoDB.
    *   *Exports*: The Mongoose models used to execute database operations (`User`, `Room`, `Message`).
*   **`routes/authRoutes.js`**
    *   *Imports*: `auth.js` (protect middleware), `models/User.js`
    *   *Purpose*: Handles user profile queries, contacts management (add/remove contact), and updates `@username`s.
    *   *Exports*: Express `router`.
*   **`routes/roomRoutes.js`**
    *   *Imports*: `auth.js` (protect middleware), `models/Room.js`, `models/Message.js`
    *   *Purpose*: Handles room listing, channel creation, message history loading, and join request submissions.
    *   *Exports*: Express `router`.
*   **`socket/socketAuth.js`**
    *   *Imports*: `firebaseAdmin.js`, `models/User.js`
    *   *Purpose*: Similar to the HTTP middleware, it intercepts the initial Socket.io connection handshake, verifies the token, and attaches the MongoDB user profile directly to the socket object (`socket.user`).
    *   *Exports*: `socketAuth` middleware.
*   **`socket/socketHandler.js`**
    *   *Imports*: `models/User.js`, `models/Room.js`, `models/Message.js`
    *   *Purpose*: Registers WebSocket event listeners on client connections (e.g. `'join_room'`, `'send_message'`, `'typing'`, `'react_message'`). It writes data to MongoDB and broadcasts events to other clients in real-time.
    *   *Exports*: `registerSocketHandlers` function.

---

### Frontend Structure (`/client`)

The frontend is a React application built with Vite and Tailwind CSS. It communicates with the backend via REST API calls and real-time WebSockets.

```
client/
├── public/                 # Static assets (favicons, etc.)
├── src/
│   ├── components/         # Reusable UI components
│   │   ├── Auth/           # Authentication pages (Login, Register)
│   │   ├── Sidebar/        # Navigation sidebar components (channels, contacts)
│   │   └── Chat/           # Active chat workspace (message list, header, inputs)
│   ├── config/
│   │   └── firebase.js     # Configures and boots Client-side Firebase SDK
│   ├── context/            # React Context Providers (Global State)
│   │   ├── AuthContext.jsx # Google login state, token, user profile caching
│   │   └── SocketContext.jsx# Initialized Socket.io client instance
│   ├── App.jsx             # Governing root component (layout, responsive toggle)
│   ├── main.jsx            # Entry point; renders React tree into DOM
│   └── index.css           # Global CSS, glassmorphism tokens, wallpaper animation
├── vercel.json             # Vercel deployment routes and backend proxy redirects
└── vite.config.js          # Local Vite dev server port and proxy settings
```

#### Detailed Frontend Files Explanation

*   **`main.jsx`**
    *   *Purpose*: Bootstraps React. Wraps the app in `<AuthProvider>` and `<SocketProvider>` so all components can access user sessions and socket events.
*   **`App.jsx`**
    *   *Imports*: `context/AuthContext.jsx`, `context/SocketContext.jsx`, sidebar & chat components.
    *   *Purpose*: Manages global layout states (active room selection, unread counts). Implements mobile responsiveness: toggles visibility of the Sidebar and ChatWindow depending on screen width and active room.
*   **`config/firebase.js`**
    *   *Imports*: Firebase Client SDK.
    *   *Purpose*: Boots the Client-side Firebase SDK with your API keys to support login flows.
    *   *Exports*: `auth` and `googleProvider`.
*   **`context/AuthContext.jsx`**
    *   *Imports*: `config/firebase.js`.
    *   *Purpose*: Tracks user login status. Exposes login, registration, Google popup triggers, the current user token (`idToken`), and MongoDB profile metadata to the entire frontend.
    *   *Exports*: `useAuth()` custom hook.
*   **`context/SocketContext.jsx`**
    *   *Imports*: `useAuth()`, `socket.io-client`.
    *   *Purpose*: Maintains a single, global Socket.io client connection instance. It automatically establishes connection when a user logs in and disconnects when they log out.
    *   *Exports*: `useSocket()` custom hook.
*   **`components/Chat/ChatWindow.jsx`**
    *   *Purpose*: Coordinates the active room workspace. Fetches message history via REST, manages typing states, and passes actions (edit, delete, reply, react) to child components.
*   **`components/Chat/RoomHeader.jsx`**
    *   *Purpose*: Shows the channel name and the "Members" button. Houses the slide-out sidebar drawer listing channel members, invite codes, kicks, and join request approvals.
*   **`components/Chat/MessageList.jsx`**
    *   *Purpose*: Renders the chat message bubbles. Alternates message styling (sent vs received), renders quoted replies, reaction counters, and implements the tap-friendly action menu.
*   **`components/Chat/MessageInput.jsx`**
    *   *Purpose*: Manages message text inputs, emoji selection popups, quoted reply previews, and emits live typing triggers.

---

## 3. How Data Flows (Data Flow Diagram)

Data in SleekChat moves in two main ways:
1.  **HTTP Requests (REST API)**: Used for one-time operations (signing in, listing rooms, adding contacts, fetching message history).
2.  **WebSockets (Socket.io)**: Used for real-time, low-latency updates (receiving messages, typing indicator waves, updating emoji reaction counts instantly).

### Architecture & Connection Flowchart

Here is how the components talk to each other:

```mermaid
graph TD
    %% Frontend Components
    subgraph Frontend (Vercel)
        A[main.jsx] --> B[AuthContext]
        B --> C[SocketContext]
        C --> D[App.jsx]
        D --> E[Sidebar.jsx]
        D --> F[ChatWindow.jsx]
        F --> G[RoomHeader.jsx]
        F --> H[MessageList.jsx]
        F --> I[MessageInput.jsx]
    end

    %% Backend Servers
    subgraph Backend (Render)
        J[server.js] --> K[Express Router]
        J --> L[Socket.io Server]
        K --> M[authRoutes.js]
        K --> N[roomRoutes.js]
        L --> O[socketHandler.js]
    end

    %% Database & Firebase
    P[(MongoDB Atlas)] <--> K
    P <--> O
    Q[Firebase Auth] <--> B
    Q <--> J

    %% Data Flow Connections
    E -- REST: Create Room / Add Contacts --> K
    F -- REST: Fetch Message History --> N
    I -- Socket: Send Message / Typing --> L
    O -- Socket Broadcast: Live Updates --> H
```

---

## 4. Key Real-Time Scenarios

### Scenario A: Sending a Message
1.  A user types a message in `MessageInput.jsx` and hits Send.
2.  `MessageInput.jsx` calls `onSendMessage` callback passed by `ChatWindow.jsx`.
3.  `ChatWindow.jsx` emits a socket event: `socket.emit('send_message', { roomId, content })`.
4.  The Render server (`socketHandler.js`) receives `'send_message'`.
5.  The server verifies that the user is a member of that room.
6.  The server saves the message to MongoDB.
7.  The server broadcasts the saved message to everyone in the room: `io.to(roomId).emit('receive_message', message)`.
8.  On the receiver's client, `SocketContext.jsx` receives the `'receive_message'` event, and the listener updates the message state inside `ChatWindow.jsx` / `MessageList.jsx` to render the new bubble instantly.

### Scenario B: Reacting with an Emoji
1.  A user hovers/taps a message in `MessageList.jsx` and clicks 👍.
2.  `MessageList.jsx` triggers `onReact` callback, which goes up to `ChatWindow.jsx`.
3.  `ChatWindow.jsx` emits a socket event: `socket.emit('react_message', { messageId, emoji })`.
4.  The Render server (`socketHandler.js`) toggles the user's ID inside the message's `reactions` array in MongoDB.
5.  The server broadcasts the updated reactions: `io.to(roomId).emit('message_reaction_updated', { messageId, reactions })`.
6.  All frontend clients in the room receive `'message_reaction_updated'` and update the pill counter on that message bubble in real-time.
