export const speakReminder = (medicineName, lang = "en-US") => {
  let message = "";

  if (lang === "hi-IN") {
    message = `दवा लेने का समय हो गया है ${medicineName}`;
  } 
  else if (lang === "kn-IN") {
    message = `ಔಷಧಿಯನ್ನು ತೆಗೆದುಕೊಳ್ಳುವ ಸಮಯವಾಗಿದೆ ${medicineName}`;
  } 
  else if (lang === "ta-IN") {
    message = `மருந்து எடுத்துக்கொள்ள வேண்டிய நேரம் ${medicineName}`;
  } 
  else {
    message = `Time to take ${medicineName}`;
  }

  const speech = new SpeechSynthesisUtterance(message);
  speech.lang = lang;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
};