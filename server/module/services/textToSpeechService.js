import say from "say";

// Convert text to speech and save it as an audio file
export const convertTextToSpeech = (text, outputAudioPath) => {
  return new Promise((resolve, reject) => {
      // Normalize text spacing for better timing
      const normalizedText = text.replace(/\s+/g, ' ').trim();
      say.export(normalizedText, 'Microsoft David Desktop', 1.0, outputAudioPath, (err) => {
          if (err) reject(new Error(`Audio generation failed: ${err.message}`));
          else resolve();
      });
  });
};
