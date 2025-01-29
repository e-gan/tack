chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Extension started");
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStatus") {
        sendResponse({ status: "active" });
    }
});

// Additional event listeners and logic can be added here as needed.
