# Responsible Technology Quiz App

Static HTML/CSS/JS app with:
- Main menu: Read mode and Exam mode
- Exam: total timer = 60s per question, Next-only navigation
- Random questions + shuffled options
- Tracks used questions (uniqueness across exams)
- Tracks wrong/unanswered questions (reappear until correct)

## Run locally
Because browsers block `fetch()` from `file://`, run a local server:

### Option A: Python
From this folder:
- Python 3:
  - `python -m http.server 8000`
Then open:
- http://localhost:8000

### Option B: VS Code Live Server
Right-click `index.html` -> "Open with Live Server"

## Deploy to GitHub Pages
1. Create a new GitHub repo (e.g. `responsible-tech-quiz`)
2. Upload all files in this folder to the repo root (including `questions_unique.json`)
3. In GitHub:
   - Settings -> Pages
   - Build and deployment:
     - Source: "Deploy from a branch"
     - Branch: `main` (or `master`) and folder `/ (root)`
4. Save. Your site will be available at the Pages URL GitHub shows.

Tip: If you use a project page (not username.github.io), set "Pages" to serve from root.
