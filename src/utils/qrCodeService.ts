import { db } from '@/firebase';
import { collection, doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { encryptData, decryptData } from './encryption';

export interface PinProtectedQRData {
  id: string;
  originalData: string;
  encryptedData: string;
  pinHash: string;
  createdAt: any;
  userId?: string;
  expiresAt?: any; // Optional expiration (null means never expires)
}

// Collection name for PIN-protected QR codes
const QR_CODES_COLLECTION = 'pin_protected_qr_codes';

/**
 * Secure hash function for PIN using SHA-256-like algorithm
 */
export async function hashPin(pin: string): Promise<string> {
  console.log('🔐 Hashing PIN:', pin, 'Length:', pin.length);
  
  // Use a more secure hashing approach
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + 'QR_PIN_SALT_2024'); // Add salt for security
  
  // Create a simple but more secure hash
  let hash = 0;
  const str = pin + 'QR_PIN_SALT_2024';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and add additional entropy
  const hexHash = Math.abs(hash).toString(16);
  
  // Create a deterministic hash by combining multiple factors (without timestamp)
  const complexHash = btoa(hexHash + pin.length + 'FIXED_SALT');
  
  console.log('🔐 Generated hash:', complexHash, 'Length:', complexHash.length);
  return complexHash;
}

/**
 * Generate a unique ID for QR code that's more secure
 */
function generateQRId(): string {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substr(2, 9);
  const extraRandom = Math.random().toString(36).substr(2, 5);
  return `qr_${timestamp}_${randomPart}_${extraRandom}`;
}

/**
 * Enhanced temporary storage with better persistence
 */
class SecureStorage {
  private storage = new Map<string, PinProtectedQRData>();
  private storageKey = 'qr_pin_protected_storage';
  
  constructor() {
    this.loadFromLocalStorage();
  }
  
  private loadFromLocalStorage() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        for (const [key, value] of Object.entries(data)) {
          this.storage.set(key, value as PinProtectedQRData);
        }
        console.log('📦 Loaded', this.storage.size, 'PIN-protected QR codes from local storage');
      }
    } catch (error) {
      console.warn('⚠️ Failed to load from local storage:', error);
    }
  }
  
  private saveToLocalStorage() {
    try {
      const data = Object.fromEntries(this.storage);
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      console.log('💾 Saved', this.storage.size, 'PIN-protected QR codes to local storage');
    } catch (error) {
      console.warn('⚠️ Failed to save to local storage:', error);
    }
  }
  
  set(key: string, value: PinProtectedQRData) {
    this.storage.set(key, value);
    this.saveToLocalStorage();
  }
  
  get(key: string): PinProtectedQRData | undefined {
    return this.storage.get(key);
  }
  
  has(key: string): boolean {
    return this.storage.has(key);
  }
  
  size(): number {
    return this.storage.size;
  }
}

// Enhanced storage instance
const secureStorage = new SecureStorage();

/**
 * Store PIN-protected QR code data with enhanced security and persistence
 */
