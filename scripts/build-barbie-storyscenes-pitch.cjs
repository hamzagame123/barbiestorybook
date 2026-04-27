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
  muted: "9E6070",
  cardBorder: "F0D0DC",
  green: "4ADE80",
  greenDark: "1A3A1A",
  amber: "FBBF24",
  amberDark: "2A1A00",
};

const shadow = () => ({
  type: "outer",
  blur: 8,
  offset: 2,
  angle: 135,
  color: "000000",
  opacity: 0.12,
});

function addTopLabel(slide, text, color) {
  slide.addText(text, {
    x: 0.45, y: 0.33, w: 8.5, h: 0.25,
    fontSize: 9, fontFace: "Trebuchet MS", bold: true,
    color, charSpacing: 3, margin: 0
  });
}

function addTitle(slide, text, color = C.dark, y = 0.65, size = 30) {
  slide.addText(text, {
    x: 0.45, y, w: 8.9, h: 0.55,
    fontSize: size, fontFace: "Georgia", bold: true,
    color, margin: 0
  });
}

function addRule(slide) {
  slide.addShape("rect", {
    x: 0.45, y: 1.35, w: 9.05, h: 0.02,
    fill: { color: C.cardBorder }, line: { color: C.cardBorder }
  });
}

function addCard(slide, x, y, w, h, accent = C.rose, bg = C.white) {
  slide.addShape("rect", {
    x, y, w, h,
    fill: { color: bg },
    line: { color: C.cardBorder },
    shadow: shadow()
  });
  slide.addShape("rect", {
    x, y, w, h: 0.08,
    fill: { color: accent },
    line: { color: accent }
  });
}

