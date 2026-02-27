// src/firebase.js

// 🔥 1. Import dari NPM Module (Bukan link CDN lagi)
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { 
    initializeFirestore, 
    persistentLocalCache, 
    persistentMultipleTabManager 
} from "firebase/firestore";

// Konfigurasi Asli Bosku
const firebaseConfig = {
    apiKey: "AIzaSyAWi2L7bJewUmTeR_SwGM0sdwjFLdOisCs",
    authDomain: "kasir-128a2.firebaseapp.com",
    projectId: "kasir-128a2",
    storageBucket: "kasir-128a2.firebasestorage.app",
    messagingSenderId: "566922594063",
    appId: "1:566922594063:web:c251d0943a0e20ab51a07a",
    measurementId: "G-NM9MSXY677"
};

// Inisialisasi Aplikasi Induk
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// ==========================================================
// 🔥 2. AKTIFKAN BRANKAS OFFLINE (CARA RESMI FIREBASE V10)
// Menggantikan fungsi getFirestore biasa agar tetap bisa jualan offline
// ==========================================================
export const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// ==========================================================
// 🔥 3. Akun Admin Bayangan (Untuk tambah karyawan)
// ==========================================================
export const secondaryApp = initializeApp(firebaseConfig, "SecondaryApp");
export const secondaryAuth = getAuth(secondaryApp);
