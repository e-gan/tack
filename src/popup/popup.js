// This file contains the JavaScript logic for the popup of the Chrome extension.
// It handles user interactions and communicates with the background script.

document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('trackButton');
    
    button.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'startTracking' }, function(response) {
            console.log(response.status);
        });
    });
    
    const statsButton = document.getElementById('statsButton');
    
    statsButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({ action: 'getStats' }, function(response) {
            displayStats(response.data);
        });
    });
    
    function displayStats(data) {
        const statsContainer = document.getElementById('statsContainer');
        statsContainer.innerHTML = '';
        
        for (const [key, value] of Object.entries(data)) {
            const statElement = document.createElement('div');
            statElement.textContent = `${key}: ${value}`;
            statsContainer.appendChild(statElement);
        }
    }
});