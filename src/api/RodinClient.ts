import { FAL_API_KEY } from "../secrets";

const RODIN_QUEUE_URL = "https://queue.fal.run/fal-ai/hyper3d/rodin";
const POLL_INTERVAL_MS = 2500;
const TIMEOUT_MS = 90_000;

export enum RodinError {
    Timeout = "timeout",
    APIError = "api-error",
    InvalidResponse = "invalid-response",
}

export class RodinClientError extends Error {
    constructor(public readonly type: RodinError, message: string) {
        super(message);
        this.name = "RodinClientError";
    }
}

type QueueSubmitResponse = {
    request_id?: string;
    status_url?: string;
    response_url?: string;
};

type QueueLog = {
    message?: string;
};

type QueueStatusResponse = {
    status?: string;
    logs?: QueueLog[];
};

type QueueResultResponse = {
    response?: {
        model_mesh?: {
            url?: string;
        };
        glb?: {
            url?: string;
        };
        model_urls?: string[];
    };
};

function getAuthHeaders(): HeadersInit {
    return {
        Authorization: `Key ${FAL_API_KEY}`,
        "Content-Type": "application/json",
    };
}

async function readJson<T>(response: Response, errorType: RodinError): Promise<T> {
    let body: unknown = null;
    try {
        body = await response.json();
    }
    catch {
        if (!response.ok) {
            throw new RodinClientError(errorType, `Rodin request failed with HTTP ${response.status}.`);
        }
    }

    if (!response.ok) {
        const message = typeof body === "object" && body && "detail" in body
            ? String((body as { detail?: string }).detail)
            : `Rodin request failed with HTTP ${response.status}.`;
        throw new RodinClientError(errorType, message);
    }

    return body as T;
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => window.setTimeout(resolve, ms));
}

function inferProgressMessage(status: QueueStatusResponse, elapsedMs: number): string {
    const logs = status.logs?.map(log => log.message?.toLowerCase() ?? "").join(" ") ?? "";
    if (logs.includes("texture")) return "Generating character... (texturing)";
    if (logs.includes("mesh") || logs.includes("shape") || logs.includes("geometry") || status.status === "IN_QUEUE") {
        return "Generating character... (sculpting)";
    }
    if (elapsedMs > 55_000) return "Almost ready...";
    if (elapsedMs > 30_000) return "Generating character... (texturing)";
    return "Generating character... (sculpting)";
}

export async function generateCharacter(
    prompt: string,
    onProgress?: (status: string) => void
): Promise<string> {
    try {
        const submitResponse = await fetch(RODIN_QUEUE_URL, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                prompt,
                geometry_file_format: "glb",
                material: "PBR",
                quality: "medium",
            }),
        });

        const submitData = await readJson<QueueSubmitResponse>(submitResponse, RodinError.APIError);
        const requestId = submitData.request_id;
        if (!requestId) {
            throw new RodinClientError(RodinError.InvalidResponse, "Rodin did not return a request id.");
        }

        const statusUrl = submitData.status_url ?? `https://queue.fal.run/fal-ai/hyper3d/requests/${requestId}/status`;
        const responseUrl = submitData.response_url ?? `https://queue.fal.run/fal-ai/hyper3d/requests/${requestId}`;

        const startedAt = Date.now();
        while (Date.now() - startedAt < TIMEOUT_MS) {
            const statusResponse = await fetch(`${statusUrl}${statusUrl.includes("?") ? "&" : "?"}logs=1`, {
                method: "GET",
                headers: {
                    Authorization: `Key ${FAL_API_KEY}`,
                },
            });

            const statusData = await readJson<QueueStatusResponse>(statusResponse, RodinError.APIError);
            onProgress?.(inferProgressMessage(statusData, Date.now() - startedAt));

            if (statusData.status === "COMPLETED") {
                onProgress?.("Almost ready...");
                const resultResponse = await fetch(responseUrl, {
                    method: "GET",
                    headers: {
                        Authorization: `Key ${FAL_API_KEY}`,
                    },
                });

                const resultData = await readJson<QueueResultResponse>(resultResponse, RodinError.APIError);
                const glbUrl =
                    resultData.response?.model_mesh?.url ??
                    resultData.response?.glb?.url ??
                    resultData.response?.model_urls?.[0];

                if (!glbUrl) {
                    throw new RodinClientError(RodinError.InvalidResponse, "Rodin finished, but no GLB url was returned.");
                }

                return glbUrl;
            }

            if (statusData.status === "FAILED") {
                throw new RodinClientError(RodinError.APIError, "Rodin generation failed.");
            }

            await sleep(POLL_INTERVAL_MS);
        }

        throw new RodinClientError(RodinError.Timeout, "Rodin generation timed out after 90 seconds.");
    }
    catch (error) {
        if (error instanceof RodinClientError) throw error;
        throw new RodinClientError(RodinError.APIError, error instanceof Error ? error.message : "Rodin generation failed.");
    }
}
