#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { exec } = require("child_process");

// Read payload from stdin
const payload = fs.readFileSync(0, "utf-8");

let data;
try {
  data = JSON.parse(payload);
} catch (e) {
  // Fail silently or log to debug
  process.exit(0);
}

const eventName = data.hook_event_name;
let title = "Gemini CLI";
let message = data.message || "Gemini Agent requires attention";

// Identify event type
if (eventName === "AfterAgent")
{
  message = data.message || "Task Finished!";
  sound = "Glass";
}
else if (eventName === "Notification" && data.notification_type === "ToolPermission") {
  message = data.message || "Gemini needs permission to run a tool.";
  sound = "Hero";
} else {
  title = "Gemini CLI | Unknown event";
  message = `eventName: ${eventName} data.notification_type: ${data.notification_type} data.message: ${data.message}`;
}




// Orchestration Logic
// 1. Try Terminal Native
// 2. Try OS Native (Fallback)

async function notify() {
  const terminalSuccess = await tryTerminalNotification(title, message);
  if (!terminalSuccess) {
    await tryOSNotification(title, message, sound);
  }
}

// Supported terminals for OSC 9
const ALLOWLISTED_TERMINALS = [
  "ghostty",
  "iterm.app",
  "iterm2",
  "kitty",
  "vscode",
  "apple_terminal",
];

async function tryTerminalNotification(title, message) {
  const termProgram = (process.env.TERM_PROGRAM || "").toLowerCase();

  // Check if we are in an allowlisted terminal
  const isSupported = ALLOWLISTED_TERMINALS.some((term) =>
    termProgram.includes(term),
  );

  if (isSupported) {
    // OSC 9: \x1b]9;{message}\x07 (iTerm2 notification protocol)
    // We send it to stdout. The terminal emulator should intercept it.
    process.stdout.write(`\x1b]9;${message}\x07`);
    return true;
  }

  return false;
}

async function tryOSNotification(title, message, sound) {
  const platform = process.platform;

  if (platform === "darwin") {
    return notifyMacOS(title, message, sound);
  } else if (platform === "linux") {
    return notifyLinux(title, message);
  }

  return false;
}

function notifyMacOS(title, message, sound) {
  return new Promise((resolve) => {
    // Check for osascript
    exec("which osascript", (err) => {
      if (err) return resolve(false);

      // Escape quotes for AppleScript
      const safeTitle = title.replace(/"/g, '\\"');
      const safeMessage = message.replace(/"/g, '\\"');

      const script = `display notification "${safeMessage}" with title "${safeTitle}" sound name "${sound}"`;

      exec(`osascript -e '${script}'`, (err) => {
        if (err) resolve(false);
        else resolve(true);
      });
    });
  });
}

function notifyLinux(title, message) {
  return new Promise((resolve) => {
    // Check for notify-send
    exec("which notify-send", (err) => {
      if (err) return resolve(false);

      // Simple execution
      // Note: In a real shell script we'd be more careful with escaping,
      // but exec handles some of it if we are careful.
      // Ideally we'd use spawn but exec is shorter for this prototype.
      const safeTitle = title.replace(/"/g, '\\"');
      const safeMessage = message.replace(/"/g, '\\"');

      exec(`notify-send "${safeTitle}" "${safeMessage}"`, (err) => {
        if (err) resolve(false);
        else resolve(true);
      });
    });
  });
}

notify();
