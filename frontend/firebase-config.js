// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// We added these imports for the Database (Firestore)
import { 
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
    onSnapshot, query, orderBy, serverTimestamp, writeBatch 
} from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBy-ZhH3pU2lWIiQDzyg1yKtzCw0SqAeHc",
  authDomain: "todo-tracker-fcd77.firebaseapp.com",
  projectId: "todo-tracker-fcd77",
  storageBucket: "todo-tracker-fcd77.firebasestorage.app",
  messagingSenderId: "774303221590",
  appId: "1:774303221590:web:03585d2edd54797fadb8f7",
  measurementId: "G-E3KNWCK9CM"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app); // Initialize Firestore Database

console.log('🔥 Firebase initialized successfully');

// --- HELPER FUNCTIONS BELOW ---

// Generate unique device ID for anonymous user
function getDeviceId() {
    let deviceId = localStorage.getItem('bunny_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('bunny_device_id', deviceId);
    }
    return deviceId;
}

// Get device-specific collection reference
function getTodoCollectionRef() {
    const deviceId = getDeviceId();
    return collection(db, 'devices', deviceId, 'todos');
}

// Firestore service functions
const firebaseService = {
    subscribeToTodos: (callback) => {
        const todosRef = getTodoCollectionRef();
        const q = query(todosRef, orderBy('createdAt', 'desc'));
        
        return onSnapshot(q, (snapshot) => {
            const todos = [];
            snapshot.forEach((doc) => {
                todos.push({ id: doc.id, ...doc.data() });
            });
            callback(todos);
        }, (error) => {
            console.error('Error subscribing:', error);
            callback([]);
        });
    },

    addTodo: async (todo) => {
        try {
            const todosRef = getTodoCollectionRef();
            const docRef = await addDoc(todosRef, {
                ...todo,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                deviceId: getDeviceId()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding:', error);
            return { success: false, message: error.message };
        }
    },

    updateTodo: async (id, updates) => {
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, 'devices', deviceId, 'todos', id);
            await updateDoc(docRef, { ...updates, updatedAt: serverTimestamp() });
            return { success: true };
        } catch (error) {
            console.error('Error updating:', error);
            return { success: false, message: error.message };
        }
    },

    deleteTodo: async (id) => {
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, 'devices', deviceId, 'todos', id);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error) {
            console.error('Error deleting:', error);
            return { success: false, message: error.message };
        }
    }
};

// Expose service to window so script.js can see it
window.firebaseService = firebaseService;
