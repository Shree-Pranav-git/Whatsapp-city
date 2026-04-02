# WhatsApp City

A lightweight browser app to parse WhatsApp chat exports and visualize conversation analytics as a floating city dashboard.

## 🚀 What it does
- Parses WhatsApp chat text (`.txt`) exported from phone chat history
- Supports up to 5 different chat exports at once
- Extracts metrics: messages, media, links, emojis, call durations, questions
- Builds a playful city UI with districts representing conversation energy
- Highlights:
  - top senders
  - best emoji trends
  - busiest hour/day
  - monthly activity

## 📁 Project files
- `index.html` - UI layout and structure
- `style.css` - style and presentation
- `app.js` - parsing, analysis, district rendering and interaction logic
- `README.md` - this file

## 🧩 How to run
1. Clone/download repo.
2. Open `index.html` in your browser (or use live server for better refresh).
3. Drag `*.txt` WhatsApp export(s) into chat slots.
4. Click **GO** and watch your WhatsApp City build.

## 📥 Input format
WhatsApp export text format examples supported:
- `[21/12/2024, 09:23 - Alice: Hello!]`
- `21/12/2024, 09:23 - Alice: Hello!`
- `21/12/2024, 09:23:09 - Alice: Hello!`

Lines without sender header are appended to previous message body.

## 🎯 Features
- Chat upload grid (1-5 chats)
- Drag-and-drop and click file selection
- Media types counting: image, video, audio, sticker
- Link, emoji, question, and call-time extraction
- City districts for visual analytics (messages, media, calls, emojis, links, words)
- Summary stats and per-chat breakdown

## 💡 Customize
- Add new district in `getDistricts()` in `app.js`
- Adjust parsing regex in `parseWhatsApp()` for custom export variants
- Add color palette in `TOWN_PALETTE` (app.js)

## 🛠️ Notes
- Works best with exported chat files from WhatsApp desktop or mobile.
- If any message is malformed, parser attempts best effort and skips broken lines.

## 📄 License
MIT
