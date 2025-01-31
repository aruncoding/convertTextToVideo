import * as fs from 'fs';
import * as path from 'path';
import ffmpeg from 'fluent-ffmpeg';
import puppeteer from 'puppeteer';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from 'ffprobe-static';

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

export const createVideoFromAudio = async (audioPath, content, outputVideoPath) => {
    try {
        const framesDir = path.join(path.dirname(outputVideoPath), 'frames');
        fs.mkdirSync(framesDir, { recursive: true });

        // Get accurate audio duration
        const duration = await getAudioDuration(audioPath);
        if (!duration) throw new Error('Failed to get audio duration');

        // Generate synchronized 3D frames
        await render3DScene(content, framesDir, duration);

        // Compile video with precise timing
        await compileVideo(framesDir, audioPath, outputVideoPath);

        fs.rmSync(framesDir, { recursive: true });
    } catch (err) {
        throw err;
    }
};

const getAudioDuration = (audioPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, data) => {
            err ? reject(err) : resolve(data.format.duration || 0);
        });
    });
};

const render3DScene = async (text, framesDir, duration) => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    // Improved text chunking with word-based timing
    const textChunks = text.match(/[^.!?]+[.!?]+/g) || [text];
    const totalWords = textChunks.reduce((acc, chunk) => acc + chunk.split(/\s+/).length, 0);
    const chunkDurations = textChunks.map(chunk => {
        const words = chunk.split(/\s+/).length;
        return (words / totalWords) * duration;
    });

    // Virtual time-controlled scene
    await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
      <style>
        body { margin: 0; overflow: hidden; display: flex; }
        #container { display: flex; width: 100vw; height: 100vh; }
        #text-overlay {
          width: 50%; height: 100vh;
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; padding: 20px;
          text-align: center; background: rgba(0,0,0,0.5); color: white;
        }
        #canvas-container { width: 50%; height: 100vh; }
      </style>
    </head>
    <body>
      <div id="container">
        <div id="text-overlay"></div>
        <div id="canvas-container"></div>
      </div>
      <script>
        let scene, camera, renderer, mixer, model;
        const textChunks = ${JSON.stringify(textChunks)};
        const chunkDurations = ${JSON.stringify(chunkDurations)};
        let lastChunk = -1;

        const init = async () => {
            scene = new THREE.Scene();
            camera = new THREE.PerspectiveCamera(75, 640/720, 0.1, 1000);
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(640, 720);
            document.getElementById("canvas-container").appendChild(renderer.domElement);

            // Lighting
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
            directionalLight.position.set(2, 3, 4);
            scene.add(directionalLight);

            // Model
            const loader = new THREE.GLTFLoader();
            const gltf = await loader.loadAsync(
                'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Xbot.glb'
            );
            model = gltf.scene;
            model.position.set(0, -1, 0);
            scene.add(model);

            // Animation setup
            mixer = new THREE.AnimationMixer(model);
            mixer.clipAction(gltf.animations[0]).play();
            camera.position.set(2, 1.8, 3);
            camera.lookAt(0, 1, 0);

            // Expose render function with time control
            window.renderAtTime = (currentTime) => {
                // Update text chunk
                let accumulated = 0;
                let currentChunk = 0;
                for (let i = 0; i < chunkDurations.length; i++) {
                    accumulated += chunkDurations[i];
                    if (currentTime < accumulated) {
                        currentChunk = i;
                        break;
                    }
                }
                
                if (currentChunk !== lastChunk) {
                    document.getElementById('text-overlay').textContent = textChunks[currentChunk];
                    model.getObjectByName('mixamorigHead').rotation.x = 
                        (currentChunk % 2 === 0) ? 0.1 : -0.1;
                    lastChunk = currentChunk;
                }

                // Update animation mixer
                if (mixer) mixer.update(currentTime % 5); // Loop animation every 5 seconds

                renderer.render(scene, camera);
            };

            window.isInitialized = true;
        };

        init().catch(error => {
            console.error('Initialization error:', error);
            window.initializationError = error.message;
        });
      </script>
    </body>
    </html>
  `);

    await page.waitForFunction(() => window.isInitialized || window.initializationError, {
        timeout: 30000,
        polling: 100
    });

    const error = await page.evaluate(() => window.initializationError);
    if (error) throw new Error(`Scene initialization failed: ${error}`);

    // Frame-perfect capture
    const totalFrames = Math.ceil(duration * 30);
    for (let i = 0; i < totalFrames; i++) {
        const currentTime = i / 30;
        await page.evaluate((t) => window.renderAtTime(t), currentTime);
        await page.screenshot({
            path: path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.png`),
            omitBackground: false
        });
    }

    await browser.close();
};

const compileVideo = (framesDir, audioPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(path.join(framesDir, 'frame_%05d.png'))
            .inputFPS(30)
            .input(audioPath)
            .outputOptions([
                '-c:v libx264',
                '-preset medium',
                '-crf 23',
                '-pix_fmt yuv420p',
                '-r 30',
                '-shortest',
                '-map 0:v:0',
                '-map 1:a:0'
            ])
            .on('error', reject)
            .on('end', resolve)
            .save(outputPath);
    });
};