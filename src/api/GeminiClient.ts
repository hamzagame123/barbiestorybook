import { GOOGLE_API_KEY } from "../secrets";

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
};

export type BarbiePromptPack = {
    characterPrompt: string;
    worldPrompt: string;
};

const FALLBACK_CAPTION = "She stepped into a world of her own making.";
const FALLBACK_IMAGE_PROMPT = "Single full-body Barbie-style fashion doll doctor, blonde hair, friendly smile, teal scrubs, white coat, toy-like proportions, centered, front three-quarter view, clean light studio background, no other characters, no text, no crop.";
const FALLBACK_PROMPT_PACK: BarbiePromptPack = {
    characterPrompt: "Astronaut Barbie in a glossy bubble helmet, iridescent suit, star charm belt, full body fashion doll, bright smile.",
    worldPrompt: "A dreamy Barbie moon garden with pearly craters, glossy pink crystal arches, tiny star bridges, and whimsical toy-like sci-fi details.",
};

async function requestGeminiText(prompt: string): Promise<string | null> {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GOOGLE_API_KEY}`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: prompt,
                }],
            }],
        }),
    });

    if (!response.ok) {
        return null;
    }

    const data = await response.json() as GeminiResponse;
    return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
}

export async function generateCaption(characterPrompt: string): Promise<string> {
    try {
        const text = await requestGeminiText(
            `Write a magical 1-sentence caption for a Barbie storybook page. The scene shows: ${characterPrompt}. Max 15 words. Third person. Whimsical and warm. Return only the caption, no quotes, no explanation.`
        );
        return text || FALLBACK_CAPTION;
    }
    catch {
        return FALLBACK_CAPTION;
    }
}

export async function generateRodinImagePrompt(characterPrompt: string): Promise<string> {
    try {
        const text = await requestGeminiText(
            `You are writing an image-generation prompt for a Barbie Storybook AR app.
The user wants to create one stylized Barbie-like character that will later be converted into a 3D model.

User idea: ${characterPrompt}

Write one concise prompt for a text-to-image model with these requirements:
- single character only
- full body visible from head to toe
- centered in frame
- toy-like fashion doll proportions
- clean readable silhouette
- clean light studio or seamless background
- no extra characters
- no text
- no speech bubbles
- no busy environment
- no cropped limbs
- polished commercial toy photography feel
- keep the character visually consistent with the user's idea

Return only the final image prompt, no bullets, no quotes, no explanation.`
        );
        return text || `${characterPrompt}. ${FALLBACK_IMAGE_PROMPT}`;
    }
    catch {
        return `${characterPrompt}. ${FALLBACK_IMAGE_PROMPT}`;
    }
}

export async function generateBarbiePromptPack(seedPrompt?: string): Promise<BarbiePromptPack> {
    try {
        const seedLine = seedPrompt?.trim()
            ? `Use this as inspiration and preserve its core idea: ${seedPrompt.trim()}`
            : "Invent a fresh Barbie-themed idea that feels playful, magical, and easy to test quickly.";

        const text = await requestGeminiText(
            `You are writing two prompts for a mobile AR demo called Barbie Storybook.
The app needs:
1. one character prompt for a single Barbie-like fashion doll that will be turned into an image and then a 3D model
2. one world prompt for World Labs Marble that creates a matching miniature world around that doll

${seedLine}

Requirements for the character prompt:
- one character only
- full body visible
- toy-like fashion doll proportions
- strong silhouette
- charming outfit and accessories
- no background details

Requirements for the world prompt:
- no people or characters
- describe a whimsical Barbie-themed environment or diorama
- readable geometry for a 3D world
- visually rich but concise
- should feel like it matches the character

Return exactly two lines in this format:
CHARACTER: <prompt>
WORLD: <prompt>`
        );

        if (!text) return FALLBACK_PROMPT_PACK;

        const characterLine = text.split(/\r?\n/).find((line) => line.trim().toUpperCase().startsWith("CHARACTER:"));
        const worldLine = text.split(/\r?\n/).find((line) => line.trim().toUpperCase().startsWith("WORLD:"));

        const characterPrompt = characterLine?.split(":").slice(1).join(":").trim();
        const worldPrompt = worldLine?.split(":").slice(1).join(":").trim();

        if (!characterPrompt || !worldPrompt) {
            return FALLBACK_PROMPT_PACK;
        }

        return { characterPrompt, worldPrompt };
    }
    catch {
        return FALLBACK_PROMPT_PACK;
    }
}
