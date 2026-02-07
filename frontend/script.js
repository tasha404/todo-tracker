// script.js - Firebase-Enabled Todo App
// Bunny See, Bunny Do Todo App - Now with Firebase Firestore

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐰 Todo app initialized with Firebase');
    initializeApp();
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
const importLocalBtn = document.getElementById('import-local');
const exportBtn = document.getElementById('export-btn');

// Initialize app
function initializeApp() {
    setupEventListeners();
    startFirebaseListener();
    showNotification('Welcome to Bunny Todo! 🎀 Cloud sync enabled!', 'success', 2000);
    
    // Check for local storage migration
    checkForLocalData();
}

// Event Listeners
function setupEventListeners() {
    addBtn.addEventListener('click', addTodo);
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });

    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            currentFilter = button.dataset.filter;
            renderTodos();
        });
    });
    
    // Import/Export buttons
    if (importLocalBtn) {
        importLocalBtn.addEventListener('click', importFromLocalStorage);
    }
    
    if (exportBtn) {
        exportBtn.addEventListener('click', exportTodos);
    }
}

// Start Firebase real-time listener
function startFirebaseListener() {
    unsubscribeFromFirebase = firebaseService.subscribeToTodos((firestoreTodos) => {
        // Convert Firestore timestamps to regular dates
        const processedTodos = firestoreTodos.map(todo => {
            let createdAt = todo.createdAt;
            if (createdAt && typeof createdAt.toDate === 'function') {
                createdAt = createdAt.toDate().toISOString();
            } else if (!createdAt) {
                createdAt = new Date().toISOString();
            }
            
            return {
                ...todo,
                created_at: createdAt,
                // For compatibility with existing code
                id: todo.id || todo.originalId || Date.now() + Math.random()
            };
        });
        
        todos = processedTodos;
        renderTodos();
        updateProgress();
        updateSyncStatus(true);
    });
}

// Check for local data and offer import
function checkForLocalData() {
    const localTodos = JSON.parse(localStorage.getItem('bunny-todos')) || [];
    if (localTodos.length > 0) {
        setTimeout(() => {
            if (confirm(`Found ${localTodos.length} tasks in local storage. Import to Firebase for cloud sync?`)) {
                importFromLocalStorage();
            }
        }, 1500);
    }
}

// Add new todo
async function addTodo() {
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
    
    if (result.success) {
        // Clear input
        newTaskInput.value = '';
        newTaskInput.focus();
        
        // Show success notification
        if (result.isLocal) {
            showNotification('Task added (saved locally) ✨', 'info');
        } else {
            showNotification('Task added to cloud! ✨', 'success');
            createConfetti(15);
        }
    } else {
        showNotification('Failed to add task 😢', 'error');
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
    
    // Update UI immediately for better UX
    if (newCompletedState) {
        todoItem.classList.add('completed');
    } else {
        todoItem.classList.remove('completed');
    }
    
    checkbox.checked = newCompletedState;
    
    updateSyncStatus(false);
    
    // Update in Firebase
    const result = await firebaseService.updateTodo(id, { completed: newCompletedState });
    
    if (result.success) {
        const status = newCompletedState ? 'completed 🎉' : 'pending';
        showNotification(`Task marked as ${status}!`, 'success');
        
        if (newCompletedState) {
            createConfetti(10);
        }
        
        if (result.isLocal) {
            showNotification('Saved locally (offline)', 'info');
        }
    } else {
        // Revert UI if update failed
        checkbox.checked = !newCompletedState;
        if (newCompletedState) {
            todoItem.classList.remove('completed');
        } else {
            todoItem.classList.add('completed');
        }
        showNotification('Failed to update task', 'error');
    }
}

// Delete todo
async function deleteTodo(event) {
    const deleteBtn = event.target.closest('.delete-btn');
    if (!deleteBtn) return;
    
    const todoItem = deleteBtn.closest('.todo-item');
    if (!todoItem) return;
    
    const id = todoItem.dataset.id;
    const todo = todos.find(t => t.id === id);
    
    if (!todo) return;
    
    if (!confirm(`Delete "${todo.task.substring(0, 20)}${todo.task.length > 20 ? '...' : ''}"?`)) {
        return;
    }
    
    updateSyncStatus(false);
    
    const result = await firebaseService.deleteTodo(id);
    
    if (result.success) {
        showNotification('Task deleted! 🗑️', 'success');
        if (result.isLocal) {
            showNotification('Deleted from local storage', 'info');
        }
    } else {
        showNotification('Failed to delete task', 'error');
    }
}

// Import from localStorage to Firebase
async function importFromLocalStorage() {
    updateSyncStatus(false);
    
    const result = await firebaseService.importFromLocalStorage();
    
    if (result.success) {
        if (result.importedCount > 0) {
            showNotification(`Imported ${result.importedCount} tasks to Firebase! 🚀`, 'success');
            createConfetti(20);
        } else {
            showNotification('All tasks already synced to Firebase! ✅', 'info');
        }
    } else {
        showNotification(result.message || 'Import failed', 'error');
    }
}

// Export todos
async function exportTodos() {
    const result = await firebaseService.exportTodos();
    
    if (result.success) {
        showNotification(`Exported ${result.count} tasks to JSON file 📁`, 'success');
    } else {
        showNotification(result.message || 'Export failed', 'error');
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

    todoList.innerHTML = filteredTodos.map(todo => `
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
    `).join('');

    // Add event listeners using event delegation
    todoList.addEventListener('change', (event) => {
        if (event.target.classList.contains('todo-checkbox')) {
            toggleTodo(event);
        }
    });

    todoList.addEventListener('click', (event) => {
        if (event.target.closest('.delete-btn')) {
            deleteTodo(event);
        }
    });
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
    
    // Update text displays
    if (percentageElement) percentageElement.textContent = `${Math.round(progress)}%`;
    if (completedTasksElement) completedTasksElement.textContent = completed;
    if (totalTasksElement) totalTasksElement.textContent = total;
    
    const completedElement = document.querySelector('.completed');
    if (completedElement) completedElement.textContent = `${completed}/${total} completed`;
}

// Helper functions
function getCategoryIcon(category) {
    const icons = {
        'general': '🎀',
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
        
        return date.toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric'
        });
    } catch (error) {
        return 'Recently';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info', duration = 3000) {
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
        
        // Remove after animation
        setTimeout(() => {
            if (confetti.parentNode) confetti.parentNode.removeChild(confetti);
        }, 3000);
    }
}

