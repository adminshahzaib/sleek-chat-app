/**
 * Uploads a File or Blob directly to Cloudinary using their Unsigned Upload API.
 * 
 * @param {File|Blob} file The file or audio blob to upload.
 * @param {string} resourceType The Cloudinary resource type ('auto', 'image', 'video', or 'raw').
 * @returns {Promise<{url: string, fileName: string, fileSize: number, type: string}>}
 */
export async function uploadToCloudinary(file, resourceType = 'auto') {
  const cloudName = 'fjublh8n';
  const uploadPreset = 'Chat-App-Preset';
  const folder = 'chat-media';

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('folder', folder);

  const url = `https://api.cloudinary.com/v1_1/${cloudName}/${resourceType}/upload`;

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error?.message || 'Failed to upload media to Cloudinary');
  }

  const data = await res.json();

  // Determine message type mapping
  let type = 'file';
  if (data.resource_type === 'image') {
    type = 'image';
  } else if (data.resource_type === 'video' || (file.type && file.type.startsWith('audio/'))) {
    type = 'audio';
  }

  return {
    url: data.secure_url,
    fileName: file.name || (type === 'audio' ? 'voice-note.mp3' : 'attachment'),
    fileSize: data.bytes || file.size || 0,
    type,
  };
}
