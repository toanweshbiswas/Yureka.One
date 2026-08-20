import express from "express";
import compression from "compression";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cors from "cors";
import * as dotenv from "dotenv";
import { resolveRouteMeta } from './lib/seo/resolveRouteMeta';
import { injectHtml } from './lib/seo/inject';
import { buildSitemapXml } from './lib/seo/sitemap';
import { registerGoldbackRoutes } from './lib/goldback/routes';
import { registerAdminRoutes } from './lib/admin/routes';
import { registerGiftcardRoutes } from './lib/hubble/routes';
import { registerCuelinksRoutes } from './lib/cuelinks/routes';
import { registerBrowseRoutes } from './lib/browse/routes';
import { registerMediaRoutes } from './lib/media/routes';
// import { registerEmbedRoutes } from './lib/embed/routes';
import { registerWaitlistRoutes } from './lib/waitlist/routes';
import { registerAuthRoutes } from './lib/auth/routes';
import { registerPublicApiRoutes } from './lib/publicApi/routes';
import { registerNotificationRoutes } from './lib/notifications/routes';
import { registerPlanningRoutes } from './lib/planning/routes';
import { registerBrandRoutes } from './lib/brand/routes';

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
  console.warn('[python] venv not found — falling back to system python3 (scanner deps may be missing)');
  return 'python3';
}

