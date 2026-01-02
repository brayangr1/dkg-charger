import { initializeApp, FirebaseApp } from 'firebase/app';
import {
    getAuth,
    Auth,
    GoogleAuthProvider,
    signInWithPopup,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    User
} from 'firebase/auth';
import { FIREBASE_CONFIG } from '@constants/services.config';

let firebaseApp: FirebaseApp;
let auth: Auth;

// Initialize Firebase
export const initializeFirebase = () => {
    if (!firebaseApp) {
        firebaseApp = initializeApp(FIREBASE_CONFIG as any);
        auth = getAuth(firebaseApp);
    }
    return { app: firebaseApp, auth };
};

// Get Firebase Auth instance
export const getFirebaseAuth = (): Auth => {
    if (!auth) {
        initializeFirebase();
    }
    return auth;
};

// Google Sign In
export const signInWithGoogle = async (): Promise<User> => {
    const auth = getFirebaseAuth();
    const provider = new GoogleAuthProvider();

    try {
        const result = await signInWithPopup(auth, provider);
        return result.user;
    } catch (error) {
        console.error('Error signing in with Google:', error);
        throw error;
    }
};

// Email/Password Sign In
export const signInWithEmail = async (email: string, password: string): Promise<User> => {
    const auth = getFirebaseAuth();

    try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error('Error signing in with email:', error);
        throw error;
    }
};

// Register with Email/Password
export const registerWithEmail = async (email: string, password: string): Promise<User> => {
    const auth = getFirebaseAuth();

    try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        return result.user;
    } catch (error) {
        console.error('Error registering with email:', error);
        throw error;
    }
};

// Sign Out
export const signOutUser = async (): Promise<void> => {
    const auth = getFirebaseAuth();

    try {
        await signOut(auth);
    } catch (error) {
        console.error('Error signing out:', error);
        throw error;
    }
};

// Reset Password
export const resetPassword = async (email: string): Promise<void> => {
    const auth = getFirebaseAuth();

    try {
        await sendPasswordResetEmail(auth, email);
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
};

// Get current user
export const getCurrentUser = (): User | null => {
    const auth = getFirebaseAuth();
    return auth.currentUser;
};

// Export Firebase instances
export { firebaseApp, auth };
export { FIREBASE_CONFIG };
