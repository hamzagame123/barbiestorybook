export function playSfx(name: string, volume: number = 0.5): void {
    const audio = new Audio(`/sfx/${name}.mp3`);
    audio.volume = volume;
    audio.play().catch(err => console.warn(`Failed to play ${name}:`, err));
}

if (typeof window !== "undefined") {
    window.addEventListener("click", (e) => {
        if ((e.target as HTMLElement).closest("button")) {
            playSfx("ui_click", 0.3);
        }
    }, { capture: true });
}
