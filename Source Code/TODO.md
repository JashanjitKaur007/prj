# TODO

- [x] Update backend `generateResponse` error handling to detect Gemini quota/rate-limit/auth errors and return structured error (`code`, `message`, `details`) with appropriate HTTP status.
- [x] Update frontend `Home.jsx` chat error catch block to display backend-provided error message/code instead of hardcoded quota-expired text.
- [ ] Fix CORS preflight blocking login/registration from Vercel origin (backend `server.js`): ensure preflight OPTIONS gets proper CORS headers.
- [ ] Push changes to GitHub and redeploy backend + frontend.
- [ ] Verify chat + registration work on `https://prj-rjd63zve2-jashanjitkaurs-projects.vercel.app`.
