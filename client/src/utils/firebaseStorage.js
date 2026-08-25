import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '../config/firebase.js';

/**
 * Uploads a file or audio Blob to Firebase Cloud Storage with progress tracking.
 * 
 * @param {File|Blob} file The file or audio blob to upload.
 * @param {string} pathPrefix The storage folder path prefix (e.g. 'attachments', 'voice-notes').
 * @param {function} [onProgress] Callback returning upload percentage (0-100).
 * @returns {Promise<{ downloadUrl: string, fileName: string, fileSize: number }>} Resolves with downloadURL, fileName, and fileSize.
 */
export const uploadFileToStorage = (file, pathPrefix = 'attachments', onProgress = null) => {
  return new Promise((resolve, reject) => {
    // Generate a unique filename: timestamp + original name (or default for voice blobs)
    const originalName = file.name || `voice_${Date.now()}.webm`;
    const cleanName = originalName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniqueName = `${Date.now()}_${cleanName}`;
    
    const storageRef = ref(storage, `${pathPrefix}/${uniqueName}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        if (onProgress) {
          onProgress(Math.round(progress));
        }
      },
      (error) => {
        console.error('[Firebase Storage] Upload failed:', error.message);
        reject(error);
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);
          resolve({
            downloadUrl,
            fileName: originalName,
            fileSize: file.size,
          });
        } catch (err) {
          console.error('[Firebase Storage] Failed to retrieve download URL:', err.message);
          reject(err);
        }
      }
    );
  });
};
