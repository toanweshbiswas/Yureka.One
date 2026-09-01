import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import * as dotenv from "dotenv";
import { resolveRouteMeta } from './lib/seo/resolveRouteMeta';
import { staticPageMeta } from './lib/seo/pageMeta';
import { injectHtml } from './lib/seo/inject';
import { buildSitemapXml } from './lib/seo/sitemap';
import { registerGoldbackRoutes } from './lib/goldback/routes';
import { registerAdminRoutes } from './lib/admin/routes';
import { registerGiftcardRoutes } from './lib/hubble/routes';
import { registerCuelinksRoutes } from './lib/cuelinks/routes';
import { registerBrowseRoutes } from './lib/browse/routes';
import { registerCatalogRoutes } from './lib/catalog/routes';
import { registerMediaRoutes } from './lib/media/routes';
// import { registerEmbedRoutes } from './lib/embed/routes';
import { registerWaitlistRoutes } from './lib/waitlist/routes';
import { registerAuthRoutes } from './lib/auth/routes';
import { registerRiscRoutes } from './lib/auth/riscRoutes';
import { registerAccountDeletionRoutes } from './lib/accountDeletion/routes';
import { registerPublicApiRoutes } from './lib/publicApi/routes';
import { registerNotificationRoutes } from './lib/notifications/routes';
import { registerPlanningRoutes } from './lib/planning/routes';
import { registerBrandRoutes } from './lib/brand/routes';
import { registerWanderworldRoutes } from './lib/wanderworld/routes';
import { registerPwaRoutes } from './lib/pwa/routes';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePythonExecutable(): string {
  const candidates = [
    path.join(process.cwd(), 'venv', 'bin', 'python3'),
    path.join(__dirname, '..', 'venv', 'bin', 'python3'),
    path.join(process.cwd(), 'venv', 'bin', 'python'),
    path.join(__dirname, '..', 'venv', 'bin', 'python'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log('[python] using', candidate);
      return candidate;
    }
  }
  console.warn('[python] venv not found. falling back to system python3 (scanner deps may be missing)');
  return 'python3';
}

