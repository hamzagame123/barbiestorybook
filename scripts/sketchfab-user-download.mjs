#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";

const DEFAULT_USER_URL = "https://sketchfab.com/Drothari/models";
const DEFAULT_OUT_DIR = "downloads/sketchfab";

function parseArgs(argv) {
    const options = {
        userUrl: DEFAULT_USER_URL,
        outDir: DEFAULT_OUT_DIR,
        token: process.env.SKETCHFAB_TOKEN ?? "",
        format: "glb",
        dryRun: false,
    };

    for (let index = 0; index < argv.length; index++) {
        const arg = argv[index];
        switch (arg) {
            case "--user-url":
                options.userUrl = argv[++index];
                break;
            case "--out":
                options.outDir = argv[++index];
                break;
            case "--token":
                options.token = argv[++index];
                break;
            case "--format":
                options.format = argv[++index];
                break;
            case "--dry-run":
                options.dryRun = true;
                break;
            default:
                throw new Error(`Unknown argument: ${arg}`);
        }
    }

    if (!["gltf", "glb", "usdz", "source"].includes(options.format)) {
        throw new Error(`Unsupported format "${options.format}". Use "glb", "gltf", "usdz", or "source".`);
    }

    return options;
}

function slugify(input) {
    return input
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80);
}

async function ensureDirectory(dirPath) {
    await fs.mkdir(dirPath, { recursive: true });
}

async function fetchText(url, init = {}) {
    const response = await fetch(url, init);
    if (!response.ok) {
        throw new Error(`Request failed for ${url}: HTTP ${response.status}`);
    }
    return await response.text();
}

async function fetchJson(url, init = {}) {
    const response = await fetch(url, init);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
        const errorMessage = payload?.detail || payload?.error || `HTTP ${response.status}`;
        throw new Error(`Request failed for ${url}: ${errorMessage}`);
    }
    return payload;
}

function extractModelsFromHtml(html) {
    const matches = html.matchAll(/\/3d-models\/([a-z0-9-]+)-([a-f0-9]{32})/gi);
    const seen = new Map();

    for (const match of matches) {
        const titleSlug = match[1] ?? "";
        const uid = match[2] ?? "";
        if (!uid || seen.has(uid)) continue;

        const title = titleSlug
            .split("-")
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ");

        seen.set(uid, {
            uid,
            title,
            modelUrl: `https://sketchfab.com/3d-models/${titleSlug}-${uid}`,
        });
    }

    return Array.from(seen.values());
}

async function getDownloadInfo(uid, token) {
    return await fetchJson(`https://api.sketchfab.com/v3/models/${uid}/download`, {
        headers: {
            Authorization: `Token ${token}`,
        },
    });
}

async function downloadToFile(url, filePath) {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Download failed for ${url}: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    await fs.writeFile(filePath, Buffer.from(arrayBuffer));
}

async function main() {
    const options = parseArgs(process.argv.slice(2));
    const userHtml = await fetchText(options.userUrl);
    const models = extractModelsFromHtml(userHtml);

    if (!models.length) {
        throw new Error(`No models found at ${options.userUrl}`);
    }

    const outDir = path.resolve(options.outDir);
    await ensureDirectory(outDir);

    const manifest = [];
    for (const model of models) {
        const entry = {
            ...model,
            format: options.format,
            status: "listed",
        };
        manifest.push(entry);

        if (options.dryRun) continue;
        if (!options.token) {
            throw new Error("Sketchfab OAuth token missing. Pass --token or set SKETCHFAB_TOKEN.");
        }

        const downloadInfo = await getDownloadInfo(model.uid, options.token);
        const fileInfo = downloadInfo?.[options.format];
        if (!fileInfo?.url) {
            entry.status = "unavailable";
            continue;
        }

        const extension =
            options.format === "gltf" || options.format === "source"
                ? "zip"
                : options.format;
        const fileName = `${slugify(model.title)}-${model.uid}.${extension}`;
        const filePath = path.join(outDir, fileName);
        await downloadToFile(fileInfo.url, filePath);

        entry.status = "downloaded";
        entry.file = filePath;
        entry.size = fileInfo.size ?? null;
    }

    const manifestPath = path.join(outDir, "manifest.json");
    await fs.writeFile(manifestPath, JSON.stringify({
        source: options.userUrl,
        format: options.format,
        downloadedAt: new Date().toISOString(),
        models: manifest,
    }, null, 2));

    console.log(JSON.stringify({
        outDir,
        manifestPath,
        models: manifest,
    }, null, 2));
}

main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
});
