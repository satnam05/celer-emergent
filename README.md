# JP Morgan Interview Preparation App (v20.59)

## 📌 Overview
The **JP Morgan Interview Preparation App** is a robust, single-page application (SPA) designed to simulate the rigorous technical and behavioral interview process at J.P. Morgan. Built as a zero-dependency, single-file HTML solution, it leverages React and Tailwind CSS via CDN for instant deployment and high portability.

This application provides a comprehensive suite of tools ranging from technical quizzes to voice-enabled mock interviews, specifically tailored for Full-Stack and Engineering roles.

---

## 🚀 Key Features

### 1. 🧠 Immersive Learning Modes
* **Mock Interview (formerly Type Answer):** * Simulates real behavioral/technical questions.
    * **Speech-to-Text:** Dictate answers with real-time transcription.
    * **WPM Analytics:** Live typing/speaking speed tracking with mindset feedback (Nervous vs. Confident).
    * **S.T.A.R. Method:** Dedicated input fields for Situation, Task, Action, and Result.
    * **Smart Scoring:** AI-based algorithm compares user answers against model answers using keyword recall and Levenshtein distance.
* **Concept Drill (formerly Flashcards):** * Standard flip-card interface for rapid revision.
    * **Pronunciation Studio:** Text-to-Speech (listen) and Voice Recording (speak) on *both* sides of the card to practice terminology.
* **Technical Quiz (formerly MCQ):** * Multiple-choice questions with randomized options.
    * Instant feedback with dark-mode compatible styling.
* **Industry Terms (formerly Vocab):** * Dedicated section for banking and technical jargon.
* **Knowledge Base:** * Curated study materials and external links.

### 2. ⚡ Productivity & UX
* **Focus (Zen) Mode:** * One-click distraction-free interface.
    * Hides navigation, dashboards, and headers.
    * Expands content to full screen.
* **Pressure Mode:** * Optional 60-second countdown timer to simulate high-pressure interview scenarios.
    * Smart logic pauses auto-submission if the user is currently speaking.
* **Daily Motivation Engine:** * Displays a daily rotating quote from engineering/tech leaders (Title Case, Playfair Display font).

### 3. 📊 Analytics Dashboard
* **Real-time Metrics:** Tracks Accuracy, Session Progress, and Global Prep completion.
* **Visualizations:** Multi-ring progress charts (no-spill layout).
* **Gamification:** "Trophy Room" with badges (e.g., "On Fire", "Sniper") based on streak and accuracy.
* **Data Persistence:** Auto-saves progress to browser `localStorage`.
* **Backup/Restore:** JSON export/import functionality to save progress across devices.

---

## 🛠 Tech Stack & Architecture

### Architecture Pattern
* **Monolithic Single-File SPA:** The entire application (Logic, UI, Styles, Assets) resides in a single `index.html` file.
* **Client-Side Rendering (CSR):** Uses Babel Standalone to compile React/JSX in the browser at runtime.
* **No Backend Required:** Logic is handled entirely by JavaScript; data is stored in `localStorage`.

### Technologies
* **Core:** React 18 (via UMD CDN)
* **Styling:** Tailwind CSS (via CDN) + Custom Animations
* **Icons:** FontAwesome 6.4 (via CDN)
* **Transpiler:** Babel Standalone
* **APIs Used:** * `Web Speech API` (Speech Recognition & Synthesis)
    * `MediaRecorder API` (Voice Recording/Playback)
    * `LocalStorage API` (Persistence)

### System Design
1.  **Data Layer:** Parses CSV strings embedded or fetched within the app into JSON objects.
2.  **State Management:** React `useState` and `useReducer` handle session history, active decks, and user settings.
3.  **Routing:** Boolean/String-based conditional rendering (no router library needed).
4.  **Error Handling:** Global Error Boundaries and Component Sandboxing prevent white-screen crashes.

---

## 🧪 Regression Testing Suite
The application includes a built-in "DevTools" suite with **66 automated regression tests**. These tests run on the client side to ensure stability before every "release."

**Recent Regression Coverage (v20.50 - v20.59):**
* `Test #50`: **Algo: Stop Word Filter** - Verifies filler words are ignored in scoring.
* `Test #51`: **Fix: NaN Safety Check** - Ensures accuracy doesn't display NaN on new sessions.
* `Test #53`: **Fix: Accuracy Logic** - Validates 1/1 correct answers = 100%.
* `Test #54`: **Feat: WPM Persistence** - Ensures WPM data survives after recording stops.
* `Test #55`: **UI: Session Progress Logic** - Checks bar movement within a specific deck.
* `Test #56`: **Algo: Short Answer Match** - Validates partial credit for concise correct answers.
* `Test #57`: **UI: Quote Engine** - Verifies daily quote generation.
* `Test #59`: **UI: Focus Mode State** - Checks toggle logic for Zen mode.
* `Test #63`: **Feat: Vocab Recorder** - Verifies audio recording in Flashcards.
* `Test #64`: **UI: Type Mode Peek** - Checks "Show Answer" toggle logic.
* `Test #65`: **UI: Rebranding Check** - Verifies tile renaming (e.g., "Mock Interview").
* `Test #66`: **Feat: Vocab Back Audio** - Verifies audio controls on the flip side.

---

## 📥 Installation & Usage

### Method 1: Direct File (Recommended)
1.  Download the `index.html` file.
2.  Open it in any modern web browser (Chrome, Safari, Edge).
3.  **Note:** For Voice Recording to work, the file must often be served over `localhost` or HTTPS due to browser security policies, though some browsers allow it for local files.

### Method 2: Local Server (For Development)
If you have Python installed, you can run a simple server to ensure all APIs work perfectly:
```bash
# In the directory containing index.html
python3 -m http.server 8000
# Open http://localhost:8000 in your browser
