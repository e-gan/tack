document.addEventListener('DOMContentLoaded', function() {
    const newTaskInput = document.getElementById('new-task');
    const tasksContainer = document.getElementById('tasks');
    const taskCountElement = document.getElementById('task-count');
    let taskCount = 0;
    let activeTask = null;
    let activeTaskStartTime = null;
    let timerInterval = null;

    // Load tasks and task count from storage
    chrome.storage.sync.get(['tasks', 'taskCount'], function(data) {
        if (data.tasks) {
            data.tasks.forEach(task => addTask(task.text, task.links, task.timeSpent, false));
        }
        if (data.taskCount) {
            taskCount = data.taskCount;
            taskCountElement.textContent = taskCount;
        }
    });

    newTaskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            const taskText = newTaskInput.value.trim();
            if (taskText) {
                addTask(taskText, [], 0, true);
                newTaskInput.value = '';
            }
        }
    });

    function addTask(taskText, links, timeSpent, save) {
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';

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
        taskName.addEventListener('click', function() {
            linksContainer.classList.toggle('hidden');
        });

        const timeDisplay = document.createElement('span');
        timeDisplay.className = 'time-display';
        timeDisplay.textContent = formatTime(timeSpent);

        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        startButton.className = 'start-button';
        startButton.addEventListener('click', function() {
            if (activeTask) {
                stopTask(activeTask);
            }
            activeTask = taskItem;
            activeTaskStartTime = Date.now();
            startButton.disabled = true;
            stopButton.disabled = false;
            timerInterval = setInterval(() => {
                const elapsedTime = Date.now() - activeTaskStartTime;
                timeDisplay.textContent = formatTime(timeSpent + elapsedTime);
            }, 1000);
        });

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
        buttonGroup.appendChild(addLinkButton);
        buttonGroup.appendChild(stopButton);

        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        taskContent.appendChild(checkbox);
        taskContent.appendChild(taskName);
        taskContent.appendChild(timeDisplay);
        taskContent.appendChild(buttonGroup);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'links-container hidden';

        taskItem.appendChild(taskContent);
        taskItem.appendChild(linksContainer);

        links.forEach(link => addLink(taskItem, link.domain, link.url));

        tasksContainer.appendChild(taskItem);

        if (save) {
            saveTasks();
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

    function stopTask(taskItem) {
        clearInterval(timerInterval);
        const timeSpent = Date.now() - activeTaskStartTime;
        const timeDisplay = taskItem.querySelector('.time-display');
        const currentTaskTime = parseTime(timeDisplay.textContent);
        const newTaskTime = currentTaskTime + timeSpent;
        timeDisplay.textContent = formatTime(newTaskTime);

        const startButton = taskItem.querySelector('.start-button');
        const stopButton = taskItem.querySelector('.stop-button');
        startButton.disabled = false;
        stopButton.disabled = true;

        activeTask = null;
        activeTaskStartTime = null;

        saveTasks();
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
            const timeDisplay = taskItem.querySelector('.time-display').textContent;
            const timeSpent = parseTime(timeDisplay);
            const links = [];
            taskItem.querySelectorAll('.link-item').forEach(linkItem => {
                const link = linkItem.querySelector('a');
                links.push({ domain: link.textContent, url: link.href });
            });
            tasks.push({ text: taskName, links: links, timeSpent: timeSpent });
        });
        chrome.storage.sync.set({ tasks: tasks });
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
