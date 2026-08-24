import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import RoomList from './RoomList.jsx';
import UserSearch from './UserSearch.jsx';
import UserProfileModal from './UserProfileModal.jsx';
import DarkModeToggle from '../Common/DarkModeToggle.jsx';
import { LogOut, Settings, MessageSquare, Users, MessageSquareCode } from 'lucide-react';

export default function Sidebar({
  rooms,
  activeRoomId,
  onSelectRoom,
  onCreateRoom,
  onStartDM,
  unreadCounts = {},
}) {
  const { mongoUser, logout } = useAuth();
  const [activeTab, setActiveTab] = useState('channels'); // 'channels' or 'users'
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <div className="w-80 h-full flex flex-col bg-slate-900/60 backdrop-blur-md border-r border-slate-800 shrink-0">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow shadow-indigo-500/25">
            <MessageSquareCode className="w-4 h-4 text-white" />
          </div>
          <span className="text-sm font-bold tracking-tight text-slate-100">SleekChat</span>
        </div>
        <DarkModeToggle />
      </div>

      {/* Tab Navigation selector */}
      <div className="p-3">
        <div className="grid grid-cols-2 gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('channels')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'channels'
                ? 'bg-slate-900 text-indigo-400 border border-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Channels</span>
          </button>
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'users'
                ? 'bg-slate-900 text-indigo-400 border border-slate-800 shadow-sm'
                : 'text-slate-500 hover:text-slate-350'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contacts</span>
          </button>
        </div>
      </div>

      {/* Main Tab Panel Content */}
      <div className="flex-1 overflow-hidden px-3 pb-3">
        {activeTab === 'channels' ? (
          <RoomList
            rooms={rooms.filter((room) => room.name !== 'DM')}
            activeRoomId={activeRoomId}
            onSelectRoom={onSelectRoom}
            onCreateRoom={onCreateRoom}
            unreadCounts={unreadCounts}
          />
        ) : (
          <UserSearch
            onStartDM={onStartDM}
            activeRoomId={activeRoomId}
            rooms={rooms}
            onSelectRoom={onSelectRoom}
            unreadCounts={unreadCounts}
          />
        )}
      </div>

      {/* User Footer Profile bar */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 p-0.5 shrink-0">
            <img
              src={mongoUser?.avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${mongoUser?.email}`}
              alt={mongoUser?.displayName || 'User'}
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-slate-200 truncate">
              {mongoUser?.displayName || 'Anonymous User'}
            </p>
            <p className="text-[10px] text-slate-500 truncate mt-0.5">
              {mongoUser?.email}
            </p>
          </div>
        </div>

        {/* User profile actions */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setIsProfileOpen(true)}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
            title="Profile Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={logout}
            className="p-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/20 transition-colors"
            title="Log Out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Profile Settings Modal */}
      <UserProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
