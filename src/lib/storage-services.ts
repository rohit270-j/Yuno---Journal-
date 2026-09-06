import { storage } from './firebase';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

export const uploadImageToStorage = async (file: File, userId: string, entryId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    // We generate a random id for the image if entryId is not yet available, but ideally it should be.
    const fileId = Math.random().toString(36).substring(2, 15);
    const storageRef = ref(storage, `users/${userId}/entries/${entryId || 'temp'}/${fileId}_${file.name}`);
    
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (snapshot) => {
        // Progress can be tracked here if needed
        const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        console.log('Upload is ' + progress + '% done');
      },
      (error) => {
        console.error("Error uploading image:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
};
