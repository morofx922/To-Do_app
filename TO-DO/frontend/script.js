
const API_URL = 'http://127.0.0.1:5000/api';
let authToken = null;
let lastNotificationId = 0; 


const inputBox = document.getElementById('inputBox');
const categoryRow = document.getElementById('categoryRow');
const priorityRow = document.getElementById('priorityRow');
const prioritySelect = document.getElementById('prioritySelect');
const reminderSelect = document.getElementById('reminderSelect');
const taskSections = document.getElementById('task-sections');
const taskCounter = document.getElementById('sub');

async function apiCall(endpoint, method = 'GET', body = null) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    const response = await fetch(`${API_URL}${endpoint}`, config);

    if (response.status === 401) {
        console.error('Session expired. Please log in again.');
        authToken = null;
        return null;
    }

    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || 'API call failed');
    }

    const text = await response.text();
    return text ? JSON.parse(text) : null;
}


async function login(email, password) {
    const formData = new URLSearchParams();
    formData.append('username', email); 
    formData.append('password', password);

    const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData
    });

    if (!response.ok) throw new Error('Login failed. Check your credentials.');
    const data = await response.json();
    authToken = data.access_token;
    console.log('✅ Logged in successfully');
    return data;
}


async function fetchTasks() {
    try {
        const tasks = await apiCall('/tasks/');
        if (!tasks) return;
        renderTasks(tasks);
    } catch (error) {
        console.error('Failed to fetch tasks:', error);
        showInAppNotification('Failed to load tasks');
    }
}


function showCategories() {
    if (inputBox.value.trim() === '') {
        alert('You must write something!');
        return;
    }

    if (categoryRow.style.display === 'none' || categoryRow.style.display === '') {
        categoryRow.style.display = 'flex';
        priorityRow.style.display = 'none';
    } else {
        categoryRow.style.display = 'none';
        priorityRow.style.display = 'none';
    }
}


function selectCategory(category) {
    if (inputBox.value.trim() === '') return;

    priorityRow.style.display = 'flex';
    priorityRow.dataset.category = category;
}

async function confirmAddTask() {
    const category = priorityRow.dataset.category;
    const taskText = inputBox.value.trim();
    const priority = prioritySelect.value;
    const reminderValue = reminderSelect.value;

    if (taskText === '' || !category) return;

    const payload = {
        title: taskText,
        category: category,
        priority: priority
    };

    if (reminderValue) {
        payload.reminder_minutes = parseInt(reminderValue);
    }

    try {
        await apiCall('/tasks/', 'POST', payload);
        showInAppNotification(`Task "${taskText}" added!`);


        inputBox.value = '';
        categoryRow.style.display = 'none';
        priorityRow.style.display = 'none';
        reminderSelect.value = '';

        await fetchTasks();
    } catch (error) {
        showInAppNotification('Failed to add task: ' + error.message);
    }
}

function renderTasks(tasks) {
    taskSections.innerHTML = '';

    
    const grouped = { Daily: [], Weekly: [], Monthly: [] };
    tasks.forEach(task => {
        if (grouped[task.category]) {
            grouped[task.category].push(task);
        }
    });

    const categories = ['Daily', 'Weekly', 'Monthly'];

    categories.forEach(cat => {
        if (grouped[cat].length > 0) {
            
            const heading = document.createElement('div');
            heading.className = 'category-heading';
            heading.innerText = cat;
            taskSections.appendChild(heading);

            const ul = document.createElement('ul');

            grouped[cat].forEach(task => {
                const li = document.createElement('li');
                if (task.is_completed) li.classList.add('checked');

                
                const textSpan = document.createElement('span');
                textSpan.className = 'task-text';
                textSpan.innerText = task.title;
                li.appendChild(textSpan);

                
                const badge = document.createElement('span');
                badge.className = `priority-badge badge-${task.priority}`;
                badge.innerText = task.priority;
                li.appendChild(badge);

                
                if (task.reminder_at && !task.reminder_sent) {
                    const reminderIcon = document.createElement('span');
                    reminderIcon.className = 'reminder-icon';
                    reminderIcon.innerText = '⏰';
                    reminderIcon.title = `Reminder: ${new Date(task.reminder_at).toLocaleString()}`;
                    li.appendChild(reminderIcon);
                }

                
                const deleteBtn = document.createElement('span');
                deleteBtn.className = 'delete-btn';
                deleteBtn.innerHTML = '\u00d7';
                deleteBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    deleteTaskFromBackend(task.id);
                });
                li.appendChild(deleteBtn);

                
                li.addEventListener('click', () => toggleTaskInBackend(task.id));

                ul.appendChild(li);
            });

            taskSections.appendChild(ul);
        }
    });

    updateTaskCounter(tasks);
}


async function toggleTaskInBackend(id) {
    try {
        await apiCall(`/tasks/${id}/toggle`, 'PUT');
        await fetchTasks();
    } catch (error) {
        showInAppNotification('Failed to update task');
    }
}

async function deleteTaskFromBackend(id) {
    try {
        await apiCall(`/tasks/${id}`, 'DELETE');
        showInAppNotification('Task deleted');
        await fetchTasks();
    } catch (error) {
        showInAppNotification('Failed to delete task');
    }
}

function updateTaskCounter(tasks) {
    const total = tasks.length;
    const completed = tasks.filter(t => t.is_completed).length;

    if (total === 0) {
        taskCounter.innerText = "Add your task below: ";
    } else if (completed === 0) {
        taskCounter.innerText = `${total} of ${total}`;
    } else {
        taskCounter.innerText = `${completed} of ${total} done`;
    }
}

function showInAppNotification(message) {
    const notification = document.createElement('div');
    notification.className = 'in-app-notification';
    notification.innerText = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.classList.add('show'), 100);
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 500);
    }, 3000);
}

async function checkNotifications() {
    try {
        const notifications = await apiCall('/notifications/');
        if (!notifications || notifications.length === 0) return;

        notifications.forEach(notif => {
            if (notif.id > lastNotificationId) {
                showInAppNotification(notif.message);

                if (Notification.permission === 'granted') {
                    new Notification('To-Do Reminder', {
                        body: notif.message,
                        icon: '/favicon.ico'
                    });
                }

                lastNotificationId = notif.id;
            }
        });
    } catch (error) {
        console.error('Failed to check notifications:', error);
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

async function startApp() {
    try {
        await login('admin@example.com', 'admin123');
        await fetchTasks();
        checkNotifications();
        setInterval(checkNotifications, 30000); 
    } catch (error) {
        console.error('Startup failed:', error);
        taskCounter.innerText = 'Login failed. Check console.';
    }
}

startApp();