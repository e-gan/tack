let activeTask = null;
let activeTaskStartTime = null;
let timerInterval = null;

// Resume task tracking on startup
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.sync.get(['activeTask', 'elapsedTime'], function (data) {
        if (data.activeTask) {
            activeTask = data.activeTask.id;
            activeTaskStartTime = data.activeTask.startTime;
            resumeTask();
        }
    });
});

// Listen for messages from popup.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "startTask") {
        startTask(request.taskId, request.startTime, request.elapsedTime);
    } else if (request.action === "stopTask") {
        stopTask();
    } else if (request.action === "getTaskStatus") {
        sendResponse({
            activeTask: activeTask,
            startTime: activeTaskStartTime
        });
    }
});

// Start tracking a task (keeps running even when popup closes)
function startTask(taskId, startTime, elapsedTime) {
    if (activeTask) {
        stopTask();
    }

    activeTask = taskId;
    activeTaskStartTime = startTime - elapsedTime;

    chrome.storage.sync.set({
        activeTask: {
            id: activeTask,
            startTime: activeTaskStartTime
        }
    });

    if (timerInterval) {
        clearInterval(timerInterval);
    }

    // Continuously update elapsed time every second
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - activeTaskStartTime;
        chrome.storage.sync.set({ elapsedTime: elapsedTime });
    }, 1000);
}

// Stop tracking a task
function stopTask() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    activeTask = null;
    activeTaskStartTime = null;

    chrome.storage.sync.remove(['activeTask', 'elapsedTime']);
}

// Resume active task when Chrome restarts or extension reloads
function resumeTask() {
    chrome.storage.sync.get(['activeTask', 'elapsedTime'], function (data) {
        if (data.activeTask) {
            activeTask = data.activeTask.id;
            activeTaskStartTime = data.activeTask.startTime - (data.elapsedTime || 0);

            if (timerInterval) {
                clearInterval(timerInterval);
            }

            timerInterval = setInterval(() => {
                const elapsedTime = Date.now() - activeTaskStartTime;
                chrome.storage.sync.set({ elapsedTime: elapsedTime });
            }, 1000);
        }
    });
}
