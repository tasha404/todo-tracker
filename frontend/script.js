[file name]: script.js
[file content begin]
// Add this at the very beginning
if (typeof firebaseService === 'undefined') {
    console.error('Firebase service not loaded. Please refresh the page.');
}


// script.js - Firebase-Enabled Todo App (DEBUG VERSION)

console.log('🚀 script.js loading...');

document.addEventListener('DOMContentLoaded', () => {
    console.log('✅ DOM Content Loaded');
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
    
    addBtn.addEventListener('click', addTodo);
    console.log('✅ Add button listener added');
    
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addTodo();
    });
    console.log('✅ Enter key listener added');

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
        
        if (todos.length > 0) {
            showNotification(`Loaded ${todos.length} tasks from cloud! ☁️`, 'success');
        }
    });
}

// Add new todo
async function addTodo() {
    console.log('➕ Add todo function called');
    const task = newTaskInput.value.trim();
    const category = taskCategorySelect.value;

    console.log('📝 Task input:', task);
    console.log('🏷️ Category:', category);

    if (!task) {
        console.log('⚠️ Empty task, showing warning');
        showNotification('Please enter a task! 🌸', 'warning');
        newTaskInput.focus();
        return;
    }

    if (task.length > 100) {
        console.log('⚠️ Task too long');
        showNotification('Task is too long (max 100 characters)', 'warning');
        return;
    }

    const newTodo = {
        task: task,
        category: category,
        completed: false
    };

    console.log('📦 New todo object:', newTodo);
    
    updateSyncStatus(false);
    
    const result = await firebaseService.addTodo(newTodo);
    console.log('📨 Firebase add result:', result);
    
    if (result.success) {
        // Clear input
        newTaskInput.value = '';
        newTaskInput.focus();
        
        // Show success notification
        if (result.isLocal) {
            showNotification('Task added (saved locally) ✨', 'info');
            console.log('💾 Task saved locally');
        } else {
            showNotification('Task added to cloud! ✨', 'success');
            createConfetti(15);
            console.log('☁️ Task saved to Firebase');
        }
    } else {
        showNotification('Failed to add task 😢', 'error');
        console.error('❌ Failed to add task');
    }
}

// Toggle todo completion
async function toggleTodo(event) {
    console.log('🔄 Toggle todo called');
    const checkbox = event.target;
    const todoItem = checkbox.closest('.todo-item');
    
    if (!todoItem) {
        console.log('❌ No todo item found');
        return;
    }
    
    const id = todoItem.dataset.id;
    console.log('🎯 Todo ID:', id);
    
    const todo = todos.find(t => t.id === id);
    console.log('📋 Found todo:', todo);
    
    if (!todo) {
        console.log('❌ Todo not found in array');
        return;
    }
    
    const newCompletedState = !todo.completed;
    console.log('🔄 New completed state:', newCompletedState);
    
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
    console.log('📨 Update result:', result);
    
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
        console.log('❌ Update failed, reverting UI');
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
    console.log('🗑️ Delete todo called');
    const deleteBtn = event.target.closest('.delete-btn');
    if (!deleteBtn) {
        console.log('❌ No delete button found');
        return;
    }
    
    const todoItem = deleteBtn.closest('.todo-item');
    if (!todoItem) {
        console.log('❌ No todo item found');
        return;
    }
    
    const id = todoItem.dataset.id;
    console.log('🎯 Todo ID to delete:', id);
    
    const todo = todos.find(t => t.id === id);
    console.log('📋 Todo to delete:', todo);
    
    if (!todo) {
        console.log('❌ Todo not found');
        return;
    }
    
    const taskPreview = todo.task.substring(0, 20) + (todo.task.length > 20 ? '...' : '');
    if (!confirm(`Delete "${taskPreview}"?`)) {
        console.log('❌ Delete cancelled by user');
        return;
    }
    
    updateSyncStatus(false);
    
    const result = await firebaseService.deleteTodo(id);
    console.log('📨 Delete result:', result);
    
    if (result.success) {
        showNotification('Task deleted! 🗑️', 'success');
        if (result.isLocal) {
            showNotification('Deleted from local storage', 'info');
        }
    } else {
        showNotification('Failed to delete task', 'error');
    }
}

