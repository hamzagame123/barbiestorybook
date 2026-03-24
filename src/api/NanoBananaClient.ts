import { GOOGLE_API_KEY } from "../secrets";

const NANO_BANANA_PRO_MODEL = "gemini-3-pro-image-preview";
const NANO_BANANA_FALLBACK_MODEL = "gemini-2.5-flash-image";
const NANO_BANANA_PRO_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_PRO_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;
const NANO_BANANA_FALLBACK_URL = `https://generativelanguage.googleapis.com/v1beta/models/${NANO_BANANA_FALLBACK_MODEL}:generateContent?key=${GOOGLE_API_KEY}`;

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

function isRetryableImageError(error: unknown): boolean {
    return error instanceof NanoBananaClientError
        && (error.message.includes("HTTP 429")
            || error.message.includes("HTTP 500")
            || error.message.includes("HTTP 502")
            || error.message.includes("HTTP 503")
            || error.message.includes("HTTP 504"));
}

async function sleep(ms: number): Promise<void> {
    await new Promise((resolve) => window.setTimeout(resolve, ms));
}

function imagePartToDataUrl(part: GeminiImagePart | undefined): string | null {
    const inline = part?.inlineData ?? part?.inline_data;
    const mimeType = inline?.mimeType ?? inline?.mime_type;
    const data = inline?.data;
    if (!mimeType || !data) return null;
    return `data:${mimeType};base64,${data}`;
}

async function requestNanoBanana(parts: Array<Record<string, unknown>>, modelUrl: string): Promise<string> {
    const response = await fetch(modelUrl, {
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

async function requestNanoBananaWithRetry(parts: Array<Record<string, unknown>>): Promise<string> {
    const attempts = [
        { url: NANO_BANANA_PRO_URL, delays: [0, 400, 1100] },
        { url: NANO_BANANA_FALLBACK_URL, delays: [0, 250] },
    ];

    let lastError: unknown = null;

    for (const attempt of attempts) {
        for (let i = 0; i < attempt.delays.length; i++) {
            const delay = attempt.delays[i];
            if (delay > 0) await sleep(delay);

            try {
                return await requestNanoBanana(parts, attempt.url);
            }
            catch (error) {
                lastError = error;
                if (!isRetryableImageError(error) || i === attempt.delays.length - 1) break;
            }
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new NanoBananaClientError(NanoBananaError.APIError, "Nano Banana image generation failed.");
}

export async function generateReferenceImage(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        onProgress?.("Painting reference...");
        return await requestNanoBananaWithRetry([{ text: prompt }]);
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
        return await requestNanoBananaWithRetry([
            {
                inlineData: {
                    mimeType: imageDataUrl.startsWith("data:image/png") ? "image/png" : "image/jpeg",
                    data: imageDataUrl.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, ""),
                },
            },
            {
                text: `You are editing a real AR capture, not inventing a new scene.
Preserve the exact subject identity, pose, camera angle, composition, and background layout.
Keep the Barbie character based on: ${characterPrompt}.
Keep the world vibe based on: ${worldPrompt || "a whimsical Barbie storybook scene"}.
Only improve realism, polish, lighting, clarity, and minor artifacts.
Do not change the face, hair, outfit, color palette, framing, or add new objects, people, text, or borders.`,
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
