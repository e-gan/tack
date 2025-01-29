let activeTask = null;
let activeTaskStartTime = null;
let timerInterval = null;

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Extension started");
    chrome.storage.sync.get(['activeTask'], function(data) {
        if (data.activeTask) {
            activeTask = data.activeTask.id;
            activeTaskStartTime = data.activeTask.startTime;
            resumeTask();
        }
    });
});

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

    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - activeTaskStartTime;
        chrome.storage.sync.set({ elapsedTime: elapsedTime });
    }, 1000);
}

function stopTask() {
    if (timerInterval) {
        clearInterval(timerInterval);
    }

    activeTask = null;
    activeTaskStartTime = null;

    chrome.storage.sync.remove(['activeTask', 'elapsedTime']);
}

function resumeTask() {
    if (activeTask && activeTaskStartTime) {
        if (timerInterval) {
            clearInterval(timerInterval);
        }

        timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - activeTaskStartTime;
            chrome.storage.sync.set({ elapsedTime: elapsedTime });
        }, 1000);
    }
}
