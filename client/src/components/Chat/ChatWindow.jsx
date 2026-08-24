import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import RoomHeader from './RoomHeader.jsx';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import LoadingSkeleton from './LoadingSkeleton.jsx';
import { MessageSquare, ShieldAlert, Lock } from 'lucide-react';

export default function ChatWindow({ room, onRoomUpdated }) {
  const { idToken, mongoUser } = useAuth();
  const { socket } = useSocket();
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [typingUsers, setTypingUsers] = useState({}); // format: { userId: displayName }
  const [requesting, setRequesting] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null); // message object being replied to

  const isMember = room?.members?.some((m) => (m._id || m) === mongoUser?._id);
  const hasRequested = room?.joinRequests?.some((id) => (id._id || id) === mongoUser?._id);

  // 1. Fetch Room Messages from Database when Active Room changes (Only for members)
  useEffect(() => {
    setMessages([]);
    setTypingUsers({}); // reset typing on room change
    
    if (!room?._id || !idToken || !isMember) return;

    const fetchMessages = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/rooms/${room._id}/messages`, {
          headers: {
            Authorization: `Bearer ${idToken}`,
          },
        });
        if (res.ok) {
          const data = await res.json();
          setMessages(data);
        }
      } catch (err) {
        console.error('[ChatWindow] Error fetching history:', err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMessages();
  }, [room?._id, idToken, isMember]);

  // 2. Join/Leave WebSocket Room on selection change (Only for members)
  useEffect(() => {
    if (!socket || !room?._id || !isMember) return;

    socket.emit('join_room', room._id);

    return () => {
      socket.emit('leave_room', room._id);
    };
  }, [socket, room?._id, isMember]);

  // 3. Socket Listeners (Incoming messages & typing indicators)
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (message) => {
      // Append only if the message matches our active room
      if (message.roomId === room?._id) {
        setMessages((prev) => [...prev, message]);
      }
    };

    const handleUserTyping = ({ roomId, userId, displayName, isTyping }) => {
      if (roomId !== room?._id) return;

      setTypingUsers((prev) => {
        const updated = { ...prev };
        if (isTyping) {
          updated[userId] = displayName;
        } else {
          delete updated[userId];
        }
        return updated;
      });
    };

    // Update reaction pills live across all users in room
    const handleReactionUpdated = ({ messageId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id)?.toString() === messageId?.toString()
            ? { ...m, reactions }
            : m
        )
      );
    };

    // Update content + editedAt when another user edits in real-time
    const handleMessageEdited = ({ messageId, content, editedAt }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id)?.toString() === messageId?.toString()
            ? { ...m, content, editedAt }
            : m
        )
      );
    };

    // Soft-delete: replace bubble with placeholder
    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prev) =>
        prev.map((m) =>
          (m._id || m.id)?.toString() === messageId?.toString()
            ? { ...m, isDeleted: true, content: '' }
            : m
        )
      );
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('message_reaction_updated', handleReactionUpdated);
    socket.on('message_edited', handleMessageEdited);
    socket.on('message_deleted', handleMessageDeleted);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('message_reaction_updated', handleReactionUpdated);
      socket.off('message_edited', handleMessageEdited);
      socket.off('message_deleted', handleMessageDeleted);
    };
  }, [socket, room?._id]);

  const handleSendMessage = (content, replyToId = null) => {
    if (!socket || !room?._id || !isMember) return;

    socket.emit('send_message', {
      roomId: room._id,
      content,
      replyToId,
    });
    setReplyingTo(null);
  };

  const handleTyping = (isTyping) => {
    if (!socket || !room?._id || !isMember) return;
    socket.emit('typing', { roomId: room._id, isTyping });
  };

  const handleReply = (message) => {
    setReplyingTo(message);
  };

  const handleEdit = (messageId, newContent) => {
    if (!socket) return;
    // Optimistic local state update
    setMessages((prev) =>
      prev.map((m) =>
        (m._id || m.id)?.toString() === messageId?.toString()
          ? { ...m, content: newContent, editedAt: new Date() }
          : m
      )
    );
    socket.emit('edit_message', { messageId: messageId.toString(), newContent });
  };

  const handleDelete = (messageId) => {
    if (!socket) return;
    // Optimistic local state update
    setMessages((prev) =>
      prev.map((m) =>
        (m._id || m.id)?.toString() === messageId?.toString()
          ? { ...m, isDeleted: true, content: '' }
          : m
      )
    );
    socket.emit('delete_message', { messageId: messageId.toString() });
  };

  const handleReact = (messageId, emoji) => {
    if (!socket || !mongoUser) return;
    const msgIdStr = messageId?.toString();
    const myIdStr = (mongoUser._id || mongoUser.id)?.toString();

    // Optimistic local state update
    setMessages((prev) =>
      prev.map((m) => {
        if ((m._id || m.id)?.toString() !== msgIdStr) return m;
        const currentReactions = Array.isArray(m.reactions) ? [...m.reactions] : [];
        const rIndex = currentReactions.findIndex((r) => r.emoji === emoji);
        if (rIndex === -1) {
          currentReactions.push({ emoji, users: [myIdStr] });
        } else {
          const r = { ...currentReactions[rIndex] };
          const usersList = Array.isArray(r.users) ? [...r.users] : [];
          const uIndex = usersList.findIndex(
            (u) => (u?._id || u)?.toString() === myIdStr
          );
          if (uIndex === -1) {
            usersList.push(myIdStr);
            r.users = usersList;
            currentReactions[rIndex] = r;
          } else {
            usersList.splice(uIndex, 1);
            if (usersList.length === 0) {
              currentReactions.splice(rIndex, 1);
            } else {
              r.users = usersList;
              currentReactions[rIndex] = r;
            }
          }
        }
        return { ...m, reactions: currentReactions };
      })
    );

    socket.emit('react_message', { messageId: msgIdStr, emoji });
  };

  const handleJoinRequest = async () => {
    if (!room?._id || requesting) return;
    setRequesting(true);
    try {
      const res = await fetch(`/api/rooms/${room._id}/requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit request');
      }
      const data = await res.json();
      if (onRoomUpdated) {
        onRoomUpdated(data.room);
      }
      alert('Join request sent successfully!');
    } catch (err) {
      console.error('[ChatWindow] Send request error:', err.message);
      alert(err.message);
    } finally {
      setRequesting(false);
    }
  };

  // Build typing notification string
  const renderTypingText = () => {
    const names = Object.values(typingUsers);
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return 'Multiple colleagues are typing...';
  };

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-8 text-center select-none">
        <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 text-slate-500 animate-bounce">
          <MessageSquare className="w-8 h-8" />
        </div>
        <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">No Channel Selected</h3>
        <p className="text-xs text-slate-500 max-w-sm mt-1.5">
          Select a channel or direct message thread from the sidebar workspace to start texting.
        </p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative chat-background">
      {/* Room Top Banner */}
      <RoomHeader room={room} />

      {isMember ? (
        <>
          {/* Loading state / Message feed list */}
          {loading ? (
            <LoadingSkeleton />
          ) : (
            <MessageList
              messages={messages}
              onReply={handleReply}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onReact={handleReact}
            />
          )}

          {/* Typing indicator wave animation */}
          {Object.keys(typingUsers).length > 0 && (
            <div className="absolute bottom-[66px] left-6 text-[10px] text-indigo-400 font-semibold flex items-center gap-1.5 bg-indigo-500/10 border border-indigo-500/25 px-2 py-1 rounded-md">
              <div className="flex gap-0.5 mr-1 text-indigo-400 shrink-0">
                <span className="typing-dot animate-none"></span>
                <span className="typing-dot animate-none"></span>
                <span className="typing-dot animate-none"></span>
              </div>
              <span>{renderTypingText()}</span>
            </div>
          )}

          {/* Input textbox footer */}
          <MessageInput
            onSendMessage={handleSendMessage}
            onTyping={handleTyping}
            replyingTo={replyingTo}
            onCancelReply={() => setReplyingTo(null)}
          />
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center bg-slate-950 p-8 text-center select-none">
          <div className="w-16 h-16 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center mb-4 text-indigo-400">
            <Lock className="w-8 h-8" />
          </div>
          <h3 className="text-sm font-bold text-slate-200 uppercase tracking-wider">Join Channel</h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1.5 leading-relaxed">
            You are not a member of <span className="font-semibold text-slate-450">{room.name}</span>. Send a request to the group admin to join the discussion.
          </p>
          
          <div className="mt-6 w-full max-w-[240px]">
            {hasRequested ? (
              <div className="py-2.5 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold rounded-xl select-none">
                Join Request Pending
              </div>
            ) : (
              <button
                onClick={handleJoinRequest}
                disabled={requesting}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs rounded-xl shadow transition-all active:scale-95 disabled:opacity-50"
              >
                {requesting ? 'Submitting request...' : 'Request to Join'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
