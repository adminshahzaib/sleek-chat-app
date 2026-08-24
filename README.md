# SleekChat - Real-Time Chat Workspace

SleekChat is a high-performance, production-ready full-stack real-time chat application inspired by Linear and Discord. It features a modern, dark-mode first, glassmorphism interface built using React (Vite, SWC), Tailwind CSS, Node.js/Express, Socket.io, and MongoDB, with Firebase Authentication securing the stack.

---

## 1. Project Directory Architecture

```
chat-app/
├── server/                 # Express, MongoDB & Socket.io Server
│   ├── config/             # DB & Firebase Initialization Utilities
│   ├── middleware/         # Token Verification REST Middleware
│   ├── models/             # Mongoose Schemas (User, Room, Message)
│   ├── routes/             # REST API Handlers (Auth Sync, Rooms, History)
│   ├── socket/             # WS Handshake Middleware & Message Routing
│   ├── .env.example        # Environment Variables Template
│   ├── package.json        # Dependencies & Run Scripts
│   └── server.js           # Express App Bootstrapper
│
├── client/                 # React & Vite client workspace
│   ├── src/
│   │   ├── components/     # UI Component Tree
│   │   ├── config/         # Firebase Client Settings
│   │   ├── context/        # Global Auth & Socket Contexts
│   │   ├── App.jsx         # App Root Router & Panel Workspace
│   │   ├── main.jsx        # Boot React root
│   │   └── index.css       # Tailwind directives & Custom scrollbars
│   ├── .env.example        # Client Firebase Keys Template
│   ├── tailwind.config.js  # Tailwind settings
│   ├── vite.config.js      # Proxy settings & SWC Loaders
│   └── package.json        # Frontend NPM Dependencies
│
└── README.md               # Setup Guide (This file)
```

---

## 2. Configuration & Credentials Setup

To run this application, you must configure environment settings for both backend and frontend.

### A. Backend Credentials (`server`)
1. Create a `.env` file in the `server` directory by copying `.env.example`:
   ```bash
   cp server/.env.example server/.env
   ```
2. Set your `MONGO_URI` (local database or MongoDB Atlas connection string).
3. **Firebase Service Account setup:**
   - Go to your **Firebase Console** -> **Project Settings** -> **Service Accounts**.
   - Click **Generate New Private Key** to download the JSON credentials.
   - **Option 1 (Recommended):** Convert the downloaded JSON into a single-line string and assign it to `FIREBASE_SERVICE_ACCOUNT_JSON` inside `server/.env`.
   - **Option 2:** Rename the downloaded JSON file to `serviceAccountKey.json`, place it directly inside the `server/` directory, and uncomment `# FIREBASE_SERVICE_ACCOUNT_PATH=./serviceAccountKey.json` inside your `.env` file.

### B. Frontend Credentials (`client`)
1. Create a `.env` file in the `client` directory by copying `.env.example`:
   ```bash
   cp client/.env.example client/.env
   ```
2. In your **Firebase Console** -> **Project Settings** -> **General**, scroll to **Your Apps** and create a Web App.
3. Copy the configuration fields and paste them into the appropriate variables inside `client/.env`:
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`

---

## 3. Installation & Local Development

### Prerequisites
- Node.js (v18+ recommended)
- NPM or Yarn
- MongoDB running locally or accessible in the cloud

### Step 1: Start the Backend Server
Navigate to the server directory, install dependencies, and start the development server:
```bash
cd server
npm install
npm run dev
```
The server will run on port `5000` (e.g., `http://localhost:5000`).

### Step 2: Start the React Client
Open a new terminal tab, navigate to the client directory, install dependencies, and boot Vite's dev server:
```bash
cd client
npm install
npm run dev
```
The client workspace will run on port `5173` (e.g., `http://localhost:5173`). Vite is configured to proxy all API requests starting with `/api` to the backend on `http://localhost:5000`.

---

## 4. Key Features Implemented
- **Firebase Auth Bridge:** The client-side token is sent securely via headers on REST requests, and during Socket.io handshakes, verifying identity and auto-provisioning Mongoose records.
- **Dynamic Channels:** Users can create public or private channels, toggle visibility, and invite colleagues from a workspace check-list.
- **Presence Indicators:** Pulse highlights represent colleagues who are actively online. Status is updated in real time via socket connection/disconnection hooks.
- **Typing Indicators:** Broadcast signals let participants know when colleagues are currently typing within a active channel.
- **Interactive Customizations:** Profile edits (such as custom avatar selections or display names) instantly propagate.
- **Optimized UI:** Dark layout inspired by Linear and Discord with thin slate scrollbars, glassmorphic panels, date dividers, and parsed URLs.