/** Install scanner deps into ./venv if missing (covers stale Render Start Commands). */
async function ensurePythonDeps(): Promise<void> {
  const script = path.join(process.cwd(), 'scripts', 'ensure-python-deps.sh');
  if (!fs.existsSync(script)) {
    console.warn('[python] ensure-python-deps.sh missing — skip auto-install');
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
  app.use(cors());
  const PORT = Number(process.env.PORT) || 3000;

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
  registerAdminRoutes(app);
  registerGiftcardRoutes(app);
  registerCuelinksRoutes(app);
  registerBrowseRoutes(app);
  registerMediaRoutes(app);
  // registerEmbedRoutes(app);
  registerAuthRoutes(app);
  registerWaitlistRoutes(app);
  registerNotificationRoutes(app);
  registerPublicApiRoutes(app);



  // Get cached financial transactions & profile
  app.get("/api/financial-ledger", async (req, res) => {
    const fs = await import("fs/promises");
    const cachePath = path.join(__dirname, "..", "data", "financial_cache.json");
    try {
      const dataStr = await fs.readFile(cachePath, "utf-8");
      const data = JSON.parse(dataStr);
      res.json(data);
    } catch (err) {
      res.json({ profile: {}, transactions: [] });
    }
  });

  // Fast profile-only lookup (name/phone/dob/age/gender/location) — skips the
  // slow Gmail inbox scan so Step 1 of the waitlist can move on immediately.
  app.post("/api/scan-profile", async (req, res) => {
    const { accessToken, fallbackData } = req.body;
    const { spawn } = await import("child_process");
    const pythonExecutable = resolvePythonExecutable();
    const pythonProcess = spawn(pythonExecutable, [
      path.join(__dirname, "scripts", "scanner.py"),
      accessToken || "",
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

  // Email Deep Scanner API — runs the full inbox scan + Yureka Score. This is
  // slow (can take a minute+), so the frontend fires it in the background and
  // doesn't block on the response; once done, we email the user their score.
  app.post("/api/scan-email", async (req, res) => {
    const { accessToken, email, fallbackData } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "accessToken is required for Gmail scoring" });
    }
    const { spawn } = await import("child_process");
    const pythonExecutable = resolvePythonExecutable();
    const pythonProcess = spawn(pythonExecutable, [
      path.join(__dirname, "scripts", "scanner.py"),
      accessToken || "",
      JSON.stringify(fallbackData || {})
    ]);

    let output = "";
    let errorOutput = "";

    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });

    pythonProcess.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    pythonProcess.on("close", async (code) => {
      if (code !== 0) {
        console.error("Python deep scanner process failed with exit code:", code, errorOutput);
        return res.status(500).json({ error: "Deep scanner script failed to execute", details: errorOutput });
      }

      try {
        const result = JSON.parse(output.trim());
        if (result.error) {
          return res.status(400).json({ error: result.error });
        }

        // Cache success output locally
        const fs = await import("fs/promises");
        const cacheDir = path.join(__dirname, "..", "data");
        try {
          await fs.mkdir(cacheDir, { recursive: true });
        } catch {}
        await fs.writeFile(
          path.join(cacheDir, "financial_cache.json"),
          JSON.stringify(result, null, 2)
        );

        const recipient = email || result.profile?.email;
        if (recipient && result.score?.score != null) {
          const { persistScoreToWaitlist } = await import('./lib/waitlist/score.js');
          try {
            await persistScoreToWaitlist({
              email: recipient,
              profile: result.profile,
              score: result.score,
              notify: true,
            });
          } catch (err) {
            console.error("Failed to persist score to waitlist:", err);
          }
        }
        res.json(result);
      } catch (err: any) {
        console.error("Failed to parse Python deep scanner JSON response:", err, output);
        res.status(500).json({ error: "Invalid JSON output from deep scanner script", raw: output });
      }
    });
  });

  // Email Notification API
  app.post("/api/notify-team-member", async (req, res) => {
    const { email, role, firstName } = req.body;

    if (!email) {
        return res.status(400).json({ error: "Missing recipient email" });
    }

    console.log(`Attempting to send onboarding email to: ${email}`);

    const { sendMail } = await import("./lib/mail/transport.js");

    const portalLink = process.env.VITE_ADMIN_PORTAL_URL?.replace(/\/$/, '') || 'https://admin.yureka.one';
    const adminLogin = `${portalLink}/admin`;
    const result = await sendMail({
      to: email,
      subject: "Welcome to Yureka One Admin Dashboard",
      text: `Hi ${firstName || 'there'},\n\nAnwesh has added you as ${role}, to yureka.one, you can access the same using ${adminLogin}, make sure due to nature of security you will get automatically logged out of the admin dashboard within 15 minutes of inactivity`,
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #333;">
          <p>Hi ${firstName || 'there'},</p>
          <p>Anwesh has added you as <strong>${role}</strong>, to <a href="https://yureka.one">yureka.one</a>.</p>
          <p>You can access the portal here: <a href="${adminLogin}">${adminLogin}</a></p>
          <p style="color: #666; font-size: 0.9em;">Important: For security purposes, you will be automatically logged out of the admin dashboard after 15 minutes of inactivity.</p>
          <p>Welcome aboard!</p>
        </div>
      `
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
    // index: false — otherwise express.static auto-serves the raw index.html
    // for the exact "/" request (with its own ETag) before the catch-all
    // below ever runs, silently skipping meta injection on the homepage only.
    app.use(express.static(distPath, {
      index: false,
      // Default short; hashed /assets/* get immutable below.
      maxAge: '1h',
      setHeaders(res, filePath) {
        const base = path.basename(filePath);
        const rel = path.relative(distPath, filePath).split(path.sep).join('/');

        // HTML entry must always revalidate — it points at hashed chunks.
        if (base === 'index.html' || base.endsWith('.html')) {
          res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=120, must-revalidate');
          return;
        }

        // Vite content-hashed bundles — safe to cache forever.
        if (rel.startsWith('assets/')) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          return;
        }

        // Unhashed media (videos/images) — cache a day, revalidate in background.
        // Avoids year-long stale vault/rewards after content updates.
        if (/\.(mp4|mov|webm|jpg|jpeg|png|webp|gif|svg|ico|woff2?)$/i.test(base)) {
          res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          return;
        }

        res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
      },
    }));

    // Read once at boot — every request injects route-specific meta into this
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

    // Express 5 requires named wildcard params — bare '*' is no longer valid
    app.get('/{*splat}', async (req, res) => {
      if (req.url.startsWith('/api')) {
        return res.status(404).json({ error: 'API not found' });
      }

      // Never let browsers / Cloudflare cache the SPA shell — stale HTML
      // references deleted chunk hashes and looks like a "cache loading" hang.
      res.set({
        'Cache-Control': 'public, max-age=0, s-maxage=120, must-revalidate',
        'Content-Type': 'text/html; charset=utf-8',
      });

      try {
        const resolved = await resolveRouteMeta(req.path);

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

  async function runDeepScannerBackground() {
    console.log("Auto-triggering background financial deep sync...");
    const { spawn } = await import("child_process");
    const pythonExecutable = resolvePythonExecutable();
    const pythonProcess = spawn(pythonExecutable, [
      path.join(__dirname, "scripts", "scanner.py"),
      "",
      "{}"
    ]);
    let output = "";
    pythonProcess.stdout.on("data", (data) => {
      output += data.toString();
    });
    pythonProcess.on("close", async (code) => {
      if (code === 0) {
        try {
          const result = JSON.parse(output.trim());
          if (!result.error) {
            const fs = await import("fs/promises");
            const cacheDir = path.join(__dirname, "..", "data");
            try {
              await fs.mkdir(cacheDir, { recursive: true });
            } catch {}
            await fs.writeFile(
              path.join(cacheDir, "financial_cache.json"),
              JSON.stringify(result, null, 2)
            );
            console.log("Successfully updated daily financial deep cache!");
          }
        } catch (e) {
          console.error("Failed to parse background deep sync result:", e);
        }
      } else {
        console.error("Background daily sync failed with exit code:", code);
      }
    });
  }

  function scheduleDailySync() {
    console.log("Daily background email deep sync scheduled for 12:00 PM local time.");
    setInterval(async () => {
      const now = new Date();
      if (now.getHours() === 12 && now.getMinutes() === 0) {
        try {
          await runDeepScannerBackground();
        } catch (err) {
          console.error("Failed executing scheduled background sync:", err);
        }
      }
    }, 60000); // Check every 60 seconds
  }

  scheduleDailySync();

  // Do not block listen on pip install — run in background so health checks pass.
  void ensurePythonDeps().then(() => {
    console.log('[python] deps ready:', resolvePythonExecutable());
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
