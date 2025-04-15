let ringInterval;
const WORK_DURATION = 2 * 60 * 1000;  // 2 min work
const BREAK_DURATION = 2 * 60 * 1000; // 2 min break
const TOTAL_DURATION = WORK_DURATION + BREAK_DURATION;


chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "startRing") {
      if (ringInterval) clearInterval(ringInterval);

      const start = message.startTime;
      ringInterval = setInterval(() => {
        const elapsed = Date.now() - start;

        if (elapsed < WORK_DURATION) {
          // Work phase
          const remaining = WORK_DURATION - elapsed;
          const min = Math.ceil(remaining / 60000);
          const sec = Math.ceil((remaining % 60000) / 1000);
          const display = min > 1 ? `${min}m` : `${sec}s`;

          chrome.action.setBadgeText({ text: display });
          chrome.action.setBadgeBackgroundColor({ color: '#FF6347' }); // red
        } else if (elapsed < TOTAL_DURATION) {
          // Break phase
          const breakElapsed = elapsed - WORK_DURATION;
          const remaining = BREAK_DURATION - breakElapsed;
          const min = Math.ceil(remaining / 60000);
          const sec = Math.ceil((remaining % 60000) / 1000);
          const display = min > 1 ? `${min}m` : `${sec}s`;

          chrome.action.setBadgeText({ text: 'BRK' }); // 💡 switch to display for break if you want
          chrome.action.setBadgeBackgroundColor({ color: '#00cc66' }); // green
        } else {
          // Done
          chrome.action.setBadgeText({ text: "✔" });
          chrome.action.setBadgeBackgroundColor({ color: '#32CD32' }); // lime green
          clearInterval(ringInterval);
        }
      }, 1000);
    }
  });
