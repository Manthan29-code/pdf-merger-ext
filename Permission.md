# Troubleshooting Local File Access (`file://`) Issues

If this extension is not working as expected when you open local files (such as local PDFs or HTML files), it is highly likely due to the browser's built-in security mechanisms. Modern browsers restrict extensions from accessing local files by default to protect your system.

Below is an explanation of why this happens, why you might see differences between Google Chrome and Microsoft Edge, and how to enable the necessary permissions to make the extension work.

---

## Why Browsers Restrict Access to `file://` URLs

The fundamental reason browsers block or strictly gate access to local files is **security and sandboxing**. If any web extension could freely execute local commands or read files without your explicit knowledge, it would introduce severe vulnerabilities:

* **Malicious Data Exfiltration:** A malicious website or a compromised extension could silently scan your entire hard drive, read sensitive configuration files, SSH keys, or personal documents, and upload them to a remote server.
* **The Same-Origin Policy (SOP) Paradox:** On the live web, `https://example.com` cannot read data from `https://yourbank.com` due to the Same-Origin Policy. However, local files historically lacked a robust origin model. If a local file could access other local files, opening a single downloaded malicious HTML file could compromise your entire local file system.
* **Preventing "Drive-by" Attacks:** If you accidentally download a file or an extension scripts an invisible local file fetch, the browser serves as the firewall protecting your operating system from the web environment.

---

## Primary Reasons It May Not Run On Your Browser

If the extension works perfectly in one browser (e.g., Chrome) but fails or behaves unexpectedly in another (e.g., Edge), it typically comes down to two main causes:

### Cause A: The "Allow access to file URLs" Setting (Most Common)
Chromium browsers require an explicit, manual user opt-in for an extension to interact with the local file system. Even if the extension requests this permission in its source code, the browser overrides it until you manually flip the toggle. You may have enabled this in Chrome in the past while leaving it disabled in Edge.

### Cause B: Differences in Default PDF/File Viewers
Microsoft Edge uses a heavily customized, feature-rich internal PDF reader with strict internal security wrappers. Google Chrome uses the standard Chromium PDFium viewer. Because of these architectural differences, Edge's internal viewer may apply tighter restrictions on extension content scripts trying to access local file streams until explicit permissions are granted.

---

## How to Fix: Step-by-Step Enablement Guide

To grant the extension permission to read local files, follow these steps depending on the browser you are using:

### For Microsoft Edge
1. Open Edge and navigate to `edge://extensions`.
2. Find this extension in your list and click the **Details** button.
3. Scroll down to find the **"Allow access to file URLs"** checkbox.
4. **Explicitly check/toggle this setting ON.** If it is turned OFF, your background scripts or content scripts cannot touch local files.

### For Google Chrome
1. Open Chrome and navigate to `chrome://extensions`.
2. Locate this extension and click the **Details** button.
3. Find the toggle labeled **"Allow access to file URLs"**.
4. **Turn the toggle ON.**