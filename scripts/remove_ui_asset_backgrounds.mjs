import fs from "node:fs/promises";
import path from "node:path";

async function readApiKey() {
  const fromEnv = process.env.PICSART_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  throw new Error("Missing PICSART_API_KEY environment variable.");
}

function parseArgs(argv) {
  const args = {
    input: "src/assets/ui/generated",
    output: "src/assets/ui/cutouts",
    format: "PNG",
    model: "urn:air:picsart:model:picsart:sod@10",
    concurrency: 2,
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    const next = argv[i + 1];
    if (arg === "--input" && next) {
      args.input = next;
      i++;
    }
    else if (arg === "--output" && next) {
      args.output = next;
      i++;
    }
    else if (arg === "--format" && next) {
      args.format = next.toUpperCase();
      i++;
    }
    else if (arg === "--model" && next) {
      args.model = next;
      i++;
    }
    else if (arg === "--concurrency" && next) {
      args.concurrency = Number(next);
      i++;
    }
  }

  return args;
}

async function listPngFiles(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".png"))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function getResultUrl(payload) {
  return payload?.data?.url
    || payload?.url
    || payload?.data?.image_url
    || payload?.image_url
    || payload?.data?.result_url
    || payload?.result_url
    || null;
}

async function removeBackgroundForFile(filePath, outputDir, apiKey, options) {
  const bytes = await fs.readFile(filePath);
  const blob = new Blob([bytes], { type: "image/png" });
  const form = new FormData();
  form.set("image", blob, path.basename(filePath));
  form.set("output_type", "cutout");
  form.set("format", options.format);
  form.set("model", options.model);

  const response = await fetch("https://api.picsart.io/tools/1.0/removebg", {
    method: "POST",
    headers: {
      accept: "application/json",
      "x-picsart-api-key": apiKey,
    },
    body: form,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`Picsart removebg failed for ${path.basename(filePath)}: HTTP ${response.status} ${JSON.stringify(payload)}`);
  }

  const resultUrl = getResultUrl(payload);
  if (!resultUrl) {
    throw new Error(`Picsart removebg returned no result URL for ${path.basename(filePath)}: ${JSON.stringify(payload)}`);
  }

  const imageResponse = await fetch(resultUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download Picsart result for ${path.basename(filePath)}: HTTP ${imageResponse.status}`);
  }

  const arrayBuffer = await imageResponse.arrayBuffer();
  await fs.mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, path.basename(filePath));
  await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;

  async function runWorker() {
    while (cursor < items.length) {
      const current = cursor++;
      results[current] = await worker(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.max(1, limit) }, () => runWorker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const options = parseArgs(process.argv);
  const apiKey = await readApiKey();
  const inputDir = path.resolve(options.input);
  const outputDir = path.resolve(options.output);
  const files = await listPngFiles(inputDir);

  if (!files.length) {
    throw new Error(`No PNG files found in ${inputDir}`);
  }

  console.log(`Removing backgrounds for ${files.length} assets from ${inputDir}`);
  const outputs = await mapWithConcurrency(files, options.concurrency, async (filePath) => {
    const outputPath = await removeBackgroundForFile(filePath, outputDir, apiKey, options);
    console.log(`cutout -> ${outputPath}`);
    return outputPath;
  });

  console.log(`Saved ${outputs.length} cutouts to ${outputDir}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
