export function playCue(message: string, audioEnabled: boolean, vibrationEnabled: boolean): void {
  if (vibrationEnabled && typeof navigator.vibrate === 'function') {
    navigator.vibrate(40);
  }
  if (!audioEnabled || message.trim().length === 0 || typeof speechSynthesis === 'undefined') return;
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(message);
  utterance.lang = 'pt-BR';
  utterance.rate = 1;
  speechSynthesis.speak(utterance);
}

export function announceKilometer(kilometer: number, audioEnabled: boolean, vibrationEnabled: boolean): void {
  playCue(`Quilômetro ${kilometer}.`, audioEnabled, vibrationEnabled);
}
