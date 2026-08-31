import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  signInWithCustomToken
} from 'firebase/auth';
import { auth, googleProvider } from '../config/firebase.js';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [mongoUser, setMongoUser] = useState(null);
  const [idToken, setIdToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [contacts, setContacts] = useState([]);
  const [contactsMap, setContactsMap] = useState({});

  // Sync nicknames map
  useEffect(() => {
    const map = {};
    contacts.forEach((c) => {
      if (c.user?._id) {
        map[c.user._id] = c.nickname;
      }
    });
    setContactsMap(map);
  }, [contacts]);

  // Load contacts list
  const fetchContacts = async (token) => {
    try {
      const res = await fetch('/api/auth/contacts', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setContacts(data);
      }
    } catch (err) {
      console.error('[AuthContext] Fetch Contacts Error:', err.message);
    }
  };

  const saveContact = async (queryId, nickname) => {
    if (!idToken) return;
    const res = await fetch('/api/auth/contacts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ queryId, nickname }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to save contact');
    }

    const updatedContacts = await res.json();
    setContacts(updatedContacts);
    return updatedContacts;
  };

  const updateContactNickname = async (contactUserId, nickname) => {
    if (!idToken) return;
    const res = await fetch(`/api/auth/contacts/${contactUserId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ nickname }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to update contact nickname');
    }

    const updatedContacts = await res.json();
    setContacts(updatedContacts);
    return updatedContacts;
  };

  const deleteContact = async (contactUserId) => {
    if (!idToken) return;
    const res = await fetch(`/api/auth/contacts/${contactUserId}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${idToken}`,
      },
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.message || 'Failed to delete contact');
    }

    const updatedContacts = await res.json();
    setContacts(updatedContacts);
    return updatedContacts;
  };

  // Sync token-authorized user details with MongoDB
  const syncWithMongo = async (token) => {
    try {
      const res = await fetch('/api/auth/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        throw new Error('Server synchronization failed');
      }

      const dbUser = await res.json();
      setMongoUser(dbUser);
      await fetchContacts(token);
      return dbUser;
    } catch (err) {
      console.error('[AuthContext] MongoDB Sync Error:', err.message);
      return null;
    }
  };

  // Sign up user with Email/Password
  const register = async (email, password, displayName, avatarUrl) => {
    setLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Seed avatar or use generated dicebear avatar if empty
      const finalAvatar = avatarUrl || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(email)}`;

      // Update Firebase profile info
      await updateProfile(user, {
        displayName: displayName || email.split('@')[0],
        photoURL: finalAvatar,
      });

      // Force refresh token
      const token = await user.getIdToken(true);
      setIdToken(token);

      // Sync and store in Mongo
      await syncWithMongo(token);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Send 6-digit verification code to email
  const sendOTP = async (email) => {
    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'Failed to send verification code');
      }
      return data;
    } catch (err) {
      throw err;
    }
  };

  // Verify code and log in
  const verifyOTPAndRegister = async (email, password, displayName, avatarUrl, otp) => {
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, displayName, avatarUrl, otp }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.message || 'OTP verification failed');
      }

      // Log in with the custom token generated by the server
      const userCredential = await signInWithCustomToken(auth, data.token);
      const token = await userCredential.user.getIdToken(true);
      setIdToken(token);
      await syncWithMongo(token);
      return data;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Login user with Email/Password
  const login = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const token = await userCredential.user.getIdToken(true);
      setIdToken(token);
      await syncWithMongo(token);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Google OAuth Popup login
  const googleSignIn = async () => {
    setLoading(true);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const token = await result.user.getIdToken(true);
      setIdToken(token);
      await syncWithMongo(token);
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Sign out user
  const logout = async () => {
    setLoading(true);
    try {
      // Set offline status in DB prior to signing out
      if (idToken) {
        await fetch('/api/auth/sync', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        }).catch(() => {}); // silent catch if offline or server is shutting down
      }

      await signOut(auth);
      setCurrentUser(null);
      setMongoUser(null);
      setIdToken(null);
      setContacts([]);
    } catch (error) {
      console.error('[AuthContext] Sign Out Error:', error.message);
    } finally {
      setLoading(false);
    }
  };

  // Update profile info (displayName, avatarUrl) on both MongoDB and Firebase
  const updateMongoProfile = async (displayName, avatarUrl, username) => {
    if (!idToken) throw new Error('Unauthenticated user profile update attempt');

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ displayName, avatarUrl, username }),
      });

      if (!res.ok) {
        throw new Error('Failed to update profile settings on backend');
      }

      const updatedUser = await res.json();
      setMongoUser(updatedUser);

      // Keep Firebase Web UI representation aligned
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, {
          displayName,
          photoURL: avatarUrl,
        });
      }

      return updatedUser;
    } catch (error) {
      console.error('[AuthContext] Update Profile Error:', error.message);
      throw error;
    }
  };

  // Hook into Firebase Auth State changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          setCurrentUser(user);
          const token = await user.getIdToken();
          setIdToken(token);
          await syncWithMongo(token);
        } else {
          setCurrentUser(null);
          setMongoUser(null);
          setIdToken(null);
          setContacts([]);
        }
      } catch (err) {
        console.error('[AuthContext] Auth State change handling error:', err.message);
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    mongoUser,
    idToken,
    loading,
    login,
    register,
    sendOTP,
    verifyOTPAndRegister,
    googleSignIn,
    logout,
    updateMongoProfile,
    contacts,
    contactsMap,
    saveContact,
    updateContactNickname,
    deleteContact,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
