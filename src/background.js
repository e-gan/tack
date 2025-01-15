// This file contains the background script for the Chrome extension. 
// It handles events and manages the extension's lifecycle.

chrome.runtime.onInstalled.addListener(() => {
    console.log("Extension installed");
});

chrome.runtime.onStartup.addListener(() => {
    console.log("Extension started");
});

// Example of handling a message from the content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getStatus") {
        sendResponse({ status: "active" });
    }
});

// Additional event listeners and logic can be added here as needed.