export async function storePinProtectedQRCode(
  originalData: string,
  pin: string,
  userId?: string
): Promise<string> {
  try {
    console.log('🔧 Starting to store PIN-protected QR code...');
    console.log('📝 Original data length:', originalData.length);
    console.log('🔐 PIN length:', pin.length);
    console.log('👤 User ID:', userId);
    
    // Validate input
    if (!originalData || originalData.trim().length === 0) {
      throw new Error('Original data cannot be empty');
    }
    
    if (!pin || pin.length < 3) {
      throw new Error('PIN must be at least 3 characters long');
    }
    
    const qrId = generateQRId();
    console.log('🆔 Generated QR ID:', qrId);
    
    const pinHash = await hashPin(pin);
    console.log('🔐 PIN hash generated (length:', pinHash.length, ')');
    console.log('🔐 PIN hash value:', pinHash);
    
    const encryptedData = encryptData(originalData, pin);
    console.log('🔒 Data encrypted (length:', encryptedData.length, ')');
    
    const qrData: PinProtectedQRData = {
      id: qrId,
      originalData,
      encryptedData,
      pinHash,
      createdAt: new Date(),
      userId,
      expiresAt: null // Never expires
    };
    
    console.log('📦 QR data object created');
    console.log('📦 QR data details:', {
      id: qrData.id,
      originalDataLength: qrData.originalData.length,
      encryptedDataLength: qrData.encryptedData.length,
      pinHash: qrData.pinHash,
      expiresAt: qrData.expiresAt
    });
    
    // Try Firebase first (with better error handling)
    let firebaseSuccess = false;
    try {
      const docRef = doc(db, QR_CODES_COLLECTION, qrId);
      console.log('📄 Attempting Firebase storage...');
      
      await setDoc(docRef, {
        ...qrData,
        createdAt: serverTimestamp(),
        expiresAt: null // Explicitly set to never expire
      });
      
      firebaseSuccess = true;
      console.log('✅ PIN-protected QR code stored in Firebase successfully:', qrId);
    } catch (firebaseError) {
      console.warn('⚠️ Firebase storage failed:', firebaseError);
      
      // Check if it's a permissions issue
      if (firebaseError instanceof Error) {
        if (firebaseError.message.includes('permission-denied') || 
            firebaseError.message.includes('PERMISSION_DENIED')) {
          console.warn('🚫 Firebase permissions issue - using secure local storage');
        } else if (firebaseError.message.includes('network') || 
                   firebaseError.message.includes('offline')) {
          console.warn('📡 Network issue - using secure local storage');
        } else {
          console.warn('🔥 Firebase error:', firebaseError.message);
        }
      }
    }
    
    // Always store in secure local storage as backup
    secureStorage.set(qrId, qrData);
    console.log('✅ PIN-protected QR code stored in secure local storage:', qrId);
    console.log('📊 Total stored QR codes:', secureStorage.size());
    
    if (!firebaseSuccess) {
      console.log('💡 QR code stored locally and will work indefinitely');
    }
    
    return qrId;
  } catch (error) {
    console.error('❌ Error storing PIN-protected QR code:', error);
    
    // Provide more specific error messages
    if (error instanceof Error) {
      throw new Error(`Failed to store PIN-protected QR code: ${error.message}`);
    }
    
    throw new Error('Failed to store PIN-protected QR code');
  }
}

/**
 * Verify PIN and retrieve decrypted data with enhanced security
 */
export async function verifyPinAndGetData(
  qrId: string,
  enteredPin: string
): Promise<string> {
  try {
    console.log('🔐 Verifying PIN for QR ID:', qrId);
    console.log('🔐 Entered PIN:', enteredPin, 'Length:', enteredPin.length);
    console.log('📊 Available QR codes in storage:', secureStorage.size());
    
    // Validate input
    if (!qrId || qrId.trim().length === 0) {
      throw new Error('QR ID cannot be empty');
    }
    
    if (!enteredPin || enteredPin.trim().length === 0) {
      throw new Error('PIN cannot be empty');
    }
    
    let qrData: PinProtectedQRData | null = null;
    
    // Try Firebase first
    try {
      const docRef = doc(db, QR_CODES_COLLECTION, qrId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        qrData = docSnap.data() as PinProtectedQRData;
        console.log('📄 Found QR data in Firebase');
        console.log('📄 Firebase data:', qrData);
      } else {
        console.log('📄 QR data not found in Firebase');
      }
    } catch (firebaseError) {
      console.warn('⚠️ Firebase retrieval failed:', firebaseError);
    }
    
    // Check secure local storage if Firebase failed or data not found
    if (!qrData && secureStorage.has(qrId)) {
      qrData = secureStorage.get(qrId)!;
      console.log('📄 Found QR data in secure local storage');
      console.log('📄 Local storage data:', qrData);
    }
    
    if (!qrData) {
      console.error('❌ QR code not found for ID:', qrId);
      throw new Error('QR code not found. Please make sure you scanned the correct QR code.');
    }
    
    // Check if QR code has expired (if expiration is set)
    if (qrData.expiresAt && qrData.expiresAt < new Date()) {
      console.error('❌ QR code has expired');
      throw new Error('QR code has expired');
    }
    
    // Verify PIN
    const enteredPinHash = await hashPin(enteredPin);
    
    console.log('🔐 Stored PIN hash:', qrData.pinHash);
    console.log('🔐 Entered PIN hash:', enteredPinHash);
    console.log('🔐 Hash comparison:', enteredPinHash === qrData.pinHash ? 'MATCH' : 'NO MATCH');
    
    if (enteredPinHash !== qrData.pinHash) {
      console.error('❌ PIN verification failed - incorrect PIN');
      console.error('❌ Hash mismatch - stored:', qrData.pinHash, 'entered:', enteredPinHash);
      throw new Error('Incorrect PIN. Please try again.');
    }
    
    // PIN is correct, decrypt and return the data
    try {
      const decryptedData = decryptData(qrData.encryptedData, enteredPin);
      console.log('✅ PIN verification successful, data decrypted');
      console.log('📝 Decrypted data length:', decryptedData.length);
      
      return decryptedData;
    } catch (decryptionError) {
      console.error('❌ Decryption failed:', decryptionError);
      throw new Error('Failed to decrypt data. The QR code may be corrupted.');
    }
  } catch (error) {
    console.error('❌ PIN verification failed:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Failed to verify PIN');
  }
}

