#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_QUERIES = ["guitar", "birthday cake", "toy camera", "toy puppy", "handbag"];
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_OUT_DIR = "downloads/sketchfab/accessory-search";
const SEARCH_BASE = "https://api.sketchfab.com/v3/search";
const MODEL_BASE = "https://api.sketchfab.com/v3/models";

async function parseArgs(argv) {
    const options = {
        queries: [],
        count: 10,
        outDir: DEFAULT_OUT_DIR,
        googleKey: process.env.GOOGLE_API_KEY ?? "",
        sketchfabToken: process.env.SKETCHFAB_TOKEN ?? "",
        model: DEFAULT_MODEL,
        downloadTop: 1,
        minScore: 70,
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
            case "--query":
                options.queries.push(argv[++i]);
                break;
            case "--count":
                options.count = Number(argv[++i]);
                break;
            case "--out":
                options.outDir = argv[++i];
                break;
            case "--google-key":
                options.googleKey = argv[++i];
                break;
            case "--sketchfab-token":
                options.sketchfabToken = argv[++i];
                break;
            case "--model":
                options.model = argv[++i];
                break;
            case "--download-top":
                options.downloadTop = Number(argv[++i]);
                break;
            case "--min-score":
                options.minScore = Number(argv[++i]);
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!options.queries.length) {
        options.queries = [...DEFAULT_QUERIES];
    }

    if (!options.googleKey) {
        options.googleKey = await awaitReadGoogleKeyFromSecrets();
    }

    return options;
}

function slugify(input) {
    return input.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
}

async function awaitReadGoogleKeyFromSecrets() {
    try {
        const secretsPath = path.resolve("src/secrets.ts");
        const source = await fs.readFile(secretsPath, "utf8");
        const match = source.match(/const GOOGLE_API_KEY = "([^"]+)"/);
        return match?.[1] ?? "";
    }
    catch {
        return "";
    }
}

async function ensureDir(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function fetchJson(url, init = {}) {
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const message = payload?.detail || payload?.error || payload?.message || `HTTP ${response.status}`;
        throw new Error(`Request failed for ${url}: ${message}`);
    }
    return payload;
}

