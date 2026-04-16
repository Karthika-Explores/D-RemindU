// Initialize voices early so they are loaded when needed
let availableVoices = [];
const loadVoices = () => {
  availableVoices = window.speechSynthesis.getVoices();
};
// Attach listener for dynamic loading
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = loadVoices;
}
// Try an initial load
setTimeout(loadVoices, 100);

export const speakReminder = (medicineName, lang = "en-US", alertType = "time") => {
  let message = "";

  if (alertType === "time") {
    if (lang === "hi-IN") {
      message = `दवा लेने का समय हो गया है ${medicineName}`;
    } else if (lang === "kn-IN") {
      message = `ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ: ${medicineName}`;
    } else if (lang === "ta-IN") {
      message = `உங்களுக்கான மருந்து எடுத்துக்கொள்ள வேண்டிய நேரம்: ${medicineName}`;
    } else {
      message = `It is time to take your medication: ${medicineName}`;
    }
  } else if (alertType === "stock") {
    if (lang === "hi-IN") {
      message = `कृपया ध्यान दें। ${medicineName} का स्टॉक कम है। इसे फिर से भरें।`;
    } else if (lang === "kn-IN") {
      message = `ದಯವಿಟ್ಟು ಗಮನಿಸಿ. ${medicineName} ದಾಸ್ತಾನು ಕಡಿಮೆಯಾಗಿದೆ. ದಯವಿಟ್ಟು ಭರ್ತಿ ಮಾಡಿ.`;
    } else if (lang === "ta-IN") {
      message = `கவனிக்கவும். ${medicineName} இருப்பு குறைவாக உள்ளது. மீண்டும் நிரப்பவும்.`;
    } else {
      message = `Stock alert. You are running low on ${medicineName}. Please refill soon.`;
    }
  }

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = lang;
  
  // Harden voice selection to ensure regional accent plays correctly
  if (availableVoices.length === 0) {
    availableVoices = window.speechSynthesis.getVoices();
  }
  
  // Find a voice matching the exact language or regional prefix
  const targetVoice = availableVoices.find(v => v.lang === lang || v.lang.startsWith(lang.split('-')[0]));
  if (targetVoice) {
    speech.voice = targetVoice;
  }

  // Optimize speech speed/pitch for clearer regional pronunciation
  speech.rate = 0.9;
  speech.pitch = 1.0;

  window.speechSynthesis.cancel(); // Clear any ongoing speech
  window.speechSynthesis.speak(speech);
};