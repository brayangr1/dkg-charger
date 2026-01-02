
import fs from 'fs';
import path from 'path';
import admin from 'firebase-admin';
const serviceAccountPath = path.resolve(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
if (!admin.apps.length) {
admin.initializeApp({
credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`
});
}
export const firebaseAdmin = admin;