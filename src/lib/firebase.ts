
// IMPORTANT: Replace with your actual Firebase project configuration!
// You can find this in your Firebase project settings.
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

const firebaseConfig = {
  // 1. Go to your Firebase project settings (gear icon).
  // 2. Under the "General" tab, find the "Your apps" section.
  // 3. Select your Web app (or create one if it doesn't exist).
  // 4. Copy the config values from the "SDK setup and configuration" (usually "Config" option)
  //    and paste them below, replacing ALL "YOUR_..." placeholders.

  apiKey: "YOUR_API_KEY", // Replace with your actual API key
  authDomain: "YOUR_AUTH_DOMAIN", // Replace with your actual auth domain
  
  // CRITICAL: THIS IS THE MOST LIKELY SOURCE OF THE RECURRING ERROR.
  // REPLACE "YOUR_DATABASE_URL_GOES_HERE_SEE_FIREBASE_CONSOLE_REALTIME_DATABASE_SECTION"
  // with your ACTUAL Realtime Database URL from the Firebase Console.
  // To find it: Firebase Console -> Build -> Realtime Database -> URL at the top.
  // It MUST start with https:// and look like:
  //   https://your-project-id.firebaseio.com
  // OR for newer projects/different regions:
  //   https://your-project-id-default-rtdb.region.firebasedatabase.app
  // ENSURE THIS IS THE CORRECT AND COMPLETE URL.
  databaseURL: "https://weather-station-25716-default-rtdb.asia-southeast1.firebasedatabase.app/", 
  
  projectId: "YOUR_PROJECT_ID", // Replace with your actual project ID
  storageBucket: "YOUR_STORAGE_BUCKET", // Replace with your actual storage bucket
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID", // Replace with your actual messaging sender ID
  appId: "YOUR_APP_ID" // Replace with your actual app ID
};

// Initialize Firebase
let app: FirebaseApp;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database: Database = getDatabase(app);

export { app, database };

// Note: If you haven't configured ALL your Firebase details above,
// especially the databaseURL, the application will not be able to connect.
// Please ensure all "YOUR_..." placeholders are correctly filled.
// The error you are seeing is specifically related to an invalid `databaseURL`.