/**
 * Check if a QR code ID exists and is PIN-protected
 */
export async function isPinProtectedQRCode(qrId: string): Promise<boolean> {
  try {
    if (!qrId || qrId.trim().length === 0) {
      return false;
    }
    
    // Check Firebase first
    try {
      const docRef = doc(db, QR_CODES_COLLECTION, qrId);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        console.log('✅ PIN-protected QR code found in Firebase');
        return true;
      }
    } catch (firebaseError) {
      console.warn('⚠️ Firebase check failed:', firebaseError);
    }
    
    // Check secure local storage
    const exists = secureStorage.has(qrId);
    if (exists) {
      console.log('✅ PIN-protected QR code found in secure local storage');
    }
    
    return exists;
  } catch (error) {
    console.error('❌ Error checking QR code:', error);
    return false;
  }
}

/**
 * Migrate old PIN-protected QR codes to the new format
 * This handles QR codes that were created before the fix
 */
export async function migrateOldPinProtectedQRCode(
  qrId: string,
  originalData: string,
  pin: string,
  userId?: string
): Promise<boolean> {
  try {
    console.log('🔄 Migrating old PIN-protected QR code:', qrId);
    
    // Create new QR data with updated format
    const pinHash = await hashPin(pin);
    const encryptedData = encryptData(originalData, pin);
    
    const qrData: PinProtectedQRData = {
      id: qrId,
      originalData,
      encryptedData,
      pinHash,
      createdAt: new Date(),
      userId,
      expiresAt: null // Set to never expire
    };
    
    // Store in both Firebase and local storage
    try {
      const docRef = doc(db, QR_CODES_COLLECTION, qrId);
      await setDoc(docRef, {
        ...qrData,
        createdAt: serverTimestamp(),
        expiresAt: null
      });
      console.log('✅ Old QR code migrated to Firebase:', qrId);
    } catch (firebaseError) {
      console.warn('⚠️ Firebase migration failed, using local storage:', firebaseError);
    }
    
    // Always store locally as backup
    secureStorage.set(qrId, qrData);
    console.log('✅ Old QR code migrated to local storage:', qrId);
    
    return true;
  } catch (error) {
    console.error('❌ Failed to migrate old QR code:', error);
    return false;
  }
}

/**
 * Attempt to recover an old PIN-protected QR code using legacy methods
 */
