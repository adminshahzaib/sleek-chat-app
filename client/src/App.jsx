import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { SocketProvider, useSocket } from './context/SocketContext.jsx';
import { CallProvider } from './context/CallContext.jsx';
import Login from './components/Auth/Login.jsx';
import Register from './components/Auth/Register.jsx';
import Sidebar from './components/Sidebar/Sidebar.jsx';
import ChatWindow from './components/Chat/ChatWindow.jsx';
import LoadingSpinner from './components/Common/LoadingSpinner.jsx';
import AudioCallModal from './components/AudioCallModal.jsx';
import VerifyEmail from './components/Auth/VerifyEmail.jsx';

function Dashboard() {
  const { idToken, mongoUser } = useAuth();
  const { socket } = useSocket();
  const [rooms, setRooms] = useState([]);
  const [activeRoom, setActiveRoom] = useState(null);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [unreadCounts, setUnreadCounts] = useState({}); // { [roomId]: number }
  const activeRoomRef = React.useRef(activeRoom);

  // Keep ref in sync with activeRoom for use inside socket callbacks
  useEffect(() => {
    activeRoomRef.current = activeRoom;
  }, [activeRoom]);

  // 1. Fetch Room collection from database on logon
  useEffect(() => {
    const fetchRooms = async () => {
      if (!idToken) return;
      try {
        const res = await fetch('/api/rooms', {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setRooms(data);
          
          // Default to first room if active room not selected (desktop only)
          if (data.length > 0 && !activeRoom && window.innerWidth >= 768) {
            setActiveRoom(data[0]);
          }
        }
      } catch (err) {
        console.error('[Dashboard] Fetch rooms error:', err.message);
      } finally {
        setLoadingRooms(false);
      }
    };

    fetchRooms();
  }, [idToken]);

  // 2. React to dynamic room creation/membership changes via sockets
  useEffect(() => {
    if (!socket) return;

    // Listen for general updates (e.g. if another user updates room list or details)
    const handleRoomUpdated = (updatedRoom) => {
      setRooms((prevRooms) =>
        prevRooms.map((r) => (r._id === updatedRoom._id ? updatedRoom : r))
      );
      if (activeRoom?._id === updatedRoom._id) {
        setActiveRoom(updatedRoom);
      }
    };

    // Listen for live room additions or invites
    const handleRoomCreatedOrUpdated = (roomData) => {
      setRooms((prevRooms) => {
        const exists = prevRooms.some((r) => r._id === roomData._id);
        if (exists) {
          return prevRooms.map((r) => (r._id === roomData._id ? roomData : r));
        } else {
          return [roomData, ...prevRooms];
        }
      });

      // Auto-join socket room for real-time messaging
      socket.emit('join_room', roomData._id);

      if (activeRoom?._id === roomData._id) {
        setActiveRoom(roomData);
      }
    };

    // Listen for room deletion or kicks
    const handleRoomRemoved = ({ roomId }) => {
      setRooms((prevRooms) => prevRooms.filter((r) => r._id !== roomId));
      if (activeRoom?._id === roomId) {
        setActiveRoom(null);
      }
    };

    socket.on('room_updated', handleRoomUpdated);
    socket.on('room_created_or_updated', handleRoomCreatedOrUpdated);
    socket.on('room_removed', handleRoomRemoved);

    return () => {
      socket.off('room_updated', handleRoomUpdated);
      socket.off('room_created_or_updated', handleRoomCreatedOrUpdated);
      socket.off('room_removed', handleRoomRemoved);
    };
  }, [socket, activeRoom?._id]);

  // Track unread messages from rooms other than the active room
  useEffect(() => {
    if (!socket) return;
    const handleNewMessage = (message) => {
      const currentActiveRoom = activeRoomRef.current;
      if (message.roomId && message.roomId !== currentActiveRoom?._id && !message.isSystem) {
        setUnreadCounts((prev) => ({
          ...prev,
          [message.roomId]: (prev[message.roomId] || 0) + 1,
        }));
      }
    };
    socket.on('receive_message', handleNewMessage);
    return () => socket.off('receive_message', handleNewMessage);
  }, [socket]);

  // Sync browser tab title with total unread count
  useEffect(() => {
    const total = Object.values(unreadCounts).reduce((sum, n) => sum + n, 0);
    document.title = total > 0 ? `(${total}) SleekChat` : 'SleekChat';
  }, [unreadCounts]);

  // Reset title when window gains focus
  useEffect(() => {
    const handleFocus = () => {
      // Only reset if active room is selected (all unread presumed seen)
      if (activeRoomRef.current) {
        setUnreadCounts((prev) => {
          const updated = { ...prev };
          delete updated[activeRoomRef.current._id];
          return updated;
        });
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const handleCreateRoom = (newRoom) => {
    setRooms((prev) => {
      if (prev.some((r) => r._id === newRoom._id)) return prev;
      return [newRoom, ...prev];
    });
    setActiveRoom(newRoom);
  };

  const handleSelectRoom = (room) => {
    setActiveRoom(room);
    // Clear unread badge for this room when user opens it
    setUnreadCounts((prev) => {
      const updated = { ...prev };
      delete updated[room._id];
      return updated;
    });
  };

  const handleBackToSidebar = () => {
    setActiveRoom(null);
  };

  const handleRoomUpdated = (updatedRoom) => {
    setRooms((prev) => prev.map((r) => (r._id === updatedRoom._id ? updatedRoom : r)));
    if (activeRoom?._id === updatedRoom._id) {
      setActiveRoom(updatedRoom);
    }
  };

  // 3. Initiate direct message thread with target colleague
  const handleStartDM = async (targetUser) => {
    if (!mongoUser || !idToken) return;

    // Check if a direct message session with target user already exists locally
    const existingDM = rooms.find(
      (r) =>
        r.isPrivate &&
        r.name === 'DM' &&
        r.members?.length === 2 &&
        r.members.some((m) => m._id === targetUser._id) &&
        r.members.some((m) => m._id === mongoUser._id)
    );

    if (existingDM) {
      setActiveRoom(existingDM);
      return;
    }

    // Provision a new private DM room on backend
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: 'DM',
          isPrivate: true,
          members: [mongoUser._id, targetUser._id],
          description: `Direct message thread between ${mongoUser.displayName} and ${targetUser.displayName}`,
        }),
      });

      if (res.ok) {
        const newDM = await res.json();
        setRooms((prev) => {
          if (prev.some((r) => r._id === newDM._id)) return prev;
          return [newDM, ...prev];
        });
        setActiveRoom(newDM);
      }
    } catch (err) {
      console.error('[Dashboard] Start DM error:', err.message);
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      <Sidebar
        rooms={rooms}
        activeRoomId={activeRoom?._id}
        onSelectRoom={handleSelectRoom}
        onCreateRoom={handleCreateRoom}
        onStartDM={handleStartDM}
        unreadCounts={unreadCounts}
      />
      <ChatWindow room={activeRoom} onRoomUpdated={handleRoomUpdated} onBack={handleBackToSidebar} />
    </div>
  );
}

function MainApp() {
  const { currentUser, loading, awaitingVerification } = useAuth();
  const [authView, setAuthView] = useState('login'); // 'login' or 'register'

  if (loading) {
    return <LoadingSpinner fullScreen={true} />;
  }

  // If unauthorized, return login card
  if (!currentUser) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 p-4">
        {authView === 'login' ? (
          <Login onToggleAuth={() => setAuthView('register')} />
        ) : (
          <Register onToggleAuth={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  // If user just registered manually, show verification waiting screen
  if (awaitingVerification) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-950 p-4">
        <VerifyEmail />
      </div>
    );
  }

  // If authenticated and verified (or OAuth), load Chat workspace
  return (
    <SocketProvider>
      <CallProvider>
        <Dashboard />
        <AudioCallModal />
      </CallProvider>
    </SocketProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