async function fetchBuffer(url, init = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Download failed for ${url}: HTTP ${response.status}`);
    }
    return Buffer.from(await response.arrayBuffer());
}

function pickPreview(images = []) {
    return [...images]
        .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))
        .find((image) => (image.width ?? 0) >= 512) ?? images[0] ?? null;
}

const STOPWORDS = new Set(["toy", "3d", "model", "asset", "prop"]);

function tokenize(text) {
    return String(text || "")
        .toLowerCase()
        .split(/[^a-z0-9]+/g)
        .filter(Boolean)
        .filter((token) => !STOPWORDS.has(token));
}

function isRelevantToQuery(query, model) {
    const queryTokens = tokenize(query);
    if (!queryTokens.length) return true;

    const hardHaystack = new Set([
        ...tokenize(model.name),
        ...(model.tags ?? []).flatMap((tag) => tokenize(tag.name)),
    ]);
    const softHaystack = new Set([
        ...hardHaystack,
        ...tokenize(model.description),
        ...(model.categories ?? []).flatMap((category) => tokenize(category.name)),
    ]);

    const hardMatched = queryTokens.filter((token) => hardHaystack.has(token));
    const softMatched = queryTokens.filter((token) => softHaystack.has(token));
    if (queryTokens.length === 1) return hardMatched.length === 1 || softMatched.length === 1;
    if (queryTokens.includes("camera")) return hardMatched.includes("camera");
    if (queryTokens.includes("guitar")) return hardMatched.includes("guitar");
    if (queryTokens.includes("cake")) return hardMatched.includes("cake") || hardMatched.includes("birthday");
    if (queryTokens.includes("puppy")) return hardMatched.includes("puppy") || hardMatched.includes("dog");
    if (queryTokens.includes("handbag")) return hardMatched.includes("handbag") || hardMatched.includes("bag");
    return softMatched.length >= Math.max(1, queryTokens.length - 1);
}

async function searchModels(query, count) {
    const params = new URLSearchParams({
        type: "models",
        downloadable: "true",
        count: String(count),
        q: query,
    });
    const data = await fetchJson(`${SEARCH_BASE}?${params.toString()}`);
    return data.results ?? [];
}

async function fetchModel(uid) {
    return await fetchJson(`${MODEL_BASE}/${uid}`);
}

function buildGeminiPrompt(query, model) {
    const tags = (model.tags ?? []).slice(0, 12).map((tag) => tag.name).join(", ");
    const license = model.license?.label ?? "unknown";
    return `You are evaluating whether a downloadable 3D model is a good accessory for a kid-friendly Barbie AR story app.

Return strict JSON with this exact shape:
{
  "score": number,
  "verdict": "import" | "skip",
  "summary": string,
  "reasons": string[],
  "risks": string[],
  "recommendedLabel": string
}

Be strict. Favor clean, toy-like, readable, isolated props that work on mobile AR.
Reject cluttered scenes, realistic weapons, creepy objects, giant environments, poor style fit, or very heavy meshes.

Target search: ${query}
Model name: ${model.name}
Description: ${model.description || "none"}
Face count: ${model.faceCount ?? "unknown"}
Vertex count: ${model.vertexCount ?? "unknown"}
Animation count: ${model.animationCount ?? 0}
Texture count: ${model.textureCount ?? "unknown"}
Download count: ${model.downloadCount ?? "unknown"}
License: ${license}
Tags: ${tags || "none"}

Score guidance:
- 90-100 = excellent Barbie/Toybox accessory
- 75-89 = strong candidate
- 60-74 = maybe usable with caveats
- below 60 = skip`;
}

function extractJson(text) {
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) return JSON.parse(trimmed);
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error(`Gemini did not return JSON: ${trimmed.slice(0, 300)}`);
    }
    return JSON.parse(match[0]);
}

async function evaluateWithGemini(query, model, previewBuffer, googleKey, modelName) {
    if (!googleKey) {
        return {
            score: 0,
            verdict: "skip",
            summary: "Missing Google API key.",
            reasons: [],
            risks: ["Gemini evaluation skipped because no Google API key was available."],
            recommendedLabel: model.name,
        };
    }

    const mimeType = "image/jpeg";
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${googleKey}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    { text: buildGeminiPrompt(query, model) },
                    {
                        inline_data: {
                            mime_type: mimeType,
                            data: previewBuffer.toString("base64"),
                        },
                    },
                ],
            }],
            generationConfig: {
                temperature: 0.15,
                responseMimeType: "application/json",
            },
        }),
    });

    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload?.error?.message || `Gemini request failed with HTTP ${response.status}`);
    }

    const text = payload?.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n").trim();
    if (!text) {
        throw new Error("Gemini returned no text.");
    }
    return extractJson(text);
}

async function getDownloadInfo(uid, token) {
    return await fetchJson(`${MODEL_BASE}/${uid}/download`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    });
}

async function downloadCandidate(model, queryDir, token) {
    if (!token) return null;

    const downloadInfo = await getDownloadInfo(model.uid, token);
    const glbInfo = downloadInfo?.glb;
    if (!glbInfo?.url) return null;

    const fileName = `${slugify(model.name)}-${model.uid}.glb`;
    const filePath = path.join(queryDir, fileName);
    const fileBuffer = await fetchBuffer(glbInfo.url);
    await fs.writeFile(filePath, fileBuffer);
    return {
        fileName,
        filePath,
        size: glbInfo.size ?? fileBuffer.byteLength,
    };
}

async function run() {
    const options = await parseArgs(process.argv.slice(2));
    const outDir = path.resolve(options.outDir);
    await ensureDir(outDir);

    const report = [];

    for (const query of options.queries) {
        const querySlug = slugify(query);
        const queryDir = path.join(outDir, querySlug);
        await ensureDir(queryDir);
        const models = await searchModels(query, options.count);
        const reviewed = [];

        for (const modelSummary of models) {
            const model = await fetchModel(modelSummary.uid);
            if (!isRelevantToQuery(query, model)) continue;
            const preview = pickPreview(model.thumbnails?.images);
            if (!preview?.url) continue;

            const previewBuffer = await fetchBuffer(preview.url);
            const previewName = `${slugify(model.name)}-${model.uid}.jpg`;
            await fs.writeFile(path.join(queryDir, previewName), previewBuffer);

            const evaluation = await evaluateWithGemini(query, model, previewBuffer, options.googleKey, options.model);
            reviewed.push({
                query,
                uid: model.uid,
                name: model.name,
                viewerUrl: model.viewerUrl,
                faceCount: model.faceCount ?? null,
                vertexCount: model.vertexCount ?? null,
                animationCount: model.animationCount ?? 0,
                downloadCount: model.downloadCount ?? null,
                license: model.license?.label ?? null,
                previewFile: previewName,
                previewUrl: preview.url,
                evaluation,
            });
        }

        reviewed.sort((a, b) => (b.evaluation?.score ?? 0) - (a.evaluation?.score ?? 0));

        let importedCount = 0;
        for (const candidate of reviewed) {
            if (candidate.evaluation?.verdict !== "import") continue;
            if ((candidate.evaluation?.score ?? 0) < options.minScore) continue;
            if (importedCount >= options.downloadTop) break;

            const download = await downloadCandidate(candidate, queryDir, options.sketchfabToken);
            if (!download) continue;
            candidate.download = download;
            importedCount += 1;
        }

        const manifestPath = path.join(queryDir, "viability-report.json");
        await fs.writeFile(manifestPath, JSON.stringify(reviewed, null, 2));
        report.push({
            query,
            manifestPath,
            reviewedCount: reviewed.length,
            imported: reviewed.filter((item) => item.download).map((item) => ({
                uid: item.uid,
                name: item.name,
                score: item.evaluation.score,
                filePath: item.download.filePath,
                previewFile: item.previewFile,
            })),
        });
    }

    const summaryPath = path.join(outDir, "summary.json");
    await fs.writeFile(summaryPath, JSON.stringify(report, null, 2));
    console.log(JSON.stringify({ outDir, summaryPath, report }, null, 2));
}

run().catch((error) => {
    console.error(error instanceof Error ? error.stack || error.message : String(error));
    process.exitCode = 1;
});