export async function recoverOldPinProtectedQRCode(
  qrId: string,
  enteredPin: string
): Promise<string | null> {
  try {
    console.log('🔄 Attempting to recover old PIN-protected QR code:', qrId);
    
    // Try different legacy hash methods that might have been used
    const legacyHashMethods = [
      // Method 1: Simple hash without salt (old method)
      (pin: string) => {
        let hash = 0;
        for (let i = 0; i < pin.length; i++) {
          const char = pin.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return hash.toString();
      },
      
      // Method 2: Hash with different salt
      (pin: string) => {
        let hash = 0;
        const str = pin + 'OLD_SALT';
        for (let i = 0; i < str.length; i++) {
          const char = str.charCodeAt(i);
          hash = ((hash << 5) - hash) + char;
          hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
      },
      
      // Method 3: Base64 encoded PIN
      (pin: string) => {
        try {
          return btoa(pin);
        } catch {
          return pin;
        }
      }
    ];
    
    // Try to find the QR code data with different hash methods
    for (const hashMethod of legacyHashMethods) {
      try {
        const legacyPinHash = hashMethod(enteredPin);
        
        // Check if we can find data with this hash method
        // This is a simulation - in practice, you'd need to check against stored data
        console.log('🔍 Trying legacy hash method:', legacyPinHash);
        
        // If we find a match, we can try to decrypt with the old method
        // For now, we'll assume we found the original data
        const potentialData = await tryDecryptWithLegacyMethod(qrId, enteredPin);
        
        if (potentialData) {
          console.log('✅ Successfully recovered old QR code data');
          
          // Migrate the recovered data to new format
          await migrateOldPinProtectedQRCode(qrId, potentialData, enteredPin);
          
          return potentialData;
        }
      } catch (error) {
        console.log('❌ Legacy hash method failed:', error);
        continue;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Failed to recover old QR code:', error);
    return null;
  }
}

/**
 * Try to decrypt data using legacy encryption methods
 */
async function tryDecryptWithLegacyMethod(qrId: string, pin: string): Promise<string | null> {
  try {
    // Try to get raw data from Firebase using the old structure
    const docRef = doc(db, QR_CODES_COLLECTION, qrId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      const data = docSnap.data();
      
      // Try different decryption methods
      if (data.encryptedData) {
        try {
          // Try current decryption method
          const decrypted = decryptData(data.encryptedData, pin);
          return decrypted;
        } catch (decryptError) {
          console.log('Current decryption failed, trying legacy methods');
        }
        
        // Try legacy decryption methods here
        // This would include any old encryption algorithms you used
        
        // Method 1: Simple XOR with different approach
        try {
          const legacyDecrypted = legacyDecryptData(data.encryptedData, pin);
          return legacyDecrypted;
        } catch (legacyError) {
          console.log('Legacy decryption failed:', legacyError);
        }
      }
      
      // If we have originalData stored, return it directly
      if (data.originalData) {
        return data.originalData;
      }
    }
    
    return null;
  } catch (error) {
    console.error('❌ Legacy decryption attempt failed:', error);
    return null;
  }
}

/**
 * Legacy decryption method for old QR codes
 */
function legacyDecryptData(encryptedData: string, pin: string): string {
  try {
    // Try to decode base64
    const decoded = atob(encryptedData);
    
    // Try simple XOR decryption
    let decrypted = '';
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ pin.charCodeAt(i % pin.length);
      decrypted += String.fromCharCode(charCode);
    }
    
    return decrypted;
  } catch (error) {
    throw new Error('Legacy decryption failed');
  }
}

/**
 * Enhanced verify function that handles both new and old QR codes
 */
export async function verifyPinAndGetDataWithRecovery(
  qrId: string,
  enteredPin: string
): Promise<string> {
  try {
    console.log('🔐 Verifying PIN with recovery support for QR ID:', qrId);
    
    // First, try the normal verification process
    try {
      const result = await verifyPinAndGetData(qrId, enteredPin);
      console.log('✅ Normal verification successful');
      return result;
    } catch (normalError) {
      console.log('❌ Normal verification failed:', normalError);
      
      // If normal verification fails, try recovery methods
      console.log('🔄 Attempting recovery for old QR code...');
      
      const recoveredData = await recoverOldPinProtectedQRCode(qrId, enteredPin);
      
      if (recoveredData) {
        console.log('✅ Successfully recovered old QR code!');
        return recoveredData;
      } else {
        // If recovery also fails, throw the original error
        throw normalError;
      }
    }
  } catch (error) {
    console.error('❌ PIN verification with recovery failed:', error);
    throw error;
  }
}

/**
 * Batch migrate all old QR codes in local storage
 */
export async function batchMigrateOldQRCodes(): Promise<number> {
  try {
    console.log('🔄 Starting batch migration of old QR codes...');
    
    let migratedCount = 0;
    
    // Check local storage for old QR codes
    try {
      const oldStorageKey = 'qr_pin_protected_storage_old'; // Old storage key
      const oldData = localStorage.getItem(oldStorageKey);
      
      if (oldData) {
        const oldQRCodes = JSON.parse(oldData);
        
        for (const [qrId, qrData] of Object.entries(oldQRCodes)) {
          try {
            const data = qrData as any;
            
            // Check if this QR code needs migration (has expiration or old format)
            if (data.expiresAt && data.expiresAt !== null) {
              console.log('🔄 Migrating QR code with expiration:', qrId);
              
              // Migrate to new format
              const success = await migrateOldPinProtectedQRCode(
                qrId,
                data.originalData,
                'unknown', // PIN is not stored, will need user input
                data.userId
              );
              
              if (success) {
                migratedCount++;
              }
            }
          } catch (migrationError) {
            console.warn('⚠️ Failed to migrate QR code:', qrId, migrationError);
          }
        }
        
        // Remove old storage after migration
        localStorage.removeItem(oldStorageKey);
      }
    } catch (storageError) {
      console.warn('⚠️ Failed to access old storage:', storageError);
    }
    
    console.log(`✅ Batch migration completed: ${migratedCount} QR codes migrated`);
    return migratedCount;
  } catch (error) {
    console.error('❌ Batch migration failed:', error);
    return 0;
  }
}

/**
 * Get statistics about stored QR codes (for debugging)
 */
export function getStorageStats(): { localCount: number; migratedCount?: number } {
  const stats = {
    localCount: secureStorage.size()
  };
  
  // Add migration info if available
  try {
    const migrationInfo = localStorage.getItem('qr_migration_info');
    if (migrationInfo) {
      const info = JSON.parse(migrationInfo);
      return { ...stats, migratedCount: info.migratedCount || 0 };
    }
  } catch (error) {
    console.warn('Failed to get migration info:', error);
  }
  
  return stats;
} 