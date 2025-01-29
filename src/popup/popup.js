document.addEventListener('DOMContentLoaded', function() {
    const newTaskInput = document.getElementById('new-task');
    const categoryNameInput = document.getElementById('category-name');
    const categoryColorInput = document.getElementById('category-color');
    const tasksContainer = document.getElementById('tasks');
    const taskCountElement = document.getElementById('task-count');
    const totalTimeElement = document.getElementById('total-time');
    const summaryStats = document.getElementById('summary-stats');
    const refreshButton = document.getElementById('refresh-button');
    const categoryStatsContainer = document.getElementById('category-stats');
    let taskCount = 0;
    let totalTimeSpent = 0;
    let categoryTimes = {};
    let categoryColors = {};
    let activeTask = null;
    let activeTaskStartTime = null;
    let timerInterval = null;

    // Load tasks and task count from storage
    chrome.storage.sync.get(['tasks', 'taskCount', 'totalTimeSpent', 'categoryTimes', 'categoryColors', 'activeTask', 'elapsedTime'], function(data) {
        if (data.tasks) {
            data.tasks.forEach(task => addTask(task.text, task.category, task.color, task.links, task.timeSpent, false));
        }
        if (data.taskCount) {
            taskCount = data.taskCount;
            taskCountElement.textContent = taskCount;
        }
        if (data.totalTimeSpent) {
            totalTimeSpent = data.totalTimeSpent;
            totalTimeElement.textContent = formatTime(totalTimeSpent);
        }
        if (data.categoryTimes) {
            categoryTimes = data.categoryTimes;
        }
        if (data.categoryColors) {
            categoryColors = data.categoryColors;
        }
        if (data.activeTask) {
            const taskItem = document.querySelector(`[data-task-id="${data.activeTask.id}"]`);
            if (taskItem) {
                startTask(taskItem, data.activeTask.startTime, data.elapsedTime || 0);
            }
        }
        updateCategoryStats();
    });

    newTaskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            createTask();
        }
    });

    categoryNameInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            createTask();
        }
    });

    refreshButton.addEventListener('click', function() {
        taskCount = 0;
        totalTimeSpent = 0;
        categoryTimes = {};
        categoryColors = {};
        tasksContainer.innerHTML = '';
        categoryStatsContainer.innerHTML = '';
        taskCountElement.textContent = taskCount;
        totalTimeElement.textContent = formatTime(totalTimeSpent);
        chrome.storage.sync.set({ taskCount: taskCount, totalTimeSpent: totalTimeSpent, categoryTimes: categoryTimes, categoryColors: categoryColors, tasks: [] });
    });

    summaryStats.addEventListener('click', function() {
        const statsContainer = document.getElementById('stats-container');
        statsContainer.classList.toggle('hidden');
    });

    function createTask() {
        const taskText = newTaskInput.value.trim();
        const categoryName = categoryNameInput.value.trim();
        let categoryColor = categoryColorInput.value;
        if (taskText && categoryName) {
            if (categoryColors[categoryName] && categoryColor === '#ff0000') {
                categoryColor = categoryColors[categoryName];
            } else {
                categoryColors[categoryName] = categoryColor;
                updateCategoryColor(categoryName, categoryColor);
            }
            addTask(taskText, categoryName, categoryColor, [], 0, true);
            newTaskInput.value = '';
            categoryNameInput.value = '';
            categoryColorInput.value = '#ff0000';
        }
    }

    function addTask(taskText, category, color, links, timeSpent, save) {
        const taskId = `task-${Date.now()}`;
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        taskItem.dataset.category = category; // Store category in data attribute
        taskItem.dataset.taskId = taskId; // Store task ID in data attribute
        taskItem.dataset.cumulativeTime = timeSpent; // Store cumulative time in data attribute
        taskItem.style.backgroundColor = color;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        checkbox.addEventListener('change', function() {
            if (checkbox.checked) {
                tasksContainer.removeChild(taskItem);
                incrementTaskCount();
                saveTasks();
            }
        });

        const taskName = document.createElement('span');
        taskName.textContent = taskText;
        taskName.className = 'task-name';

        const caret = document.createElement('span');
        caret.className = 'caret';
        caret.innerHTML = '&#9660;'; // Downward arrow

        const addLinkButton = document.createElement('button');
        addLinkButton.textContent = '+';
        addLinkButton.className = 'add-link-button';
        addLinkButton.addEventListener('click', function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const taskUrl = tabs[0].url;
                const domain = new URL(taskUrl).hostname;
                addLink(taskItem, domain, taskUrl);
                saveTasks();
            });
        });

        const taskNameContainer = document.createElement('div');
        taskNameContainer.className = 'task-name-container';
        taskNameContainer.appendChild(taskName);
        taskNameContainer.appendChild(addLinkButton);
        taskNameContainer.appendChild(caret);
        taskNameContainer.addEventListener('click', function() {
            linksContainer.classList.toggle('hidden');
            caret.classList.toggle('caret-rotate');
        });

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'time-display';
        timeDisplay.textContent = formatTime(0); // Initialize with 0 for current session

        const cumulativeTimeDisplay = document.createElement('span');
        cumulativeTimeDisplay.className = 'cumulative-time-display';
        cumulativeTimeDisplay.textContent = formatTime(timeSpent); // Display cumulative time

        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        startButton.className = 'start-button';
        startButton.addEventListener('click', function() {
            startTask(taskItem);
        });

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.className = 'stop-button';
        stopButton.disabled = true;
        stopButton.addEventListener('click', function() {
            stopTask(taskItem);
        });

        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        buttonGroup.appendChild(startButton);
        buttonGroup.appendChild(stopButton);

        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        taskContent.appendChild(checkbox);
        taskContent.appendChild(taskNameContainer);
        taskContent.appendChild(timeDisplay);
        taskContent.appendChild(cumulativeTimeDisplay);
        taskContent.appendChild(buttonGroup);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'links-container hidden';

        taskItem.appendChild(taskContent);
        taskItem.appendChild(linksContainer);

        links.forEach(link => addLink(taskItem, link.domain, link.url));

        tasksContainer.appendChild(taskItem);

        if (save) {
            if (!categoryTimes[category]) {
                categoryTimes[category] = 0;
                categoryColors[category] = color;
            }
            saveTasks();
            updateCategoryStats();
        }
    }

    function addLink(taskItem, domain, url) {
        const linksContainer = taskItem.querySelector('.links-container');

        const linkItem = document.createElement('div');
        linkItem.className = 'link-item';

        const link = document.createElement('a');
        link.href = url;
        link.textContent = domain;
        link.target = '_blank';

        const removeLinkButton = document.createElement('button');
        removeLinkButton.textContent = 'x';
        removeLinkButton.className = 'remove-link-button';
        removeLinkButton.addEventListener('click', function() {
            linksContainer.removeChild(linkItem);
            saveTasks();
        });

        linkItem.appendChild(link);
        linkItem.appendChild(removeLinkButton);
        linksContainer.appendChild(linkItem);
    }

    function startTask(taskItem, startTime = Date.now(), elapsedTime = 0) {
        if (activeTask) {
            stopTask(activeTask);
        }
        activeTask = taskItem;
        activeTaskStartTime = startTime - elapsedTime;
        const timeDisplay = taskItem.querySelector('.time-display');
        const startButton = taskItem.querySelector('.start-button');
        const stopButton = taskItem.querySelector('.stop-button');
        startButton.disabled = true;
        stopButton.disabled = false;
        timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - activeTaskStartTime;
            timeDisplay.textContent = formatTime(elapsedTime);
        }, 1000);
        chrome.runtime.sendMessage({ action: "startTask", taskId: taskItem.dataset.taskId, startTime: startTime, elapsedTime: elapsedTime });
    }

    function stopTask(taskItem) {
        clearInterval(timerInterval);
        const timeDisplay = taskItem.querySelector('.time-display');
        const cumulativeTimeDisplay = taskItem.querySelector('.cumulative-time-display');
        const elapsedTime = Date.now() - activeTaskStartTime;
        const currentTaskTime = parseTime(timeDisplay.textContent);
        const newTaskTime = currentTaskTime + elapsedTime;
        timeDisplay.textContent = formatTime(0); // Reset current session time
        taskItem.dataset.cumulativeTime = parseInt(taskItem.dataset.cumulativeTime) + elapsedTime;
        cumulativeTimeDisplay.textContent = formatTime(parseInt(taskItem.dataset.cumulativeTime)); // Update cumulative time

        const startButton = taskItem.querySelector('.start-button');
        const stopButton = taskItem.querySelector('.stop-button');
        startButton.disabled = false;
        stopButton.disabled = true;

        activeTask = null;
        activeTaskStartTime = null;

        totalTimeSpent += elapsedTime;
        totalTimeElement.textContent = formatTime(totalTimeSpent);

        const category = taskItem.dataset.category;
        if (!categoryTimes[category]) {
            categoryTimes[category] = 0;
        }
        categoryTimes[category] += elapsedTime;
        updateCategoryStats();

        saveTasks();
        chrome.runtime.sendMessage({ action: "stopTask" });
    }

    function incrementTaskCount() {
        taskCount++;
        taskCountElement.textContent = taskCount;
        chrome.storage.sync.set({ taskCount: taskCount });
    }

    function saveTasks() {
        const tasks = [];
        tasksContainer.querySelectorAll('li').forEach(taskItem => {
            const taskName = taskItem.querySelector('.task-name').textContent;
            const category = taskItem.dataset.category;
            const color = taskItem.style.backgroundColor;
            const cumulativeTime = parseInt(taskItem.dataset.cumulativeTime);
            const links = [];
            taskItem.querySelectorAll('.link-item').forEach(linkItem => {
                const link = linkItem.querySelector('a');
                links.push({ domain: link.textContent, url: link.href });
            });
            tasks.push({ text: taskName, category: category, color: color, links: links, timeSpent: cumulativeTime });
        });
        chrome.storage.sync.set({ tasks: tasks, totalTimeSpent: totalTimeSpent, categoryTimes: categoryTimes, categoryColors: categoryColors });
    }

    function updateCategoryStats() {
        categoryStatsContainer.innerHTML = '';
        for (const category in categoryTimes) {
            const categoryStat = document.createElement('div');
            categoryStat.className = 'category-highlight';
            categoryStat.style.backgroundColor = categoryColors[category];
            categoryStat.innerHTML = `<strong>${category}:</strong> ${formatTime(categoryTimes[category])}`;
            categoryStatsContainer.appendChild(categoryStat);

            const taskList = document.createElement('ul');
            taskList.style.listStyleType = 'none';
            taskList.style.paddingLeft = '20px';

            tasksContainer.querySelectorAll('.task-item').forEach(taskItem => {
                const taskName = taskItem.querySelector('.task-name').textContent;
                const taskCategory = taskItem.dataset.category;
                const cumulativeTime = taskItem.dataset.cumulativeTime;

                if (taskCategory === category) {
                    const taskStat = document.createElement('li');
                    taskStat.textContent = `${taskName}: ${formatTime(cumulativeTime)}`;
                    taskList.appendChild(taskStat);
                }
            });

            categoryStatsContainer.appendChild(taskList);
        }
    }

    function updateCategoryColor(category, color) {
        tasksContainer.querySelectorAll('.task-item').forEach(taskItem => {
            const taskCategory = taskItem.dataset.category;
            if (taskCategory === category) {
                taskItem.style.backgroundColor = color;
            }
        });
        updateCategoryStats();
    }

    function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    function parseTime(timeString) {
        const timeParts = timeString.split(':');
        const hours = parseInt(timeParts[0]) * 3600000;
        const minutes = parseInt(timeParts[1]) * 60000;
        const seconds = parseInt(timeParts[2]) * 1000;
        return hours + minutes + seconds;
    }
});
