import { DeviceUtilities } from "@needle-tools/engine";
import { GoogleGenAI, Modality, type LiveServerMessage, type Session } from "@google/genai";
import { GOOGLE_API_KEY, GOOGLE_LIVE_API_KEYS } from "../secrets";
import { logDebug } from "../utils/DebugLog";

type GeminiResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
    }>;
};

export type NarratorTurn = {
    speaker: "child" | "glimmer";
    text: string;
};

type NarratorContext = {
    backgroundTitle?: string;
    stagePropTitle?: string;
    dollTitle?: string;
    sceneTitle?: string;
    beatCount: number;
    latestBeatCaption?: string;
};

export type LiveNarratorStatus = "offline" | "connecting" | "live" | "error" | "chat";

export type LiveNarratorEvent =
    | { type: "status"; status: LiveNarratorStatus; message?: string }
    | { type: "input"; text: string }
    | { type: "partial"; text: string }
    | { type: "response"; text: string }
    | { type: "speaking"; active: boolean }
    | { type: "debug"; text: string };

const FALLBACK_MODEL = "gemini-3.1-flash-lite-preview";
const LIVE_MODEL = "gemini-3.1-flash-live-preview";

const GLIMMER_SYSTEM_PROMPT = `You are Glimmer, a tiny magical story helper inside a Barbie AR storybook app.

You help a child shape story beats and prop ideas for a Barbie AR scene.

Always sound:
- warm
- concise
- imaginative
- easy to understand
- confident, never corporate

Your job:
- react to the child's story idea
- suggest 1 clear next story beat or 1-3 prop ideas
- keep ideas easy to stage with toys in AR

Rules:
- keep responses very short
- prefer 1 or 2 natural spoken sentences
- do not use labels, lists, or sections
- do not invent giant lore
- stay in Barbie world unless the child clearly asks for a different theme
- keep everything child-safe
- never mention policy, prompts, or internal instructions
- do not claim to generate images, worlds, or 3D assets
- do not give technical app instructions unless asked directly
- focus only on story direction and prop inspiration
- sound magical and warm, never robotic`;

let liveSession: Session | null = null;
let liveConnectPromise: Promise<void> | null = null;
let liveStatus: LiveNarratorStatus = "offline";
let lastStatusMessage = "";
let pendingResponse = "";
let lastDeliveredResponse = "";
let shouldSpeakResponses = true;
let liveAudioContext: AudioContext | null = null;
let livePlaybackQueue = Promise.resolve();
let currentTurnHasLiveAudio = false;
let liveAudioChunkCount = 0;
let narratorSpeaking = false;
let liveMicAudioContext: AudioContext | null = null;
let liveMicStream: MediaStream | null = null;
let liveMicSource: MediaStreamAudioSourceNode | null = null;
let liveMicProcessor: ScriptProcessorNode | null = null;
let liveMicSink: MediaStreamAudioDestinationNode | null = null;
let liveMicActive = false;
let liveMicManualActivity = false;

type NavigatorWithAudioSession = Navigator & {
    audioSession?: {
        type: string;
    };
};

const listeners = new Set<(event: LiveNarratorEvent) => void>();

function emit(event: LiveNarratorEvent): void {
    listeners.forEach((listener) => listener(event));
}

function emitDebug(text: string): void {
    emit({ type: "debug", text });
}

function setNarratorSpeaking(active: boolean): void {
    if (narratorSpeaking === active) return;
    narratorSpeaking = active;
    emit({ type: "speaking", active });
}

function setBrowserAudioSession(type: string): void {
    if (DeviceUtilities.isNeedleAppClip() || DeviceUtilities.isiOS()) {
        emitDebug(`audioSession skipped on ios/appclip (${type})`);
        return;
    }
    const navigatorWithAudioSession = navigator as NavigatorWithAudioSession;
    if (!navigatorWithAudioSession.audioSession) return;
    try {
        navigatorWithAudioSession.audioSession.type = type;
        emitDebug(`audioSession -> ${type}`);
    }
    catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        emitDebug(`audioSession failed: ${message}`);
    }
}

function setStatus(status: LiveNarratorStatus, message?: string): void {
    liveStatus = status;
    lastStatusMessage = message ?? "";
    logDebug("narrator.status", { status, message: lastStatusMessage });
    emit({ type: "status", status, message });
}

function getClient(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: GOOGLE_API_KEY });
}

