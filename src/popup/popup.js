document.addEventListener('DOMContentLoaded', function() {
    const newTaskInput = document.getElementById('new-task');
    const categoryNameInput = document.getElementById('category-name');
    const colorOptionsContainer = document.getElementById('color-options');
    const addTaskButton = document.getElementById('add-task-button');
    const tasksContainer = document.getElementById('tasks');
    const taskCountElement = document.getElementById('task-count');
    const activeTaskName = document.getElementById('active-task-name');
    const totalTimeElement = document.getElementById('total-time');
    const summaryStats = document.getElementById('summary-stats');
    const refreshButton = document.getElementById('refresh-button');
    const categoryStatsContainer = document.getElementById('category-stats');
    let taskCount = 0;
    let totalTimeSpent = 0;
    let categoryTimes = {}; // maps colors to times
    let activeTaskId = null;
    let pausedTaskId = null;
    let activeTaskStartTime = null;
    // let timerInterval = null;
    let selectedColor = '#FFB3BA'; // Default color
    let selectedColorIndex = 0; // Index of the currently selected color
    let ringTimerInterval = null;
    let ringStartTime = null;
    let ringPausedElapsed = 0;
    const RING_CONFIG = {
        outerDuration: 2 * 60 * 1000, // 2 mins
        innerDuration: 2 * 60 * 1000,
        totalOuter: 163,
        totalInner: 125.6
    };

    // Predefined pastel color options in rainbow order
    const colors = ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E3BAFF'];

    // Add color options to the container
    colors.forEach((color, index) => {
        const colorOption = document.createElement('div');
        colorOption.className = 'color-option';
        colorOption.style.backgroundColor = color;
        colorOption.dataset.index = index; // Store index for easy navigation
        colorOption.addEventListener('click', () => {
            selectColor(index);
        });
        colorOptionsContainer.appendChild(colorOption);
    });


    function selectColor(indexOrColor) {
        let index;

        if (typeof indexOrColor === 'number') {
            index = indexOrColor
        } else {
            index = colors.indexOf(indexOrColor);
            if (index === -1) {
                console.error('Color not found in the predefined list.');
                return;
            }
        }
        selectedColor = colors[index];
        console.log("Selected color: ", selectedColor);
        // Highlight the selected color
        document.querySelectorAll('.color-option').forEach((option, i) => {
            option.style.borderColor = i === index ? '#000' : 'transparent';
        });
    }

    // Load saved tasks and stats from chrome.storage.sync
    chrome.storage.sync.get(['tasks', 'taskCount', 'totalTimeSpent', 'categoryTimes', 'activeTask', 'pausedTask'], function(data) {
        taskCount = data.taskCount || 0;
        totalTimeSpent = data.totalTimeSpent || 0;
        categoryTimes = data.categoryTimes || {};

        const tasks = data.tasks || [];
        const activeTaskId = data.activeTask?.id;
        const pausedTaskId = data.pausedTask?.id;

        function waitForTaskToRender(taskId, callback) {
            const existing = getTaskItemById(taskId, { silent: true });
            if (existing) {
                callback(existing);
                return;
            }

            const observer = new MutationObserver(() => {
                const task = getTaskItemById(taskId, { silent: true });
                if (task) {
                    observer.disconnect();
                    callback(task);
                }
            });

            observer.observe(document.getElementById('tasks'), { childList: true, subtree: true });
        }

        tasks.forEach(task => {
            addTask(task.text, task.id, task.color, task.timeSpent, false);
        });

        if (activeTaskId) {
            waitForTaskToRender(activeTaskId, (taskItem) => {
                startTask(taskItem, data.activeTask.startTime);
                startRing(data.activeTask.startTime);
            });
        } else if (pausedTaskId) {
            waitForTaskToRender(pausedTaskId, (taskItem) => {
                const stopButton = taskItem.querySelector('.stop-button');
                const startButton = taskItem.querySelector('.start-button');
                const resumeButton = taskItem.querySelector('.resume-button');

                startButton.style.visibility = 'hidden';
                stopButton.style.visibility = 'hidden';
                resumeButton.style.visibility = 'visible';
                resumeButton.disabled = false;

                ringPausedElapsed = data.pausedTask.ringPausedElapsed || 0;

                const outerRing = document.getElementById("outer-ring");
                const innerRing = document.getElementById("inner-ring");
                const timerText = document.getElementById("countdown-timer");

                if (outerRing && innerRing && timerText) {
                    const elapsed = ringPausedElapsed;

                    if (elapsed <= RING_CONFIG.outerDuration) {
                        const progress = elapsed / RING_CONFIG.outerDuration;
                        outerRing.style.strokeDashoffset = RING_CONFIG.totalOuter * (1 - progress);
                        innerRing.style.strokeDashoffset = RING_CONFIG.totalInner;
                    } else if (elapsed <= RING_CONFIG.outerDuration + RING_CONFIG.innerDuration) {
                        outerRing.style.strokeDashoffset = 0;
                        const innerElapsed = elapsed - RING_CONFIG.outerDuration;
                        const progress = innerElapsed / RING_CONFIG.innerDuration;
                        innerRing.style.strokeDashoffset = RING_CONFIG.totalInner * (1 - progress);
                    } else {
                        outerRing.style.strokeDashoffset = 0;
                        innerRing.style.strokeDashoffset = 0;
                    }

                    timerText.textContent = "Paused";
                }
            });
        }

        taskCountElement.textContent = taskCount;
        totalTimeElement.textContent = formatTime(totalTimeSpent);
        updateCategoryStats();
    });


    newTaskInput.focus();

    newTaskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            selectColor(0);  // Select the first color by default
            colorOptionsContainer.focus();  // Move focus to color selection
        }
    });

    colorOptionsContainer.setAttribute('tabindex', '0'); // Make div focusable

    colorOptionsContainer.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowRight') {
            console.log("arrow right color options container");
            selectedColorIndex = (selectedColorIndex + 1) % colors.length;
            selectColor(selectedColorIndex);
        } else if (event.key === 'ArrowLeft') {
            selectedColorIndex = (selectedColorIndex - 1 + colors.length) % colors.length;
            selectColor(selectedColorIndex);
        } else if (event.key === 'Enter') {
            createTask();
        }

    });

    addTaskButton.addEventListener('click', function() {
        createTask();
    });

    refreshButton.addEventListener('click', function() {
        // Reset summary stats
        taskCount = 0;
        totalTimeSpent = 0;
        categoryTimes = {};

        // Update the UI for summary stats
        taskCountElement.textContent = taskCount;
        totalTimeElement.textContent = formatTime(totalTimeSpent);
        updateCategoryStats();

        // Save the updated summary stats to storage
        chrome.storage.sync.set({
            taskCount: taskCount,
            totalTimeSpent: totalTimeSpent,
            categoryTimes: categoryTimes
        });
    });

    summaryStats.addEventListener('click', function() {
        const statsContainer = document.getElementById('stats-container');
        statsContainer.classList.toggle('hidden');
    });

    function createTask() {
        const taskText = newTaskInput.value.trim();

        if (taskText) {
            const taskId = `task-${Date.now()}`;
            addTask(taskText, taskId, selectedColor, 0, true);
            newTaskInput.value = '';
            selectedColorIndex = -1; // Reset color selection
            document.querySelectorAll('.color-option').forEach(option => option.style.borderColor = 'transparent');
        }
    }

    function getTaskItemById(taskId, options = {}) {
        const { silent = false } = options;
        const taskItem = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskItem && !silent) {
            console.error(`Task with ID "${taskId}" not found in the DOM.`);
        }
        return taskItem;
    }

    function saveTasks() {
        const tasks = [];
        tasksContainer.querySelectorAll('.task-item').forEach(taskItem => {
            const taskName = taskItem.querySelector('span').textContent;
            const taskId = taskItem.dataset.taskId;
            const color = taskItem.style.borderColor;
            const cumulativeTime = parseInt(taskItem.dataset.cumulativeTime);
            tasks.push({ text: taskName, id: taskId, color: color, links: [], timeSpent: cumulativeTime });
        });

        chrome.storage.sync.set({
            tasks: tasks,
            taskCount: taskCount,
            totalTimeSpent: totalTimeSpent,
            categoryTimes: categoryTimes,
        });
    }

    function incrementTaskCount(){
        taskCount++;
        taskCountElement.textContent = taskCount;
        chrome.storage.sync.set({ taskCount: taskCount });
    }


    function addTask(taskText, taskId, color, timeSpent, save) {
        console.log(`Adding task with ID: ${taskId}`);
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        taskItem.dataset.taskId = taskId; // Store task ID in data attribute
        taskItem.dataset.cumulativeTime = timeSpent; // Store cumulative time in data attribute
        taskItem.style.borderColor = color; // Set border color based on category


        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'checkbox';
        const checkSound = new Audio('check.wav');

        checkbox.addEventListener('change', function() {
            if (checkbox.checked) {
                checkSound.play();

                confetti({
                    particleCount: 50,
                    spread: 60,
                    origin: { y: 0.6 }
                });

                taskItem.style.transition = 'all 0.4s ease';
                taskItem.style.transform = 'scale(0.95)';
                taskItem.style.backgroundColor = '#d4edda'; // green flash

                const taskName = taskItem.querySelector('.task-name');
                if (taskName) taskName.style.textDecoration = 'line-through';

                const msg = document.createElement('div');
                msg.className = 'task-complete-message';
                msg.textContent = 'Task Complete!';
                document.body.appendChild(msg);
                setTimeout(() => msg.remove(), 1500);

                setTimeout(() => {
                    tasksContainer.removeChild(taskItem);
                    incrementTaskCount();
                    saveTasks();
                }, 500); // after animation completes

            }
        });

        const taskName = document.createElement('span');
        taskName.textContent = taskText;
        taskName.className = 'task-name';

        const taskNameContainer = document.createElement('div');
        taskNameContainer.className = 'task-name-container';
        taskNameContainer.appendChild(taskName);

        const cumulativeTimeDisplay = document.createElement('span');
        cumulativeTimeDisplay.className = 'cumulative-time-display';
        cumulativeTimeDisplay.textContent = formatTime(timeSpent); // Display cumulative time

        const timeContainer = document.createElement('div');
        timeContainer.className = 'time-container';
        // timeContainer.appendChild(timeDisplay);
        timeContainer.appendChild(cumulativeTimeDisplay);

        const startButton = document.createElement('button');
        startButton.textContent = 'Start';
        startButton.className = 'start-button';
        startButton.addEventListener('click', function() {
            startTask(taskItem);
        });

        const stopButton = document.createElement('button');
        stopButton.textContent = 'Stop';
        stopButton.className = 'stop-button';
        stopButton.style.visibility = 'hidden';
        stopButton.addEventListener('click', function() {
            stopTask(taskItem);
        });

        const resumeButton = document.createElement('button');
        resumeButton.textContent = 'Resume';
        resumeButton.className = 'resume-button';
        resumeButton.style.visibility = 'hidden'; // hidden initially
        resumeButton.addEventListener('click', function () {
            resumeTask(taskItem);
        });


        const buttonGroup = document.createElement('div');
        buttonGroup.className = 'button-group';
        buttonGroup.appendChild(startButton);
        buttonGroup.appendChild(stopButton);
        buttonGroup.appendChild(resumeButton);


        const taskContent = document.createElement('div');
        taskContent.className = 'task-content';
        taskContent.appendChild(checkbox);
        taskContent.appendChild(taskNameContainer);
        const bottomRow = document.createElement('div');
        bottomRow.className = 'bottom-row';
        bottomRow.appendChild(timeContainer);
        bottomRow.appendChild(buttonGroup);
        taskContent.appendChild(bottomRow);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'links-container hidden';

        taskItem.appendChild(taskContent);
        taskItem.appendChild(linksContainer);

        // links.forEach(link => addLink(taskItem, link.domain, link.url));

        tasksContainer.appendChild(taskItem);

        if (save) {
            if (!categoryTimes[color]) {
                categoryTimes[color] = 0;
            }
            saveTasks();
            requestAnimationFrame(() => {
                updateCategoryStats();
            });
        }
    }

    function startTask(taskItem, startTime) {
        document.querySelectorAll('.start-button, .stop-button, .resume-button').forEach(btn => {
            btn.style.visibility = 'visible';
            btn.disabled = false;
        });

        if (!taskItem || !(taskItem instanceof HTMLElement)) {
            console.error('Task item is not a valid DOM element.');
            return;
        }

        if (!taskItem.dataset) {
            console.error('Task item does not have a dataset property.');
            return;
        }

        if (!taskItem.dataset.taskId) {
            console.error('Task item does not have a valid data-task-id attribute.');
            return;
        }
        console.log("Start clicked for", taskItem.dataset.taskId);
        if (activeTaskId && activeTaskStartTime) {
            const prevTask = getTaskItemById(activeTaskId);
            if (prevTask) {
                stopTask(prevTask);
            } else {
                console.warn(`Previous active task with ID ${activeTaskId} no longer exists.`);
                activeTaskId = null;
                activeTaskStartTime = null;
                chrome.storage.sync.remove(['activeTask']);
            }
        }

        if (!startTime) {
            startTime = Date.now();
        }

        activeTaskId = taskItem.dataset.taskId;
        activeTaskStartTime = startTime;
        chrome.storage.sync.set({
            activeTask: {
              id: activeTaskId,
              startTime: activeTaskStartTime
            }
          });


        const stopButton = taskItem.querySelector('.stop-button');
        const startButton = taskItem.querySelector('.start-button');
        taskItem.classList.add('active');


        startButton.disabled = true;
        stopButton.disabled = false;

        document.querySelectorAll('.start-button, .stop-button, .resume-button').forEach(btn => {
            btn.style.visibility = 'hidden';
        });
        stopButton.style.visibility = 'visible';
        resetRing();
        startRing();
    }

    function stopTask(taskItem) {
        pauseRing();

        // FIX: Get elapsedTime before resetting activeTaskStartTime
        const elapsedTime = Date.now() - activeTaskStartTime;

        const cumulativeTimeDisplay = taskItem.querySelector('.cumulative-time-display');
        taskItem.dataset.cumulativeTime = parseInt(taskItem.dataset.cumulativeTime) + elapsedTime;
        cumulativeTimeDisplay.textContent = formatTime(parseInt(taskItem.dataset.cumulativeTime));

        activeTaskId = null;
        activeTaskStartTime = null;

        totalTimeSpent += elapsedTime;
        totalTimeElement.textContent = formatTime(totalTimeSpent);

        const color = taskItem.style.borderColor;
        if (!categoryTimes[color]) categoryTimes[color] = 0;
        categoryTimes[color] += elapsedTime;
        updateCategoryStats();
        saveTasks();

        chrome.storage.sync.set({
            pausedTask: {
              id: taskItem.dataset.taskId,
              ringPausedElapsed: ringPausedElapsed,
              cumulativeTime: parseInt(taskItem.dataset.cumulativeTime),
            }
          });
        chrome.storage.sync.remove(['activeTask']);
        chrome.runtime.sendMessage({ action: "stopTask" });

        document.querySelectorAll('.start-button').forEach(btn => btn.style.visibility = 'visible');
        document.querySelectorAll('.stop-button').forEach(btn => btn.style.visibility = 'hidden');
        document.querySelectorAll('.task-item').forEach(item => {
            item.classList.remove('active');
            item.style.removeProperty('--pulse-color');
        });
        const startButton = taskItem.querySelector('.start-button');
        const resumeButton = taskItem.querySelector('.resume-button');
        const stopButton = taskItem.querySelector('.stop-button');

        startButton.style.visibility = 'hidden';
        stopButton.style.visibility = 'hidden';
        resumeButton.style.visibility = 'visible';
        resumeButton.disabled = false;
    }



    function resumeTask(taskItem) {
        chrome.storage.sync.get(['pausedTask'], function(data) {
            const ringElapsed = data.pausedTask?.ringPausedElapsed || 0;

            activeTaskId = taskItem.dataset.taskId;
            activeTaskStartTime = Date.now();

            document.querySelectorAll('.start-button, .stop-button, .resume-button').forEach(btn => {
                btn.style.visibility = 'hidden';
            });

            // Show STOP button ONLY for the resumed task
            const stopButton = taskItem.querySelector('.stop-button');
            stopButton.disabled = false;
            stopButton.style.visibility = 'visible';

            // Just in case: hide resume and start button for this task explicitly
            const resumeButton = taskItem.querySelector('.resume-button');
            const startButton = taskItem.querySelector('.start-button');
            taskItem.classList.add('active');
            taskItem.style.setProperty('--pulse-color', taskItem.style.borderColor || '#00cc66');

            resumeButton.style.visibility = 'hidden';
            startButton.style.visibility = 'hidden';

            // ✨ Use the previously paused time offset to continue the ring
            resetRing();
            ringPausedElapsed = ringElapsed;
            startRing(Date.now() - ringPausedElapsed);
            // Clear pausedTask and update activeTask in storage
            chrome.storage.sync.remove(['pausedTask']);
            chrome.storage.sync.set({
                activeTask: {
                    id: activeTaskId,
                    startTime: activeTaskStartTime
                }
            });
        });
    }




    function updateCategoryStats() {
        categoryStatsContainer.innerHTML = ''; // Clear old stats

        const colorMap = {}; // Map color -> list of tasks

        // Build the map of tasks grouped by color
        tasksContainer.querySelectorAll('.task-item').forEach(taskItem => {
            const color = taskItem.style.borderColor;
            let taskNameEl = taskItem.querySelector('.task-name');
            if (!taskNameEl) {
                console.warn("No task-name element found in:", taskItem);
            }
            const taskName = taskNameEl?.textContent || 'Untitled';
            const cumulativeTime = parseInt(taskItem.dataset.cumulativeTime || 0);

            if (!colorMap[color]) {
                colorMap[color] = [];
            }

            // Only add if not already in the list
            const alreadyExists = colorMap[color].some(task => task.name === taskName);
            if (!alreadyExists) {
                colorMap[color].push({ name: taskName, time: cumulativeTime });
            }
        });

        // Now render each color group
        Object.entries(colorMap).forEach(([color, tasks]) => {
            const totalTimeForColor = tasks.reduce((sum, t) => sum + t.time, 0);

            const colorBox = document.createElement('div');
            colorBox.className = 'summary-color-group';
            colorBox.style.borderColor = color;


            const colorHeader = document.createElement('div');
            colorHeader.style.fontWeight = 'bold';
            colorHeader.style.marginBottom = '5px';
            colorHeader.textContent = `${formatTime(totalTimeForColor)}`;
            colorBox.appendChild(colorHeader);

            const taskList = document.createElement('ul');
            taskList.style.listStyleType = 'none';
            taskList.style.paddingLeft = '15px';

            tasks.forEach(task => {
                const li = document.createElement('li');
                li.textContent = `${task.name}: ${formatTime(task.time)}`;
                taskList.appendChild(li);
            });

            colorBox.appendChild(taskList);
            categoryStatsContainer.appendChild(colorBox);
        });
    }



    function formatTime(milliseconds) {
        const totalSeconds = Math.floor(milliseconds / 1000);
        const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
        const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${hours}:${minutes}:${seconds}`;
    }

    // function getPieSlicePath(progress) {
    //     const radius = 14, center = 16;
    //     const angle = progress * 360;
    //     const radians = (angle - 90) * (Math.PI / 180);
    //     const x = center + radius * Math.cos(radians);
    //     const y = center + radius * Math.sin(radians);
    //     const largeArcFlag = progress > 0.5 ? 1 : 0;

    //     return `M${center},${center - radius} A${radius},${radius} 0 ${largeArcFlag},1 ${x},${y} L${center},${center} Z`;
    // }

    newTaskInput.focus();


    // RING TIMER RELATED

    function startRing(startTimeFromStorage = null) {
        const outerRing = document.getElementById("outer-ring");
        const innerRing = document.getElementById("inner-ring");
        const timerText = document.getElementById("countdown-timer");

        if (!outerRing || !innerRing || !timerText) return;

        // Clear any existing interval
        if (ringTimerInterval) {
            clearInterval(ringTimerInterval);
        }
        ringStartTime = startTimeFromStorage ? startTimeFromStorage : Date.now();
        const actualStart = startTimeFromStorage || Date.now();

        chrome.runtime.sendMessage({
        action: "startRing",
        startTime: actualStart
        });

        chrome.storage.local.set({ ringStartTime: actualStart });

        let breakStarted = false;

        ringTimerInterval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - ringStartTime;
        ringPausedElapsed = elapsed;

            if (elapsed <= RING_CONFIG.outerDuration) {
                // ⏳ Focus period
                const progress = elapsed / RING_CONFIG.outerDuration;
                outerRing.style.strokeDashoffset = RING_CONFIG.totalOuter * (1 - progress);
                innerRing.style.strokeDashoffset = RING_CONFIG.totalInner;

                const remaining = RING_CONFIG.outerDuration - elapsed;
                timerText.textContent = formatShortTime(remaining);

            } else if (elapsed <= RING_CONFIG.outerDuration + RING_CONFIG.innerDuration) {
                // ✅ Transition from focus to break
                if (!breakStarted) {
                    breakStarted = true;

                    // 🔔 Notify
                    chrome.notifications.create({
                        type: "basic",
                        iconUrl: "icons/timer_done.png",
                        title: "Break Time!",
                        message: "Focus time is over. Your 2-minute break has started.",
                        priority: 2
                    });

                    // // 💡 Optional: change icon or badge
                    // chrome.action.setBadgeText({ text: "BRK" });
                    // chrome.action.setBadgeBackgroundColor({ color: "#00cc66" }); // green
                    // }
                }

                    // 🧘 Break period
                    outerRing.style.strokeDashoffset = 0;

                    const innerElapsed = elapsed - RING_CONFIG.outerDuration;
                    const progress = innerElapsed / RING_CONFIG.innerDuration;
                    innerRing.style.strokeDashoffset = RING_CONFIG.totalInner * (1 - progress);

                    const remaining = RING_CONFIG.innerDuration - innerElapsed;
                    timerText.textContent = formatShortTime(remaining);

            } else {
                // 🎯 Both rings are done (focus + break)
                outerRing.style.strokeDashoffset = 0;
                innerRing.style.strokeDashoffset = 0;
                timerText.textContent = "Done!";

                // ✅ Badge update
                // chrome.action.setBadgeText({ text: "✔" });
                // chrome.action.setBadgeBackgroundColor({ color: '#32CD32' });

                // 🔔 Final notification
                chrome.notifications.create({
                type: "basic",
                iconUrl: "icons/timer_done.png",
                title: "All Done!",
                message: "Focus and break are finished. Ready for the next task.",
                priority: 2
                });

                // 🛑 Clear interval
                clearInterval(ringTimerInterval);
                ringTimerInterval = null;

                chrome.storage.local.remove('ringStartTime');


                // 🧹 Reset all task buttons
                document.querySelectorAll('.task-item').forEach(taskItem => {
                taskItem.classList.remove('active');
                taskItem.style.removeProperty('--pulse-color');

                const startButton = taskItem.querySelector('.start-button');
                const stopButton = taskItem.querySelector('.stop-button');
                const resumeButton = taskItem.querySelector('.resume-button');

                if (startButton) {
                    startButton.style.visibility = 'visible';
                    startButton.disabled = false;
                }
                if (stopButton) {
                    stopButton.style.visibility = 'hidden';
                    stopButton.disabled = true;
                }
                if (resumeButton) {
                    resumeButton.style.visibility = 'hidden';
                    resumeButton.disabled = true;
                }
                });

                // 🧹 Clear active task state
                activeTaskId = null;
                activeTaskStartTime = null;
                chrome.storage.sync.remove(['activeTask', 'pausedTask']);
            }
        }, 1000);
    }

    function pauseRing() {
        if (ringTimerInterval) {
            clearInterval(ringTimerInterval);
            ringTimerInterval = null;
        }

        const timerText = document.getElementById("countdown-timer");
        if (timerText) {
            timerText.textContent = "Paused";
        }
        chrome.action.setBadgeText({ text: "" });

    }

    function resetRing() {
        pauseRing(); // clear interval

        const outerRing = document.getElementById("outer-ring");
        const innerRing = document.getElementById("inner-ring");
        const timerText = document.getElementById("countdown-timer");

        if (outerRing) outerRing.style.strokeDashoffset = RING_CONFIG.totalOuter;
        if (innerRing) innerRing.style.strokeDashoffset = RING_CONFIG.totalInner;
        if (timerText) timerText.textContent = formatShortTime(RING_CONFIG.outerDuration);

        ringStartTime = null;
        ringPausedElapsed = 0;
    }



    function formatShortTime(ms) {
        const totalSeconds = Math.ceil(ms / 1000);
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
        const seconds = String(totalSeconds % 60).padStart(2, '0');
        return `${minutes}:${seconds}`;
    }

    chrome.storage.local.get(['ringStartTime'], function(data) {
        if (data.ringStartTime) {
            startRing(data.ringStartTime);  // resumes visual
            chrome.runtime.sendMessage({
                action: "startRing",
                startTime: data.ringStartTime  // resumes badge
            });
        }
    });

});
