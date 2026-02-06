const API_URL = 'http://localhost:5000/api';

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchTodos();
    setupEventListeners();
});

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

// Fetch todos from backend
async function fetchTodos() {
    try {
        const response = await fetch(`${API_URL}/todos`);
        if (!response.ok) throw new Error('Failed to fetch todos');
        
        todos = await response.json();
        renderTodos();
        updateProgress();
    } catch (error) {
        console.error('Error fetching todos:', error);
        showNotification('Failed to load tasks', 'error');
    }
}

// Add new todo
async function addTodo() {
    const task = newTaskInput.value.trim();
    const category = taskCategorySelect.value;

    if (!task) {
        showNotification('Please enter a task!', 'warning');
        newTaskInput.focus();
        return;
    }

    try {
        const response = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                task: task,
                category: category
            }),
        });

        const data = await response.json();
        
        if (response.ok) {
            newTaskInput.value = '';
            newTaskInput.focus();
            fetchTodos();
            showNotification('Task added successfully! ✨', 'success');
        } else {
            throw new Error(data.error || 'Failed to add task');
        }
    } catch (error) {
        console.error('Error adding todo:', error);
        showNotification(error.message, 'error');
    }
}

// Toggle todo completion
async function toggleTodo(id, completed) {
    try {
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ completed: !completed }),
        });

        if (response.ok) {
            fetchTodos();
            const status = !completed ? 'completed' : 'pending';
            showNotification(`Task marked as ${status}!`, 'success');
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to update task');
        }
    } catch (error) {
        console.error('Error updating todo:', error);
        showNotification(error.message, 'error');
    }
}

// Delete todo
async function deleteTodo(id) {
    if (!confirm('Are you sure you want to delete this task? 🌸')) return;

    try {
        const response = await fetch(`${API_URL}/todos/${id}`, {
            method: 'DELETE',
        });

        if (response.ok) {
            fetchTodos();
            showNotification('Task deleted successfully!', 'success');
        } else {
            const data = await response.json();
            throw new Error(data.error || 'Failed to delete task');
        }
    } catch (error) {
        console.error('Error deleting todo:', error);
        showNotification(error.message, 'error');
    }
}

// Render todos
function renderTodos() {
    const filteredTodos = filterTodos();
    
    if (filteredTodos.length === 0) {
        todoList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-list"></i>
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
                <span class="todo-category">${getCategoryIcon(todo.category)} ${todo.category}</span>
            </div>
            <div class="todo-actions">
                <button class="todo-btn delete-btn" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    // Add event listeners to checkboxes and delete buttons
    document.querySelectorAll('.todo-checkbox').forEach((checkbox, index) => {
        checkbox.addEventListener('change', () => {
            const todo = filteredTodos[index];
            toggleTodo(todo.id, Boolean(todo.completed));
        });
    });

    document.querySelectorAll('.delete-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const todo = filteredTodos[index];
            deleteTodo(todo.id);
        });
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

// Update progress tracker
async function updateProgress() {
    try {
        const response = await fetch(`${API_URL}/progress`);
        if (!response.ok) throw new Error('Failed to fetch progress');
        
        const data = await response.json();
        
        const progress = data.progress || 0;
        const total = data.total || 0;
        const completed = data.completed || 0;
        
        // Update progress circle
        const circumference = 2 * Math.PI * 54;
        const offset = circumference - (progress / 100) * circumference;
        progressBar.style.strokeDasharray = `${circumference} ${circumference}`;
        progressBar.style.strokeDashoffset = offset;
        
        // Update text
        percentageElement.textContent = `${progress}%`;
        completedTasksElement.textContent = completed;
        totalTasksElement.textContent = total;
        
        // Update progress text
        document.querySelector('.completed').textContent = `${completed}/${total} completed`;
    } catch (error) {
        console.error('Error fetching progress:', error);
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
    return icons[category] || '📝';
}

function showNotification(message, type) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Add notification styles if not already added
    if (!document.querySelector('#notification-styles')) {
        const style = document.createElement('style');
        style.id = 'notification-styles';
        style.textContent = `
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                padding: 15px 20px;
                border-radius: 15px;
                color: white;
                font-weight: bold;
                display: flex;
                align-items: center;
                gap: 10px;
                z-index: 1000;
                animation: slideIn 0.3s ease;
                box-shadow: 0 5px 15px rgba(0,0,0,0.2);
                min-width: 300px;
            }
            .notification.success {
                background: linear-gradient(135deg, var(--dark-green), #4CAF50);
                border-left: 5px solid #2E7D32;
            }
            .notification.error {
                background: linear-gradient(135deg, #ff6b6b, #ff4757);
                border-left: 5px solid #c62828;
            }
            .notification.warning {
                background: linear-gradient(135deg, #ffd166, #ff9e00);
                border-left: 5px solid #ef6c00;
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
        `;
        document.head.appendChild(style);
    }
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

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
            if (confetti.parentNode) {
                confetti.parentNode.removeChild(confetti);
            }
        }, 3000);
    }
}

