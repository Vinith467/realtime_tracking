
import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, addDoc, serverTimestamp } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyDEku6wwKA32KGQXuMRpMX6DD6lGMvKcEo",
    authDomain: "real-time-tracker-26064.firebaseapp.com",
    projectId: "real-time-tracker-26064",
    storageBucket: "real-time-tracker-26064.firebasestorage.app",
    messagingSenderId: "274390042154",
    appId: "1:274390042154:web:d2d3009b4424924f5ea553",
    measurementId: "G-Q6WNFFHGTE"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function testConnection() {
    console.log("Testing Firebase Connection...");
    try {
        console.log("1. Attempting to READ 'users' collection...");
        const snapshot = await getDocs(collection(db, "users"));
        console.log(`Sucess! Found ${snapshot.size} users.`);
    } catch (e) {
        console.error("READ FAILED:", e.code, e.message);
    }

    try {
        console.log("2. Attempting to WRITE to 'test_logs' collection...");
        await addDoc(collection(db, "test_logs"), {
            msg: "Hello from test script",
            timestamp: serverTimestamp()
        });
        console.log("Success! Write completed.");
    } catch (e) {
        console.error("WRITE FAILED:", e.code, e.message);
    }
}

testConnection();
