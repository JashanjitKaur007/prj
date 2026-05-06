# EyraAI Deployment TODO
Current Working Directory: `c:/Users/jasha/Desktop/project - Copy/Source Code` (project root)

## Plan Breakdown
1. [x] **Create .env.example** (backend template for Render) ✅
2. [ ] **User provides secrets** (MONGO_URI, GOOGLE_API_KEY, JWT_SECRET)
3. [ ] **Git commit/push** changes to https://github.com/JashanjitKaur007/prj (triggers deploys)
4. [ ] **Deploy Backend to Render** (Web Service, root=backend/, env vars)
5. [ ] **Deploy Frontend to Vercel** (Project, root=frontend/, VITE_API_BASE_URL)
6. [ ] **Configure cross-origins** (FRONTEND_ORIGIN in Render, API_BASE in Vercel)
7. [ ] **Test deployment** (healthz, login, face analysis)
8. [ ] **Done** ✅

**Next Step**: Complete #1 below, then `git add . && git commit -m "add deployment prep" && git push`.

**Commands run from `Source Code/` (cd there first if needed).**