// Enhanced showNotification function with more animations
function showNotification(message, type) {
    // Remove existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (existingNotification.parentNode) {
                existingNotification.parentNode.removeChild(existingNotification);
            }
        }, 300);
    }

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.body.appendChild(notification);
    
    // Trigger confetti for success notifications
    if (type === 'success') {
        setTimeout(() => createConfetti(20), 300);
    }
    
    // Add bounce animation
    notification.style.animation = 'slideIn 0.5s cubic-bezier(0.68, -0.55, 0.27, 1.55)';
    
    // Auto remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// Add loading animation for async operations
function showLoading(element) {
    const originalHTML = element.innerHTML;
    element.innerHTML = '<div class="loading-spinner"></div>';
    element.disabled = true;
    return originalHTML;
}

function hideLoading(element, originalHTML) {
    element.innerHTML = originalHTML;
    element.disabled = false;
}

// Enhanced addTodo with loading state
async function addTodo() {
    const task = newTaskInput.value.trim();
    const category = taskCategorySelect.value;

    if (!task) {
        showNotification('Please enter a task! 🌸', 'warning');
        newTaskInput.focus();
        return;
    }

    const originalButtonHTML = showLoading(addBtn);
    
    try {
        const response = await fetch(`${API_URL}/todos`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                task: task,
                category: category
            }),
        });

        const data = await response.json();
        
        if (response.ok) {
            newTaskInput.value = '';
            newTaskInput.focus();
            // Add a nice visual effect
            taskCategorySelect.style.transform = 'scale(1.1)';
            setTimeout(() => {
                taskCategorySelect.style.transform = 'scale(1)';
            }, 300);
            
            fetchTodos();
            showNotification('Task added successfully! ✨', 'success');
        } else {
            throw new Error(data.error || 'Failed to add task');
        }
    } catch (error) {
        console.error('Error adding todo:', error);
        showNotification(error.message, 'error');
    } finally {
        hideLoading(addBtn, originalButtonHTML);
    }
}

// Enhanced deleteTodo with better animations
async function deleteTodo(id) {
    const todoItem = document.querySelector(`.todo-item[data-id="${id}"]`);
    
    if (todoItem) {
        todoItem.style.animation = 'slideOut 0.3s ease';
        todoItem.style.transformOrigin = 'left';
    }
    
    setTimeout(async () => {
        try {
            const response = await fetch(`${API_URL}/todos/${id}`, {
                method: 'DELETE',
            });

            if (response.ok) {
                fetchTodos();
                showNotification('Task deleted successfully! 🗑️', 'success');
            } else {
                const data = await response.json();
                throw new Error(data.error || 'Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting todo:', error);
            showNotification(error.message, 'error');
            // Restore animation if error
            if (todoItem) {
                todoItem.style.animation = 'todoAppear 0.5s ease';
            }
        }
    }, 300);
}


function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
