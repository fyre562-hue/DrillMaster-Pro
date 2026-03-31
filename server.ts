import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";
import axios from "axios";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: "gen-lang-client-0033631996",
  });
}

// Lazy initialize Firestore
let db: any = null;
function getDb() {
  if (!db) {
    db = getFirestore(admin.app(), "ai-studio-204cd0cd-a519-46cb-b8d1-4677b94788c7");
  }
  return db;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enhanced CORS for mobile app compatibility
  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins with credentials: true
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept", "X-AIStudio-Skip-Auth"]
  }));

  // Explicitly handle pre-flight OPTIONS requests
  app.options("*", cors());

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Configure cookie-session for cross-origin iframe/mobile compatibility
  app.use(cookieSession({
    name: 'session',
    keys: [process.env.SESSION_KEY || 'drillmaster-secret-key'],
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: true,      // Required for SameSite=None
    sameSite: 'none',  // Required for cross-origin iframe
    httpOnly: true,
  }));

  // Mock authentication endpoint for apps that require a "session" check
  app.get("/api/auth/status", (req, res) => {
    // Set session to establish the cookie
    if (req.session) {
      req.session.authenticated = true;
      req.session.user = { id: "judge_1", role: "judge" };
    }
    
    // Always return {authenticated: true} as JSON
    res.json({ 
      authenticated: true, 
      user: { id: "judge_1", role: "judge" },
      session_valid: true 
    });
  });

  // Logging middleware to help debug incoming requests from the mobile app
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (Object.keys(req.body).length > 0) {
      console.log("Body:", JSON.stringify(req.body, null, 2));
    }
    next();
  });

  // --- API Routes ---
  
  // Proxy endpoint for cross-origin requests from the mobile app
  app.all("/api/proxy", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) {
      return res.status(400).json({ error: "Missing target URL" });
    }

    console.log(`[PROXY] ${req.method} ${targetUrl}`);

    try {
      const response = await axios({
        method: req.method,
        url: targetUrl,
        data: req.body,
        headers: {
          ...req.headers,
          host: new URL(targetUrl).host,
          // Forward Authorization and Cookie headers
          "Authorization": req.headers["authorization"],
          "Cookie": req.headers["cookie"],
        },
        validateStatus: () => true, // Don't throw on error statuses
        responseType: 'arraybuffer', // Get raw data first
      });

      console.log(`[PROXY] Response: ${response.status}`);

      // Pass Set-Cookie headers from the upstream response back to the client
      if (response.headers["set-cookie"]) {
        res.setHeader("Set-Cookie", response.headers["set-cookie"]);
      }

      const contentType = response.headers["content-type"] || "";
      
      // If the upstream returns HTML (auth page), return a clean JSON error
      if (contentType.includes("text/html")) {
        return res.status(401).json({ error: "AUTH_REQUIRED", isAISAuth: true });
      }

      // When the upstream returns JSON, parse and re-serialize it cleanly
      if (contentType.includes("application/json")) {
        try {
          const json = JSON.parse(Buffer.from(response.data).toString());
          return res.json(json);
        } catch (e) {
          console.error("[PROXY] JSON parse error:", e);
        }
      }

      // Otherwise pass through
      res.set("Content-Type", contentType);
      return res.send(response.data);

    } catch (error) {
      console.error("[PROXY] Error:", error);
      return res.status(500).json({ error: "Proxy request failed", details: error instanceof Error ? error.message : String(error) });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "DrillMaster Scoring Server" });
  });

  // Generic status/discovery endpoint
  app.get("/api/status", (req, res) => {
    res.json({
      online: true,
      serverName: "DrillMaster Pro Cloud",
      version: "1.0.0",
      capabilities: ["scoring", "realtime", "printing", "data_sync"]
    });
  });

  // Debug endpoint for mobile app verification
  app.get("/api/debug", async (req, res) => {
    let firestoreConnected = false;
    let firestoreError = null;
    
    try {
      // Test read from Firestore
      await getDb().collection("competitions").limit(1).get();
      firestoreConnected = true;
    } catch (e) {
      firestoreError = e instanceof Error ? e.message : String(e);
    }

    // Extract registered routes
    const routes: string[] = [];
    app._router.stack.forEach((middleware: any) => {
      if (middleware.route) {
        // Routes registered directly on the app
        const methods = Object.keys(middleware.route.methods).join(",").toUpperCase();
        routes.push(`${methods} ${middleware.route.path}`);
      } else if (middleware.name === "router") {
        // Routes registered via express.Router()
        middleware.handle.stack.forEach((handler: any) => {
          if (handler.route) {
            const methods = Object.keys(handler.route.methods).join(",").toUpperCase();
            routes.push(`${methods} ${handler.route.path}`);
          }
        });
      }
    });

    res.json({
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())} seconds`,
      firestore: {
        connected: firestoreConnected,
        error: firestoreError
      },
      cors: {
        origin: "* (all)",
        credentials: true,
        methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
      },
      session: {
        active: !!req.session,
        config: {
          name: "session",
          secure: true,
          sameSite: "none"
        }
      },
      routes: routes.sort()
    });
  });

  // Fetch competition data by PIN
  app.get("/api/competition/:pin", async (req, res) => {
    try {
      const { pin } = req.params;
      const snapshot = await getDb().collection("competitions").where("pin", "==", pin).limit(1).get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const doc = snapshot.docs[0];
      const compData = doc.data();
      
      // Return data that exactly matches the Competition type
      const response = {
        id: doc.id,
        name: compData.name,
        date: compData.date,
        pin: compData.pin,
        teams: compData.teams || [],
        events: compData.events || []
      };

      console.log(`[API] Returning competition data for PIN ${pin}:`, JSON.stringify(response, null, 2));
      res.json(response);
    } catch (error) {
      console.error("Error fetching competition:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Scoring submission endpoint
  app.post(["/api/score", "/submit", "/api/submit"], async (req, res) => {
    try {
      const scoreData = req.body;
      
      if (!scoreData) {
        return res.status(400).json({ error: "No data provided" });
      }

      const docRef = await getDb().collection("submissions").add({
        ...scoreData,
        source: "mobile_app",
        timestamp: admin.firestore.FieldValue.serverTimestamp()
      });

      console.log(`Score saved with ID: ${docRef.id}`);
      res.json({ success: true, id: docRef.id, message: "Score received and saved" });
    } catch (error) {
      console.error("Error saving score:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Catch-all for undefined API routes to return JSON instead of HTML
  app.all("/api/*", (req, res) => {
    res.status(404).json({ 
      error: "API endpoint not found", 
      path: req.url,
      method: req.method 
    });
  });

  // Global error handler for API routes
  app.use("/api/*", (err: any, req: any, res: any, next: any) => {
    console.error("Unhandled API Error:", err);
    res.status(err.status || 500).json({
      error: err.message || "Internal Server Error"
    });
  });

  // --- Vite Integration ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