// Render todos to the screen
function renderTodos() {
    console.log('🎨 Rendering todos...');
    console.log('📊 Current todos array:', todos);
    console.log('🔍 Current filter:', currentFilter);
    
    const filteredTodos = filterTodos();
    console.log('🔍 Filtered todos:', filteredTodos);
    
    if (filteredTodos.length === 0) {
        console.log('📭 No todos to display, showing empty state');
        todoList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list fa-3x"></i>
                <h3>No ${currentFilter !== 'all' ? currentFilter : ''} tasks!</h3>
                <p>${currentFilter === 'all' ? 'Add your first task to get started 🌈' : 'Try changing the filter'}</p>
            </div>
        `;
        return;
    }

    console.log('🖼️ Rendering', filteredTodos.length, 'todos');
    
    todoList.innerHTML = filteredTodos.map(todo => {
        console.log('🎨 Rendering todo:', todo);
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

    console.log('✅ Todos rendered to DOM');

    // Add event listeners using event delegation
    todoList.addEventListener('change', (event) => {
        if (event.target.classList.contains('todo-checkbox')) {
            console.log('✅ Checkbox change event detected');
            toggleTodo(event);
        }
    });

    todoList.addEventListener('click', (event) => {
        if (event.target.closest('.delete-btn')) {
            console.log('✅ Delete button click detected');
            deleteTodo(event);
        }
    });
}

// Filter todos based on current filter
function filterTodos() {
    console.log('🔍 Filtering todos with filter:', currentFilter);
    
    let filtered;
    switch (currentFilter) {
        case 'pending':
            filtered = todos.filter(todo => !todo.completed);
            console.log('📋 Pending todos:', filtered.length);
            break;
        case 'completed':
            filtered = todos.filter(todo => todo.completed);
            console.log('📋 Completed todos:', filtered.length);
            break;
        default:
            filtered = todos;
            console.log('📋 All todos:', filtered.length);
            break;
    }
    
    return filtered;
}

// Update progress circle and stats
function updateProgress() {
    console.log('📈 Updating progress...');
    const total = todos.length;
    const completed = todos.filter(todo => todo.completed).length;
    const progress = total > 0 ? (completed / total) * 100 : 0;
    
    console.log('📊 Stats - Total:', total, 'Completed:', completed, 'Progress:', progress + '%');
    
    // Update progress circle animation
    const circumference = 2 * Math.PI * 54;
    const offset = circumference - (progress / 100) * circumference;
    
    if (progressBar) {
        progressBar.style.strokeDasharray = `${circumference} ${circumference}`;
        progressBar.style.strokeDashoffset = offset;
        console.log('🎯 Progress bar updated');
    }
    
    // Update text displays
    if (percentageElement) {
        percentageElement.textContent = `${Math.round(progress)}%`;
        console.log('📊 Percentage updated:', percentageElement.textContent);
    }
    
    if (completedTasksElement) {
        completedTasksElement.textContent = completed;
        console.log('📊 Completed tasks updated:', completedTasksElement.textContent);
    }
    
    if (totalTasksElement) {
        totalTasksElement.textContent = total;
        console.log('📊 Total tasks updated:', totalTasksElement.textContent);
    }
    
    const completedElement = document.querySelector('.completed');
    if (completedElement) {
        completedElement.textContent = `${completed}/${total} completed`;
        console.log('📊 Completed text updated:', completedElement.textContent);
    }
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
    const icon = icons[category] || '📌';
    console.log('🏷️ Category icon for', category + ':', icon);
    return icon;
}

function formatDate(dateString) {
    try {
        if (!dateString) {
            console.log('📅 No date string, returning "Recently"');
            return 'Recently';
        }
        
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        let result;
        if (diffMins < 1) result = 'Just now';
        else if (diffMins < 60) result = `${diffMins}m ago`;
        else if (diffHours < 24) result = `${diffHours}h ago`;
        else if (diffDays < 7) result = `${diffDays}d ago`;
        else result = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        console.log('📅 Formatted date:', dateString, '→', result);
        return result;
    } catch (error) {
        console.error('❌ Error formatting date:', error);
        return 'Recently';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    console.log('🔒 Escaped HTML for:', text.substring(0, 20) + '...');
    return div.innerHTML;
}

// Show notification
function showNotification(message, type = 'info', duration = 3000) {
    console.log('📢 Showing notification:', message, type);
    
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
    console.log('✅ Notification added to DOM');
    
    // Add animation
    notification.style.animation = 'slideIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    
    // Auto remove
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) notification.parentNode.removeChild(notification);
            console.log('✅ Notification removed');
        }, 300);
    }, duration);
}

// Create confetti effect
function createConfetti(count = 50) {
    console.log('🎉 Creating confetti:', count, 'pieces');
    
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
    
    console.log('✅ Confetti created');
}

// Update sync status indicator (overrides firebase-config.js version)
function updateSyncStatus(isSynced = true, isLocal = false) {
    console.log('🔄 Updating sync status:', { isSynced, isLocal });
    
    const syncElement = document.getElementById('sync-status');
    if (syncElement) {
        if (isLocal) {
            syncElement.innerHTML = '<i class="fas fa-laptop"></i> Local Mode';
            syncElement.className = 'sync-indicator local';
            console.log('💻 Sync status: Local Mode');
        } else if (isSynced) {
            syncElement.innerHTML = '<i class="fas fa-cloud"></i> Synced';
            syncElement.className = 'sync-indicator synced';
            console.log('☁️ Sync status: Synced');
        } else {
            syncElement.innerHTML = '<i class="fas fa-cloud-slash"></i> Syncing...';
            syncElement.className = 'sync-indicator syncing';
            console.log('🔄 Sync status: Syncing...');
        }
    } else {
        console.log('❌ Sync status element not found');
    }
}

// Add CSS for notifications if not in style.css
function addMissingStyles() {
    if (!document.querySelector('#notification-styles')) {
        console.log('🎨 Adding notification styles...');
        
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
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
        `;
        document.head.appendChild(style);
        console.log('✅ Notification styles added');
    }
}

// Initialize missing styles
addMissingStyles();

// Debug functions
window.todoApp = {
    getTodos: () => {
        console.log('📊 Current todos:', todos);
        return todos;
    },
    getFirebaseStatus: () => {
        console.log('🔥 Firebase status check');
        return {
            firebase: typeof firebase !== 'undefined',
            firestore: typeof firebase.firestore !== 'undefined',
            todos: todos.length,
            deviceId: localStorage.getItem('bunny_device_id')
        };
    },
    clearLocalStorage: () => {
        localStorage.removeItem('bunny-todos');
        localStorage.removeItem('bunny_device_id');
        console.log('🧹 LocalStorage cleared');
        location.reload();
    }
};

// Initial welcome message
setTimeout(() => {
    console.log('✅ Bunny Todo App ready!');
    console.log('🔍 Available debug commands:');
    console.log('   - todoApp.getTodos()');
    console.log('   - todoApp.getFirebaseStatus()');
    console.log('   - todoApp.clearLocalStorage()');
}, 1000);
