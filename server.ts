import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import { fileURLToPath } from "url";
import cookieSession from "cookie-session";

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
      // Allow all origins for mobile app compatibility
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

  // Configure cookie-session for cross-origin iframe compatibility
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
    
    res.json({ 
      authenticated: true, 
      user: { id: "judge_1", role: "judge" },
      session_valid: true 
    });
  });

  // Logging middleware to help debug incoming requests from the mobile app
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log("Headers:", JSON.stringify(req.headers, null, 2));
    if (Object.keys(req.body).length > 0) {
      console.log("Body:", JSON.stringify(req.body, null, 2));
    }
    next();
  });

  // --- API Routes ---
  app.get("/", (req, res, next) => {
    const userAgent = req.headers["user-agent"] || "";
    const isBrowser = userAgent.includes("Mozilla") || userAgent.includes("Chrome") || userAgent.includes("Safari");
    const wantsJson = req.headers.accept?.includes("application/json") || req.headers["x-requested-with"];

    // If it's not a browser, or it specifically asks for JSON, return JSON
    if (wantsJson || !isBrowser) {
      return res.json({ 
        status: "online", 
        message: "DrillMaster Scoring Server API",
        endpoints: ["/api/status", "/api/score", "/api/competition/:pin"]
      });
    }
    next();
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

  // Fetch competition data by PIN
  // This allows the mobile app to download the teams and commands
  app.get("/api/competition/:pin", async (req, res) => {
    try {
      const { pin } = req.params;
      const snapshot = await getDb().collection("competitions").where("pin", "==", pin).limit(1).get();

      if (snapshot.empty) {
        return res.status(404).json({ error: "Competition not found" });
      }

      const compData = snapshot.docs[0].data();
      res.json({
        id: snapshot.docs[0].id,
        name: compData.name,
        date: compData.date,
        teams: compData.teams || [],
        events: compData.events || []
      });
    } catch (error) {
      console.error("Error fetching competition:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Scoring submission endpoint
  // This handles POST requests from mobile apps
  app.post(["/api/score", "/submit", "/api/submit"], async (req, res) => {
    try {
      const scoreData = req.body;
      
      // Basic validation
      if (!scoreData) {
        return res.status(400).json({ error: "No data provided" });
      }

      // Save to Firestore
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
