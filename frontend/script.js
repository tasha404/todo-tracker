// script.js - Firebase-Enabled Todo App (Fixed Version)

// 1. Safety Check: Ensure the config file loaded first
if (typeof firebaseService === 'undefined') {
    console.warn('⚠️ firebaseService not found immediately. It might be loading as a module.');
}

console.log('🚀 script.js loading...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded');
    // Small delay to ensure module (firebase-config.js) has attached to window
    setTimeout(() => {
        if (typeof firebaseService !== 'undefined') {
            initializeApp();
        } else {
            showNotification('Firebase failed to load. Check console.', 'error');
            console.error('CRITICAL: firebaseService is missing. Make sure firebase-config.js is loaded.');
        }
    }, 500);
});

// Global variables
let todos = [];
let currentFilter = 'all';
let unsubscribeFromFirebase = null;

// DOM Elements
const todoList = document.getElementById('todo-list');
const newTaskInput = document.getElementById('new-task');
const taskCategorySelect = document.getElementById('task-category');
const addBtn = document.getElementById('add-btn');
const filterButtons = document.querySelectorAll('.filter-btn');
const percentageElement = document.querySelector('.percentage');
const completedTasksElement = document.getElementById('completed-tasks');
const totalTasksElement = document.getElementById('total-tasks');
const progressBar = document.querySelector('.progress-bar');

// Initialize app
function initializeApp() {
    console.log('🐰 Initializing Todo App...');
    setupEventListeners();
    startFirebaseListener();
    console.log('✅ App initialized');
}

// Event Listeners
function setupEventListeners() {
    console.log('🔧 Setting up event listeners...');
    
    if(addBtn) {
        addBtn.addEventListener('click', addTodo);
        console.log('✅ Add button listener added');
    }
    
    if(newTaskInput) {
        newTaskInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addTodo();
        });
        console.log('✅ Enter key listener added');
    }

    if(filterButtons) {
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                filterButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                currentFilter = button.dataset.filter;
                console.log('🔘 Filter changed to:', currentFilter);
                renderTodos();
            });
        });
        console.log('✅ Filter button listeners added');
    }
}

// Start Firebase real-time listener
function startFirebaseListener() {
    console.log('📡 Starting Firebase listener...');
    
    // Update status to loading
    updateSyncStatus(false);
    
    unsubscribeFromFirebase = firebaseService.subscribeToTodos((firestoreTodos) => {
        console.log('📥 Received todos from Firebase:', firestoreTodos);
        
        // Convert Firestore timestamps to regular dates
        const processedTodos = firestoreTodos.map(todo => {
            let createdAt = todo.createdAt;
            // Handle Firestore Timestamp objects
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate().toISOString();
            } else if (!createdAt) {
                createdAt = new Date().toISOString();
            }
            
            return {
                ...todo,
                created_at: createdAt,
                id: todo.id // Use Firestore document ID
            };
        });
        
        todos = processedTodos;
        console.log('📊 Processed todos:', todos);
        
        renderTodos();
        updateProgress();
        updateSyncStatus(true, firestoreTodos.length === 0 && todos.length > 0);
        
        // Only show "Loaded" if we actually have items
        if (todos.length > 0) {
             // Optional: Comment this out if it gets annoying on every refresh
            // showNotification(`Loaded ${todos.length} tasks from cloud! ☁️`, 'success');
        }
    });
}

// Add new todo
async function addTodo() {
    console.log('➕ Add todo function called');
    const task = newTaskInput.value.trim();
    const category = taskCategorySelect.value;

    if (!task) {
        showNotification('Please enter a task! 🌸', 'warning');
        newTaskInput.focus();
        return;
    }

    if (task.length > 100) {
        showNotification('Task is too long (max 100 characters)', 'warning');
        return;
    }

    const newTodo = {
        task: task,
        category: category,
        completed: false
    };

    updateSyncStatus(false);
    
    const result = await firebaseService.addTodo(newTodo);
    console.log('📨 Firebase add result:', result);
    
    if (result.success) {
        newTaskInput.value = '';
        newTaskInput.focus();
        
        if (result.isLocal) {
            showNotification('Task added (saved locally) ✨', 'info');
        } else {
            showNotification('Task added to cloud! ✨', 'success');
            createConfetti(15);
        }
    } else {
        showNotification('Failed to add task 😢', 'error');
        console.error('❌ Failed to add task');
    }
}

// Toggle todo completion
async function toggleTodo(event) {
    const checkbox = event.target;
    const todoItem = checkbox.closest('.todo-item');
    
    if (!todoItem) return;
    
    const id = todoItem.dataset.id;
    const todo = todos.find(t => t.id === id);
    
    if (!todo) return;
    
    const newCompletedState = !todo.completed;
    
    // Optimistic UI Update (Update immediately before server responds)
    checkbox.checked = newCompletedState;
    if (newCompletedState) {
        todoItem.classList.add('completed');
    } else {
        todoItem.classList.remove('completed');
    }
    
    updateSyncStatus(false);
    
    // Update in Firebase
    const result = await firebaseService.updateTodo(id, { completed: newCompletedState });
    
    if (result.success) {
        const status = newCompletedState ? 'completed 🎉' : 'pending';
        // Only show notification/confetti for completion
        if (newCompletedState) {
            showNotification(`Task marked as ${status}!`, 'success');
            createConfetti(10);
        }
    } else {
        // Revert UI if update failed
        checkbox.checked = !newCompletedState;
        if (newCompletedState) todoItem.classList.remove('completed');
        else todoItem.classList.add('completed');
        showNotification('Failed to update task', 'error');
    }
}

