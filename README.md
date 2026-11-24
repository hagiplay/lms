# LMS

פלטפורמת למידה בעברית (RTL): קורסים ומחזורים, נגן שיעור עם תמלול וציר זמן, הערות, מבדקים, משימות עם בדיקת מנחה, דיון שאלות-תשובות בשיעור, ניקוד ותעודות עם אימות ציבורי, מפגשים חיים, חיפוש ⌘K וניהול תוכן.

- דרישות: [`docs/references/master-prd.md`](docs/references/master-prd.md)
- משימות ומצב המימוש: [`docs/TASKS.md`](docs/TASKS.md)

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind v4 · Drizzle ORM · Postgres (Supabase) · Supabase Auth/Storage · Bunny Stream · Resend · Vitest · Playwright + axe

## הרצה מקומית (בלי Supabase)

צריך Node 22 ו-Postgres 16 מותקן מקומית (`brew install postgresql@16` ב-Mac).

```bash
npm install
npm run db:local      # Postgres זמני על פורט 54329 תחת .data/
cp .env.example .env.local
npm run db:migrate
npm run db:seed       # תוכנית לדוגמה + 4 משתמשים
npm run dev
```

פותחים http://localhost:3000 ומתחברים במסך "התחברות פיתוח" כאחד המשתמשים:

| משתמש/ת | תפקיד | מה רואים |
| --- | --- | --- |
| נועה כהן | member | התקדמות חלקית, יחידה 3 נעולה |
| עומר בר | member | חדש, יחידה 2 נעולה עד 50% מיחידה 1 |
| דני לוי | mentor | בדיקת משימות, מענה בדיון |
| מאיה אדמין | admin | ניהול תוכן, מפגשים ומשתמשים |

## בדיקות

```bash
npm run typecheck && npm run lint
npm test              # יחידה (לוגיקה טהורה)
npm run test:int      # אינטגרציה מול Postgres (DB: lms_test)
npm run test:e2e      # Playwright + axe מול build של production (DB: lms_e2e)
```

## חיבור לשירותים אמיתיים

1. **Supabase:** יוצרים פרויקט. מעתיקים את ה-URL, ה-anon key וה-service role key ל-`.env.local` (ובשרת: למשתני הסביבה של Vercel). `DATABASE_URL` = מחרוזת החיבור (Session pooler). מריצים `npm run db:migrate`.
   - **Auth:** מפעילים Email (OTP) ו-Google. ב-Email template של Magic Link מוסיפים `{{ .Token }}` כדי שיישלח קוד בן 6 ספרות. ב-Redirect URLs מוסיפים `https://<domain>/auth/callback`.
   - **Storage:** יוצרים bucket פרטי בשם `private`.
   - **אבטחה:** כל הטבלאות עם RLS בלי policies. ה-Data API של Supabase לא חושף כלום, והגישה לנתונים היא רק מהשרת.
2. **Bunny Stream:** יוצרים Library, מפעילים Embed token authentication, וממלאים `BUNNY_LIBRARY_ID` ו-`BUNNY_TOKEN_KEY`. בעריכת שיעור בוחרים "Bunny Stream" ומדביקים את מזהה הווידאו.
3. **Resend:** מאמתים דומיין, ממלאים `RESEND_API_KEY` ו-`EMAIL_FROM`.
4. **סליקה:** `POST /api/webhooks/payments?provider=<name>` עם כותרת `X-Signature: sha256=<HMAC-SHA256 של הגוף עם PAYMENT_WEBHOOK_SECRET>`. מבנה הגוף: `src/lib/domain/webhook.ts`. התשלום יוצר משתמש (אם אין) והרשמה; החזר מבטל גישה. כפילויות מטופלות (idempotent).

**סודות:** לעולם לא בקוד ולא ב-git. רק ב-`.env.local` מקומית ובמשתני הסביבה של פלטפורמת ה-deploy.
