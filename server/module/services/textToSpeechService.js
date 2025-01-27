import say from "say";

// Convert text to speech and save it as an audio file
export const convertTextToSpeech = (text, outputAudioPath) => {
  console.log("text to speech function called");
  return new Promise((resolve, reject) => {
    say.export(text, 'Microsoft David Desktop', 1.0, outputAudioPath, (err) => {
      if (err) {
        console.error("Error during audio export:", err); // Log the error details
        return reject(new Error('Failed to generate audio'));
      }
      console.log('Audio created successfully:', outputAudioPath);
      resolve();
    });
  });
};
