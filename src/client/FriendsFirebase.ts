import { initializeApp } from "firebase/app";
import { getAuth, connectAuthEmulator } from "firebase/auth";
import { getDatabase, connectDatabaseEmulator } from "firebase/database";

// Public web configuration. Database rules and Firebase Auth protect data.
export const firebaseApp = initializeApp({
  projectId: "ag-arcade-frontier",
  appId: "1:12965730403:web:3fe3e7f0e5cc57a5744056",
  apiKey: "AIzaSyACwlch1F6_E13wno3kAyEwxanpbWnpcqE",
  authDomain: "ag-arcade-frontier.firebaseapp.com",
  databaseURL: "https://ag-arcade-frontier-default-rtdb.firebaseio.com",
});
export const friendsAuth = getAuth(firebaseApp);
export const friendsDB = getDatabase(firebaseApp);
// Explicit local test mode; a deployed origin can never select emulators.
if (
  ["localhost", "127.0.0.1"].includes(location.hostname) &&
  new URLSearchParams(location.search).has("firebaseEmulator")
) {
  connectAuthEmulator(friendsAuth, "http://127.0.0.1:9099", {
    disableWarnings: true,
  });
  connectDatabaseEmulator(friendsDB, "127.0.0.1", 9000);
}
