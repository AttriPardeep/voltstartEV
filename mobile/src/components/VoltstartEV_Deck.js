// deck_safe.js
// ✅ SAFE MODE: No images, no sharp, no react. Just text & shapes.
const pptxgen = require("pptxgenjs");

// ── Palette ──────────────────────────────────────────
const C = {
  navy:       "0A0F1E",
  teal:       "0D9488",
  tealLight:  "14B8A6",
  white:      "FFFFFF",
  slate:      "1E293B",
  gray:       "64748B",
  grayLight:  "CBD5E1",
  amber:      "F59E0B",
  green:      "10B981",
  red:        "EF4444",
  purple:     "7C3AED",
};

async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.title = "VoltStartEV — Pitch Deck";

  // ── Helper: Add Stat Card ──────────────────────────
  function addStat(slide, x, y, w, h, val, label, accent) {
    slide.addShape("rect", { x, y, w, h, fill: { color: C.slate }, shadow: { type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
    slide.addShape("rect", { x, y, w, h:0.04, fill: { color: accent } });
    slide.addText(val, { x: x+0.1, y: y+0.2, w: w-0.2, h:0.6, fontSize: 26, fontFace:"Arial Black", color: accent, bold:true, align:"center", margin:0 });
    slide.addText(label, { x: x+0.1, y: y+0.8, w: w-0.2, h:0.4, fontSize: 10, fontFace:"Calibri", color: C.grayLight, align:"center", margin:0 });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 1 — Hero
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    // Left Bar
    s.addShape("rect", { x:0, y:0, w:0.06, h:5.625, fill:{color:C.teal} });
    // Big Bolt Icon (Emoji)
    s.addText("⚡", { x:7, y:0.5, w:2.5, h:2.5, fontSize:140, align:"center", valign:"middle", transparency:80 });
    // Title
    s.addText("INTRODUCING", { x:0.5, y:0.7, w:7, h:0.3, fontSize:10, color:C.tealLight, bold:true, charSpacing:5, margin:0 });
    s.addText("VoltStartEV", { x:0.5, y:1.1, w:8, h:1.2, fontSize:64, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    s.addShape("rect", { x:0.5, y:2.3, w:3.4, h:0.05, fill:{color:C.teal} });
    s.addText("India's Smartest EV Charging Platform", { x:0.5, y:2.5, w:8, h:0.5, fontSize:20, color:C.grayLight, italic:true, margin:0 });
    // Pillars
    const pillars = [
      { icon:"⚡", text:"OCPP 1.6\nNative" },
      { icon:"🤖", text:"AI\nAssistant" },
      { icon:"📱", text:"Real-time\nTelemetry" }
    ];
    pillars.forEach((p, i) => {
      const x = 0.5 + (i * 2.2);
      s.addShape("rect", { x, y:3.5, w:1.9, h:1.5, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText(p.icon, { x, y:3.6, w:1.9, h:0.5, fontSize:24, align:"center", margin:0 });
      s.addText(p.text, { x, y:4.1, w:1.9, h:0.8, fontSize:11, color:C.grayLight, align:"center", margin:0 });
    });
    s.addText("April 2026 | Confidential", { x:7, y:5.2, w:2.8, h:0.3, fontSize:9, color:C.gray, align:"right", margin:0 });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 2 — The Problem
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("THE PROBLEM", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("India's EV Charging Gap", { x:0.5, y:0.6, w:9, h:0.7, fontSize:32, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    s.addShape("rect", { x:0.5, y:1.3, w:1.8, h:0.05, fill:{color:C.teal} });
    
    const problems = [
      { icon:"🏷️", title:"No White-Label Solutions", body:"Operators use generic dashboards. Zero branded UX for drivers.", c:C.red },
      { icon:"💰", title:"Fixed Flat-Rate Pricing", body:"₹8–10/kWh regardless of power or time. Revenue lost.", c:C.amber },
      { icon:"📵", title:"Offline Blind Spots", body:"Drivers arrive to find chargers occupied or broken.", c:C.purple },
      { icon:"🧩", title:"Zero App Intelligence", body:"No AI, no route planning. Just a start/stop button.", c:C.tealLight }
    ];

    problems.forEach((p, i) => {
      const x = 0.5 + (i%2)*4.7;
      const y = 1.6 + Math.floor(i/2)*1.85;
      s.addShape("rect", { x, y, w:4.3, h:1.65, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addShape("rect", { x, y, w:0.06, h:1.65, fill:{color:p.c} });
      s.addText(p.icon, { x:x+0.15, y:y+0.15, w:0.6, h:0.6, fontSize:24, margin:0 });
      s.addText(p.title, { x:x+0.85, y:y+0.1, w:3.3, h:0.35, fontSize:13, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
      s.addText(p.body, { x:x+0.85, y:y+0.48, w:3.3, h:1.05, fontSize:10, color:C.grayLight, margin:0 });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 3 — Solution
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("OUR SOLUTION", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("One Platform. Built for India.", { x:0.5, y:0.6, w:9, h:0.7, fontSize:32, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    s.addShape("rect", { x:0.5, y:1.28, w:2.0, h:0.05, fill:{color:C.teal} });

    const layers = [
      { label:"Mobile App (React Native)", items:"Map · Session · Wallet · AI Chat", c:C.teal, y:1.55 },
      { label:"Backend API (Node.js)", items:"OCPP Webhooks · Pricing · WebSocket", c:C.amber, y:2.5 },
      { label:"OCPP Infrastructure (SteVe)", items:"RemoteStart · Stop · ReserveNow", c:C.purple, y:3.45 }
    ];
    layers.forEach(l => {
      s.addShape("rect", { x:0.5, y:l.y, w:9, h:0.8, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText(l.label, { x:0.7, y:l.y+0.05, w:8.6, h:0.3, fontSize:13, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
      s.addText(l.items, { x:0.7, y:l.y+0.4, w:8.6, h:0.3, fontSize:11, color:C.grayLight, margin:0 });
      if(l.y < 3.4) s.addShape("rect", { x:4.85, y:l.y+0.8, w:0.3, h:0.15, fill:{color:l.c} });
    });

    addStat(s, 0.5, 4.55, 2.1, 0.9, "12", "Chargers", C.teal);
    addStat(s, 2.8, 4.55, 2.1, 0.9, "OCPP", "Protocol", C.amber);
    addStat(s, 5.1, 4.55, 2.1, 0.9, "Real-time", "Telemetry", C.green);
    addStat(s, 7.4, 4.55, 2.1, 0.9, "Razorpay", "Payments", C.purple);
  }

  // ════════════════════════════════════════════════════
  // SLIDE 4 — AI Assistant
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape("rect", { x:0, y:0, w:4.5, h:5.625, fill:{color:"0A2020"} });
    s.addShape("rect", { x:0, y:0, w:0.06, h:5.625, fill:{color:C.teal} });
    
    s.addText("🏆 NOT IN ANY COMPETITOR", { x:0.3, y:0.4, w:2.5, h:0.35, fontSize:9, color:C.white, bold:true, align:"center", margin:0, fill:{color:C.teal} }); // Simple text box bg
    s.addText("🤖", { x:1.5, y:0.9, w:1.5, h:1.5, fontSize:80, align:"center", valign:"middle", margin:0 });
    s.addText("Volt AI", { x:0.2, y:2.1, w:4, h:0.7, fontSize:38, fontFace:"Arial Black", color:C.tealLight, bold:true, align:"center", margin:0 });
    s.addText("Powered by Claude Sonnet", { x:0.2, y:2.8, w:4, h:0.3, fontSize:11, color:C.gray, align:"center", margin:0 });

    const chats = [
      { msg:"'Find nearest DC fast charger'", a:"right", c:C.teal },
      { msg:"CS-DC150K-00002 is 1.2km away...", a:"left", c:C.slate },
      { msg:"'Stop charging'", a:"right", c:C.teal },
      { msg:"Session stopped. ₹272 charged.", a:"left", c:C.slate }
    ];
    chats.forEach((c, i) => {
      const isUser = c.a === "right";
      const bx = isUser ? 0.3 : 0.6;
      s.addShape("rect", { x:bx, y:3.3+i*0.5, w:3.6, h:0.4, fill:{color:c.c}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText(c.msg, { x:bx+0.1, y:3.3+i*0.5, w:3.4, h:0.4, fontSize:9.5, color:C.white, align:isUser?"right":"left", italic:isUser, margin:0 });
    });

    s.addText("What Volt Can Do", { x:4.8, y:0.4, w:4.9, h:0.4, fontSize:22, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    const caps = [
      { i:"🗺️", t:"Find & Navigate", d:"Natural language charger search" },
      { i:"⚡", t:"Start / Stop", d:"Voice commands trigger OCPP actions" },
      { i:"📊", t:"Insights", d:"'How much did I spend this month?'" },
      { i:"🔍", t:"Smart Filters", d:"'Fast chargers only' → auto filter" },
      { i:"🌐", t:"Context", d:"Knows your vehicle & balance" }
    ];
    caps.forEach((c, i) => {
      const y = 1.1 + i*0.85;
      s.addShape("rect", { x:4.8, y, w:4.9, h:0.75, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText(c.i, { x:4.9, y:y+0.1, w:0.5, h:0.5, fontSize:22, margin:0 });
      s.addText(c.t, { x:5.5, y:y+0.05, w:4, h:0.3, fontSize:13, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
      s.addText(c.d, { x:5.5, y:y+0.35, w:4, h:0.3, fontSize:10, color:C.grayLight, margin:0 });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 5 — Pricing
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("PRICING ENGINE", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.amber, bold:true, charSpacing:5, margin:0 });
    s.addText("Power-Based Dynamic Pricing", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    
    const models = [
      { n:"Per kWh", i:"⚡", e:"₹7.50", d:"AC Chargers\n7-22kW", c:C.green },
      { n:"Per Minute", i:"⏱️", e:"₹2/min", d:"Busy Locations", c:C.tealLight },
      { n:"Tiered Power", i:"📈", e:"₹16→28", d:"HPC 350kW", c:C.amber },
      { n:"Time-of-Use", i:"🌙", e:"₹6 Night", d:"Off-peak reward", c:C.purple },
      { n:"Session Fee", i:"🎟️", e:"₹25", d:"Reservations", c:C.red }
    ];
    models.forEach((m, i) => {
      const x = 0.5 + (i%3)*3.05, y = 1.6 + Math.floor(i/3)*1.75, w=2.85, h=1.5;
      s.addShape("rect", { x, y, w, h, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addShape("rect", { x, y, w, h:0.05, fill:{color:m.c} });
      s.addText(m.i, { x, y:y+0.1, w, h:0.5, fontSize:26, align:"center", margin:0 });
      s.addText(m.n, { x, y:y+0.6, w, h:0.3, fontSize:12, fontFace:"Arial Black", color:m.c, bold:true, align:"center", margin:0 });
      s.addText(m.e, { x, y:y+0.9, w, h:0.25, fontSize:13, fontFace:"Arial Black", color:C.white, align:"center", margin:0 });
      s.addText(m.d, { x, y:y+1.15, w, h:0.3, fontSize:9.5, color:C.grayLight, align:"center", margin:0 });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 6 — Market Gap Table
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("MARKET GAP", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("Why VoltStartEV Wins", { x:0.5, y:0.6, w:9, h:0.6, fontSize:28, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    const rows = [
      ["Feature", "Generic Apps", "VoltStartEV"],
      ["Branded App", "❌ No", "✅ Full Branding"],
      ["Dynamic Pricing", "❌ No", "✅ 5 Models"],
      ["AI Assistant", "❌ No", "✅ Volt AI"],
      ["Real-time Telemetry", "❌ No", "✅ Live Updates"],
      ["Reservation", "❌ No", "✅ ReserveNow"],
      ["Fleet Accounts", "❌ No", "✅ Multi-Vehicle"],
      ["Wallet + UPI", "❌ No", "✅ Auto-deduct"],
      ["Offline Mode", "❌ No", "✅ Cache Support"]
    ];

    rows.forEach((row, ri) => {
      const y = 1.3 + ri*0.42;
      s.addShape("rect", { x:0.4, y, w:9.2, h:0.4, fill:{color: ri===0?C.teal:(ri%2===0?C.slate:C.navy)} });
      row.forEach((cell, ci) => {
        const xs = [0.5, 3.7, 6.5], ws = [3.2, 2.8, 3.2];
        s.addText(cell, { x:xs[ci], y, w:ws[ci], h:0.4, fontSize:10, fontFace:"Arial Black", color: ri===0?C.white:(ci===2?C.green:C.white), align:"center", bold:ci>0, margin:0 });
      });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 7 — Features
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("PLATFORM FEATURES", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("Built for Real-World EV Charging", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    const feats = [
      { e:"🗺️", t:"Live Map", d:"Availability & Filters", c:C.teal },
      { e:"🔋", t:"Session Screen", d:"Live Power & Cost", c:C.tealLight },
      { e:"💰", t:"Wallet + Razorpay", d:"Pre-loaded & UPI", c:C.amber },
      { e:"📋", t:"History", d:"Reports & CO2 Saved", c:C.green },
      { e:"🕐", t:"Reservations", d:"Lock charger 30min", c:C.purple },
      { e:"🏢", t:"Fleet Mgmt", d:"Multi-vehicle Limits", c:C.red },
      { e:"💳", t:"RFID Support", d:"External Card Reader", c:C.tealLight },
      { e:"🌱", t:"Efficiency", d:"Heat Loss Insights", c:C.green }
    ];
    feats.forEach((f, i) => {
      const col = i%2, row = Math.floor(i/2);
      const x = 0.5 + col*4.75, y = 1.5 + row*1.0;
      s.addShape("rect", { x, y, w:4.4, h:0.85, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addShape("rect", { x, y, w:0.05, h:0.85, fill:{color:f.c} });
      s.addText(f.e, { x:x+0.15, y:y+0.08, w:0.5, h:0.5, fontSize:22, margin:0 });
      s.addText(f.t, { x:x+0.7, y:y+0.08, w:3.5, h:0.3, fontSize:13, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
      s.addText(f.d, { x:x+0.7, y:y+0.4, w:3.5, h:0.4, fontSize:10, color:C.grayLight, margin:0 });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 8 — Architecture
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("TECHNICAL ARCHITECTURE", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("Real-Time Telemetry Flow", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    const nodes = [
      { l:"Charger", i:"🔌", x:0.3, c:C.slate },
      { l:"SteVe OCPP", i:"⚙️", x:2.3, c:C.slate },
      { l:"Backend", i:"🔗", x:4.3, c:C.slate },
      { l:"WebSockets", i:"📡", x:6.3, c:C.slate },
      { l:"App", i:"📱", x:8.3, c:C.teal }
    ];
    nodes.forEach((n, i) => {
      s.addShape("rect", { x:n.x, y:1.7, w:1.6, h:1.2, fill:{color:n.c}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText(n.i, { x:n.x, y:1.8, w:1.6, h:0.4, fontSize:22, align:"center", margin:0 });
      s.addText(n.l, { x:n.x, y:2.3, w:1.6, h:0.5, fontSize:10, color:C.white, align:"center", margin:0 });
      if(i<4) s.addText("▶", { x:n.x+1.65, y:2.1, w:0.2, h:0.5, fontSize:14, color:C.teal, margin:0 });
    });

    addStat(s, 0.5, 3.8, 2.1, 1.0, "<5s", "Lag", C.teal);
    addStat(s, 2.8, 3.8, 2.1, 1.0, "OCPP", "Protocol", C.amber);
    addStat(s, 5.1, 3.8, 2.1, 1.0, "99.9%", "Uptime", C.green);
    addStat(s, 7.4, 3.8, 2.1, 1.0, "AES-256", "Encryption", C.purple);
  }

  // ════════════════════════════════════════════════════
  // SLIDE 9 — Security
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("SECURITY & PAYMENTS", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.purple, bold:true, charSpacing:5, margin:0 });
    s.addText("Production-Grade Stack", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    const items = [
      "JWT 30-day tokens (Encrypted)",
      "OTP Email Verification (SHA-256)",
      "Rate Limiting (Auth & API)",
      "Zod Schema Validation",
      "OCPP Tag Isolation"
    ];
    items.forEach((it, i) => {
      s.addShape("rect", { x:0.5, y:1.95+i*0.6, w:4.3, h:0.5, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText("✓ "+it, { x:0.65, y:1.95+i*0.6, w:4.0, h:0.5, fontSize:11, color:C.white, bold:true, margin:0 });
    });

    s.addText("💳 Razorpay Integration", { x:5.2, y:1.45, w:4.5, h:0.5, fontSize:18, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    const pays = [
      "UPI / GPay / PhonePe",
      "Debit & Credit Cards",
      "Net Banking",
      "Pre-Loaded Wallet"
    ];
    pays.forEach((p, i) => {
      s.addShape("rect", { x:5.2, y:1.95+i*0.6, w:4.5, h:0.5, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addText("• "+p, { x:5.35, y:1.95+i*0.6, w:4.2, h:0.5, fontSize:13, color:C.white, margin:0 });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 10 — Roadmap
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("FUTURE ROADMAP", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.amber, bold:true, charSpacing:5, margin:0 });
    s.addText("What's Coming Next", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    const phases = [
      { p:"Phase 2 (Q3)", c:C.teal, i:["🎤 Voice Commands","🎟️ Reservations","⭐ Ratings"] },
      { p:"Phase 3 (Q4)", c:C.amber, i:["🗺️ Route Planner","🏷️ Loyalty Points","🔌 QR Charging"] },
      { p:"Phase 4 (Q1)", c:C.purple, i:["📱 Android Auto","🌿 Carbon Credits","🤝 White-Label"] }
    ];
    phases.forEach((ph, i) => {
      const x = 0.4+i*3.2;
      s.addShape("rect", { x, y:1.55, w:3.0, h:3.8, fill:{color:C.slate}, shadow:{ type:"outer", blur:8, offset:3, angle:135, color:"000000", opacity:0.12 } });
      s.addShape("rect", { x, y:1.55, w:3.0, h:0.05, fill:{color:ph.c} });
      s.addText(ph.p, { x:x+0.15, y:1.65, w:2.7, h:0.3, fontSize:14, fontFace:"Arial Black", color:ph.c, bold:true, margin:0 });
      ph.i.forEach((it, ii) => {
        s.addText(it, { x:x+0.15, y:2.1+ii*0.7, w:2.7, h:0.6, fontSize:12, color:C.grayLight, margin:0 });
      });
    });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 11 — Market
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addText("MARKET OPPORTUNITY", { x:0.5, y:0.3, w:9, h:0.3, fontSize:9, color:C.green, bold:true, charSpacing:5, margin:0 });
    s.addText("India's EV Market", { x:0.5, y:0.6, w:9, h:0.6, fontSize:30, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });

    addStat(s, 0.4, 1.5, 2.15, 1.4, "₹12,000 Cr", "Market Size 2027", C.teal);
    addStat(s, 2.7, 1.5, 2.15, 1.4, "3.8M+", "EVs on Road", C.green);
    addStat(s, 5.0, 1.5, 2.15, 1.4, "68,000+", "Chargers Needed", C.amber);
    addStat(s, 7.3, 1.5, 2.15, 1.4, "2%", "Coverage", C.red);

    s.addText("Why Now?", { x:0.4, y:3.2, w:4, h:0.5, fontSize:18, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    const whys = [
      "🏛️ FAME III Subsidies",
      "⛽ Petrol at ₹103/L",
      "🔋 Battery <$100/kWh"
    ];
    whys.forEach((w, i) => {
      s.addText(w, { x:0.5, y:3.7+i*0.45, w:4, h:0.4, fontSize:13, color:C.grayLight, margin:0 });
    });

    s.addText("Competition?", { x:4.8, y:3.2, w:4, h:0.5, fontSize:18, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    s.addText("• No AI Assistant", { x:4.9, y:3.7, w:4, h:0.3, fontSize:12, color:C.red, margin:0 });
    s.addText("• No Dynamic Pricing", { x:4.9, y:4.1, w:4, h:0.3, fontSize:12, color:C.red, margin:0 });
    s.addText("• Generic UX", { x:4.9, y:4.5, w:4, h:0.3, fontSize:12, color:C.red, margin:0 });
  }

  // ════════════════════════════════════════════════════
  // SLIDE 12 — Closing
  // ════════════════════════════════════════════════════
  {
    const s = pres.addSlide();
    s.background = { color: C.navy };
    s.addShape("rect", { x:0, y:0, w:0.08, h:5.625, fill:{color:C.teal} });
    s.addText("⚡", { x:6, y:0.5, w:3.5, h:3.5, fontSize:200, align:"center", valign:"middle", transparency:85 });
    
    s.addText("READY TO CHARGE INDIA", { x:0.5, y:0.9, w:8.5, h:0.4, fontSize:11, color:C.teal, bold:true, charSpacing:5, margin:0 });
    s.addText("VoltStartEV", { x:0.5, y:1.3, w:8, h:1.3, fontSize:72, fontFace:"Arial Black", color:C.white, bold:true, margin:0 });
    
    s.addText("The only EV charging platform built for India.", { x:0.5, y:2.65, w:7, h:0.5, fontSize:16, color:C.grayLight, margin:0 });

    const ctas = [
      { t:"Operator?", b:"White-label Platform", c:C.teal },
      { t:"Enterprise?", b:"Fleet Management", c:C.amber },
      { t:"Investor?", b:"Join the Revolution", c:C.purple }
    ];
    ctas.forEach((c, i) => {
      const x = 0.5+i*3.0;
      s.addShape("rect", { x, y:3.5, w:2.75, h:1.5, fill:{color:C.slate}, shadow:{ type:"outer", blur:16, offset:6, angle:135, color:"000000", opacity:0.18 } });
      s.addText(c.t, { x, y:3.6, w:2.75, h:0.4, fontSize:16, fontFace:"Arial Black", color:c.c, bold:true, align:"center", margin:0 });
      s.addText(c.b, { x, y:4.0, w:2.75, h:0.5, fontSize:11, color:C.grayLight, align:"center", margin:0 });
    });
  }

  console.log("Generating file...");
  await pres.writeFile({ fileName: "VoltStartEV_Pitch_Deck_Safe.pptx" });
  console.log("✅ Done! Check 'VoltStartEV_Pitch_Deck_Safe.pptx'");
}

buildDeck().catch(console.error);