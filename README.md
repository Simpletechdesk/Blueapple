# Blue Apple Menu: menu + admin (7) + super admin + Paystack

GitHub stores the code and runs the tests. Netlify hosts it live (GitHub Pages cannot run logins, the database or payments).
Every push to `main` is tested, and only deployed live if the tests pass.

## Go live (one time)
1. Push to GitHub:
   `git init && git add . && git commit -m "first version" && git branch -M main`
   `git remote add origin https://github.com/YOU/REPO.git && git push -u origin main`
2. Netlify > Add new site > Deploy manually (an empty site is fine). Copy its **Site ID** (Site configuration > Site ID).
3. Netlify > User settings > Applications > create a **Personal access token**.
4. GitHub repo > Settings > Secrets and variables > Actions > add `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID`.
5. Netlify > Site configuration > Environment variables:
   `ADMIN_PASSWORD` (invite code), `SUPER_ADMIN_EMAIL`, `PAYSTACK_SECRET_KEY`, `PAYSTACK_PLAN_MONTHLY`, `PAYSTACK_PLAN_YEARLY`
6. GitHub > Actions > "Test and deploy to live" > Run workflow. After it turns green, the site is live.
Do NOT also link the repo inside Netlify's own build settings, or every push deploys twice.

## Go-live checklist
- Paystack: plans created (15,000 NGN monthly, 115,000 NGN yearly); webhook = `https://YOUR-SITE/api/paystack-webhook`; test with test keys first, then swap to live keys.
- Open `/admin` > Create account with the SUPER_ADMIN_EMAIL address + invite code (becomes the super user).
- Give the invite code to up to 7 admins. Manage them at `/super`.
- Scan your QR code and confirm the menu loads.
- Re-point the QR code if the site address changes.

Never commit keys to GitHub. Keep them only in Netlify variables and GitHub Secrets.
