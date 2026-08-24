import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { X, Check, User, Save, AlertCircle, Copy } from 'lucide-react';

const AVATAR_SEEDS = ['Felix', 'Aria', 'Milo', 'Zoe', 'Buster', 'Coco', 'Rusty', 'Nova', 'Gizmo', 'Pip', 'Sparky', 'Gears'];

export default function UserProfileModal({ isOpen, onClose }) {
  const { mongoUser, updateMongoProfile } = useAuth();
  const [displayName, setDisplayName] = useState(mongoUser?.displayName || '');
  const [username, setUsername] = useState(mongoUser?.username || '');
  const [selectedSeed, setSelectedSeed] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState(mongoUser?.avatarUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const getAvatarUrl = (seed) => `https://api.dicebear.com/7.x/bottts/svg?seed=${seed}`;

  const handleSelectSeed = (seed) => {
    setSelectedSeed(seed);
    setCustomAvatarUrl(getAvatarUrl(seed));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!displayName.trim()) {
      return setError('Display name cannot be empty');
    }

    setIsSaving(true);
    setError('');
    setSuccess(false);

    try {
      await updateMongoProfile(displayName.trim(), customAvatarUrl, username.trim());
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-slate-100">Profile Settings</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-6">
          {error && (
            <div className="p-3 bg-red-950/40 border border-red-950 rounded-xl flex items-start gap-2.5 text-red-200 text-sm">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-3 bg-emerald-950/40 border border-emerald-950 rounded-xl flex items-center gap-2.5 text-emerald-200 text-sm">
              <Check className="w-5 h-5 text-emerald-400 shrink-0" />
              <span>Profile updated successfully!</span>
            </div>
          )}

          {/* Current Avatar & Info */}
          <div className="flex items-center gap-4 bg-slate-950/40 p-4 rounded-xl border border-slate-800/40">
            <div className="relative w-16 h-16 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 p-1">
              <img
                src={customAvatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${mongoUser?.email}`}
                alt="Avatar Preview"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-200 truncate">{mongoUser?.displayName}</p>
              <p className="text-xs text-slate-400 truncate mt-0.5">{mongoUser?.email}</p>
              <div className="flex items-center gap-1.5 mt-2 bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 w-fit">
                <span className="text-[10px] text-slate-400 font-mono select-all">ID: {mongoUser?._id}</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(mongoUser?._id);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="p-0.5 text-slate-500 hover:text-indigo-400 transition-colors shrink-0"
                  title="Copy User ID"
                >
                  {copied ? (
                    <span className="text-[9px] text-emerald-400 font-semibold px-0.5">Copied!</span>
                  ) : (
                    <Copy className="w-3 h-3" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Display Name Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Display Name
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                placeholder="Name"
                required
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Username (@username)
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 font-semibold text-sm">@</span>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-8 pr-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
                placeholder="username"
                required
                disabled={isSaving}
              />
            </div>
          </div>

          {/* Grid Selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Choose New Avatar
              </label>
            </div>
            <div className="grid grid-cols-6 gap-2 bg-slate-950/40 p-3 rounded-xl border border-slate-800 max-h-[140px] overflow-y-auto">
              {AVATAR_SEEDS.map((seed) => {
                const url = getAvatarUrl(seed);
                const isSelected = customAvatarUrl === url;
                return (
                  <button
                    key={seed}
                    type="button"
                    onClick={() => handleSelectSeed(seed)}
                    className={`relative aspect-square rounded-lg overflow-hidden border p-1 bg-slate-800 transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-indigo-500 bg-indigo-500/10 scale-105 ring-2 ring-indigo-500/20'
                        : 'border-slate-800 hover:border-slate-700'
                    }`}
                    disabled={isSaving}
                  >
                    <img src={url} alt={`Avatar ${seed}`} className="w-full h-full object-contain" />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Avatar Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Or Paste Custom Avatar URL
            </label>
            <input
              type="url"
              value={customAvatarUrl}
              onChange={(e) => {
                setSelectedSeed('');
                setCustomAvatarUrl(e.target.value);
              }}
              className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all text-sm"
              placeholder="https://example.com/avatar.png"
              disabled={isSaving}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-slate-800 hover:bg-slate-800 text-slate-350 hover:text-slate-100 text-sm font-medium transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium flex items-center gap-2 shadow-lg shadow-indigo-600/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all disabled:opacity-50 disabled:pointer-events-none"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