/** Install scanner deps into ./venv if missing (covers stale Render Start Commands). */
async function ensurePythonDeps(): Promise<void> {
  const script = path.join(process.cwd(), 'scripts', 'ensure-python-deps.sh');
  if (!fs.existsSync(script)) {
    console.warn('[python] ensure-python-deps.sh missing. skip auto-install');
    return;
  }
  const { spawn } = await import('child_process');
  await new Promise<void>((resolve) => {
    const child = spawn('bash', [script], { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '';
    child.stdout.on('data', (d) => process.stdout.write(d));
    child.stderr.on('data', (d) => {
      err += d.toString();
      process.stderr.write(d);
    });
    child.on('close', (code) => {
      if (code !== 0) {
        console.warn('[python] ensure-python-deps exited', code, err.slice(0, 300));
      }
      resolve();
    });
    child.on('error', (e) => {
      console.warn('[python] ensure-python-deps failed to start:', e.message);
      resolve();
    });
  });
}


async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(compression());
  const corsOrigins = [
    process.env.APP_ORIGIN,
    process.env.FRONTEND_URL,
    process.env.PUBLIC_APP_URL,
    process.env.VITE_APP_URL,
    process.env.VITE_LANDING_URL,
    process.env.VITE_ADMIN_PORTAL_URL,
    process.env.VITE_BRAND_URL,
    process.env.VITE_WANDERWORLD_URL,
    'https://app.yureka.one',
    'https://yureka.one',
    'https://www.yureka.one',
    'https://admin.yureka.one',
    'https://brand.yureka.one',
    'https://wanderworld.yureka.one',
    'http://localhost:5173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:3000',
  ]
    .map((o) => (o || '').trim().replace(/\/$/, ''))
    .filter(Boolean)
  const allowAnyCors = process.env.CORS_ALLOW_ANY === 'true'
  app.use(
    cors({
      origin(origin, cb) {
        if (allowAnyCors || !origin) return cb(null, true)
        const normalized = origin.replace(/\/$/, '')
        if (corsOrigins.includes(normalized)) return cb(null, true)
        if (process.env.NODE_ENV !== 'production' && /localhost|127\.0\.0\.1/.test(normalized)) {
          return cb(null, true)
        }
        return cb(null, false)
      },
      credentials: true,
    })
  );
  const PORT = Number(process.env.PORT) || 3000;

  // RISC SETs are raw JWTs (application/secevent+jwt), not JSON.
  registerRiscRoutes(app)

  // Keep raw body for Hubble webhook HMAC (X-Verify) verification.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        ;(req as any).rawBody = buf.toString('utf8')
      },
    }),
  );

  // Universal / App Links for the consumer iOS + Android app (`one.yureka.app`).
  app.get(['/.well-known/apple-app-site-association', '/apple-app-site-association'], (_req, res) => {
    const team = (process.env.APPLE_TEAM_ID || 'TEAMID').trim()
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    })
    res.json({
      applinks: {
        details: [
          {
            appIDs: [`${team}.one.yureka.app`],
            paths: ['/dashboard/*', '/offers*', '/giftcards*', '/login*', '/waiting*', '/join-waitlist*', '*'],
          },
        ],
      },
    })
  })

  app.get('/.well-known/assetlinks.json', (_req, res) => {
    const fingerprints = (process.env.ANDROID_SHA256_FINGERPRINTS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    res.set({
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=3600',
    })
    res.json([
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: 'one.yureka.app',
          sha256_cert_fingerprints: fingerprints.length ? fingerprints : ['REPLACE_WITH_PLAY_APP_SIGNING_CERT'],
        },
      },
    ])
  })

  // --- API Routes ---

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  app.get('/robots.txt', (_req, res) => {
    const candidates = [
      path.resolve(process.cwd(), 'public/robots.txt'),
      path.resolve(__dirname, '..', 'public/robots.txt'),
      path.resolve(__dirname, '..', 'dist', 'robots.txt'),
    ];
    const file = candidates.find((p) => fs.existsSync(p));
    if (!file) return res.status(404).type('text/plain').send('User-agent: *\nAllow: /\n');
    res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
    res.type('text/plain').send(fs.readFileSync(file, 'utf8'));
  });

  app.get('/sitemap.xml', async (_req, res) => {
    try {
      const xml = await buildSitemapXml();
      res.set('Cache-Control', 'public, max-age=3600, must-revalidate');
      res.type('application/xml').send(xml);
    } catch (err) {
      console.warn('sitemap.xml failed:', err);
      res.status(500).type('text/plain').send('Sitemap unavailable');
    }
  });

  app.get("/api/score/health", async (_req, res) => {
    const { spawn } = await import("child_process");
    const pythonExecutable = resolvePythonExecutable();
    const pythonProcess = spawn(pythonExecutable, [
      "-c",
      "import googleapiclient, bs4, pypdf; print('ok')",
    ]);
    let out = "";
    let err = "";
    pythonProcess.stdout.on("data", (d) => { out += d.toString(); });
    pythonProcess.stderr.on("data", (d) => { err += d.toString(); });
    pythonProcess.on("close", (code) => {
      if (code === 0 && out.includes("ok")) {
        return res.json({ status: "ok", python: pythonExecutable, scoring: true });
      }
      res.status(503).json({
        status: "unavailable",
        python: pythonExecutable,
        scoring: false,
        error: err || out || `exit ${code}`,
      });
    });
  });

  registerGoldbackRoutes(app);
  registerPlanningRoutes(app);
  registerBrandRoutes(app);
  registerWanderworldRoutes(app);
  registerAdminRoutes(app);
  registerGiftcardRoutes(app);
  registerCuelinksRoutes(app);
  registerBrowseRoutes(app);
  registerCatalogRoutes(app);
  registerMediaRoutes(app);
  // registerEmbedRoutes(app);
  registerAuthRoutes(app);
  registerAccountDeletionRoutes(app);
  registerWaitlistRoutes(app);
  registerNotificationRoutes(app);
  registerPwaRoutes(app);
  registerPublicApiRoutes(app);



  // Per-user ledger cache only. requires verified Bearer. Legacy global file removed from public API.
  app.get("/api/financial-ledger", async (req, res) => {
    try {
      const { requireAuthEmail } = await import("./lib/auth/userId.js");
      const auth = await requireAuthEmail(req);
      if ("error" in auth) {
        return res.status(auth.status).json({ error: auth.error, profile: {}, transactions: [] });
      }
      const { readLedgerCache } = await import("./lib/ledger/scannerRunner.js");
      const data = await readLedgerCache({ userId: auth.userId, authEmail: auth.email });
      res.json({
        profile: data.profile || {},
        transactions: Array.isArray(data.transactions) ? data.transactions : [],
        score: data.score || null,
        scannedAt: data.scannedAt || null,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to load ledger", profile: {}, transactions: [] });
    }
  });

  // Fast profile-only lookup. requires a Gmail accessToken; rate-limited.
  app.post("/api/scan-profile", async (req, res) => {
    const { isRateLimited } = await import("./lib/auth/rateLimit.js");
    if (isRateLimited(req, "scan-profile", { limit: 20, windowMs: 15 * 60_000 })) {
      return res.status(429).json({ error: "Too many profile scans. Try again later." });
    }
    const { accessToken, fallbackData } = req.body || {};
    if (!accessToken || typeof accessToken !== "string") {
      return res.status(401).json({ error: "Gmail accessToken is required" });
    }
    const { spawn } = await import("child_process");
    const pythonExecutable = resolvePythonExecutable();
    const pythonProcess = spawn(pythonExecutable, [
      path.join(__dirname, "scripts", "scanner.py"),
      accessToken,
      JSON.stringify(fallbackData || {}),
      "profile_only"
    ]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => { output += data.toString(); });
    pythonProcess.stderr.on("data", (data) => { errorOutput += data.toString(); });

    pythonProcess.on("close", (code) => {
      if (code !== 0) {
        console.error("Python profile lookup failed with exit code:", code, errorOutput);
        return res.status(500).json({ error: "Profile lookup script failed to execute", details: errorOutput });
      }
      try {
        const result = JSON.parse(output.trim());
        if (result.error) {
          return res.status(400).json({ error: result.error });
        }
        res.json(result);
      } catch (err: any) {
        console.error("Failed to parse Python profile lookup JSON response:", err, output);
        res.status(500).json({ error: "Invalid JSON output from profile lookup script", raw: output });
      }
    });
  });

  // Email Deep Scanner (waitlist). Uses unified ledger scan service.
  app.post("/api/scan-email", async (req, res) => {
    const { isRateLimited } = await import("./lib/auth/rateLimit.js");
    if (isRateLimited(req, "scan-email", { limit: 10, windowMs: 15 * 60_000 })) {
      return res.status(429).json({ error: "Too many inbox scans. Try again later." });
    }
    const { accessToken, email, fallbackData, authCode, code } = req.body || {};
    const token = String(accessToken || "").trim();
    const authCodeIn = String(authCode || code || "").trim();
    if (!token && !authCodeIn) {
      return res.status(400).json({ error: "accessToken is required for Gmail scoring" });
    }

    try {
      const { resolveLedgerUserId } = await import("./lib/ledger/scannerRunner.js");
      const { runLedgerScan } = await import("./lib/ledger/scanService.js");

      const claimed = String(email || fallbackData?.email || "")
        .trim()
        .toLowerCase();
      const userId =
        (await resolveLedgerUserId({ authEmail: claimed, gmailEmail: claimed })) ||
        (claimed ? `email:${claimed.replace(/[^a-z0-9._@+-]/g, "_")}` : "anonymous");

      const outcome = await runLedgerScan({
        userId,
        authEmail: claimed || userId,
        accessToken: token || undefined,
        authCode: authCodeIn || undefined,
        redirectUri: "postmessage",
        persistScore: true,
        consumeQuota: false,
      });

      if (outcome.error) {
        const status =
          outcome.error === "AUTH_EXPIRED" ? 401 : outcome.error === "email_mismatch" ? 403 : 400;
        return res.status(status).json({ error: outcome.error, details: outcome.details });
      }

      const gmailEmail = String((outcome.saved.profile as any)?.email || claimed || "")
        .trim()
        .toLowerCase();
      if (claimed && gmailEmail && claimed !== gmailEmail) {
        return res.status(403).json({
          error: "email_mismatch",
          details: "Body email must match the Gmail account used for the scan",
        });
      }

      res.json({
        profile: outcome.saved.profile || {},
        transactions: outcome.saved.transactions || [],
        score: outcome.score || null,
        scannedAt: outcome.saved.scannedAt || null,
      });
    } catch (err: any) {
      console.error("[scan-email] failed:", err);
      res.status(500).json({ error: err?.message || "Deep scanner failed" });
    }
  });

  // Admin onboarding email. requires admin session (was unauthenticated; open mailer).
  app.post("/api/notify-team-member", async (req, res) => {
    const { verifyAdminToken } = await import("./lib/admin/auth.js");
    const token = req.header("x-admin-session") || req.header("X-Admin-Session");
    const session = verifyAdminToken(token);
    if (!session || (session.role !== "admin" && session.role !== "superadmin")) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { isRateLimited } = await import("./lib/auth/rateLimit.js");
    if (isRateLimited(req, "notify-team-member", { limit: 20, windowMs: 15 * 60_000 })) {
      return res.status(429).json({ error: "Too many onboarding emails. Try again later." });
    }

    const { email, role, firstName } = req.body || {};
    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Missing recipient email" });
    }

    console.log(`Attempting to send onboarding email to: ${email}`);

    const { sendMail } = await import("./lib/mail/transport.js");

    const portalLink = process.env.VITE_ADMIN_PORTAL_URL?.replace(/\/$/, "") || "https://admin.yureka.one";
    const adminLogin = `${portalLink}/admin`;
    const safeRole = String(role || "admin").slice(0, 40);
    const safeName = String(firstName || "there").slice(0, 80);
    const result = await sendMail({
      to: email,
      subject: "Welcome to Yureka One Admin Dashboard",
      text: `Hi ${safeName},\n\nYou've been added as ${safeRole} on yureka.one. Sign in at ${adminLogin}. For security, the admin dashboard signs you out after 15 minutes of inactivity.`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <p>Hi ${safeName},</p>
          <p>You've been added as <strong>${safeRole}</strong> on <a href="https://yureka.one">yureka.one</a>.</p>
          <p>Sign in here: <a href="${adminLogin}">${adminLogin}</a></p>
          <p style="color: #666; font-size: 0.9em;">For security, you will be signed out of the admin dashboard after 15 minutes of inactivity.</p>
          <p>Welcome aboard!</p>
        </div>
      `,
    });

    if (!result.sent) {
      console.error("CRITICAL: Onboarding Email delivery failed:", result.skipped || result.error);
      return res.status(500).json({ error: result.skipped || result.error });
    }

    console.log("Email sent successfully:", result.messageId);
    res.json({ success: true, messageId: result.messageId });
  });

  // --- Vite / Frontend Handling ---
  if (process.env.NODE_ENV !== "production") {
    // Dynamically import vite (devDependency) only in dev mode
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, '..', 'dist');
    // index: false. otherwise express.static auto-serves the raw index.html
    // for the exact "/" request (with its own ETag) before the catch-all
    // below ever runs, silently skipping meta injection on the homepage only.
    app.use(express.static(distPath, {
      index: false,
      // Default short; hashed /assets/* get immutable below.
      maxAge: '1h',
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        const rel = path.relative(distPath, filePath).split(path.sep).join('/');

        // HTML entry must always revalidate. it points at hashed chunks.
        if (base === 'index.html' || base.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, must-revalidate');
          return;
        }

        // Vite content-hashed bundles. safe to cache forever.
        if (rel.startsWith('assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        // Unhashed media (videos/images). cache a day, revalidate in background.
        // Avoids year-long stale vault/rewards after content updates.
        if (/\.(mp4|mov|webm|jpg|jpeg|png|webp|gif|svg|ico|woff2?)$/i.test(base)) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          return;
        }

        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      },
    }));

    // Read once at boot. every request injects route-specific meta into this
    // same cached template string, so crawlers that don't execute JS still
    // get a correct unique <title>/description/OG image/JSON-LD per URL.
    const indexTemplate = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');

    // Unmatched API methods must stay JSON (never fall through to SPA HTML).
    app.all('/api/{*splat}', (req, res) => {
      res.status(404).json({
        data: null,
        status: 404,
        error: `API not found: ${req.method} ${req.path}`,
        timestamp: new Date().toISOString(),
      });
    });

    // Express 5 requires named wildcard params. bare '*' is no longer valid
    app.get('/{*splat}', async (req, res) => {
      if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API not found' });
      }

      // Never let browsers / Cloudflare cache the SPA shell. stale HTML
      // references deleted chunk hashes and looks like a "cache loading" hang.
      res.set({
        'Cache-Control': 'public, max-age=0, s-maxage=120, must-revalidate',
        'Content-Type': 'text/html; charset=utf-8',
      });

      try {
        const host = String(req.get('host') || '').toLowerCase().split(':')[0]
        const isWanderworldHost = host === 'wanderworld.yureka.one' || host.endsWith('.wanderworld.yureka.one')
        let resolved = await resolveRouteMeta(req.path);

        // WanderWorld ops host: never serve marketing meta for `/`.
        if (isWanderworldHost) {
          const wwMeta =
            staticPageMeta['/ww'] || {
              title: 'WanderWorld ops | Yureka.One',
              description: 'Invite-only WanderWorld trips admin and promoter portal.',
              robots: 'noindex, nofollow' as const,
            }
          if (req.path === '/' || req.path === '/login' || req.path === '/signup' || req.path === '/reset-password' || req.path.startsWith('/ww')) {
            resolved = { status: 200, meta: staticPageMeta[req.path] || wwMeta }
          }
        }

        if (resolved.redirect) {
          return res.redirect(301, resolved.redirect);
        }

        const html = injectHtml(indexTemplate, resolved.meta, req.path, resolved.schemas, { status: resolved.status });
        res.status(resolved.status).send(html);
      } catch (err) {
        console.warn('SEO meta injection failed, serving plain index.html:', err);
        res.sendFile(path.resolve(distPath, 'index.html'));
      }
    });
  }

  // Per-user Gmail resync requires stored refresh tokens (see docs/sops/ledger-email-sync-plan.md).
  const { scheduleWeeklyLedgerSync } = await import('./lib/ledger/scheduledSync.js')
  scheduleWeeklyLedgerSync()

  const { scheduleWwReminders } = await import('./lib/wanderworld/reminders.js')
  scheduleWwReminders()

  if (String(process.env.WANDERWORLD_STORE || 'dual').toLowerCase() === 'supabase') {
    try {
      const { loadSnapshotFromSupabase } = await import('./lib/wanderworld/supabaseSync.js')
      const { writeStoreSnapshot } = await import('./lib/wanderworld/store.js')
      const snap = await loadSnapshotFromSupabase()
      if (snap) {
        writeStoreSnapshot(snap)
        console.log('[wanderworld] hydrated store from Supabase')
      }
    } catch (e: any) {
      console.warn('[wanderworld] supabase hydrate skipped:', e?.message || e)
    }
  }

  // Account deletion: purge approved requests after 30-day retention.
  const runDeletionPurge = async () => {
    try {
      const { runDueDeletionPurges } = await import('./lib/accountDeletion/service.js')
      const result = await runDueDeletionPurges()
      if (result.purged || result.errors.length) {
        console.log('[deletion] purge cycle', result)
      }
    } catch (err) {
      console.error('[deletion] purge cycle failed', err)
    }
  }
  void runDeletionPurge()
  setInterval(runDeletionPurge, 60 * 60_000)

  if ((process.env.GOOGLE_RISC_SA_JSON || '').trim() && process.env.RISC_AUTO_REGISTER === 'true') {
    void import('./lib/auth/riscRegister.js')
      .then(({ registerRiscStream }) => registerRiscStream())
      .then(({ url }) => console.log('[risc] stream registered', url))
      .catch((err) => console.warn('[risc] stream register skipped:', err?.message || err))
  }

  // Do not block listen on pip install. run in background so health checks pass.
  void ensurePythonDeps().then(() => {
    console.log('[python] deps ready:', resolvePythonExecutable());
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
