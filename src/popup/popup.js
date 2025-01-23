document.addEventListener('DOMContentLoaded', function() {
    const newTaskInput = document.getElementById('new-task');
    const tasksContainer = document.getElementById('tasks');
    const taskCountElement = document.getElementById('task-count');
    let taskCount = 0;

    // Load tasks and task count from storage
    chrome.storage.sync.get(['tasks', 'taskCount'], function(data) {
        if (data.tasks) {
            data.tasks.forEach(task => addTask(task.text, task.links, false));
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
                addTask(taskText, [], true);
                newTaskInput.value = '';
            }
        }
    });

    function addTask(taskText, links, save) {
        const taskItem = document.createElement('li');
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

        const addLinkButton = document.createElement('button');
        addLinkButton.textContent = 'Add Link';
        addLinkButton.addEventListener('click', function() {
            chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
                const taskUrl = tabs[0].url;
                const domain = new URL(taskUrl).hostname;
                addLink(taskItem, domain, taskUrl);
                saveTasks();
            });
        });

        taskItem.appendChild(checkbox);
        taskItem.appendChild(taskName);
        taskItem.appendChild(addLinkButton);

        links.forEach(link => addLink(taskItem, link.domain, link.url));

        tasksContainer.appendChild(taskItem);

        if (save) {
            saveTasks();
        }
    }

    function addLink(taskItem, domain, url) {
        const linkItem = document.createElement('div');
        const link = document.createElement('a');
        link.href = url;
        link.textContent = domain;
        link.target = '_blank';

        const removeLinkButton = document.createElement('button');
        removeLinkButton.textContent = 'Remove';
        removeLinkButton.addEventListener('click', function() {
            taskItem.removeChild(linkItem);
            saveTasks();
        });

        linkItem.appendChild(link);
        linkItem.appendChild(removeLinkButton);
        taskItem.appendChild(linkItem);
    }

    function incrementTaskCount() {
        taskCount++;
        taskCountElement.textContent = taskCount;
        chrome.storage.sync.set({ taskCount: taskCount });
    }

    function saveTasks() {
        const tasks = [];
        tasksContainer.querySelectorAll('li').forEach(taskItem => {
            const taskName = taskItem.querySelector('span').textContent;
            const links = [];
            taskItem.querySelectorAll('div').forEach(linkItem => {
                const link = linkItem.querySelector('a');
                links.push({ domain: link.textContent, url: link.href });
            });
            tasks.push({ text: taskName, links: links });
        });
        chrome.storage.sync.set({ tasks: tasks });
    }
});
