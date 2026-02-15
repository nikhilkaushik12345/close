import express from "express";
import fetch from "node-fetch";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// OAuth callback
app.get("/callback", (req, res) => {
  res.redirect("/?code=" + req.query.code);
});

// Exchange code (ONLY generate access token)
app.post("/exchange", async (req, res) => {
  try {
    const { code } = req.body;

    console.log("👉 Received auth code:", code);

    const params = new URLSearchParams();
    params.append("grant_type", "authorization_code");
    params.append("code", code);
    params.append("redirect_uri", "https://close-oyjq.onrender.com/callback");
    params.append("client_id", "oa2client_4dT3wSbkIPZXhqlCptWNjg");
    params.append(
      "client_secret",
      "ZZDiFnb2It6LP5p1VsQ3IK7HL1KYrrI7VqrF2yqQqTod6ep4"
    );

    const tokenRes = await fetch("https://api.close.com/oauth2/token/", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Accept": "application/json"
      },
      body: params.toString()
    });

    console.log("👉 Token response status:", tokenRes.status);

    const rawTokenText = await tokenRes.text();
    console.log("👉 RAW token response from Close:");
    console.log(rawTokenText);

    const token = JSON.parse(rawTokenText);

    if (!token.access_token) {
      return res.status(400).json(token);
    }

    res.json({ access_token: token.access_token });

  } catch (err) {
    console.error("🔥 Server error:", err);
    res.status(500).json({ error: err.message });
  }
});

// MCP request (runs ONLY when button clicked)
app.post("/mcp", async (req, res) => {
  try {
    const { access_token } = req.body;

    const listRes = await fetch("https://mcp.close.com/mcp", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${access_token}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: "lead_search",
          arguments: {
            name: null,
            full_text: null,
            lead_status_id: null,
            smart_view_id: null
          }
        }
      })
    });

    const listData = await listRes.json();

    const leads =
      listData?.result?.structuredContent?.results?.results || [];

    const deleted = [];

    for (const lead of leads) {
      const delRes = await fetch("https://mcp.close.com/mcp", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${access_token}`,
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 2,
          method: "tools/call",
          params: {
            name: "delete_lead",
            arguments: {
              id: lead.lead_id
            }
          }
        })
      });

      const delData = await delRes.json();
      deleted.push({ id: lead.lead_id, response: delData });
    }

    res.json({
      listed_leads: leads,
      deleted_leads: deleted
    });

  } catch (err) {
    console.error("🔥 MCP error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Running on port", PORT));
