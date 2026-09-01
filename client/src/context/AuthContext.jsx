import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  signInWithPopup,
  updateProfile,
  onAuthStateChanged,
  sendEmailVerification
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
  const [awaitingVerification, setAwaitingVerification] = useState(false);
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

  // Sign up user with Email/Password and send email verification
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

      // Send email verification with redirect back to app origin
      const actionCodeSettings = {
        url: window.location.origin,
        handleCodeInApp: true,
      };
      await sendEmailVerification(user, actionCodeSettings);

      // Enter verification waiting state for manual registration
      setAwaitingVerification(true);
      setCurrentUser(user);
      setIdToken(null);
      setMongoUser(null);
      return user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Login user with Email/Password (valid credentials log in directly without requiring email verification)
  const login = async (email, password) => {
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Clear registration verification waiting state on successful login
      setAwaitingVerification(false);

      const token = await user.getIdToken(true);
      setIdToken(token);
      await syncWithMongo(token);
      return user;
    } catch (error) {
      setLoading(false);
      throw error;
    }
  };

  // Resend verification email to current user
  const resendVerificationEmail = async () => {
    if (!auth.currentUser) {
      throw new Error('No user is currently signed in to resend verification email.');
    }
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: true,
    };
    await sendEmailVerification(auth.currentUser, actionCodeSettings);
  };

  // Reload user and verify email status
  const checkEmailVerified = async () => {
    if (!auth.currentUser) return false;
    await auth.currentUser.reload();
    const refreshedUser = auth.currentUser;
    if (refreshedUser.emailVerified) {
      setAwaitingVerification(false);
      setCurrentUser(refreshedUser);
      const token = await refreshedUser.getIdToken(true);
      setIdToken(token);
      await syncWithMongo(token);
      return true;
    }
    return false;
  };

  // Google OAuth Popup login
  const googleSignIn = async () => {
    setLoading(true);
    try {
      setAwaitingVerification(false);
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
      setAwaitingVerification(false);
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
          if (!awaitingVerification) {
            const token = await user.getIdToken();
            setIdToken(token);
            await syncWithMongo(token);
          }
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
  }, [awaitingVerification]);

  const value = {
    currentUser,
    awaitingVerification,
    mongoUser,
    idToken,
    loading,
    login,
    register,
    googleSignIn,
    logout,
    updateMongoProfile,
    resendVerificationEmail,
    checkEmailVerified,
    contacts,
    contactsMap,
    saveContact,
    updateContactNickname,
    deleteContact,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
