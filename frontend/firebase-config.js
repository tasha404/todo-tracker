import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { 
    getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, 
    onSnapshot, query, orderBy, serverTimestamp, writeBatch 
} from "firebase/firestore";

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
const db = getFirestore(app); // Correctly initialize Firestore

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

// Get device-specific collection reference (V9 Modular Syntax)
function getTodoCollectionRef() {
    const deviceId = getDeviceId();
    return collection(db, 'devices', deviceId, 'todos');
}

// Firestore service functions
const firebaseService = {
    // Subscribe to todos with real-time updates
    subscribeToTodos: (callback) => {
        const todosRef = getTodoCollectionRef();
        // Create a query ordered by createdAt
        const q = query(todosRef, orderBy('createdAt', 'desc'));
        
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
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            callback(localTodos);
        });
    },

    // Add new todo
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
            console.error('Error adding todo:', error);
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const newTodo = { ...todo, id: Date.now() + Math.random(), createdAt: new Date().toISOString() };
            localTodos.unshift(newTodo);
            localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            return { success: true, id: newTodo.id, isLocal: true };
        }
    },

    // Update todo
    updateTodo: async (id, updates) => {
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, 'devices', deviceId, 'todos', id);
            await updateDoc(docRef, {
                ...updates,
                updatedAt: serverTimestamp()
            });
            return { success: true };
        } catch (error) {
            console.error('Error updating todo:', error);
            return { success: false, message: error.message };
        }
    },

    // Delete todo
    deleteTodo: async (id) => {
        try {
            const deviceId = getDeviceId();
            const docRef = doc(db, 'devices', deviceId, 'todos', id);
            await deleteDoc(docRef);
            return { success: true };
        } catch (error) {
            console.error('Error deleting todo:', error);
            return { success: false, message: error.message };
        }
    },

    // Import from local storage
    importFromLocalStorage: async () => {
        try {
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            if (localTodos.length === 0) return { success: true, importedCount: 0 };

            const batch = writeBatch(db);
            const todosRef = getTodoCollectionRef();
            
            let count = 0;
            for (const todo of localTodos) {
                const newDocRef = doc(todosRef);
                batch.set(newDocRef, {
                    task: todo.task,
                    category: todo.category || 'personal',
                    completed: todo.completed || false,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                    deviceId: getDeviceId(),
                    originalId: todo.id // Keep ref to old ID
                });
                count++;
            }
            
            await batch.commit();
            
            // Clear local storage after successful import
            localStorage.removeItem('bunny-todos');
            return { success: true, importedCount: count };
        } catch (error) {
            console.error('Import error:', error);
            return { success: false, message: error.message };
        }
    },

    // Export todos
    exportTodos: async () => {
        // Logic handled in script.js or implementing a download here
        return { success: true, message: "Use script.js export logic" };
    }
};

// CRITICAL: Attach to window so script.js can access it
window.firebaseService = firebaseService;