async function buildDeck() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_16x9";
  pres.author = "OpenAI Codex";
  pres.company = "OpenAI";
  pres.subject = "Barbie StoryScenes discovery and feasibility pitch";
  pres.title = "Barbie StoryScenes - Discovery & Feasibility Pitch";
  pres.lang = "en-US";
  pres.theme = {
    headFontFace: "Georgia",
    bodyFontFace: "Trebuchet MS",
    lang: "en-US",
  };

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape("rect", { x: 0, y: 0, w: 0.09, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    s.addShape("rect", { x: 0.09, y: 0, w: 0.04, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    s.addShape("ellipse", { x: 8.2, y: -0.55, w: 2.8, h: 2.8, fill: { color: C.rose, transparency: 82 }, line: { color: C.rose, transparency: 72 } });
    s.addShape("ellipse", { x: 7.5, y: 4.0, w: 2.0, h: 2.0, fill: { color: C.blush, transparency: 88 }, line: { color: C.blush, transparency: 82 } });
    addTopLabel(s, "DISCOVERY & FEASIBILITY PITCH", C.pink);
    s.addText([
      { text: "Barbie", options: { color: C.pink, bold: true, breakLine: true } },
      { text: "StoryScenes", options: { color: C.white, bold: true } }
    ], {
      x: 0.5, y: 1.0, w: 8.5, h: 1.9,
      fontSize: 60, fontFace: "Georgia", margin: 0
    });
    s.addText("A guided AR scene-making system where kids turn\nideas, moods, and memories into living Barbie moments.", {
      x: 0.5, y: 3.5, w: 7.2, h: 0.8,
      fontSize: 14, fontFace: "Trebuchet MS", color: C.blush, margin: 0
    });
    s.addText("Immersive Technology - Term Project Pitch", {
      x: 0.5, y: 5.23, w: 9, h: 0.24,
      fontSize: 9, fontFace: "Trebuchet MS", color: C.blush, margin: 0
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    addTopLabel(s, "THE BIG IDEA", C.rose);
    addTitle(s, "What is Barbie StoryScenes?");
    addRule(s);

    s.addShape("rect", {
      x: 0.45, y: 1.55, w: 9.05, h: 1.05,
      fill: { color: C.rose, transparency: 88 },
      line: { color: C.rose, transparency: 70 },
      shadow: shadow()
    });
    s.addShape("rect", { x: 0.45, y: 1.55, w: 0.08, h: 1.05, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("A mobile AR experience where kids turn a thought, mood, or mini story into a small animated Barbie scene, place it in their real space, talk through it with Glimmer, and save it as part of a growing personal collection.", {
      x: 0.63, y: 1.68, w: 8.65, h: 0.8,
      fontSize: 13, fontFace: "Georgia", italic: true, color: C.dark, margin: 0
    });

    const pillars = [
      ["MAKE", "Pick or generate a doll, backdrop, and props. Glimmer helps shape the scene in one or two short turns."],
      ["PLACE", "WebXR anchors the whole scene to a real surface. Drag, pinch, and rotate to compose the perfect shot."],
      ["KEEP", "Capture a polished story moment. Nano Banana grades it, Glimmer captions it, and it joins the book."],
    ];

    pillars.forEach((item, i) => {
      const x = 0.45 + i * 3.07;
      addCard(s, x, 3.0, 2.85, 1.95, C.pink);
      s.addText(item[0], {
        x: x + 0.14, y: 3.14, w: 1.4, h: 0.25,
        fontSize: 11, fontFace: "Trebuchet MS", bold: true,
        color: C.rose, charSpacing: 2, margin: 0
      });
      s.addText(item[1], {
        x: x + 0.14, y: 3.5, w: 2.55, h: 1.2,
        fontSize: 10.5, fontFace: "Trebuchet MS", color: C.dark, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    addTopLabel(s, "PRODUCT NAMING", C.blush);
    addTitle(s, "Why StoryScenes, Not Storybook", C.white);

    const leftX = 0.45;
    const rightX = 5.1;
    [["STORYBOOK", leftX, C.muted, "160010", "OLD DIRECTION"], ["STORYSCENES", rightX, C.pink, "1A0018", "NEW DIRECTION"]]
      .forEach(([label, x, color, bg, tag], idx) => {
        addCard(s, x, 1.45, 4.4, 3.85, color, bg);
        s.addShape("rect", {
          x: x + 0.14, y: 1.62, w: 1.55, h: 0.28,
          fill: { color: "000000", transparency: 100 }, line: { color }
        });
        s.addText(tag, {
          x: x + 0.14, y: 1.62, w: 1.55, h: 0.28,
          fontSize: 7, fontFace: "Trebuchet MS", bold: true,
          color, charSpacing: 1, align: "center", valign: "middle", margin: 0
        });
        s.addText('"' + label + '"', {
          x: x + 0.14, y: 2.0, w: 3.9, h: 0.5,
          fontSize: 25, fontFace: "Georgia", italic: true, bold: true,
          color, margin: 0
        });
        const points = idx === 0
          ? [
              "Suggests a finished, passive artifact",
              "Implies one output - a book page",
              "Positions the user as a reader",
              "Generation feels like the whole product",
              "Scrapbook metaphor limits the loop",
            ]
          : [
              "Suggests active creation and staging",
              "Implies collection - many scenes over time",
              "Positions the user as a director",
              "Generation is one tool, not the whole product",
              "Toybox + narration + capture = the loop",
            ];
        points.forEach((pt, i) => {
          s.addText((idx === 0 ? "x  " : "check  ") + pt, {
            x: x + 0.14, y: 2.7 + i * 0.48, w: 4.0, h: 0.34,
            fontSize: 9.5, fontFace: "Trebuchet MS",
            color: idx === 0 ? C.muted : C.white, margin: 0
          });
        });
      });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    addTopLabel(s, "USER EXPERIENCE", C.rose);
    addTitle(s, "The Scene-Making Loop");
    addRule(s);

    const steps = [
      "01 Imagine\nPick or describe a Barbie scene idea",
      "02 Shape\nGlimmer helps in 1-2 short turns",
      "03 Doll\nChoose preset or generate via Rodin",
      "04 World\nChoose backdrop or generate via Nano Banana",
      "05 Props\nAdd accessories and stage pieces",
      "06 Place\nAnchor scene to real AR surface",
      "07 Direct\nPose, rotate, and scale to compose",
      "08 Capture\nSnap polished story moment",
      "09 Save\nGemini captions, stored in book",
      "10 Return\nMake another scene anytime",
    ];

    steps.forEach((text, i) => {
      const col = i % 5;
      const row = Math.floor(i / 5);
      const x = 0.45 + col * 1.82;
      const y = 1.65 + row * 1.55;
      addCard(s, x, y, 1.55, 1.22, row === 0 ? C.rose : C.pink);
      const [head, body] = text.split("\n");
      s.addText(head, {
        x: x + 0.12, y: y + 0.14, w: 1.25, h: 0.35,
        fontSize: 9.5, fontFace: "Georgia", bold: true, color: C.dark, margin: 0
      });
      s.addText(body, {
        x: x + 0.12, y: y + 0.52, w: 1.25, h: 0.48,
        fontSize: 7.5, fontFace: "Trebuchet MS", color: C.muted, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    addTopLabel(s, "TECHNICAL FEASIBILITY", C.pink);
    addTitle(s, "Stack & APIs Validated", C.white);

    const rows = [
      ["AR Runtime", "Needle Engine + Needle Go App Clip", "Full WebXR on iPhone Safari via App Clip - no Xcode, no Mac required"],
      ["Story Narrator", "Glimmer (Gemini Flash-Lite)", "Scene helper that suggests titles, beats, captions, and props in-app"],
      ["Image Generation", "Nano Banana (Gemini)", "Reference image generation plus story world backdrops and atmosphere plates"],
      ["3D Doll Generation", "Hyper3D Rodin via fal.ai", "Image + prompt -> GLB; CharacterSpawner loads the result into the toy slot"],
      ["Preset Library", "Authored dolls, backdrops, props", "Fast, reliable fallback when generation is slow or unavailable"],
      ["Scene Composition", "SceneRig + SceneGestures", "Drag, pinch, and rotate for direct manipulation in AR"],
      ["Persistence", "IndexedDB", "Scrapbook pages stored locally with no backend requirement"],
    ];

    rows.forEach((row, i) => {
      const y = 1.45 + i * 0.56;
      const bg = i % 2 === 0 ? "1A0018" : "140010";
      s.addShape("rect", { x: 0.45, y, w: 9.05, h: 0.48, fill: { color: bg }, line: { color: C.rose, transparency: 65 } });
      s.addText(row[0], {
        x: 0.6, y: y + 0.08, w: 1.7, h: 0.28,
        fontSize: 9, fontFace: "Trebuchet MS", bold: true, color: C.pink, margin: 0
      });
      s.addText(row[1], {
        x: 2.45, y: y + 0.08, w: 3.0, h: 0.28,
        fontSize: 9.5, fontFace: "Trebuchet MS", bold: true, color: C.white, margin: 0
      });
      s.addText(row[2], {
        x: 5.75, y: y + 0.08, w: 3.55, h: 0.28,
        fontSize: 8.5, fontFace: "Trebuchet MS", color: C.blush, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.blush }, line: { color: C.blush } });
    addTopLabel(s, "GLIMMER", C.rose);
    addTitle(s, "The Barbie Story Helper");
    addRule(s);

    s.addShape("rect", {
      x: 0.45, y: 1.52, w: 9.05, h: 0.92,
      fill: { color: C.rose, transparency: 88 },
      line: { color: C.rose, transparency: 70 },
      shadow: shadow()
    });
    s.addShape("rect", { x: 0.45, y: 1.52, w: 0.08, h: 0.92, fill: { color: C.rose }, line: { color: C.rose } });
    s.addText("Glimmer is a compact Gemini-powered narrator built into the app. She helps the child turn a half-formed idea into a Barbie scene with a title, a moment, and something to say.", {
      x: 0.63, y: 1.67, w: 8.65, h: 0.6,
      fontSize: 12.5, fontFace: "Georgia", italic: true, color: C.dark, margin: 0
    });

    const features = [
      ["Scene shaping", "Suggests a title, setup beat, moment, and ending from a loose idea."],
      ["Caption writing", "Writes the scrapbook caption after capture in a warm Barbie tone."],
      ["Prop ideas", "Recommends accessories or stage props that match the scene theme."],
      ["Live narration", "Can read scene descriptions aloud so the scene feels more alive."],
    ];
    features.forEach((f, i) => {
      const x = 0.45 + i * 2.28;
      addCard(s, x, 2.9, 2.1, 2.0, C.rose);
      s.addText(f[0], {
        x: x + 0.12, y: 3.08, w: 1.8, h: 0.34,
        fontSize: 10, fontFace: "Trebuchet MS", bold: true, color: C.rose, margin: 0
      });
      s.addText(f[1], {
        x: x + 0.12, y: 3.48, w: 1.8, h: 1.2,
        fontSize: 9, fontFace: "Trebuchet MS", color: C.dark, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.dark };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.rose }, line: { color: C.rose } });
    addTopLabel(s, "WORLD GENERATION", C.blush);
    addTitle(s, "From World Labs to Nano Banana", C.white);

    s.addShape("rect", {
      x: 0.45, y: 1.45, w: 9.05, h: 0.9,
      fill: { color: C.rose, transparency: 88 },
      line: { color: C.rose, transparency: 70 },
      shadow: shadow()
    });
    s.addText("World Labs proved the concept, but it was fragile and slow. The new direction replaces it with Nano Banana atmosphere generation: faster, more stable, and a better fit for the StoryScenes visual language.", {
      x: 0.62, y: 1.6, w: 8.65, h: 0.55,
      fontSize: 11.5, fontFace: "Georgia", italic: true, color: C.white, margin: 0
    });

    const options = [
      ["A. Panoramic Backdrop", "Primary path", C.green, C.greenDark, "Generate a Barbie environment plate and wrap it as a skybox sphere through BackgroundSpawner."],
      ["B. Stage Card / Set Wall", "Secondary path", C.amber, C.amberDark, "Generate an illustrated playset wall or diorama panel mapped behind the doll."],
      ["C. Depth-Staged Layers", "Medium-term", C.pink, "2A0018", "Layer foreground, midground, and background planes with generated imagery and authored props."],
    ];

    options.forEach((o, i) => {
      const x = 0.45 + i * 3.07;
      addCard(s, x, 2.65, 2.85, 2.15, C.rose, "1A0018");
      s.addShape("rect", {
        x: x + 0.14, y: 2.82, w: 1.4, h: 0.26,
        fill: { color: o[3] }, line: { color: o[2] }
      });
      s.addText(o[1], {
        x: x + 0.14, y: 2.82, w: 1.4, h: 0.26,
        fontSize: 7, fontFace: "Trebuchet MS", bold: true,
        color: o[2], align: "center", valign: "middle", margin: 0
      });
      s.addText(o[0], {
        x: x + 0.14, y: 3.18, w: 2.5, h: 0.35,
        fontSize: 11, fontFace: "Georgia", bold: true, color: C.blush, margin: 0
      });
      s.addText(o[4], {
        x: x + 0.14, y: 3.58, w: 2.5, h: 0.9,
        fontSize: 9.2, fontFace: "Trebuchet MS", color: C.white, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    s.addShape("rect", { x: 0, y: 0, w: 0.1, h: 5.625, fill: { color: C.pink }, line: { color: C.pink } });
    addTopLabel(s, "STATUS & DELIVERABLES", C.rose);
    addTitle(s, "What's Built and What Comes Next");
    addRule(s);

    addCard(s, 0.45, 1.6, 4.25, 3.55, C.rose);
    s.addText("BUILT NOW", {
      x: 0.58, y: 1.78, w: 1.8, h: 0.25,
      fontSize: 11, fontFace: "Trebuchet MS", bold: true, color: C.rose, margin: 0
    });
    [
      "AR placement, reticle, and gestures",
      "Preset dolls, backdrops, accessories",
      "Glimmer narrator in-app",
      "Capture, Nano Banana polish, scrapbook",
      "Needle Engine deployment on iPhone via App Clip flow",
    ].forEach((line, i) => {
      s.addText("check  " + line, {
        x: 0.58, y: 2.15 + i * 0.46, w: 3.75, h: 0.28,
        fontSize: 9.5, fontFace: "Trebuchet MS", color: C.dark, margin: 0
      });
    });

    addCard(s, 5.0, 1.6, 4.5, 3.55, C.pink);
    s.addText("NEXT", {
      x: 5.13, y: 1.78, w: 1.2, h: 0.25,
      fontSize: 11, fontFace: "Trebuchet MS", bold: true, color: C.rose, margin: 0
    });
    [
      "Nano Banana backdrop / atmosphere generation",
      "Rodin doll generation re-integrated",
      "StoryScenes branding everywhere in the product",
      "Tighter scene-memory loop and better revisit flow",
      "More authored Barbie playsets as reliable fallbacks",
    ].forEach((line, i) => {
      s.addText((i < 2 ? "WIP  " : "PLAN  ") + line, {
        x: 5.13, y: 2.15 + i * 0.46, w: 4.0, h: 0.28,
        fontSize: 9.5, fontFace: "Trebuchet MS", color: C.dark, margin: 0
      });
    });
  }

  {
    const s = pres.addSlide();
    s.background = { color: C.rose };
    s.addShape("ellipse", { x: 6.5, y: -1, w: 5.5, h: 5.5, fill: { color: C.dark, transparency: 75 }, line: { color: C.dark, transparency: 70 } });
    s.addShape("ellipse", { x: 7.2, y: -0.4, w: 4.0, h: 4.0, fill: { color: C.pink, transparency: 70 }, line: { color: C.pink, transparency: 65 } });
    s.addShape("ellipse", { x: -1, y: 3.5, w: 3.5, h: 3.5, fill: { color: C.dark, transparency: 80 }, line: { color: C.dark, transparency: 75 } });
    s.addText("Not a storybook.", {
      x: 0.6, y: 0.7, w: 8.5, h: 0.75,
      fontSize: 42, fontFace: "Georgia", italic: true, color: C.white, margin: 0
    });
    s.addText("A scene she", {
      x: 0.6, y: 1.45, w: 8.5, h: 0.75,
      fontSize: 42, fontFace: "Georgia", italic: true, color: C.white, margin: 0
    });
    s.addText("made herself.", {
      x: 0.6, y: 2.2, w: 8.5, h: 0.75,
      fontSize: 42, fontFace: "Georgia", italic: true, bold: true, color: C.dark, margin: 0
    });
    s.addText("Barbie StoryScenes - Discovery & Feasibility Pitch", {
      x: 0.6, y: 4.82, w: 8.8, h: 0.3,
      fontSize: 10, fontFace: "Trebuchet MS", color: C.white, margin: 0
    });
  }

  const outDir = path.join(process.cwd(), "generated", "pptx");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "BarbieStoryScenes_Pitch.pptx");
  await pres.writeFile({ fileName: outPath });
  console.log("Saved:", outPath);
}

buildDeck().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
