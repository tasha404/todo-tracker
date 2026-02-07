// Firebase Configuration - REPLACE WITH YOUR ACTUAL CONFIG
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
try {
    firebase.initializeApp(firebaseConfig);
    console.log('🔥 Firebase initialized successfully');
} catch (error) {
    console.error('❌ Firebase initialization error:', error);
}

const db = firebase.firestore();
console.log('📊 Firestore database initialized');

// Generate unique device ID for anonymous user
function getDeviceId() {
    let deviceId = localStorage.getItem('bunny_device_id');
    if (!deviceId) {
        deviceId = 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('bunny_device_id', deviceId);
        console.log('📱 Created new device ID:', deviceId);
    } else {
        console.log('📱 Using existing device ID:', deviceId);
    }
    return deviceId;
}

// Get device-specific collection reference
function getTodoCollection() {
    const deviceId = getDeviceId();
    return db.collection('devices').doc(deviceId).collection('todos');
}

// Firestore service functions
const firebaseService = {
    // Subscribe to todos with real-time updates
    subscribeToTodos: (callback) => {
        console.log('👂 Subscribing to todos...');
        const todosCollection = getTodoCollection();
        
        return todosCollection.orderBy('createdAt', 'desc').onSnapshot((snapshot) => {
            console.log('📡 Firestore snapshot received:', snapshot.size, 'items');
            
            const todos = [];
            snapshot.forEach((doc) => {
                const data = doc.data();
                console.log('📝 Todo data:', data);
                todos.push({
                    id: doc.id,
                    ...data
                });
            });
            
            callback(todos);
        }, (error) => {
            console.error('❌ Error subscribing to todos:', error);
            console.error('Error details:', error.code, error.message);
            showNotification('Connection error. Using local storage.', 'warning');
            
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            console.log('📂 Fallback to localStorage:', localTodos.length, 'items');
            callback(localTodos);
        });
    },

    // Add new todo
    addTodo: async (todo) => {
        console.log('➕ Adding todo:', todo);
        try {
            const todosCollection = getTodoCollection();
            const todoData = {
                ...todo,
                createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
                deviceId: getDeviceId()
            };
            
            console.log('📤 Sending to Firestore:', todoData);
            const docRef = await todosCollection.add(todoData);
            console.log('✅ Todo added with ID:', docRef.id);
            
            return { success: true, id: docRef.id };
        } catch (error) {
            console.error('❌ Error adding todo:', error);
            console.error('Error details:', error.code, error.message);
            
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const newTodo = {
                ...todo,
                id: Date.now() + Math.random(),
                createdAt: new Date().toISOString()
            };
            localTodos.unshift(newTodo);
            localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
            console.log('💾 Saved to localStorage:', newTodo);
            
            return { success: true, id: newTodo.id, isLocal: true };
        }
    },

    // Update todo (toggle completion)
    updateTodo: async (todoId, updates) => {
        console.log('🔄 Updating todo:', todoId, updates);
        try {
            const todosCollection = getTodoCollection();
            await todosCollection.doc(todoId).update({
                ...updates,
                updatedAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            console.log('✅ Todo updated:', todoId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error updating todo:', error);
            
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const index = localTodos.findIndex(t => t.id === todoId);
            if (index !== -1) {
                localTodos[index] = { ...localTodos[index], ...updates };
                localStorage.setItem('bunny-todos', JSON.stringify(localTodos));
                console.log('💾 Updated in localStorage:', todoId);
            }
            return { success: true, isLocal: true };
        }
    },

    // Delete todo
    deleteTodo: async (todoId) => {
        console.log('🗑️ Deleting todo:', todoId);
        try {
            const todosCollection = getTodoCollection();
            await todosCollection.doc(todoId).delete();
            console.log('✅ Todo deleted:', todoId);
            return { success: true };
        } catch (error) {
            console.error('❌ Error deleting todo:', error);
            
            // Fallback to localStorage
            const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
            const filteredTodos = localTodos.filter(t => t.id !== todoId);
            localStorage.setItem('bunny-todos', JSON.stringify(filteredTodos));
            console.log('💾 Deleted from localStorage:', todoId);
            return { success: true, isLocal: true };
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

// Show notification (for firebase-config.js)
function showNotification(message, type = 'info') {
    console.log('📢 Notification:', message, type);
    
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

    // Create new notification
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
        success: 'check-circle',
        error: 'exclamation-circle',
        warning: 'exclamation-triangle',
        info: 'info-circle'
    };
    
    notification.innerHTML = `
        <i class="fas fa-${icons[type] || 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add animation
    notification.style.animation = 'slideIn 0.5s ease';
    
    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
    }, 3000);
}

// Initialize sync status
updateSyncStatus(true);

// Test Firestore connection
async function testFirestoreConnection() {
    try {
        const testCollection = db.collection('test');
        const docRef = await testCollection.add({ test: true, timestamp: new Date() });
        await docRef.delete();
        console.log('✅ Firestore connection test successful');
        return true;
    } catch (error) {
        console.error('❌ Firestore connection test failed:', error);
        return false;
    }
}

// Run connection test on load
setTimeout(() => {
    testFirestoreConnection();
}, 1000);
