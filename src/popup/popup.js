document.addEventListener('DOMContentLoaded', function() {
    const newTaskInput = document.getElementById('new-task');
    const categoryNameInput = document.getElementById('category-name');
    const colorOptionsContainer = document.getElementById('color-options');
    const headerContainer = document.getElementById('header-container');
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
    let categoryTimes = {};
    let categoryColors = {};
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
    chrome.storage.sync.get(['tasks', 'taskCount', 'totalTimeSpent', 'categoryTimes', 'categoryColors', 'activeTask', 'pausedTask'], function(data) {
        if (data.tasks) {
            data.tasks.forEach(task => {
                addTask(task.text, task.id, task.category, task.color, task.links, task.timeSpent, false);
            });
        }
        taskCount = data.taskCount || 0;
        totalTimeSpent = data.totalTimeSpent || 0;
        categoryTimes = data.categoryTimes || {};
        categoryColors = data.categoryColors || {};
        if (data.activeTask) {
            const taskItem = getTaskItemById(data.activeTask.id);
            startTask(taskItem, data.activeTask.startTime);
            startRing(data.activeTask.startTime)
        } else if (data.pausedTask) {
            const pausedTaskItem = getTaskItemById(data.pausedTask.id);
            if (pausedTaskItem) {
                const stopButton = pausedTaskItem.querySelector('.stop-button');
                const startButton = pausedTaskItem.querySelector('.start-button');
                const resumeButton = pausedTaskItem.querySelector('.resume-button');

                startButton.style.display = 'none';
                stopButton.style.display = 'none';
                resumeButton.style.display = 'inline-block';

                resumeButton.disabled = false;


                // Restore ring to paused state
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
                        // timerText.textContent = formatShortTime(RING_CONFIG.outerDuration - elapsed);
                    } else if (elapsed <= RING_CONFIG.outerDuration + RING_CONFIG.innerDuration) {
                        outerRing.style.strokeDashoffset = 0;
                        const innerElapsed = elapsed - RING_CONFIG.outerDuration;
                        const progress = innerElapsed / RING_CONFIG.innerDuration;
                        innerRing.style.strokeDashoffset = RING_CONFIG.totalInner * (1 - progress);
                        // timerText.textContent = formatShortTime(RING_CONFIG.innerDuration - innerElapsed);
                    } else {
                        outerRing.style.strokeDashoffset = 0;
                        innerRing.style.strokeDashoffset = 0;
                        // timerText.textContent = "Done!";
                    }
                    // Set timer text to paused
                    timerText.textContent = "Paused";
                }
            }
        }

        taskCountElement.textContent = taskCount;
        totalTimeElement.textContent = formatTime(totalTimeSpent);
        updateCategoryStats();

    });

    newTaskInput.focus();

    newTaskInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            categoryNameInput.focus(); // Move focus to category name input
        }
    });

    categoryNameInput.addEventListener('keypress', function(event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevent form submission
            const categoryName = categoryNameInput.value.trim();
            if (categoryName) {
                console.log("Category name: ", categoryName);
                if (categoryColors[categoryName]) {
                    selectColor(categoryColors[categoryName]);
                } else {
                    // Move focus to color selection
                    selectColor(0);  // Select the first color by default
                }
                colorOptionsContainer.focus();  // Move focus to color selection
            }
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
        const categoryName = categoryNameInput.value.trim();

        if (taskText && categoryName) {
            const taskId = `task-${Date.now()}`;
            addTask(taskText, taskId, categoryName, selectedColor, [], 0, true);
            newTaskInput.value = '';
            categoryNameInput.value = '';
            selectedColorIndex = -1; // Reset color selection
            document.querySelectorAll('.color-option').forEach(option => option.style.borderColor = 'transparent');
        }
    }

    function getTaskItemById(taskId) {
        const temp = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        // console.log(temp.dataset.taskId);
        return temp;
    }

    function saveTasks() {
        const tasks = [];
        tasksContainer.querySelectorAll('.task-item').forEach(taskItem => {
            const taskName = taskItem.querySelector('span').textContent;
            const taskId = taskItem.dataset.taskId;
            const category = taskItem.dataset.category;
            const color = taskItem.style.borderColor;
            const cumulativeTime = parseInt(taskItem.dataset.cumulativeTime);
            tasks.push({ text: taskName, id: taskId, category: category, color: color, links: [], timeSpent: cumulativeTime });
        });

        chrome.storage.sync.set({
            tasks: tasks,
            taskCount: taskCount,
            totalTimeSpent: totalTimeSpent,
            categoryTimes: categoryTimes,
            categoryColors: categoryColors
        });
    }

    function incrementTaskCount(){
        taskCount++;
        taskCountElement.textContent = taskCount;
        chrome.storage.sync.set({ taskCount: taskCount });
    }


    function addTask(taskText, taskId, category, color, links, timeSpent, save) {
        const taskItem = document.createElement('li');
        taskItem.className = 'task-item';
        taskItem.dataset.category = category; // Store category in data attribute
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

        // const timeDisplay = document.createElement('span');
        // timeDisplay.className = 'time-display';
        // timeDisplay.textContent = formatTime(0); // Initialize with 0 for current session

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
        stopButton.disabled = true;
        stopButton.addEventListener('click', function() {
            stopTask(taskItem);
        });

        const resumeButton = document.createElement('button');
        resumeButton.textContent = 'Resume';
        resumeButton.className = 'resume-button';
        resumeButton.style.display = 'none'; // hidden initially
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
        taskContent.appendChild(timeContainer);
        taskContent.appendChild(buttonGroup);

        const linksContainer = document.createElement('div');
        linksContainer.className = 'links-container hidden';

        taskItem.appendChild(taskContent);
        taskItem.appendChild(linksContainer);

        // links.forEach(link => addLink(taskItem, link.domain, link.url));

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

    function startTask(taskItem, startTime) {
        if (!taskItem) {
            console.error('Task item not found');
            return;
        }
        if (activeTaskId && activeTaskStartTime) {
            stopTask(getTaskItemById(activeTaskId));
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

        startButton.disabled = true;
        stopButton.disabled = false;

        document.querySelectorAll('.start-button, .stop-button, .resume-button').forEach(btn => {
            btn.style.display = 'none';
        });
        stopButton.style.display = 'inline-block';
        resetRing();
        startRing();

        activeTaskName.textContent = "Current task: " + taskItem.querySelector('.task-name').textContent;
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

        const category = taskItem.dataset.category;
        if (!categoryTimes[category]) categoryTimes[category] = 0;
        categoryTimes[category] += elapsedTime;
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
        activeTaskName.textContent = "Start a task!";

        document.querySelectorAll('.start-button, .stop-button').forEach(btn => {
            btn.style.display = 'inline-block';
        });

        const startButton = taskItem.querySelector('.start-button');
        const resumeButton = taskItem.querySelector('.resume-button');
        const stopButton = taskItem.querySelector('.stop-button');

        startButton.style.display = 'none';
        stopButton.style.display = 'none';
        resumeButton.style.display = 'inline-block';
        resumeButton.disabled = false;
    }



    function resumeTask(taskItem) {
        chrome.storage.sync.get(['pausedTask'], function(data) {
            const ringElapsed = data.pausedTask?.ringPausedElapsed || 0;

            activeTaskId = taskItem.dataset.taskId;
            activeTaskStartTime = Date.now();

            document.querySelectorAll('.start-button, .stop-button, .resume-button').forEach(btn => {
                btn.style.display = 'none';
            });

            // Show STOP button ONLY for the resumed task
            const stopButton = taskItem.querySelector('.stop-button');
            stopButton.disabled = false;
            stopButton.style.display = 'inline-block';

            // Just in case: hide resume and start button for this task explicitly
            const resumeButton = taskItem.querySelector('.resume-button');
            const startButton = taskItem.querySelector('.start-button');
            resumeButton.style.display = 'none';
            startButton.style.display = 'none';

            // ✨ Use the previously paused time offset to continue the ring
            resetRing();
            ringPausedElapsed = ringElapsed;
            startRing(Date.now() - ringPausedElapsed);

            activeTaskName.textContent = "Resumed task: " + taskItem.querySelector('.task-name').textContent;

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
                taskItem.style.borderColor = color;
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

        // ringStartTime = Date.now() - ringPausedElapsed;

        ringTimerInterval = setInterval(() => {
            const now = Date.now();
            const elapsed = now - ringStartTime;
            ringPausedElapsed = elapsed; // keep track of pause point

            if (elapsed <= RING_CONFIG.outerDuration) {
                const progress = elapsed / RING_CONFIG.outerDuration;
                outerRing.style.strokeDashoffset = RING_CONFIG.totalOuter * (1 - progress);

                const remaining = RING_CONFIG.outerDuration - elapsed;
                timerText.textContent = formatShortTime(remaining);
            } else if (elapsed <= RING_CONFIG.outerDuration + RING_CONFIG.innerDuration) {
                outerRing.style.strokeDashoffset = 0;

                const innerElapsed = elapsed - RING_CONFIG.outerDuration;
                const progress = innerElapsed / RING_CONFIG.innerDuration;
                innerRing.style.strokeDashoffset = RING_CONFIG.totalInner * (1 - progress);

                const remaining = RING_CONFIG.innerDuration - innerElapsed;
                timerText.textContent = formatShortTime(remaining);
            } else {
                outerRing.style.strokeDashoffset = 0;
                innerRing.style.strokeDashoffset = 0;
                timerText.textContent = "Done!";
                clearInterval(ringTimerInterval);
                ringTimerInterval = null;
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

});
