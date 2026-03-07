import { GOOGLE_API_KEY } from "../secrets";

const NANO_BANANA_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${GOOGLE_API_KEY}`;

export enum NanoBananaError {
    APIError = "api-error",
    InvalidResponse = "invalid-response",
}

export class NanoBananaClientError extends Error {
    constructor(public readonly type: NanoBananaError, message: string) {
        super(message);
        this.name = "NanoBananaClientError";
    }
}

type InlineData = {
    mimeType?: string;
    mime_type?: string;
    data?: string;
};

type GeminiImagePart = {
    text?: string;
    inlineData?: InlineData;
    inline_data?: InlineData;
};

type GeminiImageResponse = {
    candidates?: Array<{
        content?: {
            parts?: GeminiImagePart[];
        };
    }>;
    error?: {
        message?: string;
    };
};

function getHeaders(): HeadersInit {
    return {
        "Content-Type": "application/json",
    };
}

async function readJson<T>(response: Response): Promise<T> {
    const body = await response.json().catch(() => null) as GeminiImageResponse | null;
    if (!response.ok) {
        const message = body?.error?.message || `Nano Banana request failed with HTTP ${response.status}.`;
        throw new NanoBananaClientError(NanoBananaError.APIError, message);
    }
    return body as T;
}

function imagePartToDataUrl(part: GeminiImagePart | undefined): string | null {
    const inline = part?.inlineData ?? part?.inline_data;
    const mimeType = inline?.mimeType ?? inline?.mime_type;
    const data = inline?.data;
    if (!mimeType || !data) return null;
    return `data:${mimeType};base64,${data}`;
}

async function requestNanoBanana(parts: Array<Record<string, unknown>>): Promise<string> {
    const response = await fetch(NANO_BANANA_URL, {
        method: "POST",
        headers: getHeaders(),
        body: JSON.stringify({
            contents: [{
                parts,
            }],
            generationConfig: {
                responseModalities: ["TEXT", "IMAGE"],
            },
        }),
    });

    const data = await readJson<GeminiImageResponse>(response);
    const imagePart = data.candidates?.[0]?.content?.parts?.find((part) => !!imagePartToDataUrl(part));
    const dataUrl = imagePartToDataUrl(imagePart);
    if (!dataUrl) {
        throw new NanoBananaClientError(NanoBananaError.InvalidResponse, "Nano Banana finished, but no image was returned.");
    }

    return dataUrl;
}

export async function generateReferenceImage(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        onProgress?.("Painting reference...");
        return await requestNanoBanana([{ text: prompt }]);
    }
    catch (error) {
        if (error instanceof NanoBananaClientError) throw error;
        throw new NanoBananaClientError(
            NanoBananaError.APIError,
            error instanceof Error ? error.message : "Nano Banana image generation failed."
        );
    }
}

export async function polishCaptureImage(
    imageDataUrl: string,
    characterPrompt: string,
    worldPrompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        onProgress?.("Cinematic polish...");
        return await requestNanoBanana([
            {
                inlineData: {
                    mimeType: imageDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
                    data: imageDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
                },
            },
            {
                text: `Turn this mobile AR capture into a polished cinematic Barbie storybook image.
Keep the same composition, subject identity, camera angle, and scene layout.
Preserve the Barbie character based on: ${characterPrompt}.
Preserve the world vibe based on: ${worldPrompt || "a whimsical Barbie storybook scene"}.
Clean edges, improve lighting, add a warm dreamy filmic grade, and make it feel premium and magical.
Do not add text, borders, extra people, or major pose changes.`,
            },
        ]);
    }
    catch (error) {
        if (error instanceof NanoBananaClientError) throw error;
        throw new NanoBananaClientError(
            NanoBananaError.APIError,
            error instanceof Error ? error.message : "Nano Banana image editing failed."
        );
    }
}
