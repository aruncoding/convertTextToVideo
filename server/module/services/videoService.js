// videoService.js (updated)
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

        // Get audio duration
        const duration = await getAudioDuration(audioPath);

        // Generate 3D character animation frames
        await render3DScene(content, framesDir, duration);

        // Compile video with audio
        await compileVideo(framesDir, audioPath, outputVideoPath);

        // Cleanup
        fs.rmSync(framesDir, { recursive: true });
    } catch (err) {
        throw err;
    }
};

const getAudioDuration = (audioPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(audioPath, (err, data) => {
            if (err) reject(err);
            resolve(data.format.duration);
        });
    });
};

const render3DScene = async (text, framesDir, duration) => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    await page.setContent(`
    <!DOCTYPE html>
    <html>
    <head>
      <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
      <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
      <style>body { margin: 0; }</style>
    </head>
    <body>
      <script>
        let scene, camera, renderer, mixer, clock;
        const init = async () => {
          scene = new THREE.Scene();
          camera = new THREE.PerspectiveCamera(75, 1280/720, 0.1, 1000);
          renderer = new THREE.WebGLRenderer({ antialias: true });
          renderer.setSize(1280, 720);
          document.body.appendChild(renderer.domElement);

          // Add lights
          const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
          scene.add(ambientLight);
          const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
          directionalLight.position.set(1, 1, 3);
          scene.add(directionalLight);

          // Load character model
          const loader = new THREE.GLTFLoader();
          const gltf = await loader.loadAsync(
            'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Xbot.glb'
          );
          
          const model = gltf.scene;
          model.position.set(0, -1, 0);
          scene.add(model);

          // Set up animations
          mixer = new THREE.AnimationMixer(model);
          const clip = gltf.animations[0];
          const action = mixer.clipAction(clip);
          action.play();

          // Position camera
          camera.position.set(0, 1.5, 3);
          camera.lookAt(0, 1, 0);
          clock = new THREE.Clock();
        };

        const animate = () => {
          const delta = clock.getDelta();
          if (mixer) mixer.update(delta);
          renderer.render(scene, camera);
        };

        init();
      </script>
    </body>
    </html>
  `);

    // Wait for initial load
    //   await page.waitForTimeout(2000);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Capture frames
    const totalFrames = Math.ceil(duration * 30);
    for (let i = 0; i < totalFrames; i++) {
        await page.evaluate(() => animate());
        await page.screenshot({
            path: path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.png`),
            omitBackground: true
        });
    }

    await browser.close();
};

const compileVideo = (framesDir, audioPath, outputPath) => {
    return new Promise((resolve, reject) => {
        ffmpeg()
            .input(path.join(framesDir, 'frame_%05d.png'))
            .input(audioPath)
            .inputFPS(30)
            .outputOptions([
                '-c:v libx264',
                '-preset fast',
                '-crf 18',
                '-pix_fmt yuv420p',
                '-shortest'
            ])
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
};