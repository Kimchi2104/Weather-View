
// IMPORTANT: This file is configured with your Firebase project details.
import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app";
import { getDatabase, type Database } from "firebase/database";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBR-Bjxx8tw3kOrvDB5TCi_mQcX9bBci_w",
  authDomain: "weather-station-25716.firebaseapp.com",
  databaseURL: "https://weather-station-25716-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "weather-station-25716",
  storageBucket: "weather-station-25716.appspot.com",
  messagingSenderId: "913577606977",
  appId: "1:913577606977:web:d435002668462e212aabc0",
  measurementId: "G-H2JTR796JD"
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
