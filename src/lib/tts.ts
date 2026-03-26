// Web Speech API wrapper
export const isTTSSupported = () => {
  return typeof window !== "undefined" && "speechSynthesis" in window;
};

export const speakText = (text: string, rate: number = 1.0, onEnd?: () => void) => {
  if (!isTTSSupported()) return;
  
  window.speechSynthesis.cancel();
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.0;
  
  if (onEnd) {
    utterance.onend = onEnd;
  }
  
  window.speechSynthesis.speak(utterance);
};

export const pauseSpeech = () => {
  if (isTTSSupported()) window.speechSynthesis.pause();
};

export const resumeSpeech = () => {
  if (isTTSSupported()) window.speechSynthesis.resume();
};

export const stopSpeech = () => {
  if (isTTSSupported()) window.speechSynthesis.cancel();
};

export const isSpeaking = () => {
  return typeof window !== "undefined" && window.speechSynthesis.speaking;
};

export const isPaused = () => {
  return typeof window !== "undefined" && window.speechSynthesis.paused;
};
