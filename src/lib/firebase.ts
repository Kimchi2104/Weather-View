
// IMPORTANT: This file is configured with your Firebase project details.
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC5ln8OWl3oJCC7ZBFO3kXidxucmNEAHC8",
  authDomain: "weatherview-88av2.firebaseapp.com",
  projectId: "weatherview-88av2",
  storageBucket: "weatherview-88av2.firebasestorage.app",
  messagingSenderId: "323164095317",
  appId: "1:323164095317:web:e3d2ce70557914cccc65dc",
  databaseURL: "https://weather-station-25716-default-rtdb.asia-southeast1.firebasedatabase.app/",
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
