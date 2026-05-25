// content.js — runs on all pages, nothing heavy needed here
// The background.js handles PDF detection via tab URL/title
// This file intentionally kept minimal to avoid interfering with PDF rendering



// "content_scripts": [
//     {
//         "matches": ["<all_urls>"],
//         "js": ["content.js"],
//         "run_at": "document_end"
//     }
// ]
// But the current extension does not actually need page - level JavaScript to detect PDFs.
//  background.js already checks browser tabs using chrome.tabs:

//     chrome.tabs.query(...)
// chrome.tabs.onUpdated(...)

// So content.js was likely kept for one of these reasons:

// Future use, for example reading PDF viewer DOM details.
// Manifest structure was prepared early, then logic moved to background.js.
// To avoid touching pages unnecessarily, it was left intentionally empty.

// For your current extension, it is not needed.
// You can safely remove the content_scripts block from manifest.json and delete content.js, unless you plan to use content - script logic later.