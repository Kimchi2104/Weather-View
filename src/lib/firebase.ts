// TODO: Add your Firebase SDK configuration and initialization code here.
// This file is a placeholder. You should replace it with your actual
// Firebase setup.

// Example (replace with your actual config):
/*
import { initializeApp, getApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_AUTH_DOMAIN",
  databaseURL: "YOUR_DATABASE_URL", // Crucial for Realtime Database
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_STORAGE_BUCKET",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const database = getDatabase(app);

export { app, database };
*/

// For now, we'll export dummy objects so the app can compile.
// Replace these with your actual Firebase exports.
export const app = {};
export const database = {};

// You will also need functions to fetch data from Firebase Realtime Database.
// For example:
// export const getRealtimeWeatherData = (callback) => {
//   const weatherRef = ref(database, 'weather/realtime/station1'); // Adjust path
//   onValue(weatherRef, (snapshot) => {
//     const data = snapshot.val();
//     callback(data);
//   });
// };

// export const getHistoricalWeatherData = async (startDate, endDate) => {
//   const weatherRef = query(
//     ref(database, 'weather/historical/station1'), // Adjust path
//     orderByChild('timestamp'),
//     startAt(startDate.getTime()),
//     endAt(endDate.getTime())
//   );
//   const snapshot = await get(weatherRef);
//   return snapshot.val();
// };

console.warn(
  "Firebase is not configured. Please update src/lib/firebase.ts with your Firebase project details."
);
