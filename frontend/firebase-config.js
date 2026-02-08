[file name]: firebase-config.js
[file content begin]
// Firebase Modular SDK v9
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { 
    getFirestore, 
    collection, 
    doc, 
    addDoc, 
    updateDoc, 
    deleteDoc, 
    onSnapshot, 
    query, 
    orderBy, 
    serverTimestamp,
    getDocs 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

console.log("🚀 Loading Firebase configuration...");

// Your Firebase Config (unchanged - this is correct)
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
console.log("📡 Initializing Firebase app...");
let app;
let db;
let isFirebaseReady = false;

try {
    app = initializeApp(firebaseConfig);
    console.log("✅ Firebase app initialized");
    
    db = getFirestore(app);
    console.log("✅ Firestore database initialized");
    isFirebaseReady = true;
} catch (error) {
    console.error("❌ Firebase initialization failed:", error);
    isFirebaseReady = false;
}

// Generate device ID
function getDeviceId() {
    let deviceId = localStorage.getItem('bunny_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('bunny_device_id', deviceId);
        console.log("🆔 Created new device ID:", deviceId);
    } else {
        console.log("🆔 Using existing device ID:", deviceId);
    }
    return deviceId;
}

// Get collection reference
function getTodoCollection() {
    if (!isFirebaseReady) {
        console.warn("⚠️ Firebase not ready, using localStorage");
        return null;
    }
    
    const deviceId = getDeviceId();
    console.log("📂 Accessing collection for device:", deviceId);
    return collection(doc(db, 'devices', deviceId), 'todos');
}

// Simple notification function for this file
function showNotification(message, type = 'info') {
    console.log(`📢 ${type.toUpperCase()}: ${message}`);
    // Update sync status in UI if possible
    updateSyncStatusUI(type === 'error' ? false : true, type === 'local');
}

// Update sync status in UI
function updateSyncStatusUI(isSynced = true, isLocal = false) {
    const syncElement = document.getElementById('sync-status');
    if (syncElement) {
        if (isLocal) {
            syncElement.innerHTML = '<i class="fas fa-laptop"></i> Local Mode';
            syncElement.className = 'sync-indicator local';
        } else if (isSynced) {
            syncElement.innerHTML = '<i class="fas fa-cloud"></i> Synced';
            syncElement.className = 'sync-indicator synced';
        } else {
            syncElement.innerHTML = '<i class="fas fa-cloud-slash"></i> Syncing...';
            syncElement.className = 'sync-indicator syncing';
        }
        console.log("🔄 Sync status updated:", syncElement.textContent);
    }
}

// Firestore Service
const firebaseService = {
    // Check if Firebase is ready
    isReady: () => isFirebaseReady,
    
    // Subscribe to todos
    subscribeToTodos: (callback) => {
        console.log("👂 Starting Firestore listener...");
        
        if (!isFirebaseReady) {
            console.warn("⚠️ Firebase not available, using localStorage");
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            callback(localTodos);
            updateSyncStatusUI(true, true);
            return () => {}; // Return empty unsubscribe function
        }
        
        try {
            const todosCollection = getTodoCollection();
            if (!todosCollection) {
                throw new Error("Collection not available");
            }
            
            const q = query(todosCollection, orderBy('createdAt', 'desc'));
            console.log("🔍 Query created, setting up listener...");
            
            return onSnapshot(q, 
                (snapshot) => {
                    console.log("📨 Firestore update received, docs:", snapshot.size);
                    const todos = [];
                    snapshot.forEach((doc) => {
                        todos.push({
                            id: doc.id,
                            ...doc.data()
                        });
                    });
                    callback(todos);
                    updateSyncStatusUI(true, false);
                },
                (error) => {
                    console.error("❌ Firestore listener error:", error);
                    showNotification('Connection error. Using local storage.', 'warning');
                    const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
                    callback(localTodos);
                    updateSyncStatusUI(true, true);
                }
            );
        } catch (error) {
            console.error("❌ Error setting up listener:", error);
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            callback(localTodos);
            updateSyncStatusUI(true, true);
            return () => {};
        }
    },

    // Add todo
    addTodo: async (todo) => {
        console.log("➕ Adding todo:", todo.task);
        
        if (!isFirebaseReady) {
            console.warn("⚠️ Adding to localStorage (Firebase not available)");
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random(),
                createdAt: new Date().toISOString()
            };
            localTodos.unshift(newTodo);
            localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            return { success: true, id: newTodo.id, isLocal: true };
        }
        
        try {
            const todosCollection = getTodoCollection();
            const docRef = await addDoc(todosCollection, {
                ...todo,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                deviceId: getDeviceId()
            });
            console.log("✅ Todo added to Firestore, ID:", docRef.id);
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error("❌ Error adding to Firestore:", error);
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random(),
                createdAt: new Date().toISOString()
            };
            localTodos.unshift(newTodo);
            localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            return { success: true, id: newTodo.id, isLocal: true };
        }
    },

    // Update todo
    updateTodo: async (todoId, updates) => {
        console.log("✏️ Updating todo:", todoId, updates);
        
        if (!isFirebaseReady) {
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const index = localTodos.findIndex(t => t.id === todoId);
            if (index !== -1) {
                localTodos[index] = { ...localTodos[index], ...updates };
                localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            }
            return { success: true, isLocal: true };
        }
        
        try {
            const todosCollection = getTodoCollection();
            const todoDoc = doc(todosCollection, todoId);
            await updateDoc(todoDoc, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error("❌ Error updating in Firestore:", error);
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const index = localTodos.findIndex(t => t.id === todoId);
            if (index !== -1) {
                localTodos[index] = { ...localTodos[index], ...updates };
                localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            }
            return { success: true, isLocal: true };
        }
    },

    // Delete todo
    deleteTodo: async (todoId) => {
        console.log("🗑️ Deleting todo:", todoId);
        
        if (!isFirebaseReady) {
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const filteredTodos = localTodos.filter(t => t.id !== todoId);
            localStorage.setItem('bunny-todos', JSON.stringify(filteredTodos));
            return { success: true, isLocal: true };
        }
        
        try {
            const todosCollection = getTodoCollection();
            const todoDoc = doc(todosCollection, todoId);
            await deleteDoc(todoDoc);
            return { success: true };
        } catch (error) {
            console.error("❌ Error deleting from Firestore:", error);
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const filteredTodos = localTodos.filter(t => t.id !== todoId);
            localStorage.setItem('bunny-todos', JSON.stringify(filteredTodos));
            return { success: true, isLocal: true };
        }
    }
};

// Initialize
console.log("🎯 Firebase service initialized, ready:", isFirebaseReady);
updateSyncStatusUI(isFirebaseReady, !isFirebaseReady);

// Make available globally
window.firebaseService = firebaseService;
window.updateSyncStatusUI = updateSyncStatusUI;

console.log("🔥 Firebase configuration loaded successfully!");
[file content end]
