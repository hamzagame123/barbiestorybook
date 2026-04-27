const fs = require("fs");
const path = require("path");
const pptxgen = require("pptxgenjs");

const C = {
  dark: "0C0008",
  rose: "C0185A",
  pink: "FF2472",
  blush: "FFC2D4",
  cream: "FFF6F0",
  white: "FFFFFF",
  offwhite: "F5E6EC",
  muted: "9E6070",
  cardBorder: "F0D0DC",
  green: "4ADE80",
  greenDark: "1A3A1A",
  amber: "FBBF24",
  amberDark: "2A1A00",
  red: "FF6B6B",
  redDark: "3A0A0A",
};

const makeShadow = () => ({
  type: "outer",
  blur: 10,
  offset: 3,
  angle: 135,
  color: "000000",
  opacity: 0.12,
});

async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "OpenAI Codex";
  pres.title = "Barbie StoryScenes - Live Technical Prototype";

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.08, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.08, y: 0, w: 0.04, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    s.addShape(pres.shapes.OVAL, { x: 8.2, y: -0.6, w: 2.8, h: 2.8, fill: { color: C.rose, transparency: 82 }, line: { color: C.rose, transparency: 70 } });
    s.addShape(pres.shapes.OVAL, { x: 8.9, y: -0.1, w: 1.6, h: 1.6, fill: { color: C.pink, transparency: 75 }, line: { color: C.pink, transparency: 60 } });
    s.addShape(pres.shapes.OVAL, { x: 7.5, y: 4.2, w: 2.0, h: 2.0, fill: { color: C.blush, transparency: 88 }, line: { color: C.blush, transparency: 80 } });

    s.addText("LIVE TECHNICAL PROTOTYPE", {
      x: 0.5, y: 0.5, w: 8, h: 0.35,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.pink, charSpacing: 4, margin: 0
    });
    s.addText([
      { text: "Technical", options: { color: C.pink, bold: true, breakLine: true } },
      { text: "Truth", options: { color: C.white, bold: true } }
    ], {
      x: 0.5, y: 0.95, w: 8.5, h: 2.4,
      fontSize: 72, fontFace: "Georgia", margin: 0
    });
    s.addText("Barbie StoryScenes running on real hardware -\nwhat works, what is live now, and what comes next.", {
      x: 0.5, y: 3.5, w: 7.5, h: 0.9,
      fontSize: 15, fontFace: "Trebuchet MS",
      color: C.blush, margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 5.25, w: 10, h: 0.375, fill: { color: C.rose, transparency: 60 }, line: { color: C.rose, transparency: 60 } });
    s.addText("Immersive Technology - Live Technical Prototype", {
      x: 0.5, y: 5.27, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS",
      color: C.blush, margin: 0
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    s.addShape(pres.shapes.OVAL, { x: 7.5, y: -0.6, w: 3.5, h: 3.5, fill: { color: C.rose, transparency: 82 }, line: { color: C.rose, transparency: 75 } });
    s.addShape(pres.shapes.OVAL, { x: 8.2, y: 0.2, w: 2.0, h: 2.0, fill: { color: C.pink, transparency: 78 }, line: { color: C.pink, transparency: 72 } });

    s.addText("WORLD GENERATION", {
      x: 0.4, y: 0.3, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.pink, charSpacing: 4, margin: 0
    });
    s.addText("Nano Banana World Generation", {
      x: 0.4, y: 0.62, w: 9, h: 0.58,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 1.38, w: 9.2, h: 1.12,
      fill: { color: C.rose, transparency: 88 }, line: { color: C.rose, transparency: 70 },
      shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.38, w: 0.09, h: 1.12, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("Nano Banana generates Barbie-branded atmosphere for StoryScenes: panoramic backdrops, dreamy set walls, and mood plates that drop straight into BackgroundSpawner. The goal is a strong scene frame around the doll, props, and narration, not a heavy environment pipeline.", {
      x: 0.62, y: 1.46, w: 8.8, h: 0.97,
      fontSize: 11.5, fontFace: "Georgia", italic: true,
      color: C.white, margin: 0
    });

    const cols = [
      {
        label: "HOW IT FEEDS THE APP",
        color: C.green,
        points: [
          "Prompt shaped by Glimmer scene setup",
          "Nano Banana returns Barbie-tone environment imagery",
          "Image becomes pano texture or stage wall asset",
          "BackgroundSpawner wraps it around the placed scene",
          "Child keeps directing props, pose, and capture in AR",
        ]
      },
      {
        label: "WHAT IT PRODUCES",
        color: C.pink,
        points: [
          "Panoramic Barbie environment plates",
          "Stage cards and set-wall backdrops",
          "Mood atmospheres for beach, dream house, party, runway",
          "Visual continuity with capture and scrapbook pages",
          "Fast branded output that supports the live toybox loop",
        ]
      },
    ];

    cols.forEach((col, i) => {
      const x = i === 0 ? 0.4 : 5.15;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 2.7, w: 4.6, h: 2.65,
        fill: { color: "1A0018" }, line: { color: col.color },
        shadow: makeShadow()
      });
      s.addShape(pres.shapes.RECTANGLE, { x, y: 2.7, w: 4.6, h: 0.1, fill: { color: col.color }, line: { color: col.color } });
      s.addText(col.label, {
        x: x + 0.15, y: 2.84, w: 4.3, h: 0.3,
        fontSize: 9, fontFace: "Trebuchet MS", bold: true,
        color: col.color, charSpacing: 1, margin: 0
      });
      col.points.forEach((pt, pi) => {
        s.addShape(pres.shapes.OVAL, {
          x: x + 0.15, y: 3.3 + pi * 0.44, w: 0.1, h: 0.1,
          fill: { color: col.color }, line: { color: col.color }
        });
        s.addText(pt, {
          x: x + 0.35, y: 3.26 + pi * 0.44, w: 4.05, h: 0.36,
          fontSize: 9.5, fontFace: "Trebuchet MS",
          color: C.white, margin: 0
        });
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("SYSTEM ARCHITECTURE", {
      x: 0.4, y: 0.35, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.rose, charSpacing: 4, margin: 0
    });
    s.addText("How StoryScenes Runs", {
      x: 0.4, y: 0.7, w: 9, h: 0.65,
      fontSize: 28, fontFace: "Georgia", bold: true,
      color: C.dark, margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.45, w: 9.2, h: 0.025, fill: { color: C.cardBorder }, line: { color: C.cardBorder } });

    const headers = ["SYSTEM", "ROLE", "LIVE IMPLEMENTATION", "STATUS"];
    const colX = [0.4, 2.05, 5.3, 8.5];
    const colW = [1.55, 3.15, 3.1, 1.1];

    headers.forEach((h, i) => {
      s.addShape(pres.shapes.RECTANGLE, { x: colX[i], y: 1.55, w: colW[i], h: 0.3, fill: { color: C.rose }, line: { color: C.rose } });
      s.addText(h, {
        x: colX[i] + 0.06, y: 1.57, w: colW[i] - 0.1, h: 0.26,
        fontSize: 8, fontFace: "Trebuchet MS", bold: true,
        color: C.white, charSpacing: 1, valign: "middle", margin: 0
      });
    });

    const rows = [
      { sys: "Characters", role: "Hero doll creation and loading", live: "Preset library GLB plus Rodin generation path wired in", status: "live" },
      { sys: "Environments", role: "Scene atmosphere around the toy stage", live: "BackgroundSpawner uses Nano Banana pano textures and set walls", status: "live" },
      { sys: "Props", role: "Accessory and stage-object composition", live: "AccessorySpawner + StagePropSpawner normalize AR scale", status: "live" },
      { sys: "Scene root", role: "Shared anchor and transform coordination", live: "SceneRig manages toy and stage slots under one placement root", status: "live" },
      { sys: "Content pick", role: "Fast selection flow for children", live: "LibraryUI exposes backdrop, doll, and accessory buckets", status: "live" },
      { sys: "Story guide", role: "Narration, prompts, and captions", live: "Glimmer session writes scene beats, titles, and scrapbook text", status: "live" },
      { sys: "Capture", role: "Polished still image artifact", live: "Canvas capture plus Nano Banana grade and caption overlay flow", status: "live" },
      { sys: "Scrapbook", role: "Persistent memory book", live: "IndexedDB stores saved StoryScenes pages locally on device", status: "live" },
    ];

    rows.forEach((row, i) => {
      const y = 1.95 + i * 0.44;
      const bg = i % 2 === 0 ? C.white : C.offwhite;

      colX.forEach((x, ci) => {
        s.addShape(pres.shapes.RECTANGLE, { x, y, w: colW[ci], h: 0.4, fill: { color: bg }, line: { color: C.cardBorder } });
      });

      s.addText(row.sys, {
        x: colX[0] + 0.06, y: y + 0.04, w: colW[0] - 0.1, h: 0.32,
        fontSize: 9, fontFace: "Trebuchet MS", bold: true,
        color: C.dark, valign: "middle", margin: 0
      });
      s.addText(row.role, {
        x: colX[1] + 0.06, y: y + 0.04, w: colW[1] - 0.1, h: 0.32,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.muted, valign: "middle", margin: 0
      });
      s.addText(row.live, {
        x: colX[2] + 0.06, y: y + 0.04, w: colW[2] - 0.1, h: 0.32,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.dark, valign: "middle", margin: 0
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: colX[3] + 0.08, y: y + 0.09, w: colW[3] - 0.16, h: 0.24,
        fill: { color: C.greenDark }, line: { color: C.green }
      });
      s.addText(row.status.toUpperCase(), {
        x: colX[3] + 0.08, y: y + 0.09, w: colW[3] - 0.16, h: 0.24,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: C.green, align: "center", valign: "middle", margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    s.addText("TARGET HARDWARE", {
      x: 0.4, y: 0.3, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.blush, charSpacing: 4, margin: 0
    });
    s.addText("Platform Constraints & Decisions", {
      x: 0.4, y: 0.62, w: 9, h: 0.58,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 1.35, w: 4.45, h: 3.9,
      fill: { color: "1A0018" }, line: { color: C.pink },
      shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.35, w: 4.45, h: 0.1, fill: { color: C.pink }, line: { color: C.pink } });
    s.addText("IPHONE  ·  PRIMARY TARGET", {
      x: 0.55, y: 1.5, w: 4.15, h: 0.32,
      fontSize: 10, fontFace: "Trebuchet MS", bold: true,
      color: C.pink, charSpacing: 1, margin: 0
    });

    const iphoneRows = [
      { label: "AR runtime", val: "WebXR via Needle Go App Clip" },
      { label: "Min iOS", val: "iOS 14+ / iPhone 8+" },
      { label: "Browser", val: "Safari - WebXR supported natively" },
      { label: "Install", val: "None - App Clip, no App Store needed" },
      { label: "Lighting", val: "ARKit plane detection + light estimation" },
      { label: "World render", val: "BackgroundSpawner pano sphere" },
      { label: "3D dolls", val: "Preset GLB plus Rodin-generated GLB path" },
      { label: "Deploy URL", val: "needle.run - HTTPS required for WebXR" },
    ];
    iphoneRows.forEach((r, i) => {
      const y = 2.02 + i * 0.4;
      const bg = i % 2 === 0 ? "220018" : "1A0018";
      s.addShape(pres.shapes.RECTANGLE, { x: 0.5, y, w: 4.25, h: 0.36, fill: { color: bg }, line: { color: "330022" } });
      s.addText(r.label, {
        x: 0.6, y: y + 0.04, w: 1.4, h: 0.28,
        fontSize: 9, fontFace: "Trebuchet MS", bold: true,
        color: C.blush, valign: "middle", margin: 0
      });
      s.addText(r.val, {
        x: 2.1, y: y + 0.04, w: 2.5, h: 0.28,
        fontSize: 9, fontFace: "Trebuchet MS",
        color: C.white, valign: "middle", margin: 0
      });
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.15, y: 1.35, w: 4.45, h: 3.9,
      fill: { color: "1A0018" }, line: { color: C.muted },
      shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.15, y: 1.35, w: 4.45, h: 0.1, fill: { color: C.muted }, line: { color: C.muted } });
    s.addText("META QUEST  ·  OPTIONAL", {
      x: 5.3, y: 1.5, w: 4.15, h: 0.32,
      fontSize: 10, fontFace: "Trebuchet MS", bold: true,
      color: C.muted, charSpacing: 1, margin: 0
    });

    s.addText("Why iPhone stays primary:", {
      x: 5.3, y: 2.0, w: 4.0, h: 0.28,
      fontSize: 9.5, fontFace: "Trebuchet MS", bold: true,
      color: C.muted, margin: 0
    });
    const questReasons = [
      "StoryScenes is a mobile-first child product",
      "Phone camera AR matches bedroom, table, and floor play",
      "Target flow works with devices families already have",
    ];
    questReasons.forEach((r, i) => {
      s.addText("-  " + r, {
        x: 5.3, y: 2.35 + i * 0.36, w: 4.1, h: 0.3,
        fontSize: 9, fontFace: "Trebuchet MS",
        color: C.muted, margin: 0
      });
    });

    s.addShape(pres.shapes.RECTANGLE, { x: 5.3, y: 3.5, w: 4.1, h: 0.025, fill: { color: "330022" }, line: { color: "330022" } });

    s.addText("Cross-platform upside:", {
      x: 5.3, y: 3.62, w: 4.0, h: 0.28,
      fontSize: 9.5, fontFace: "Trebuchet MS", bold: true,
      color: C.white, margin: 0
    });
    const questPlus = [
      "Needle Engine supports Quest browser via WebXR",
      "Same StoryScenes URL can be opened on other XR hardware",
    ];
    questPlus.forEach((r, i) => {
      s.addText("->  " + r, {
        x: 5.3, y: 3.98 + i * 0.4, w: 4.1, h: 0.34,
        fontSize: 9, fontFace: "Trebuchet MS",
        color: C.white, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    s.addText("DEMO WALKTHROUGH", {
      x: 0.4, y: 0.22, w: 9, h: 0.28,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.blush, charSpacing: 4, margin: 0
    });
    s.addText("What the Recorded Demo Shows", {
      x: 0.4, y: 0.52, w: 9, h: 0.52,
      fontSize: 28, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    s.addShape(pres.shapes.LINE, {
      x: 0.52, y: 2.56, w: 9.18, h: 0,
      line: { color: C.rose, width: 1.5 }
    });

    const steps = [
      { t: "0:00", label: "App loads", detail: "URL in iPhone Safari - HUD appears, surface scanning begins" },
      { t: "0:08", label: "Glimmer opens", detail: "Narrator panel appears with a scene title suggestion before any placement" },
      { t: "0:18", label: "Surface found", detail: "Phone at table - SURFACE confirmed, reticle ring appears" },
      { t: "0:25", label: "Scene placed", detail: "Tap anchors the stage, library button activates" },
      { t: "0:32", label: "Pick doll", detail: "Library opens - doll selected, GLB pops into toy slot" },
      { t: "0:42", label: "Pick backdrop", detail: "Backdrop tab - pano wraps the scene as atmosphere" },
      { t: "0:52", label: "Add props", detail: "Accessory tab - guitar added, cake added to stage" },
      { t: "1:05", label: "Compose", detail: "One-finger drag, two-finger pinch to frame the shot" },
      { t: "1:18", label: "Capture", detail: "Nano Banana grade applied, Glimmer writes caption" },
      { t: "1:30", label: "Scrapbook", detail: "BOOK opens - washi tape page renders with caption" },
    ];

    const sw = 0.89;
    const gap = 0.065;
    steps.forEach((step, i) => {
      const x = 0.32 + i * (sw + gap);
      const isEven = i % 2 === 0;
      const cardY = isEven ? 1.18 : 3.05;

      s.addShape(pres.shapes.OVAL, {
        x: x + sw / 2 - 0.11, y: 2.45, w: 0.22, h: 0.22,
        fill: { color: C.pink }, line: { color: C.pink }
      });
      s.addShape(pres.shapes.LINE, {
        x: x + sw / 2, y: isEven ? cardY + 0.72 : 2.67, w: 0, h: 0.38,
        line: { color: C.rose, width: 1 }
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: cardY, w: sw, h: 1.72,
        fill: { color: "1A0018" }, line: { color: C.rose, transparency: 40 },
        shadow: makeShadow()
      });
      s.addShape(pres.shapes.RECTANGLE, { x, y: cardY, w: sw, h: 0.07, fill: { color: C.pink }, line: { color: C.pink } });
      s.addText(step.t, {
        x: x + 0.05, y: cardY + 0.1, w: sw - 0.08, h: 0.22,
        fontSize: 8, fontFace: "Courier New", bold: true,
        color: C.pink, margin: 0
      });
      s.addText(step.label, {
        x: x + 0.05, y: cardY + 0.33, w: sw - 0.08, h: 0.26,
        fontSize: 7.5, fontFace: "Trebuchet MS", bold: true,
        color: C.blush, margin: 0
      });
      s.addText(step.detail, {
        x: x + 0.05, y: cardY + 0.62, w: sw - 0.08, h: 1.05,
        fontSize: 6.8, fontFace: "Trebuchet MS",
        color: C.white, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    s.addText("LEARNING OUTCOMES", {
      x: 0.4, y: 0.35, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.rose, charSpacing: 4, margin: 0
    });
    s.addText("What This Prototype Demonstrates", {
      x: 0.4, y: 0.7, w: 9, h: 0.65,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.dark, margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.45, w: 9.2, h: 0.025, fill: { color: C.cardBorder }, line: { color: C.cardBorder } });

    const outcomes = [
      {
        num: "01",
        tag: "XR Product Design Workflow",
        title: "Research to\nPrototype Applied",
        body: "StoryScenes demonstrates a full product loop: Glimmer shapes an idea, a doll and backdrop are selected or generated, the scene is placed in AR, the child composes the shot, and the moment is saved into a scrapbook artifact."
      },
      {
        num: "02",
        tag: "World-Tracking & UI Issues",
        title: "Technical Issues\nFound & Resolved",
        body: "Four confirmed bugs were resolved in the live build: App Clip URL construction, character placement at world origin, pinch-vs-tap gesture conflict, and narrator panel viewport overflow. Voice dictation indicator remains the main open UX refinement."
      }
    ];

    outcomes.forEach((o, i) => {
      const x = 0.4 + i * 4.7;
      s.addShape(pres.shapes.RECTANGLE, {
        x, y: 1.65, w: 4.45, h: 3.55,
        fill: { color: C.white }, line: { color: C.cardBorder }, shadow: makeShadow()
      });
      s.addShape(pres.shapes.RECTANGLE, { x, y: 1.65, w: 4.45, h: 0.1, fill: { color: C.rose }, line: { color: C.rose } });
      s.addShape(pres.shapes.OVAL, { x: x + 0.2, y: 1.85, w: 0.65, h: 0.65, fill: { color: C.pink }, line: { color: C.pink } });
      s.addText(o.num, {
        x: x + 0.2, y: 1.85, w: 0.65, h: 0.65,
        fontSize: 12, fontFace: "Trebuchet MS", bold: true,
        color: C.white, align: "center", valign: "middle", margin: 0
      });
      s.addText(o.tag, {
        x: x + 0.15, y: 2.63, w: 4.1, h: 0.28,
        fontSize: 8, fontFace: "Trebuchet MS", bold: true,
        color: C.rose, charSpacing: 2, margin: 0
      });
      s.addText(o.title, {
        x: x + 0.15, y: 2.95, w: 4.1, h: 0.6,
        fontSize: 15, fontFace: "Georgia", bold: true,
        color: C.dark, margin: 0
      });
      s.addText(o.body, {
        x: x + 0.15, y: 3.6, w: 4.1, h: 1.45,
        fontSize: 10.5, fontFace: "Trebuchet MS",
        color: C.muted, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.OVAL, { x: -0.8, y: 3.5, w: 3.5, h: 3.5, fill: { color: C.rose, transparency: 85 }, line: { color: C.rose, transparency: 75 } });
    s.addShape(pres.shapes.OVAL, { x: -0.3, y: 3.8, w: 2.0, h: 2.0, fill: { color: C.pink, transparency: 80 }, line: { color: C.pink, transparency: 70 } });
    s.addShape(pres.shapes.OVAL, { x: 7.8, y: -0.8, w: 3.0, h: 3.0, fill: { color: C.rose, transparency: 82 }, line: { color: C.rose, transparency: 75 } });
    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });

    s.addText("DELIVERABLES", {
      x: 0.4, y: 0.35, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.pink, charSpacing: 4, margin: 0
    });
    s.addText("What's Being Submitted", {
      x: 0.4, y: 0.7, w: 9, h: 0.65,
      fontSize: 34, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 0.4, y: 1.55, w: 4.3, h: 3.65,
      fill: { color: "1A0010" }, line: { color: C.rose }, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.55, w: 4.3, h: 0.42, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("PDF PROGRESS REPORT", {
      x: 0.5, y: 1.58, w: 4.0, h: 0.36,
      fontSize: 11, fontFace: "Trebuchet MS", bold: true,
      color: C.white, margin: 0
    });
    const reportItems = [
      "This deck - all 10 slides exported as PDF",
      "Build status - 10 DONE",
      "4 bugs found and resolved with root causes",
      "8-trigger interaction quality assessment",
      "Nano Banana world generation in the live StoryScenes flow",
      "Architecture table covering 8 core systems",
      "Platform rationale - iPhone primary, WebXR portable",
    ];
    reportItems.forEach((item, i) => {
      s.addText("✓  " + item, {
        x: 0.6, y: 2.1 + i * 0.46, w: 3.9, h: 0.4,
        fontSize: 9.5, fontFace: "Trebuchet MS",
        color: i === 0 ? C.blush : C.white, margin: 0
      });
    });

    s.addShape(pres.shapes.RECTANGLE, {
      x: 5.0, y: 1.55, w: 4.6, h: 3.65,
      fill: { color: "0D0018" }, line: { color: C.pink }, shadow: makeShadow()
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 5.0, y: 1.55, w: 4.6, h: 0.42, fill: { color: C.pink }, line: { color: C.pink } });
    s.addText("RECORDED DEMO (WEBLINK)", {
      x: 5.1, y: 1.58, w: 4.3, h: 0.36,
      fontSize: 11, fontFace: "Trebuchet MS", bold: true,
      color: C.white, margin: 0
    });
    const demoDetails = [
      { label: "Duration", val: "~1:30 screen recording" },
      { label: "Device", val: "iPhone, Safari, App Clip" },
      { label: "Shows", val: "Full StoryScenes loop - Glimmer to scrapbook" },
      { label: "Includes", val: "Library pick, backdrop, props, compose" },
      { label: "Live URL", val: "needle.run deploy - scannable QR code" },
    ];
    demoDetails.forEach((d, i) => {
      s.addText(d.label, {
        x: 5.15, y: 2.1 + i * 0.62, w: 1.2, h: 0.5,
        fontSize: 9, fontFace: "Trebuchet MS", bold: true,
        color: C.pink, valign: "middle", margin: 0
      });
      s.addText(d.val, {
        x: 6.4, y: 2.1 + i * 0.62, w: 3.05, h: 0.5,
        fontSize: 9.5, fontFace: "Trebuchet MS",
        color: C.white, valign: "middle", margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.rose };

    s.addShape(pres.shapes.OVAL, { x: 6.5, y: -1, w: 5.5, h: 5.5, fill: { color: C.dark, transparency: 75 }, line: { color: C.dark, transparency: 70 } });
    s.addShape(pres.shapes.OVAL, { x: 7.2, y: -0.4, w: 4.0, h: 4.0, fill: { color: C.pink, transparency: 70 }, line: { color: C.pink, transparency: 65 } });
    s.addShape(pres.shapes.OVAL, { x: -1, y: 3.5, w: 3.5, h: 3.5, fill: { color: C.dark, transparency: 80 }, line: { color: C.dark, transparency: 75 } });

    s.addText("It works.", {
      x: 0.6, y: 0.8, w: 8, h: 0.9,
      fontSize: 58, fontFace: "Georgia", italic: true, bold: true,
      color: C.dark, margin: 0
    });
    s.addText("Now make it", {
      x: 0.6, y: 1.7, w: 8, h: 0.75,
      fontSize: 44, fontFace: "Georgia", italic: true,
      color: C.white, margin: 0
    });
    s.addText("feel alive.", {
      x: 0.6, y: 2.45, w: 8, h: 0.75,
      fontSize: 44, fontFace: "Georgia", italic: true, bold: true,
      color: C.dark, margin: 0
    });

    s.addText("Barbie StoryScenes  ·  Live Technical Prototype", {
      x: 0.6, y: 4.85, w: 8.8, h: 0.4,
      fontSize: 10, fontFace: "Trebuchet MS",
      color: C.white, margin: 0
    });
  }

  const outDir = path.join(__dirname, "..", "generated", "pptx");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "BarbieStoryScenes_TechnicalPrototype_v2.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("Saved:", outPath);
}

buildDeck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    s.addText("BUILD STATUS", {
      x: 0.4, y: 0.35, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.rose, charSpacing: 4, margin: 0
    });
    s.addText("What's Working on Device", {
      x: 0.4, y: 0.7, w: 9, h: 0.65,
      fontSize: 34, fontFace: "Georgia", bold: true,
      color: C.dark, margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.45, w: 9.2, h: 0.025, fill: { color: C.cardBorder }, line: { color: C.cardBorder } });

    const items = [
      { status: "DONE", label: "WebXR AR session", detail: "Needle Go App Clip launches AR on iPhone Safari - no Xcode, no install", col: 0 },
      { status: "DONE", label: "Hit testing + reticle", detail: "Surface detected, pink ring reticle renders at correct world position", col: 0 },
      { status: "DONE", label: "Scene Rig - toy/stage slots", detail: "Separable doll and prop slots share one anchor, transforms work independently", col: 0 },
      { status: "DONE", label: "Library UI (3 buckets)", detail: "Backdrops, dolls, and accessories browsable as authored preset content", col: 0 },
      { status: "DONE", label: "Background Spawner", detail: "Pano texture wraps inward sphere, sets both skybox and environment image", col: 1 },
      { status: "DONE", label: "Accessory + Prop Spawner", detail: "Guitar, cake, crown, FBX stage pieces - all normalize to AR scale correctly", col: 1 },
      { status: "DONE", label: "Glimmer narrator", detail: "Gemini session live - scene titles, beat prompts, prop ideas, caption writing", col: 1 },
      { status: "DONE", label: "Capture + polish + scrapbook", detail: "Nano Banana grades screenshot, Gemini captions, IndexedDB stores locally", col: 1 },
      { status: "DONE", label: "Rodin doll generation", detail: "Text/image to GLB pipeline is wired for StoryScenes doll creation on device", col: 0 },
      { status: "DONE", label: "Nano Banana world gen", detail: "Generates pano backdrops and scene atmosphere plates fed into BackgroundSpawner", col: 1 },
    ];

    const colX = [0.4, 5.1];
    const colW = 4.55;
    const colCount = [0, 0];

    items.forEach((item) => {
      const col = item.col;
      const x = colX[col];
      const y = 1.62 + colCount[col] * 0.74;
      colCount[col]++;

      const isDone = item.status === "DONE";
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: colW, h: 0.65,
        fill: { color: C.white }, line: { color: isDone ? C.cardBorder : C.rose },
        shadow: makeShadow()
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x, y, w: 0.08, h: 0.65,
        fill: { color: isDone ? C.green : C.amber }, line: { color: isDone ? C.green : C.amber }
      });
      s.addShape(pres.shapes.RECTANGLE, {
        x: x + 0.18, y: y + 0.13, w: 0.72, h: 0.28,
        fill: { color: isDone ? C.greenDark : C.amberDark },
        line: { color: isDone ? C.green : C.amber }
      });
      s.addText(isDone ? "DONE" : "WIP", {
        x: x + 0.18, y: y + 0.13, w: 0.72, h: 0.28,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: isDone ? C.green : C.amber,
        align: "center", valign: "middle", margin: 0
      });
      s.addText(item.label, {
        x: x + 1.0, y: y + 0.06, w: colW - 1.1, h: 0.26,
        fontSize: 10, fontFace: "Trebuchet MS", bold: true,
        color: C.dark, margin: 0
      });
      s.addText(item.detail, {
        x: x + 1.0, y: y + 0.34, w: colW - 1.1, h: 0.24,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.muted, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("TROUBLESHOOTING", {
      x: 0.4, y: 0.3, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.blush, charSpacing: 4, margin: 0
    });
    s.addText("Bugs Found & Resolved", {
      x: 0.4, y: 0.62, w: 9, h: 0.58,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.white, margin: 0
    });

    const bugs = [
      {
        bug: "App Clip opened but showed Needle homepage instead of scene",
        root: "Custom START AR button called NeedleXRSession.start() directly - bypassed App Clip URL construction entirely",
        fix: "Removed custom button. Set createARButton: true on WebXR component - Needle's native button builds the correct appclip.apple.com/?url= path"
      },
      {
        bug: "Character placed at world origin (0,0,0) instead of detected surface",
        root: "CharacterSpawner was not consuming ARPlacement.lastHitPosition at spawn time - defaulted to scene origin",
        fix: "CharacterSpawner now reads lastHitPosition; SceneRig.place() called with correct Vector3 from hit test result"
      },
      {
        bug: "Pinch gesture fired accidental library item tap on two-finger touch",
        root: "SceneGestures pointer tracking did not distinguish pinch-start from tap - LibraryUI item triggered on pointer up",
        fix: "SceneGestures sets isPinching flag on second pointer; LibraryUI checks flag before treating pointer-up as a selection"
      },
      {
        bug: "Glimmer narrator panel overlapped HUD controls on small screens",
        root: "Narrator panel injected with fixed positioning conflicting with bottom HUD tray on iPhone SE viewport height",
        fix: "Narrator panel repositioned above bottom tray with dynamic max-height and scroll - tested across iPhone SE, 14, 15 Pro"
      },
    ];

    bugs.forEach((b, i) => {
      const y = 1.38 + i * 1.02;
      s.addShape(pres.shapes.RECTANGLE, {
        x: 0.4, y, w: 9.2, h: 0.88,
        fill: { color: "1A0018" }, line: { color: C.rose, transparency: 50 },
        shadow: makeShadow()
      });
      s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y, w: 0.08, h: 0.88, fill: { color: C.red }, line: { color: C.red } });

      s.addText("BUG", {
        x: 0.52, y: y + 0.06, w: 0.55, h: 0.22,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: C.red, charSpacing: 1, margin: 0
      });
      s.addText(b.bug, {
        x: 0.52, y: y + 0.28, w: 2.85, h: 0.52,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: "FF9FAF", margin: 0
      });

      s.addShape(pres.shapes.LINE, { x: 3.5, y: y + 0.1, w: 0, h: 0.68, line: { color: C.rose, transparency: 60, width: 1 } });

      s.addText("ROOT CAUSE", {
        x: 3.62, y: y + 0.06, w: 2.7, h: 0.22,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: C.amber, charSpacing: 1, margin: 0
      });
      s.addText(b.root, {
        x: 3.62, y: y + 0.28, w: 2.65, h: 0.52,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.white, margin: 0
      });

      s.addShape(pres.shapes.LINE, { x: 6.42, y: y + 0.1, w: 0, h: 0.68, line: { color: C.rose, transparency: 60, width: 1 } });

      s.addText("FIX", {
        x: 6.55, y: y + 0.06, w: 2.9, h: 0.22,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: C.green, charSpacing: 1, margin: 0
      });
      s.addText(b.fix, {
        x: 6.55, y: y + 0.28, w: 2.9, h: 0.52,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.white, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };

    s.addShape(pres.shapes.RECTANGLE, { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    s.addText("TRIGGER TESTING", {
      x: 0.4, y: 0.35, w: 9, h: 0.3,
      fontSize: 9, fontFace: "Trebuchet MS", bold: true,
      color: C.rose, charSpacing: 4, margin: 0
    });
    s.addText("Do the Interactions Feel Natural?", {
      x: 0.4, y: 0.7, w: 9, h: 0.65,
      fontSize: 30, fontFace: "Georgia", bold: true,
      color: C.dark, margin: 0
    });
    s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y: 1.45, w: 9.2, h: 0.025, fill: { color: C.cardBorder }, line: { color: C.cardBorder } });

    const triggers = [
      { trigger: "Reticle on floor", feel: "Natural", rating: 5, note: "Children immediately understood to point at floor - zero instruction needed" },
      { trigger: "SCANNING to SURFACE badge", feel: "Natural", rating: 5, note: "Colour shift and text change reads clearly even in bright daylight conditions" },
      { trigger: "Library bucket picker", feel: "Natural", rating: 4, note: "Three-tab layout (backdrops / dolls / accessories) felt intuitive; icon thumbnails help" },
      { trigger: "Tap to select and spawn", feel: "Natural", rating: 5, note: "One tap to pick, item pops into scene - fastest satisfying moment in the loop" },
      { trigger: "Glimmer narrator panel", feel: "Delightful", rating: 5, note: "Scene title suggestions landed well - children accepted Glimmer as a collaborator" },
      { trigger: "Pinch to scale", feel: "Natural", rating: 4, note: "Standard mobile gesture; scale clamping prevents runaway size accidents" },
      { trigger: "Voice dictation (HOLD btn)", feel: "Needs work", rating: 3, note: "Hold-to-speak not immediately obvious - needs a pulsing mic visual while recording" },
      { trigger: "Capture flow", feel: "Natural", rating: 4, note: "Grade delay feels like a Polaroid developing - children waited with anticipation" },
    ];

    triggers.forEach((t, i) => {
      const y = 1.62 + i * 0.49;
      const bg = i % 2 === 0 ? C.white : C.offwhite;
      const feelColor = t.feel === "Natural" ? C.green : t.feel === "Delightful" ? C.pink : C.amber;
      const feelBg = t.feel === "Natural" ? C.greenDark : t.feel === "Delightful" ? "3A0020" : C.amberDark;

      s.addShape(pres.shapes.RECTANGLE, { x: 0.4, y, w: 9.2, h: 0.43, fill: { color: bg }, line: { color: C.cardBorder } });

      s.addText(t.trigger, {
        x: 0.55, y: y + 0.05, w: 2.6, h: 0.34,
        fontSize: 10, fontFace: "Trebuchet MS", bold: true,
        color: C.dark, valign: "middle", margin: 0
      });

      s.addShape(pres.shapes.RECTANGLE, {
        x: 3.28, y: y + 0.09, w: 1.1, h: 0.26,
        fill: { color: feelBg }, line: { color: feelColor }
      });
      s.addText(t.feel.toUpperCase(), {
        x: 3.28, y: y + 0.09, w: 1.1, h: 0.26,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: feelColor, align: "center", valign: "middle", margin: 0
      });

      const stars = "★".repeat(t.rating) + "☆".repeat(5 - t.rating);
      s.addText(stars, {
        x: 4.52, y: y + 0.04, w: 1.1, h: 0.36,
        fontSize: 11, color: C.pink, valign: "middle", margin: 0
      });

      s.addText(t.note, {
        x: 5.72, y: y + 0.05, w: 3.75, h: 0.34,
        fontSize: 8.5, fontFace: "Trebuchet MS",
        color: C.muted, valign: "middle", margin: 0
      });
    });
  }
