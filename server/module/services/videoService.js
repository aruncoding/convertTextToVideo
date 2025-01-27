import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

// Set FFmpeg and FFprobe paths
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

export const createVideoFromAudio = (audioPath, imagesDirectory, outputVideoPath) => {
    return new Promise((resolve, reject) => {
        try {
            // Validate audio file existence
            if (!fs.existsSync(audioPath)) {
                return reject(new Error(`Audio file does not exist at: ${audioPath}`));
            }

            // Get all image files from the directory
            const imageFiles = fs.readdirSync(imagesDirectory).filter(file => file.match(/\.(jpg|jpeg|png)$/i));
            if (imageFiles.length === 0) {
                return reject(new Error('No images found in the specified directory.'));
            }

            // Get the audio duration using ffprobe
            ffmpeg.ffprobe(audioPath, (err, metadata) => {
                if (err) {
                    console.error('Error during ffprobe:', err);
                    return reject(new Error('Error retrieving audio metadata.'));
                }

                const audioDuration = metadata.format?.duration;
                if (!audioDuration) {
                    return reject(new Error('Audio duration could not be retrieved.'));
                }

                const tempImageListPath = path.join(imagesDirectory, 'images.txt');
                const fileListContent = imageFiles
                    .map(image => `file '${path.join(imagesDirectory, image)}'\nduration ${audioDuration / imageFiles.length}`)
                    .join('\n');
                const lastImagePath = path.join(imagesDirectory, imageFiles[imageFiles.length - 1]);
                fs.writeFileSync(tempImageListPath, `${fileListContent}\nfile '${lastImagePath}'`);

                // Create the FFmpeg command
                ffmpeg()
                    .input(tempImageListPath)
                    .inputOptions(['-f concat', '-safe 0']) // Concatenate images
                    .input(audioPath)
                    .outputOptions([
                        '-shortest',                      // Match video length to audio
                        '-pix_fmt yuv420p',              // Pixel format for compatibility
                        '-vf scale=1280:720,setsar=1:1', // Set resolution and aspect ratio
                        '-r 30',                         // Frame rate: 30 FPS
                    ])
                    .output(outputVideoPath)
                    .on('end', () => {
                        console.log('Video created:', outputVideoPath);
                        fs.unlinkSync(tempImageListPath); // Clean up
                        resolve();
                    })
                    .on('error', (err) => {
                        console.error('Error creating video:', err);
                        fs.unlinkSync(tempImageListPath); // Clean up on error
                        reject(err);
                    })
                    .run();
            });
        } catch (e) {
            console.error('Unexpected error in createVideoFromAudio:', e);
            reject(e);
        }
    });
};
