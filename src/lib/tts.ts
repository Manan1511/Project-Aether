let currentUtterance: SpeechSynthesisUtterance | null = null;

export function speakText(
  text: string,
  speed: number = 1.0,
  onEnd?: () => void
): void {
  if (!window.speechSynthesis) return;
  stopSpeech();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = speed;
  utterance.lang = "en-US";

  if (onEnd) utterance.onend = onEnd;

  currentUtterance = utterance;
  window.speechSynthesis.speak(utterance);
}

export function pauseSpeech(): void {
  window.speechSynthesis?.pause();
}

export function resumeSpeech(): void {
  window.speechSynthesis?.resume();
}

export function stopSpeech(): void {
  window.speechSynthesis?.cancel();
  currentUtterance = null;
}

export function isSpeaking(): boolean {
  return window.speechSynthesis?.speaking ?? false;
}

export function isPaused(): boolean {
  return window.speechSynthesis?.paused ?? false;
}

export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}
