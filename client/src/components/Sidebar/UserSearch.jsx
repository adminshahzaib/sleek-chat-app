import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import { UserPlus, Edit2, Trash2, MessageSquare, X, AlertCircle, Users } from 'lucide-react';

export default function UserSearch({ onStartDM, activeRoomId, rooms, onSelectRoom, unreadCounts = {} }) {
  const {
    idToken,
    contacts,
    saveContact,
    updateContactNickname,
    deleteContact,
    mongoUser,
  } = useAuth();
  const { socket } = useSocket();

  const [searchTerm, setSearchTerm] = useState('');
  const [presenceMap, setPresenceMap] = useState({});
  
  // Contact Add Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [targetId, setTargetId] = useState('');
  const [nickname, setNickname] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit Nickname Modal states
  const [editingContact, setEditingContact] = useState(null); // contact object
  const [newNickname, setNewNickname] = useState('');
  const [editError, setEditError] = useState('');
  const [editing, setEditing] = useState(false);

  // Listen to socket status notifications
  useEffect(() => {
    if (!socket) return;

    const handleStatusChanged = ({ userId, isOnline, lastSeen }) => {
      setPresenceMap((prev) => ({
        ...prev,
        [userId]: { isOnline, lastSeen },
      }));
    };

    socket.on('user_status_changed', handleStatusChanged);
    return () => {
      socket.off('user_status_changed', handleStatusChanged);
    };
  }, [socket]);

  const handleSaveContactSubmit = async (e) => {
    e.preventDefault();
    if (!targetId.trim() || !nickname.trim() || adding) return;

    setAdding(true);
    setAddError('');
    try {
      await saveContact(targetId.trim(), nickname.trim());
      setTargetId('');
      setNickname('');
      setIsAddModalOpen(false);
    } catch (err) {
      setAddError(err.message || 'Failed to save contact');
    } finally {
      setAdding(false);
    }
  };

  const handleEditNicknameSubmit = async (e) => {
    e.preventDefault();
    if (!newNickname.trim() || !editingContact || editing) return;

    setEditing(true);
    setEditError('');
    try {
      await updateContactNickname(editingContact.user._id, newNickname.trim());
      setNewNickname('');
      setEditingContact(null);
    } catch (err) {
      setEditError(err.message || 'Failed to update nickname');
    } finally {
      setEditing(false);
    }
  };

  const handleDeleteContactClick = async (contactUserId) => {
    if (!window.confirm('Are you sure you want to delete this contact?')) return;
    try {
      await deleteContact(contactUserId);
    } catch (err) {
      console.error('[UserSearch] Delete contact error:', err.message);
    }
  };

  // Compile unified contact list (Saved Contacts + Unsaved Active DMs)
  const dmRooms = (rooms || []).filter((room) => room.isPrivate && room.name === 'DM');
  const displayItems = [];
  const contactUserIds = new Set();

  // 1. Add all saved contacts
  (contacts || []).forEach((c) => {
    const contactUser = c.user;
    if (!contactUser) return;
    contactUserIds.add(contactUser._id);

    // Find if there is an active DM room for this contact
    const activeDM = dmRooms.find((room) =>
      room.members?.some((m) => m._id === contactUser._id)
    );

    // Check custom presence map status, falling back to schema fields
    const presence = presenceMap[contactUser._id] || {
      isOnline: contactUser.isOnline,
      lastSeen: contactUser.lastSeen,
    };

    displayItems.push({
      key: `contact-${contactUser._id}`,
      userId: contactUser._id,
      displayName: contactUser.displayName,
      username: contactUser.username || contactUser.email.split('@')[0],
      email: contactUser.email,
      avatarUrl: contactUser.avatarUrl,
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
      nickname: c.nickname,
      isSaved: true,
      room: activeDM,
      rawUser: contactUser,
      rawContact: c,
    });
  });

  // 2. Add active DMs with unsaved users
  dmRooms.forEach((room) => {
    const other = room.members?.find((m) => m._id !== mongoUser?._id);
    if (!other) return;
    if (contactUserIds.has(other._id)) return; // already added above

    const presence = presenceMap[other._id] || {
      isOnline: other.isOnline,
      lastSeen: other.lastSeen,
    };

    displayItems.push({
      key: `dm-${room._id}`,
      userId: other._id,
      displayName: other.displayName,
      username: other.username || other.email.split('@')[0],
      email: other.email,
      avatarUrl: other.avatarUrl,
      isOnline: presence.isOnline,
      lastSeen: presence.lastSeen,
      nickname: '', // unsaved
      isSaved: false,
      room: room,
      rawUser: other,
      rawContact: null,
    });
  });

  // Filter combined list by search term
  const filteredItems = displayItems.filter((item) => {
    const name = item.displayName || '';
    const nick = item.nickname || '';
    const uname = item.username || '';
    const email = item.email || '';
    const search = searchTerm.toLowerCase();
    return (
      name.toLowerCase().includes(search) ||
      nick.toLowerCase().includes(search) ||
      uname.toLowerCase().includes(search) ||
      email.toLowerCase().includes(search)
    );
  });

  const handleItemClick = (item) => {
    if (item.room) {
      onSelectRoom(item.room);
    } else {
      onStartDM(item.rawUser);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-slate-800/60 overflow-hidden">
      {/* Header with Save trigger */}
      <div className="p-3 border-b border-slate-800 space-y-2">
        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl bg-indigo-600/15 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/25 transition-all text-xs font-semibold shadow-sm active:scale-95"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Save Contact by ID, Username or Email</span>
        </button>
        <div className="relative">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
            placeholder="Search contacts & active chats..."
          />
        </div>
      </div>

      {/* Unified Contacts & Active DMs List Feed */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {filteredItems.length === 0 ? (
          <div className="text-center py-12 px-4 select-none">
            <Users className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-bounce" />
            <p className="text-xs font-bold text-slate-400">No contacts or active DMs found</p>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[200px] mx-auto leading-relaxed">
              Save a contact using their Username, unique ID or Email to start chatting!
            </p>
          </div>
        ) : (
          filteredItems.map((item) => {
            const isActive = activeRoomId && item.room?._id === activeRoomId;
            const unread = item.room ? (unreadCounts[item.room._id] || 0) : 0;
            return (
              <div
                key={item.key}
                className={`w-full flex items-center justify-between p-2 rounded-xl border transition-all group ${
                  isActive
                    ? 'bg-indigo-600/15 border-indigo-500/35'
                    : 'bg-transparent border-transparent hover:bg-slate-800/20 hover:border-slate-800/30'
                }`}
              >
                <button
                  onClick={() => handleItemClick(item)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  {/* Avatar */}
                  <div className="relative w-9 h-9 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 p-0.5 shrink-0">
                    <img
                      src={item.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${item.email}`}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${
                        item.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className={`text-xs font-bold truncate transition-colors ${isActive ? 'text-indigo-400 font-bold' : 'text-slate-200 group-hover:text-indigo-400'}`}>
                        {item.isSaved ? item.nickname : `@${item.username}`}
                      </p>
                      {!item.isSaved && (
                        <span className="text-[8px] bg-slate-850 border border-slate-800 text-slate-500 px-1 rounded font-semibold uppercase">
                          Unsaved
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {item.isSaved ? `@${item.username} • ${item.displayName}` : `${item.displayName}`}
                    </p>
                  </div>
                </button>

                {/* Unread badge + Edit/Delete Actions */}
                <div className="flex items-center gap-1.5 ml-2 shrink-0">
                  {/* Unread badge — visible when not hovered/active */}
                  {unread > 0 && !isActive && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm shadow-red-500/40 group-hover:hidden">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {/* Edit and Delete Actions (Only for saved contacts) — visible on hover */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {item.isSaved ? (
                      <>
                        <button
                          onClick={() => {
                            setEditingContact(item.rawContact);
                            setNewNickname(item.nickname);
                          }}
                          className="p-1 rounded text-slate-500 hover:text-indigo-400 hover:bg-slate-800"
                          title="Edit Nickname"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteContactClick(item.userId)}
                          className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-red-950/20"
                          title="Delete Contact"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => {
                          setTargetId(item.username);
                          setNickname(item.displayName);
                          setIsAddModalOpen(true);
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 text-indigo-400 hover:text-white hover:bg-indigo-650/40 text-[10px] font-bold tracking-tight transition-all"
                        title="Save as Contact"
                      >
                        Save
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Save Contact Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <UserPlus className="w-4 h-4 text-indigo-400" />
                <span>Save New Contact</span>
              </span>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setAddError('');
                  setTargetId('');
                  setNickname('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveContactSubmit} className="p-4 space-y-4">
              {addError && (
                <div className="p-3 bg-red-950/40 border border-red-950 rounded-lg flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{addError}</span>
                </div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Contact's Username, ID or Email
                  </label>
                  <input
                    type="text"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                    placeholder="Username, ID or Email"
                    required
                    disabled={adding}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                    Custom Nickname (e.g. Best Friend, Boss)
                  </label>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                    placeholder="Nickname"
                    required
                    disabled={adding}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setAddError('');
                    setTargetId('');
                    setNickname('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium transition-colors"
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adding || !targetId.trim() || !nickname.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {adding ? 'Saving...' : 'Save Contact'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Nickname Modal */}
      {editingContact && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">Edit Contact Nickname</span>
              <button
                onClick={() => {
                  setEditingContact(null);
                  setEditError('');
                  setNewNickname('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleEditNicknameSubmit} className="p-4 space-y-4">
              {editError && (
                <div className="p-3 bg-red-950/40 border border-red-950 rounded-lg flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{editError}</span>
                </div>
              )}
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">
                  Change Nickname for {editingContact.user.displayName}
                </label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                  placeholder="New Nickname"
                  required
                  disabled={editing}
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setEditError('');
                    setNewNickname('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium transition-colors"
                  disabled={editing}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editing || !newNickname.trim()}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {editing ? 'Updating...' : 'Save Nickname'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
