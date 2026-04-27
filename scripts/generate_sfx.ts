import { fal } from "@fal-ai/client";
import * as fs from "fs";
import * as path from "path";
import { FAL_API_KEY } from "../src/secrets";

fal.config({
    credentials: FAL_API_KEY,
});

const sfxList = [
    { name: "ui_click.mp3", prompt: "A very soft, satisfying, tiny plastic toy click or pop for a UI button" },
    { name: "error.mp3", prompt: "A soft, cute, gentle disappointing 'uh-oh' or muted bonk sound" },
    { name: "glimmer_chime.mp3", prompt: "A magical, bright, tiny fairy dust chime for a helper AI" },
    { name: "delete.mp3", prompt: "A soft paper crumbling or poof sound, magical but deleting" }
];

async function generateAll() {
    const outDir = path.resolve(__dirname, "../public/sfx");
    if (!fs.existsSync(outDir)) {
        fs.mkdirSync(outDir, { recursive: true });
    }

    for (const sfx of sfxList) {
        console.log(`Generating ${sfx.name}...`);
        try {
            const result: any = await fal.subscribe("fal-ai/elevenlabs/sound-effects/v2", {
                input: {
                    text: sfx.prompt
                },
                logs: true
            });
            
            console.log("Result:", result);
            const audioUrl = result.data?.audio?.url || result.audio?.url;
            if (audioUrl) {
                const response = await fetch(audioUrl);
                const buffer = await response.arrayBuffer();
                fs.writeFileSync(path.join(outDir, sfx.name), Buffer.from(buffer));
                console.log(`Saved ${sfx.name}`);
            } else {
                console.log(`No audio url for ${sfx.name}`);
            }
        } catch (err: any) {
            console.error(`Failed to generate ${sfx.name}:`, err.message);
            if (err.body) {
                console.error("Error body:", JSON.stringify(err.body, null, 2));
            }
        }
    }
}

generateAll().catch(console.error);