// Add CSS for notifications if not in style.css
function addMissingStyles() {
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 12px;
                color: white;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 1000;
                box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
                max-width: 300px;
                animation: slideIn 0.5s ease;
            }
            
            .notification.success {
                background: linear-gradient(135deg, #77dd77, #55aa55);
                border-left: 5px solid #44aa44;
            }
            
            .notification.error {
                background: linear-gradient(135deg, #ff6b6b, #ff4444);
                border-left: 5px solid #dd3333;
            }
            
            .notification.warning {
                background: linear-gradient(135deg, #ffd166, #ffb347);
                border-left: 5px solid #ff9500;
            }
            
            .notification.info {
                background: linear-gradient(135deg, #4ecdc4, #44aaff);
                border-left: 5px solid #3388ff;
            }
            
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
            
            @keyframes slideOut {
                from {
                    transform: translateX(0);
                    opacity: 1;
                }
                to {
                    transform: translateX(100%);
                    opacity: 0;
                }
            }
            
            .sync-status {
                margin-top: 10px;
            }
            
            .sync-indicator {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                padding: 8px 16px;
                border-radius: 20px;
                font-size: 0.9rem;
                font-weight: bold;
                background: var(--pastel-blue);
                color: var(--dark-green);
                border: 2px solid var(--pastel-blue);
                animation: pulse 2s infinite;
            }
            
            .sync-indicator.synced {
                background: var(--pastel-green);
                color: var(--dark-green);
                border-color: var(--dark-green);
            }
            
            .sync-indicator.syncing {
                background: var(--pastel-yellow);
                color: #b8860b;
                border-color: #b8860b;
            }
            
            .sync-indicator.local {
                background: var(--pastel-purple);
                color: #6a5acd;
                border-color: #6a5acd;
            }
            
            .quick-actions {
                display: flex;
                gap: 10px;
                margin-top: 15px;
            }
            
            .secondary-btn {
                padding: 10px 15px;
                background: var(--pastel-purple);
                border: 2px solid var(--pastel-blue);
                border-radius: 12px;
                color: var(--text);
                cursor: pointer;
                transition: all 0.3s ease;
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 0.9rem;
                flex: 1;
                justify-content: center;
            }
            
            .secondary-btn:hover {
                background: var(--pastel-blue);
                transform: translateY(-2px);
            }
            
            .cloud-badge {
                background: var(--pastel-green);
                color: var(--dark-green);
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 0.7rem;
                margin-left: 5px;
            }
            
            .footer-info {
                margin-left: 15px;
                font-size: 0.9rem;
                color: var(--dark-pink);
            }
            
            .todo-meta {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-top: 8px;
                flex-wrap: wrap;
                gap: 10px;
            }
            
            .todo-date {
                font-size: 0.75rem;
                color: #888;
            }
            
            .todo-checkbox {
                width: 22px;
                height: 22px;
                cursor: pointer;
                accent-color: var(--dark-green);
            }
            
            .todo-checkbox:hover {
                transform: scale(1.1);
                transition: transform 0.2s;
            }
            
            .filter-btn.active {
                background: var(--pastel-green);
                border-color: var(--dark-green);
                color: var(--dark-green);
                box-shadow: 0 0 10px rgba(119, 221, 119, 0.3);
                font-weight: bold;
            }
        `;
        document.head.appendChild(style);
    }
}

// Initialize missing styles
addMissingStyles();

// Test function to add sample tasks
async function addSampleTasks() {
    const sampleTasks = [
        { task: "Buy carrots for bunny 🥕", category: "shopping", completed: false },
        { task: "Finish coding project 💻", category: "work", completed: true },
        { task: "Go for a morning run 🏃‍♀️", category: "health", completed: false },
        { task: "Water the plants 🌱", category: "personal", completed: false },
        { task: "Plan weekend getaway ✈️", category: "personal", completed: true }
    ];
    
    for (const sample of sampleTasks) {
        await firebaseService.addTodo(sample);
    }
    
    showNotification('Added sample tasks to Firebase!', 'success');
}

// Export for debugging
window.todoApp = {
    getTodos: () => todos,
    addSampleTasks: addSampleTasks,
    importFromLocalStorage: importFromLocalStorage,
    exportTodos: exportTodos,
    clearAll: async () => {
        if (confirm('Clear ALL tasks from Firebase? This cannot be undone.')) {
            // Note: In production, you'd want to delete all documents
            showNotification('Clear feature disabled in demo', 'warning');
        }
    }
};

// Add a welcome message
setTimeout(() => {
    console.log('✅ Todo app loaded with Firebase!');
    console.log('📝 Available commands:');
    console.log('   - todoApp.addSampleTasks()');
    console.log('   - todoApp.importFromLocalStorage()');
    console.log('   - todoApp.exportTodos()');
}, 1000);
