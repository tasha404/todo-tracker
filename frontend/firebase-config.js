[file name]: firebase-config.js
[file content begin]
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp, writeBatch } from "firebase/firestore";

// Firebase Configuration
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
const db = getFirestore(app);

console.log('🔥 Firebase initialized successfully');

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
function getTodoCollection() {
    const deviceId = getDeviceId();
    return collection(doc(db, 'devices', deviceId), 'todos');
}

// Firestore service functions
const firebaseService = {
    // Subscribe to todos with real-time updates
    subscribeToTodos: (callback) => {
        const todosCollection = getTodoCollection();
        const q = query(todosCollection, orderBy('createdAt', 'desc'));
        
        return onSnapshot(q, (snapshot) => {
            const todos = [];
            snapshot.forEach((doc) => {
                todos.push({
                    id: doc.id,
                    ...doc.data()
                });
            });
            callback(todos);
        }, (error) => {
            console.error('Error subscribing to todos:', error);
            showNotification('Connection error. Using local storage.', 'warning');
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            callback(localTodos);
        });
    },

    // Add new todo
    addTodo: async (todo) => {
        try {
            const todosCollection = getTodoCollection();
            const docRef = await addDoc(todosCollection, {
                ...todo,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
                deviceId: getDeviceId()
            });
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('Error adding todo:', error);
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

    // Update todo (toggle completion)
    updateTodo: async (todoId, updates) => {
        try {
            const todosCollection = getTodoCollection();
            const todoDoc = doc(todosCollection, todoId);
            await updateDoc(todoDoc, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating todo:', error);
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
        try {
            const todosCollection = getTodoCollection();
            const todoDoc = doc(todosCollection, todoId);
            await deleteDoc(todoDoc);
            return { success: true };
        } catch (error) {
            console.error('Error deleting todo:', error);
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const filteredTodos = localTodos.filter(t => t.id !== todoId);
            localStorage.setItem('bunny-todos', JSON.stringify(filteredTodos));
            return { success: true, isLocal: true };
        }
    },

    // Import from localStorage to Firebase
    importFromLocalStorage: async () => {
        const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
        if (localTodos.length === 0) {
            return { success: false, message: 'No local tasks found' };
        }

        try {
            const todosCollection = getTodoCollection();
            const batch = writeBatch(db);
            
            // Get existing todos to avoid duplicates
            const q = query(todosCollection);
            const snapshot = await getDocs(q);
            const existingIds = new Set(snapshot.docs.map(doc => doc.data().originalId));
            
            let importedCount = 0;
            
            for (const todo of localTodos) {
                // Skip if already imported
                if (existingIds.has(todo.id)) continue;
                
                const newDocRef = doc(todosCollection);
                batch.set(newDocRef, {
                    task: todo.task,
                    category: todo.category,
                    completed: todo.completed,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    deviceId: getDeviceId(),
                    originalId: todo.id // Keep reference to original ID
                });
                importedCount++;
            }
            
            if (importedCount > 0) {
                await batch.commit();
                localStorage.removeItem('bunny-todos'); // Clear local after successful import
            }
            
            return { 
                success: true, 
                importedCount,
                message: `Imported ${importedCount} tasks to Firebase` 
            };
        } catch (error) {
            console.error('Error importing from localStorage:', error);
            return { success: false, message: 'Import failed' };
        }
    },

    // Export todos as JSON backup
    exportTodos: async () => {
        try {
            const todosCollection = getTodoCollection();
            const q = query(todosCollection);
            const snapshot = await getDocs(q);
            const todos = [];
            
            snapshot.forEach((doc) => {
                const data = doc.data();
                todos.push({
                    id: doc.id,
                    task: data.task,
                    category: data.category,
                    completed: data.completed,
                    createdAt: data.createdAt?.toDate()?.toISOString() || new Date().toISOString(),
                    deviceId: data.deviceId
                });
            });
            
            const dataStr = JSON.stringify(todos, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
            
            const exportFileDefaultName = `bunny-todos-backup-${new Date().toISOString().split('T')[0]}.json`;
            
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', exportFileDefaultName);
            linkElement.click();
            
            return { success: true, count: todos.length };
        } catch (error) {
            console.error('Error exporting todos:', error);
            return { success: false, message: 'Export failed' };
        }
    }
};

// Update sync status indicator
function updateSyncStatus(isSynced = true, isLocal = false) {
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
    }
}

// Initialize sync status
updateSyncStatus(true);

// Make firebaseService available globally
window.firebaseService = firebaseService;
window.updateSyncStatus = updateSyncStatus;

// Helper function for notifications (needed in this file)
function showNotification(message, type = 'info') {
    console.log(`${type.toUpperCase()}: ${message}`);
}

// Import missing Firestore function
import { getDocs } from "firebase/firestore";
[file content end]
