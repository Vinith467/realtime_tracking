import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

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

export { db };