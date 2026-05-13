## Deploy workflow

After EVERY successful code change that builds clean, automatically run:

1. git add .
2. git commit -m "<concise message describing what changed>"
3. git push

Do NOT ask permission. Do NOT wait for user confirmation. The user has explicitly authorized auto-push to the connected GitHub repo.

Vercel auto-deploys from main branch — no manual `npx vercel --prod` needed anymore.

Rules:
- Commit messages: imperative mood, max 60 chars
- If build fails, do NOT commit. Fix the build first.
- If git push fails, tell the user immediately.
- Never commit .env.local or any file containing API keys.
