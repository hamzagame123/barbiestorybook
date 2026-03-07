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

const FALLBACK_CAPTION = "She stepped into a world of her own making.";

export async function generateCaption(characterPrompt: string): Promise<string> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${GOOGLE_API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Write a magical 1-sentence caption for a Barbie storybook page. The scene shows: ${characterPrompt}. Max 15 words. Third person. Whimsical and warm. Return only the caption, no quotes, no explanation.`,
                    }],
                }],
            }),
        });

        if (!response.ok) {
            return FALLBACK_CAPTION;
        }

        const data = await response.json() as GeminiResponse;
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
        return text || FALLBACK_CAPTION;
    }
    catch {
        return FALLBACK_CAPTION;
    }
}
