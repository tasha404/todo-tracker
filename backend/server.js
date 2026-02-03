const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');

const app = express();
const PORT = 5000;

// Middleware
app.use(cors());
app.use(express.json());

// SQLite Database - will create todos.db file automatically
const db = new sqlite3.Database('./todos.db', (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('✅ Connected to SQLite database');
        initializeDatabase();
    }
});

// Create tables if they don't exist
function initializeDatabase() {
    db.run(`CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        completed BOOLEAN DEFAULT 0,
        category TEXT DEFAULT 'general',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
        if (err) {
            console.error('Error creating table:', err);
        } else {
            console.log('✅ Todos table ready');
        }
    });
}

// Routes

// Get all todos
app.get('/api/todos', (req, res) => {
    db.all('SELECT * FROM todos ORDER BY created_at DESC', [], (err, rows) => {
        if (err) {
            console.error('Error fetching todos:', err);
            res.status(500).json({ error: err.message });
        } else {
            res.json(rows);
        }
    });
});

// Create a new todo
app.post('/api/todos', (req, res) => {
    const { task, category = 'general' } = req.body;
    
    if (!task || task.trim() === '') {
        return res.status(400).json({ error: 'Task cannot be empty' });
    }
    
    db.run(
        'INSERT INTO todos (task, category) VALUES (?, ?)',
        [task.trim(), category],
        function(err) {
            if (err) {
                console.error('Error inserting todo:', err);
                res.status(500).json({ error: err.message });
            } else {
                // Return the newly created todo
                db.get('SELECT * FROM todos WHERE id = ?', [this.lastID], (err, row) => {
                    if (err) {
                        console.error('Error fetching new todo:', err);
                        res.status(500).json({ error: err.message });
                    } else {
                        res.status(201).json(row);
                    }
                });
            }
        }
    );
});

// Update a todo (toggle completion)
app.put('/api/todos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    const { completed, task, category } = req.body;
    
    let updateFields = [];
    let values = [];
    
    if (completed !== undefined) {
        updateFields.push('completed = ?');
        values.push(completed ? 1 : 0);
    }
    if (task !== undefined) {
        updateFields.push('task = ?');
        values.push(task);
    }
    if (category !== undefined) {
        updateFields.push('category = ?');
        values.push(category);
    }
    
    if (updateFields.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
    }
    
    values.push(id);
    
    const sql = `UPDATE todos SET ${updateFields.join(', ')} WHERE id = ?`;
    
    db.run(sql, values, function(err) {
        if (err) {
            console.error('Error updating todo:', err);
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Todo not found' });
        } else {
            // Return updated todo
            db.get('SELECT * FROM todos WHERE id = ?', [id], (err, row) => {
                if (err) {
                    console.error('Error fetching updated todo:', err);
                    res.status(500).json({ error: err.message });
                } else {
                    res.json(row);
                }
            });
        }
    });
});

// Delete a todo
app.delete('/api/todos/:id', (req, res) => {
    const id = parseInt(req.params.id);
    
    db.run('DELETE FROM todos WHERE id = ?', id, function(err) {
        if (err) {
            console.error('Error deleting todo:', err);
            res.status(500).json({ error: err.message });
        } else if (this.changes === 0) {
            res.status(404).json({ error: 'Todo not found' });
        } else {
            res.json({ message: 'Todo deleted successfully', id });
        }
    });
});

// Get progress statistics
app.get('/api/progress', (req, res) => {
    db.get('SELECT COUNT(*) as total FROM todos', [], (err, totalRow) => {
        if (err) {
            console.error('Error getting total count:', err);
            return res.status(500).json({ error: err.message });
        }
        
        db.get('SELECT COUNT(*) as completed FROM todos WHERE completed = 1', [], (err, completedRow) => {
            if (err) {
                console.error('Error getting completed count:', err);
                return res.status(500).json({ error: err.message });
            }
            
            const total = totalRow.total || 0;
            const completed = completedRow.completed || 0;
            const progress = total > 0 ? (completed / total) * 100 : 0;
            
            res.json({
                total,
                completed,
                progress: Math.round(progress)
            });
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📁 Database: todos.db (SQLite)`);
    console.log(`✨ API Endpoints:`);
    console.log(`   GET    http://localhost:${PORT}/api/todos`);
    console.log(`   POST   http://localhost:${PORT}/api/todos`);
    console.log(`   PUT    http://localhost:${PORT}/api/todos/:id`);
    console.log(`   DELETE http://localhost:${PORT}/api/todos/:id`);
    console.log(`   GET    http://localhost:${PORT}/api/progress`);
});