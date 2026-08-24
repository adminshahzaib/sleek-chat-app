import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Hash, Lock, Plus, X, FolderPlus, Globe, Users, Search, AlertCircle } from 'lucide-react';

export default function RoomList({ rooms, activeRoomId, onSelectRoom, onCreateRoom, unreadCounts = {} }) {
  const { idToken, mongoUser, contacts, contactsMap } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [searchChannelId, setSearchChannelId] = useState('');
  const [searchedChannel, setSearchedChannel] = useState(null);
  const [searchError, setSearchError] = useState('');
  const [searching, setSearching] = useState(false);
  const [submittingRequest, setSubmittingRequest] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [searchInviteQuery, setSearchInviteQuery] = useState('');
  const [createError, setCreateError] = useState('');

  const handleSearchChannel = async () => {
    if (!searchChannelId.trim() || searching) return;
    setSearching(true);
    setSearchError('');
    setSearchedChannel(null);
    try {
      const res = await fetch(`/api/rooms/${searchChannelId.trim()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Channel not found');
      }
      const data = await res.json();
      setSearchedChannel(data);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSearching(false);
    }
  };

  const handleSendJoinRequest = async () => {
    if (!searchedChannel || submittingRequest) return;
    setSubmittingRequest(true);
    setSearchError('');
    try {
      const res = await fetch(`/api/rooms/${searchedChannel._id}/requests`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to submit request');
      }
      alert('Request sent successfully! The admin will review it.');
      setIsJoinModalOpen(false);
      setSearchChannelId('');
      setSearchedChannel(null);
    } catch (err) {
      setSearchError(err.message);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleToggleMember = (userId) => {
    setSelectedMembers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!roomName.trim() || creating) return;

    setCreating(true);
    setCreateError('');
    try {
      let finalMembers = [...selectedMembers];

      if (searchInviteQuery.trim()) {
        const userRes = await fetch(`/api/auth/users/${searchInviteQuery.trim()}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!userRes.ok) {
          const data = await userRes.json();
          throw new Error(data.message || 'User not found');
        }

        const foundUser = await userRes.json();

        if (foundUser._id.toString() === mongoUser?._id.toString()) {
          throw new Error('You are automatically included in the channel');
        }

        if (!finalMembers.includes(foundUser._id)) {
          finalMembers.push(foundUser._id);
        }
      }

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          name: roomName.trim(),
          description: description.trim(),
          isPrivate,
          members: finalMembers,
        }),
      });

      if (res.ok) {
        const newRoom = await res.json();
        onCreateRoom(newRoom);
        // Reset states
        setRoomName('');
        setDescription('');
        setIsPrivate(false);
        setSelectedMembers([]);
        setSearchInviteQuery('');
        setIsModalOpen(false);
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create channel');
      }
    } catch (err) {
      console.error('[RoomList] Create room error:', err.message);
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 rounded-xl border border-slate-800/60 overflow-hidden">
      {/* Header with Create trigger */}
      <div className="flex items-center justify-between p-3 border-b border-slate-800">
        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Channels</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setIsJoinModalOpen(true)}
            className="flex items-center gap-1 px-2 py-1 rounded bg-slate-950 border border-slate-800 hover:bg-slate-800 text-[10px] text-slate-400 hover:text-slate-200 transition-all font-semibold active:scale-95"
            title="Join Channel by ID"
          >
            <Search className="w-3 h-3 text-indigo-400" />
            <span>Join by ID</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="p-1 rounded bg-indigo-600/10 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/20 shadow transition-all active:scale-95"
            title="Create channel"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Room listings */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {rooms.length === 0 ? (
          <div className="text-center py-8">
            <Globe className="w-8 h-8 text-slate-700 mx-auto mb-2 animate-pulse" />
            <p className="text-xs text-slate-500 font-medium">No channels found</p>
          </div>
        ) : (
           rooms.map((room) => {
            const isActive = activeRoomId === room._id;
            const unread = unreadCounts[room._id] || 0;
            return (
              <button
                key={room._id}
                onClick={() => onSelectRoom(room)}
                className={`w-full flex items-center justify-between p-2.5 rounded-xl group transition-all text-left border ${
                  isActive
                    ? 'bg-indigo-600/15 border-indigo-500/35 text-indigo-200'
                    : 'bg-transparent border-transparent hover:bg-slate-800/30 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  {room.isPrivate ? (
                    <Lock className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  ) : (
                    <Hash className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-400' : 'text-slate-500'}`} />
                  )}
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold truncate ${unread > 0 && !isActive ? 'text-slate-100' : ''}`}>
                      {room.isPrivate && room.name === 'DM' && room.members
                        ? (() => {
                            const other = room.members.find((m) => m._id !== mongoUser?._id);
                            return other ? (contactsMap[other._id] || other.displayName) : 'Direct Message';
                          })()
                        : room.name}
                    </p>
                    {room.description && (
                      <p className="text-[10px] text-slate-500 truncate group-hover:text-slate-400 mt-0.5">
                        {room.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {unread > 0 && !isActive && (
                    <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[9px] font-bold shadow-sm shadow-red-500/40">
                      {unread > 99 ? '99+' : unread}
                    </span>
                  )}
                  {!unread && room.members?.length > 0 && (
                    <span className="text-[10px] bg-slate-800 border border-slate-700 text-slate-550 group-hover:text-slate-400 px-1.5 py-0.5 rounded-md font-semibold">
                      {room.members.length}
                    </span>
                  )}
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Creation Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-indigo-400" />
                <span>Create New Channel</span>
              </h2>
              <button
                onClick={() => {
                  setIsModalOpen(false);
                  setRoomName('');
                  setDescription('');
                  setIsPrivate(false);
                  setSelectedMembers([]);
                  setSearchInviteQuery('');
                  setCreateError('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 bg-red-950/40 border border-red-950 rounded-xl flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{createError}</span>
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                  placeholder="e.g. general"
                  required
                  disabled={creating}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-650 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs resize-none h-16"
                  placeholder="What is this channel about?"
                  disabled={creating}
                />
              </div>

              {/* Privacy toggle */}
              <div className="flex items-center justify-between bg-slate-950/40 p-3 rounded-xl border border-slate-800">
                <div className="flex items-center gap-2">
                  {isPrivate ? (
                    <Lock className="w-4 h-4 text-indigo-400" />
                  ) : (
                    <Globe className="w-4 h-4 text-slate-500" />
                  )}
                  <div>
                    <p className="text-xs font-semibold text-slate-200">Private Channel</p>
                    <p className="text-[10px] text-slate-500">Only invited members can access</p>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="w-4 h-4 accent-indigo-600 rounded bg-slate-900 border-slate-800"
                />
              </div>

              {/* Invite Checklist (For Private channels) */}
              {isPrivate && (
                <div>
                  <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Invite Colleagues ({selectedMembers.length})</span>
                  </label>
                  <div className="max-h-28 overflow-y-auto bg-slate-950/40 border border-slate-800 rounded-xl p-2 space-y-1.5">
                    {contacts.length === 0 ? (
                      <p className="text-[10px] text-slate-500 p-2 text-center">No contacts saved to invite</p>
                    ) : (
                      contacts.map((c) => {
                        const user = c.user;
                        if (!user) return null;
                        return (
                          <label
                            key={user._id}
                            className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-800/30 cursor-pointer text-left"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-6 h-6 rounded bg-slate-800 overflow-hidden shrink-0">
                                <img src={user.avatarUrl} alt="" className="w-full h-full object-contain" />
                              </div>
                              <span className="text-xs text-slate-350 truncate">
                                {c.nickname} ({user.displayName})
                              </span>
                            </div>
                            <input
                              type="checkbox"
                              checked={selectedMembers.includes(user._id)}
                              onChange={() => handleToggleMember(user._id)}
                              className="w-3.5 h-3.5 accent-indigo-600 rounded bg-slate-900 border-slate-800"
                            />
                          </label>
                        );
                      })
                    )}
                  </div>
                  
                  <div className="relative flex py-1 items-center">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-2 text-[10px] text-slate-550 font-bold uppercase">Or</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                      Invite by Username, ID or Email
                    </label>
                    <input
                      type="text"
                      value={searchInviteQuery}
                      onChange={(e) => setSearchInviteQuery(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                      placeholder="Enter Username, ID or Email"
                      disabled={creating}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsModalOpen(false);
                    setRoomName('');
                    setDescription('');
                    setIsPrivate(false);
                    setSelectedMembers([]);
                    setSearchInviteQuery('');
                    setCreateError('');
                  }}
                  className="px-4 py-2 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium transition-colors"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 transition-all disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Join Channel by ID Modal */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Search className="w-4 h-4 text-indigo-400" />
                <span>Join Channel by ID</span>
              </h2>
              <button
                onClick={() => {
                  setIsJoinModalOpen(false);
                  setSearchChannelId('');
                  setSearchedChannel(null);
                  setSearchError('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {searchError && (
                <div className="p-3 bg-red-950/40 border border-red-950 rounded-xl flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Search input bar */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={searchChannelId}
                  onChange={(e) => setSearchChannelId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                  placeholder="Paste Unique Channel ID"
                  disabled={searching || submittingRequest}
                />
                <button
                  onClick={handleSearchChannel}
                  disabled={searching || submittingRequest || !searchChannelId.trim()}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition-all disabled:opacity-40 shrink-0"
                >
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>

              {/* Searched Channel Result Card */}
              {searchedChannel && (
                <div className="p-4 bg-slate-950/40 border border-slate-800 rounded-xl space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                      <h3 className="text-xs font-bold text-slate-200">{searchedChannel.name}</h3>
                    </div>
                    {searchedChannel.description && (
                      <p className="text-[10px] text-slate-500 leading-normal">{searchedChannel.description}</p>
                    )}
                    <p className="text-[9px] text-slate-600 mt-1">
                      Admin: <span className="font-semibold text-slate-400">@{searchedChannel.createdBy?.username || searchedChannel.createdBy?.displayName}</span>
                    </p>
                  </div>

                  {/* Dynamic Action Trigger based on membership state */}
                  {searchedChannel.members?.some((m) => (m._id || m) === mongoUser?._id) ? (
                    <div className="text-center py-1.5 text-[10px] font-bold text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      Already a Member
                    </div>
                  ) : searchedChannel.joinRequests?.some((r) => (r._id || r) === mongoUser?._id) ? (
                    <div className="text-center py-1.5 text-[10px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      Request Pending
                    </div>
                  ) : (
                    <button
                      onClick={handleSendJoinRequest}
                      disabled={submittingRequest}
                      className="w-full py-2 bg-indigo-650/15 hover:bg-indigo-600 border border-indigo-500/25 hover:text-white text-indigo-400 font-semibold text-xs rounded-xl shadow active:scale-95 transition-all"
                    >
                      {submittingRequest ? 'Submitting Request...' : 'Send Request to Join'}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
