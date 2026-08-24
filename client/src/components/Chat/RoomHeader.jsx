import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Hash, Lock, Users, Info, X, UserPlus, Trash2, UserMinus, AlertCircle } from 'lucide-react';

export default function RoomHeader({ room }) {
  const { idToken, mongoUser, contacts, contactsMap } = useAuth();
  const [showMembers, setShowMembers] = useState(false);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedInvitees, setSelectedInvitees] = useState([]);
  const [inviting, setInviting] = useState(false);
  const [searchQueryId, setSearchQueryId] = useState('');
  const [inviteError, setInviteError] = useState('');
  const [copiedId, setCopiedId] = useState(false);

  useEffect(() => {
    setShowMembers(false);
  }, [room?._id]);

  const handleToggleInvite = (userId) => {
    setSelectedInvitees((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Are you sure you want to remove this member from the group?')) return;
    try {
      const res = await fetch(`/api/rooms/${room._id}/members/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to remove member');
      }
    } catch (err) {
      console.error('[RoomHeader] Remove member error:', err.message);
      alert(err.message);
    }
  };

  const handleDeleteGroup = async () => {
    if (!window.confirm('WARNING: Are you sure you want to permanently delete this group channel and all its messages? This action cannot be undone.')) return;
    try {
      const res = await fetch(`/api/rooms/${room._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to delete channel');
      }

      setShowMembers(false);
    } catch (err) {
      console.error('[RoomHeader] Delete room error:', err.message);
      alert(err.message);
    }
  };

  const handleRespondRequest = async (userId, action) => {
    try {
      const res = await fetch(`/api/rooms/${room._id}/requests/${userId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || `Failed to ${action} request`);
      }
    } catch (err) {
      console.error(`[RoomHeader] Respond request error:`, err.message);
      alert(err.message);
    }
  };

  const handleInvite = async (e) => {
    e.preventDefault();
    if (selectedInvitees.length === 0 && !searchQueryId.trim() || inviting) return;

    setInviting(true);
    setInviteError('');
    try {
      let finalInvitees = [...selectedInvitees];

      if (searchQueryId.trim()) {
        const userRes = await fetch(`/api/auth/users/${searchQueryId.trim()}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });

        if (!userRes.ok) {
          const data = await userRes.json();
          throw new Error(data.message || 'User not found');
        }

        const foundUser = await userRes.json();

        // Verify not already in room
        if (room.members?.some((m) => m._id === foundUser._id)) {
          throw new Error('User is already a member of this channel');
        }

        if (!finalInvitees.includes(foundUser._id)) {
          finalInvitees.push(foundUser._id);
        }
      }

      const res = await fetch(`/api/rooms/${room._id}/members`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          members: finalInvitees,
        }),
      });

      if (res.ok) {
        setSelectedInvitees([]);
        setSearchQueryId('');
        setIsAddModalOpen(false);
      } else {
        const data = await res.json();
        throw new Error(data.message || 'Failed to add members');
      }
    } catch (err) {
      console.error('[RoomHeader] Invite members error:', err.message);
      setInviteError(err.message);
    } finally {
      setInviting(false);
    }
  };

  const invitableUsers = contacts
    .map(c => c.user)
    .filter(u => u && !room.members?.some(m => m._id === u._id));

  if (!room) return null;

  return (
    <div className="relative z-40">
      <div className="flex items-center justify-between px-6 py-4 bg-slate-900/60 backdrop-blur-md border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="p-2 bg-slate-950 rounded-xl border border-slate-800 text-indigo-400">
            {room.isPrivate ? <Lock className="w-4 h-4" /> : <Hash className="w-4 h-4" />}
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-slate-100 truncate">
              {room.isPrivate && room.name === 'DM' && room.members
                ? (() => {
                    const other = room.members.find((m) => m._id !== mongoUser?._id);
                    return other ? (contactsMap[other._id] || (other.username ? `@${other.username}` : other.displayName)) : 'Direct Message';
                  })()
                : room.name}
            </h2>
            {room.description && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{room.description}</p>
            )}
          </div>
        </div>

        {/* View members list toggle */}
        {room.name !== 'DM' && (
          <button
            type="button"
            onClick={() => setShowMembers((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
              showMembers
                ? 'bg-indigo-600/15 border-indigo-500/30 text-indigo-400'
                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Members</span>
            <span className="bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-slate-800 text-slate-400">
              {room.members?.length || 1}
            </span>
          </button>
        )}
      </div>

      {/* Slide-out members drawer */}
      {room.name !== 'DM' && showMembers && (
        <div className="absolute right-0 top-full w-80 bg-slate-900 border-l border-b border-slate-800 z-50 shadow-2xl flex flex-col h-[calc(100vh-65px)] animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Channel Members</span>
            <button
              type="button"
              onClick={() => setShowMembers(false)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {room.name !== 'DM' && (
            <div className="px-4 py-2.5 bg-slate-950/40 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400 select-none">
              <span className="font-semibold truncate">Channel ID: <span className="font-mono text-slate-300 font-normal select-all">{room._id}</span></span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(room._id);
                  setCopiedId(true);
                  setTimeout(() => setCopiedId(false), 2000);
                }}
                className="text-[9px] bg-slate-850 hover:bg-slate-800 border border-slate-800 px-2 py-0.5 rounded text-indigo-400 hover:text-indigo-300 font-bold shrink-0 ml-2 transition-all active:scale-95"
              >
                {copiedId ? 'Copied!' : 'Copy'}
              </button>
            </div>
          )}

          {/* Add Members Trigger Button for groups */}
          {room.name !== 'DM' && (
            <div className="p-3 border-b border-slate-800 space-y-2">
              <button
                onClick={() => setIsAddModalOpen(true)}
                className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-indigo-600/15 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/25 transition-all text-xs font-semibold shadow-sm active:scale-95"
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Add Member to Group</span>
              </button>

              {room.createdBy?._id === mongoUser?._id && (
                <button
                  onClick={handleDeleteGroup}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-red-650/15 hover:bg-red-600 hover:text-white text-red-400 border border-red-500/25 transition-all text-xs font-semibold shadow-sm active:scale-95"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete Channel</span>
                </button>
              )}
            </div>
          )}

          {/* Join Requests section: Only visible to group admin */}
          {room.name !== 'DM' && room.createdBy?._id === mongoUser?._id && room.joinRequests && room.joinRequests.length > 0 && (
            <div className="p-3 border-b border-slate-800 bg-slate-950/20 space-y-2 shrink-0">
              <span className="text-[10px] font-bold text-amber-500 uppercase tracking-wider block">
                Join Requests ({room.joinRequests.length})
              </span>
              <div className="space-y-2 max-h-36 overflow-y-auto pr-1 scrollbar-thin">
                {room.joinRequests.map((reqUser) => (
                  <div key={reqUser._id} className="flex items-center justify-between p-1.5 rounded-lg bg-slate-955 border border-slate-800/40">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-6 h-6 rounded bg-slate-800 overflow-hidden shrink-0">
                        <img
                          src={reqUser.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${reqUser.email}`}
                          alt=""
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-bold text-slate-200 truncate">
                          @{reqUser.username || reqUser.displayName.split(' ')[0]}
                        </p>
                        <p className="text-[8px] text-slate-500 truncate mt-0.5">
                          {reqUser.displayName}
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-2 shrink-0">
                      <button
                        onClick={() => handleRespondRequest(reqUser._id, 'accept')}
                        className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-[9px] font-bold transition-colors active:scale-95"
                      >
                        Accept
                      </button>
                      <button
                        onClick={() => handleRespondRequest(reqUser._id, 'reject')}
                        className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-red-400 text-[9px] font-bold transition-colors border border-slate-700/50 active:scale-95"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {room.members && room.members.length > 0 ? (
              room.members.map((member) => (
                <div key={member._id} className="flex items-center gap-3">
                  <div className="relative w-8 h-8 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 p-0.5">
                    <img
                      src={member.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${member.email}`}
                      alt=""
                      className="w-full h-full object-contain"
                    />
                    <div
                      className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-slate-900 ${
                        member.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                      }`}
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-slate-200 truncate">
                        {member._id === mongoUser?._id ? 'You' : (contactsMap[member._id] || member.displayName)}
                      </p>
                      {room.createdBy?._id === member._id && (
                        <span className="text-[8px] bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 px-1 rounded font-bold uppercase scale-90">
                          Admin
                        </span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 truncate">
                      {member.isOnline ? 'Online' : 'Offline'}
                    </p>
                  </div>

                  {/* Remove member button */}
                  {room.name !== 'DM' && room.createdBy?._id === mongoUser?._id && member._id !== mongoUser?._id && (
                    <button
                      onClick={() => handleRemoveMember(member._id)}
                      className="p-1.5 rounded-lg hover:bg-red-950/20 text-slate-500 hover:text-red-400 transition-colors shrink-0"
                      title="Remove Member"
                    >
                      <UserMinus className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500">No members loaded</p>
            )}
          </div>
        </div>
      )}

      {/* Add Members Checklist Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
              <span className="text-xs font-bold text-slate-200">Add Members to {room.name}</span>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setSelectedInvitees([]);
                  setSearchQueryId('');
                  setInviteError('');
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-805 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleInvite} className="p-4 space-y-4">
              {inviteError && (
                <div className="p-3 bg-red-950/40 border border-red-950 rounded-lg flex items-start gap-2 text-red-200 text-xs">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{inviteError}</span>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Select Contacts ({selectedInvitees.length})
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-slate-950/40 border border-slate-800 rounded-xl p-2 space-y-1.5">
                  {invitableUsers.length === 0 ? (
                    <p className="text-[10px] text-slate-500 p-2 text-center font-medium">
                      All saved contacts are already members of this group!
                    </p>
                  ) : (
                    contacts
                      .filter(c => c.user && !room.members?.some(m => m._id === c.user._id))
                      .map((c) => {
                        const user = c.user;
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
                              checked={selectedInvitees.includes(user._id)}
                              onChange={() => handleToggleInvite(user._id)}
                              className="w-3.5 h-3.5 accent-indigo-600 rounded bg-slate-900 border-slate-800"
                            />
                          </label>
                        );
                      })
                  )}
                </div>
              </div>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-2 text-[10px] text-slate-550 font-bold uppercase">Or</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Invite Member by Username, ID or Email
                </label>
                <input
                  type="text"
                  value={searchQueryId}
                  onChange={(e) => setSearchQueryId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-xs"
                  placeholder="Enter Username, ID or Email"
                  disabled={inviting}
                />
              </div>

            </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setSelectedInvitees([]);
                    setSearchQueryId('');
                    setInviteError('');
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-slate-100 text-xs font-medium transition-colors"
                  disabled={inviting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviting || (selectedInvitees.length === 0 && !searchQueryId.trim())}
                  className="px-3.5 py-1.5 rounded-lg bg-indigo-650/15 hover:bg-indigo-600 hover:text-white text-indigo-400 border border-indigo-500/25 transition-all text-xs font-semibold shadow transition-all disabled:opacity-40"
                >
                  {inviting ? 'Inviting...' : 'Add Members'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