// Delete todo
async function deleteTodo(event) {
    const deleteBtn = event.target.closest('.delete-btn');
    if (!deleteBtn) return;
    
    const todoItem = deleteBtn.closest('.todo-item');
    const id = todoItem.dataset.id;
    const todo = todos.find(t => t.id === id);
    
    if (!todo) return;
    
    // Confirm delete
    if (!confirm(`Delete "${todo.task}"?`)) return;
    
    updateSyncStatus(false);
    
    const result = await firebaseService.deleteTodo(id);
    
    if (result.success) {
        showNotification('Task deleted! 🗑️', 'success');
    } else {
        showNotification('Failed to delete task', 'error');
    }
}

// Render todos to the screen
function renderTodos() {
    const filteredTodos = filterTodos();
    
    if (filteredTodos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list fa-3x"></i>
                <h3>No ${currentFilter !== 'all' ? currentFilter : ''} tasks!</h3>
                <p>${currentFilter === 'all' ? 'Add your first task to get started 🌈' : 'Try changing the filter'}</p>
            </div>
        `;
        return;
    }

    todoList.innerHTML = filteredTodos.map(todo => {
        return `
        <div class="todo-item ${todo.completed ? 'completed' : ''}" data-id="${todo.id}">
            <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''}>
            <div class="todo-content">
                <div class="todo-task">${escapeHtml(todo.task)}</div>
                <div class="todo-meta">
                    <span class="todo-category">${getCategoryIcon(todo.category)} ${todo.category}</span>
                    <small class="todo-date">${formatDate(todo.created_at)}</small>
                    ${todo.deviceId ? '<small class="cloud-badge"><i class="fas fa-cloud"></i></small>' : ''}
                </div>
            </div>
            <div class="todo-actions">
                <button class="todo-btn delete-btn" title="Delete" aria-label="Delete task">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Add event listeners using event delegation (More efficient)
    todoList.onclick = (event) => {
        if (event.target.closest('.delete-btn')) {
            deleteTodo(event);
        }
    };

    todoList.onchange = (event) => {
        if (event.target.classList.contains('todo-checkbox')) {
            toggleTodo(event);
        }
    };
}

// Filter todos based on current filter
function filterTodos() {
    switch (currentFilter) {
        case 'pending':
            return todos.filter(todo => !todo.completed);
        case 'completed':
            return todos.filter(todo => todo.completed);
        default:
            return todos;
    }
}

// Update progress circle and stats
function updateProgress() {
    const total = todos.length;
    const completed = todos.filter(todo => todo.completed).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    // Update progress circle animation
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (progress / 100) * circumference;
    
    if (progressBar) {
        progressBar.style.strokeDasharray = `${circumference} ${circumference}`;
        progressBar.style.strokeDashoffset = offset;
    }
    
    if (percentageElement) percentageElement.textContent = `${Math.round(progress)}%`;
    if (completedTasksElement) completedTasksElement.textContent = completed;
    if (totalTasksElement) totalTasksElement.textContent = total;
}

// Helper functions
function getCategoryIcon(category) {
    const icons = {
        'work': '💼',
        'personal': '🌸',
        'shopping': '🛍️',
        'health': '🏃‍♀️'
    };
    return icons[category] || '📌';
}

function formatDate(dateString) {
    try {
        if (!dateString) return 'Recently';
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch (error) {
        return 'Recently';
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info', duration = 3000) {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) existingNotification.remove();

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
    notification.style.animation = 'slideIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    
    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
        }, 300);
    }, duration);
}

// Create confetti effect
function createConfetti(count = 50) {
    const colors = ['#ffd6e7', '#d4f1d4', '#e6e6fa', '#fffacd', '#d4f4ff'];
    
    for (let i = 0; i < count; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.width = Math.random() * 15 + 5 + 'px';
        confetti.style.height = confetti.style.width;
        confetti.style.animationDelay = Math.random() * 2 + 's';
        
        document.body.appendChild(confetti);
        
        setTimeout(() => {
            if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
        }, 3000);
    }
}

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

// Add CSS for notifications if not in style.css
function addMissingStyles() {
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes slideOut {
                from { transform: translateX(0); opacity: 1; }
                to { transform: translateX(100%); opacity: 0; }
            }
            .notification {
                position: fixed; top: 20px; right: 20px;
                padding: 15px 20px; border-radius: 12px;
                color: white; font-weight: bold;
                display: flex; align-items: center; gap: 10px;
                z-index: 1000; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                max-width: 300px;
            }
            .notification.success { background: linear-gradient(135deg, #77dd77, #55aa55); border-left: 5px solid #44aa44; }
            .notification.error { background: linear-gradient(135deg, #ff6b6b, #ff4444); border-left: 5px solid #dd3333; }
            .notification.warning { background: linear-gradient(135deg, #ffd166, #ffb347); border-left: 5px solid #ff9500; }
            .notification.info { background: linear-gradient(135deg, #4ecdc4, #44aaff); border-left: 5px solid #3388ff; }
            
            .confetti {
                position: fixed; top: -10px; z-index: 999;
                animation: fall linear forwards;
            }
            @keyframes fall {
                to { transform: translateY(100vh) rotate(720deg); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize missing styles
addMissingStyles();

// Debug functions available in Console
window.todoApp = {
    getTodos: () => todos,
    // Fix: removed check for global 'firebase' object as it doesn't exist in v9
    getStatus: () => {
        console.log('🔥 Status Check');
        return {
            serviceLoaded: typeof firebaseService !== 'undefined',
            todosCount: todos.length,
            deviceId: localStorage.getItem('bunny_device_id')
        };
    },
    clearLocalStorage: () => {
        localStorage.removeItem('bunny-todos');
        localStorage.removeItem('bunny_device_id');
        location.reload();
    }
};
