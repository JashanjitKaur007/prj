# TODO

- [ ] Update backend `generateResponse` error handling to detect Gemini quota/rate-limit/auth errors and return a structured error (`code`, `message`, `details`) with appropriate HTTP status.
- [ ] Update frontend `Home.jsx` chat error catch block to display backend-provided error message/code instead of hardcoded quota-expired text for every error.
- [ ] (After deploy) Verify chat works on Vercel and that error messaging reflects real Gemini failure reason.