function getLiveClients(): GoogleGenAI[] {
    const uniqueKeys = Array.from(new Set([GOOGLE_API_KEY, ...GOOGLE_LIVE_API_KEYS].filter(Boolean)));
    return uniqueKeys.map((apiKey) => new GoogleGenAI({ apiKey }));
}

async function getLiveAudioContext(): Promise<AudioContext | null> {
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return null;
    if (!liveAudioContext) liveAudioContext = new AudioContextCtor({ sampleRate: 24000 });
    if (liveAudioContext.state === "suspended") {
        try {
            await liveAudioContext.resume();
        }
        catch {
            return liveAudioContext;
        }
    }
    return liveAudioContext;
}

function decodeBase64Audio(base64: string): Int16Array {
    const binary = window.atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Int16Array(bytes.buffer);
}

function encodePcm16ToBase64(input: Float32Array): string {
    const buffer = new ArrayBuffer(input.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < input.length; i++) {
        const sample = Math.max(-1, Math.min(1, input[i]));
        view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
    }
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
}

async function playLiveAudioChunk(base64: string): Promise<void> {
    const context = await getLiveAudioContext();
    if (!context) return;

    const pcm16 = decodeBase64Audio(base64);
    if (!pcm16.length) return;

    const audioBuffer = context.createBuffer(1, pcm16.length, 24000);
    const channel = audioBuffer.getChannelData(0);
    for (let i = 0; i < pcm16.length; i++) {
        channel[i] = pcm16[i] / 32768;
    }

    await new Promise<void>((resolve) => {
        const source = context.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(context.destination);
        source.onended = () => resolve();
        source.start();
    });
}

function enqueueLiveAudio(base64: string): void {
    liveAudioChunkCount += 1;
    setNarratorSpeaking(true);
    livePlaybackQueue = livePlaybackQueue
        .then(() => playLiveAudioChunk(base64))
        .finally(() => {
            liveAudioChunkCount = Math.max(0, liveAudioChunkCount - 1);
            if (liveAudioChunkCount === 0) setNarratorSpeaking(false);
        })
        .catch(() => undefined);
}

function normalizeResponseChunk(text: string): string {
    return text.replace(/\s+/g, " ").trim();
}

function appendResponseChunk(text: string): string {
    const chunk = normalizeResponseChunk(text);
    if (!chunk) return pendingResponse;
    if (!pendingResponse) {
        pendingResponse = chunk;
        return pendingResponse;
    }
    if (pendingResponse.endsWith(chunk)) return pendingResponse;
    if (chunk.startsWith(pendingResponse)) {
        pendingResponse = chunk;
        return pendingResponse;
    }
    pendingResponse = `${pendingResponse} ${chunk}`.replace(/\s+/g, " ").trim();
    return pendingResponse;
}

function extractMessageText(message: LiveServerMessage): string {
    const fromGetter = typeof message.text === "string" ? message.text : "";
    if (fromGetter.trim()) return fromGetter.trim();

    const parts = message.serverContent?.modelTurn?.parts ?? [];
    const combined = parts
        .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
        .join(" ")
        .trim();
    return combined;
}

function buildOfflineNarratorReply(userText: string, context?: NarratorContext): string {
    const lower = userText.toLowerCase();
    const doll = context?.dollTitle || "Barbie";
    if (lower.includes("music") || lower.includes("guitar") || lower.includes("sing")) {
        return `${doll} is ready for a sparkling music moment. Try adding the guitar and let the stage feel bright and playful.`;
    }
    if (lower.includes("camp") || lower.includes("forest") || lower.includes("fire")) {
        return `${doll} feels perfect for a cozy camp adventure. A warm backdrop and one playful prop will make it read right away.`;
    }
    if (lower.includes("party") || lower.includes("birthday") || lower.includes("cake")) {
        return `${doll} already feels party-ready. Add one big celebratory prop and keep the scene colorful and simple.`;
    }
    return `${doll} has a strong story spark already. Build one clear scene around that idea and Glimmer can help shape the next beat.`;
}

