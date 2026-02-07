// script.js - COMPLETE WORKING VERSION
// Bunny See, Bunny Do Todo App - Frontend Only

document.addEventListener('DOMContentLoaded', () => {
    console.log('🐰 Todo app initialized');
    loadTodos();
    setupEventListeners();
    updateProgress();
    showNotification('Welcome to Bunny Todo! 🎀', 'success', 2000);
});

// Store todos in browser's localStorage
let todos = [];
let currentFilter = 'all';

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
}

// Add new todo
function addTodo() {
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

    // Create new todo
    const newTodo = {
        id: Date.now() + Math.random(), // Unique ID
        task: task,
        category: category,
        completed: false,
        created_at: new Date().toISOString()
    };

    // Add to todos array (at the beginning)
    todos.unshift(newTodo);
    saveTodos();
    renderTodos();
    updateProgress();

    // Clear input and show success
    newTaskInput.value = '';
    newTaskInput.focus();
    showNotification('Task added successfully! ✨', 'success');
    createConfetti(15);
}

// Toggle todo completion
function toggleTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (todo) {
        todo.completed = !todo.completed;
        saveTodos();
        renderTodos();
        updateProgress();
        
        const status = todo.completed ? 'completed 🎉' : 'pending';
        showNotification(`Task marked as ${status}!`, 'success');
        
        if (todo.completed) {
            createConfetti(10);
        }
    }
}

// Delete todo
function deleteTodo(id) {
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    
    if (!confirm(`Delete "${todo.task.substring(0, 20)}${todo.task.length > 20 ? '...' : ''}"?`)) {
        return;
    }
    
    todos = todos.filter(t => t.id !== id);
    saveTodos();
    renderTodos();
    updateProgress();
    
    showNotification('Task deleted! 🗑️', 'success');
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
                </div>
            </div>
            <div class="todo-actions">
                <button class="todo-btn delete-btn" title="Delete" aria-label="Delete task">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners to the new elements
    document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        const todoItem = checkbox.closest('.todo-item');
        if (todoItem) {
            const id = todoItem.dataset.id;
            checkbox.addEventListener('change', () => toggleTodo(id));
        }
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        const todoItem = btn.closest('.todo-item');
        if (todoItem) {
            const id = todoItem.dataset.id;
            btn.addEventListener('click', () => deleteTodo(id));
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

// Save todos to localStorage
function saveTodos() {
    try {
        localStorage.setItem('bunny-todos', JSON.stringify(todos));
        console.log('💾 Saved todos to localStorage:', todos.length, 'items');
    } catch (error) {
        console.error('❌ Error saving to localStorage:', error);
        showNotification('Error saving tasks!', 'error');
    }
}

// Load todos from localStorage
function loadTodos() {
    try {
        const saved = localStorage.getItem('bunny-todos');
        if (saved) {
            todos = JSON.parse(saved);
            console.log('📂 Loaded todos from localStorage:', todos.length, 'items');
            renderTodos();
            updateProgress();
        }
    } catch (error) {
        console.error('❌ Error loading from localStorage:', error);
        todos = [];
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
    return icons[category] || '📌';
}

function formatDate(dateString) {
    try {
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
        return '';
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
        `;
        document.head.appendChild(style);
    }
}

// Initialize missing styles
addMissingStyles();

// Export for debugging (optional)
window.todoApp = {
    getTodos: () => todos,
    clearTodos: () => {
        todos = [];
        saveTodos();
        renderTodos();
        updateProgress();
    },
    addTestTask: () => {
        const testTasks = [
            { task: "Buy carrots for bunny 🥕", category: "shopping" },
            { task: "Finish coding project 💻", category: "work" },
            { task: "Go for a morning run 🏃‍♀️", category: "health" }
        ];
        
        const randomTask = testTasks[Math.floor(Math.random() * testTasks.length)];
        const newTodo = {
            id: Date.now(),
            task: randomTask.task,
            category: randomTask.category,
            completed: false,
            created_at: new Date().toISOString()
        };
        
        todos.unshift(newTodo);
        saveTodos();
        renderTodos();
        updateProgress();
        showNotification('Added test task!', 'success');
    }
};

console.log('🎯 Todo app loaded! Try: todoApp.addTestTask() in console');
