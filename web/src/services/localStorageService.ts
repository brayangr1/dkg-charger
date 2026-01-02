/**
 * Local storage service for web
 * Replaces AsyncStorage from React Native
 */

export class LocalStorageService {
    /**
     * Store a value in localStorage
     */
    static async setItem(key: string, value: string): Promise<void> {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.error(`Error storing ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get a value from localStorage
     */
    static async getItem(key: string): Promise<string | null> {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.error(`Error retrieving ${key}:`, error);
            return null;
        }
    }

    /**
     * Remove a value from localStorage
     */
    static async removeItem(key: string): Promise<void> {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.error(`Error removing ${key}:`, error);
            throw error;
        }
    }

    /**
     * Clear all localStorage
     */
    static async clear(): Promise<void> {
        try {
            localStorage.clear();
        } catch (error) {
            console.error('Error clearing localStorage:', error);
            throw error;
        }
    }

    /**
     * Get all keys from localStorage
     */
    static async getAllKeys(): Promise<string[]> {
        try {
            return Object.keys(localStorage);
        } catch (error) {
            console.error('Error getting all keys:', error);
            return [];
        }
    }

    /**
     * Store an object as JSON
     */
    static async setObject(key: string, value: any): Promise<void> {
        try {
            const jsonValue = JSON.stringify(value);
            await this.setItem(key, jsonValue);
        } catch (error) {
            console.error(`Error storing object ${key}:`, error);
            throw error;
        }
    }

    /**
     * Get an object from JSON
     */
    static async getObject<T>(key: string): Promise<T | null> {
        try {
            const jsonValue = await this.getItem(key);
            return jsonValue != null ? JSON.parse(jsonValue) : null;
        } catch (error) {
            console.error(`Error retrieving object ${key}:`, error);
            return null;
        }
    }

    /**
     * Check if a key exists
     */
    static async hasItem(key: string): Promise<boolean> {
        try {
            const value = await this.getItem(key);
            return value !== null;
        } catch (error) {
            console.error(`Error checking if ${key} exists:`, error);
            return false;
        }
    }
}

export default LocalStorageService;