function handleLiveMessage(message: LiveServerMessage): void {
    const serverContent = message.serverContent;
    const outputTranscript = serverContent?.outputTranscription?.text?.trim();
    const modelParts = serverContent?.modelTurn?.parts ?? [];
    logDebug("narrator.live.message", {
        hasText: !!extractMessageText(message),
        interrupted: !!serverContent?.interrupted,
        turnComplete: !!serverContent?.turnComplete,
        hasInputTranscript: !!serverContent?.inputTranscription?.text,
        hasOutputTranscript: !!outputTranscript,
        hasAudio: modelParts.some((part) => "inlineData" in part && !!part.inlineData?.data),
    });

    const inputTranscript = serverContent?.inputTranscription?.text?.trim();
    if (inputTranscript) emit({ type: "input", text: inputTranscript });

    if (serverContent?.interrupted) {
        pendingResponse = "";
        currentTurnHasLiveAudio = false;
        window.speechSynthesis?.cancel();
    }

    for (const part of modelParts) {
        if ("inlineData" in part && part.inlineData?.data) {
            currentTurnHasLiveAudio = true;
            enqueueLiveAudio(part.inlineData.data);
        }
    }

    const responseChunk = outputTranscript || extractMessageText(message);
    if (responseChunk) {
        const combined = appendResponseChunk(responseChunk);
        if (combined) emit({ type: "partial", text: combined });
    }

    if (serverContent?.turnComplete) {
        const finalText = pendingResponse.trim();
        pendingResponse = "";
        if (finalText && finalText !== lastDeliveredResponse) {
            lastDeliveredResponse = finalText;
            emit({ type: "response", text: finalText });
            if (shouldSpeakResponses && !currentTurnHasLiveAudio) speakNarratorReply(finalText);
        }
        currentTurnHasLiveAudio = false;
    }
}

async function requestNarratorText(prompt: string): Promise<string | null> {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${FALLBACK_MODEL}:generateContent?key=${GOOGLE_API_KEY}`, {
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

        if (!response.ok) return null;
        const data = await response.json() as GeminiResponse;
        return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;
    }
    catch {
        return null;
    }
}

export function subscribeToLiveNarrator(listener: (event: LiveNarratorEvent) => void): () => void {
    listeners.add(listener);
    listener({ type: "status", status: liveStatus, message: lastStatusMessage });
    return () => {
        listeners.delete(listener);
    };
}

export function getLiveNarratorStatus(): LiveNarratorStatus {
    return liveStatus;
}

export function setNarratorSpeechEnabled(enabled: boolean): void {
    shouldSpeakResponses = enabled;
}

export function preferChatNarrator(message = "Live audio is unavailable here. Chat mode is ready."): void {
    logDebug("narrator.prefer_chat", { message });
    emitDebug(`prefer chat: ${message}`);
    pendingResponse = "";
    lastDeliveredResponse = "";
    currentTurnHasLiveAudio = false;
    liveConnectPromise = null;
    liveSession?.close();
    liveSession = null;
    setStatus("chat", message);
}

export async function connectLiveNarrator(): Promise<void> {
    logDebug("narrator.live.connect_requested", {
        hasLiveSession: !!liveSession,
        hasPendingConnect: !!liveConnectPromise,
        model: LIVE_MODEL,
    });
    emitDebug(`connect requested: model=${LIVE_MODEL}`);
    if (liveSession) {
        setStatus("live", "Glimmer is listening");
        return;
    }
    if (liveConnectPromise) return liveConnectPromise;

    setStatus("connecting", "Connecting Glimmer...");
    pendingResponse = "";
    lastDeliveredResponse = "";

    liveConnectPromise = (async () => {
        const clients = getLiveClients();
        let lastError: unknown = null;
        try {
            logDebug("narrator.live.connect_start", { model: LIVE_MODEL, clientCount: clients.length });
            for (let index = 0; index < clients.length; index++) {
                const client = clients[index];
                emitDebug(`opening live socket (${index + 1}/${clients.length})`);
                try {
                    liveSession = await client.live.connect({
                        model: LIVE_MODEL,
                        config: {
                            responseModalities: [Modality.AUDIO],
                            outputAudioTranscription: {},
                            systemInstruction: GLIMMER_SYSTEM_PROMPT,
                            temperature: 0.85,
                            thinkingConfig: {
                                thinkingLevel: "minimal",
                            },
                        },
                        callbacks: {
                            onopen: () => {
                                logDebug("narrator.live.onopen", { clientIndex: index });
                                emitDebug("socket opened");
                                setStatus("live", "Glimmer is listening");
                            },
                            onmessage: (message) => {
                                handleLiveMessage(message);
                            },
                            onerror: (error) => {
                                const errorMessage = error instanceof Error
                                    ? error.message
                                    : typeof error === "object" && error && "message" in error
                                        ? String((error as { message?: unknown }).message ?? "Live connection failed")
                                        : String(error ?? "Live connection failed");
                                logDebug("narrator.live.onerror", { message: errorMessage, clientIndex: index });
                                emitDebug(`socket error: ${errorMessage}`);
                                liveSession = null;
                                setStatus("error", errorMessage);
                            },
                            onclose: (event) => {
                                const closeEvent = event as CloseEvent | undefined;
                                const code = closeEvent?.code;
                                const reason = closeEvent?.reason || "";
                                const wasClean = closeEvent?.wasClean;
                                logDebug("narrator.live.onclose", {
                                    previousStatus: liveStatus,
                                    code,
                                    reason,
                                    wasClean,
                                    clientIndex: index,
                                });
                                emitDebug(`socket closed: code=${code ?? "n/a"} clean=${wasClean ?? "n/a"}${reason ? ` reason=${reason}` : ""}`);
                                liveSession = null;
                                if (liveStatus !== "error") {
                                    const closeMessage = reason
                                        ? `Glimmer offline (${reason})`
                                        : code
                                            ? `Glimmer offline (code ${code})`
                                            : "Glimmer offline";
                                    setStatus("offline", closeMessage);
                                }
                            },
                        },
                    });
                    break;
                }
                catch (error) {
                    lastError = error;
                    const message = error instanceof Error ? error.message : String(error);
                    emitDebug(`live key ${index + 1} failed: ${message}`);
                    liveSession = null;
                }
            }

            if (!liveSession) {
                throw lastError instanceof Error ? lastError : new Error("Live connection failed");
            }

            logDebug("narrator.live.connect_success", { model: LIVE_MODEL });
            emitDebug("live connect resolved");
            setStatus("live", "Glimmer is listening");
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            logDebug("narrator.live.connect_failed", { message });
            emitDebug(`connect failed: ${message}`);
            liveSession = null;
            setStatus("error", error instanceof Error ? error.message : "Live connection failed");
            throw error;
        }
        finally {
            logDebug("narrator.live.connect_finished", { hasSession: !!liveSession });
            emitDebug(`connect finished: hasSession=${!!liveSession}`);
            liveConnectPromise = null;
        }
    })();

    return liveConnectPromise;
}

export function disconnectLiveNarrator(): void {
    logDebug("narrator.live.disconnect");
    emitDebug("disconnect requested");
    pendingResponse = "";
    lastDeliveredResponse = "";
    currentTurnHasLiveAudio = false;
    liveAudioChunkCount = 0;
    setNarratorSpeaking(false);
    liveConnectPromise = null;
    window.speechSynthesis?.cancel();
    stopLiveNarratorMic();
    livePlaybackQueue = Promise.resolve();
    liveSession?.close();
    liveSession = null;
    setStatus("offline", "Glimmer offline");
}

export async function sendLiveNarratorText(text: string): Promise<void> {
    const trimmed = text.trim();
    if (!trimmed) return;
    await getLiveAudioContext();
    logDebug("narrator.live.send_requested", {
        chars: trimmed.length,
        hasSession: !!liveSession,
        status: liveStatus,
    });
    emitDebug(`send requested: chars=${trimmed.length} status=${liveStatus}`);

    if (!liveSession) {
        await connectLiveNarrator();
    }
    if (!liveSession) {
        throw new Error("Live narrator session is not ready.");
    }

    pendingResponse = "";
    emit({ type: "input", text: trimmed });
    logDebug("narrator.live.send", {
        chars: trimmed.length,
        preview: trimmed.slice(0, 140),
    });
    emitDebug(`send client content: ${trimmed.slice(0, 80)}`);
    liveSession.sendRealtimeInput({
        text: trimmed,
    });
}

export function isLiveNarratorMicActive(): boolean {
    return liveMicActive;
}

export async function startLiveNarratorMic(options?: { manualActivity?: boolean }): Promise<void> {
    if (liveMicActive) return;
    if (!liveSession) {
        await connectLiveNarrator();
    }
    if (!liveSession) {
        throw new Error("Live narrator session is not ready.");
    }
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Browser microphone access is unavailable.");
    }

    const isAppClip = DeviceUtilities.isNeedleAppClip();
    const isIOS = DeviceUtilities.isiOS();
    emitDebug(`runtime: appClip=${isAppClip} safari=${DeviceUtilities.isSafari()} ios=${isIOS}`);
    if (isAppClip || isIOS) {
        emitDebug("mic permission probe skipped on ios/appclip");
    }
    else {
        try {
            const hasMicPermission = await DeviceUtilities.microphonePermissionsGranted();
            emitDebug(`mic permission probe: ${hasMicPermission ? "granted-or-promptable" : "denied"}`);
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            emitDebug(`mic permission probe failed: ${message}`);
        }
    }

    const manualActivity = options?.manualActivity === true;
    liveMicManualActivity = manualActivity;

    setBrowserAudioSession("play-and-record");
    if (manualActivity) {
        liveSession.sendRealtimeInput({ activityStart: {} });
        emitDebug("mic activityStart sent");
    }
    else {
        emitDebug("mic opened in continuous mode");
    }

    let stream: MediaStream | null = null;
    const AudioContextCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
        throw new Error("Browser microphone audio context is unavailable.");
    }
    try {
        stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
            },
        });

        if (!liveMicAudioContext) liveMicAudioContext = new AudioContextCtor({ sampleRate: 16000 });
        if (liveMicAudioContext.state === "suspended") {
            await liveMicAudioContext.resume();
        }

        const source = liveMicAudioContext.createMediaStreamSource(stream);
        const processor = liveMicAudioContext.createScriptProcessor(2048, 1, 1);
        const sink = liveMicAudioContext.createMediaStreamDestination();
        const sampleRate = liveMicAudioContext.sampleRate;

        processor.onaudioprocess = (event) => {
            if (!liveSession || !liveMicActive) return;
            const channel = event.inputBuffer.getChannelData(0);
            const base64 = encodePcm16ToBase64(channel);
            if (!base64) return;
            liveSession.sendRealtimeInput({
                audio: {
                    data: base64,
                    mimeType: `audio/pcm;rate=${sampleRate}`,
                },
            });
        };

        source.connect(processor);
        processor.connect(sink);

        liveMicStream = stream;
        liveMicSource = source;
        liveMicProcessor = processor;
        liveMicSink = sink;
        liveMicActive = true;
        logDebug("narrator.live.mic_started", { sampleRate });
        emitDebug(`mic started: rate=${sampleRate}`);
    }
    catch (error) {
        stream?.getTracks().forEach((track) => track.stop());
        stopLiveNarratorMic();
        throw error;
    }
}

export function stopLiveNarratorMic(): void {
    if (!liveMicActive) return;

    liveMicProcessor?.disconnect();
    liveMicSource?.disconnect();
    liveMicSink?.disconnect();
    liveMicStream?.getTracks().forEach((track) => track.stop());

    liveMicProcessor = null;
    liveMicSource = null;
    liveMicSink = null;
    liveMicStream = null;
    liveMicActive = false;
    if (liveMicManualActivity) {
        liveSession?.sendRealtimeInput({
            activityEnd: {},
        });
        emitDebug("mic activityEnd sent");
    }
    liveMicManualActivity = false;
    setBrowserAudioSession("auto");

    logDebug("narrator.live.mic_stopped");
    emitDebug("mic stopped");
}

export async function generateNarratorReply(userText: string, context: NarratorContext, history: NarratorTurn[]): Promise<string> {
    try {
        const historyText = history.slice(-6).map((turn) => `${turn.speaker.toUpperCase()}: ${turn.text}`).join("\n");
        const reply = await requestNarratorText(
            `${GLIMMER_SYSTEM_PROMPT}

Scene context:
- Scene title: ${context.sceneTitle || "Untitled Barbie Story"}
- Background: ${context.backgroundTitle || "none"}
- Stage prop: ${context.stagePropTitle || "none"}
- Doll: ${context.dollTitle || "none"}
- Beat count so far: ${context.beatCount}
- Latest beat caption: ${context.latestBeatCaption || "none"}

Recent transcript:
${historyText || "No previous conversation yet."}

Child says: ${userText}

Respond as Glimmer only. No quotes. No labels unless helpful.`
        );

        return reply || buildOfflineNarratorReply(userText, context);
    }
    catch {
        return buildOfflineNarratorReply(userText, context);
    }
}

export function speakNarratorReply(text: string): void {
    const synth = window.speechSynthesis;
    if (!synth) return;

    synth.cancel();
    setNarratorSpeaking(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1.02;
    utterance.pitch = 1.28;
    utterance.lang = "en-US";
    utterance.onstart = () => setNarratorSpeaking(true);
    utterance.onend = () => setNarratorSpeaking(false);
    utterance.onerror = () => setNarratorSpeaking(false);
    synth.speak(utterance);
}
