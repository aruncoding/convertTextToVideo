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

        if (!fs.existsSync(audioPath)) {
            throw new Error(`Audio file not found: ${audioPath}`);
        }

        const duration = await getAudioDuration(audioPath);
        if (!duration) throw new Error('Failed to get audio duration');

        await render3DScene(content, framesDir, duration);

        const frameFiles = fs.readdirSync(framesDir);
        console.log(`Generated ${frameFiles.length} frames (expected ${Math.ceil(duration * 30)})`);
        if (frameFiles.length === 0) throw new Error('No frames generated');

        await compileVideo(framesDir, audioPath, outputVideoPath);
        fs.rmSync(framesDir, { recursive: true });
        return outputVideoPath;
    } catch (err) {
        console.error('Video creation error:', err);
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
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    
    try {
        await page.setViewport({ width: 1280, height: 720 });
        await page.evaluateOnNewDocument(() => {
            WebGLRenderingContext.prototype.getExtension = function(ext) {
                if (ext === 'WEBGL_lose_context') return null;
                return this._getExtension(ext);
            };
        });

        const textChunks = text.match(/[^.!?]+[.!?]+/g) || [text];
        const totalWords = textChunks.reduce((acc, chunk) => acc + chunk.split(/\s+/).length, 0);
        const chunkDurations = textChunks.map(chunk => (chunk.split(/\s+/).length / totalWords) * duration);

        await page.setContent(`
        <!DOCTYPE html>
        <html>
        <head>
            <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
            <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/loaders/GLTFLoader.js"></script>
            <style>
                body { margin: 0; overflow: hidden; }
                #container { position: relative; width: 1280px; height: 720px; }
                #text-overlay {
                    position: absolute; bottom: 20px; left: 50%; transform: translateX(-50%);
                    width: 80%; padding: 15px; background: rgba(0,0,0,0.7); color: white;
                    font-family: Arial; font-size: 24px; text-align: center; border-radius: 10px; z-index: 100;
                }
                canvas { position: absolute; top: 0; left: 0; }
            </style>
        </head>
        <body>
            <div id="container">
                <div id="text-overlay"></div>
            </div>
            <script>
                let scene, camera, renderer, mixer, model, clock;
                let morphTargets = { mouthOpen: -1, eyeBlinkLeft: -1, eyeBlinkRight: -1 };
                let currentTextStart = 0, currentChunkIndex = 0;
                const textChunks = ${JSON.stringify(textChunks)};
                const chunkDurations = ${JSON.stringify(chunkDurations)};

                async function initScene() {
                    scene = new THREE.Scene();
                    scene.background = new THREE.Color(0x444444);
                    
                    camera = new THREE.PerspectiveCamera(45, 1280/720, 0.1, 1000);
                    camera.position.set(1, 1.5, 2.5);
                    
                    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
                    renderer.setSize(1280, 720);
                    renderer.shadowMap.enabled = true;
                    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
                    document.getElementById('container').appendChild(renderer.domElement);
                    
                    // Enhanced lighting
                    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
                    scene.add(ambientLight);
                    
                    const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
                    directionalLight.position.set(2, 5, 3);
                    directionalLight.castShadow = true;
                    directionalLight.shadow.mapSize.width = 1024;
                    directionalLight.shadow.mapSize.height = 1024;
                    scene.add(directionalLight);

                    // Load optimized character model
                    try {
                        const loader = new THREE.GLTFLoader();
                        const gltf = await loader.loadAsync(
                            'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/models/gltf/Xbot.glb'
                        );
                        
                        model = gltf.scene;
                        model.position.set(0, -1, 0);
                        model.scale.set(0.8, 0.8, 0.8);
                        
                        model.traverse(child => {
                            if (child.isMesh) {
                                child.castShadow = true;
                                child.receiveShadow = true;
                                if (child.morphTargetInfluences) {
                                    child.morphTargetInfluences.fill(0);
                                }
                            }
                        });

                        if (gltf.morphTargetDictionary) {
                            morphTargets = {
                                mouthOpen: gltf.morphTargetDictionary['mouthOpen'] ?? -1,
                                eyeBlinkLeft: gltf.morphTargetDictionary['eyeBlink_L'] ?? -1,
                                eyeBlinkRight: gltf.morphTargetDictionary['eyeBlink_R'] ?? -1
                            };
                        }

                        mixer = new THREE.AnimationMixer(model);
                        if (gltf.animations?.length > 0) {
                            const clip = gltf.animations.find(a => a.name === 'Walking');
                            mixer.clipAction(clip || gltf.animations[0]).play();
                        }

                        scene.add(model);
                        camera.lookAt(model.position);

                    } catch (error) {
                        console.error('Model error:', error);
                        window.initializationError = 'Failed to load character';
                        return;
                    }

                    window.renderAtTime = (currentTime) => {
                        try {
                            const delta = clock.getDelta();
                            if (mixer) mixer.update(delta);

                            // Update text chunk
                            let accumulated = 0;
                            for (let i = 0; i < chunkDurations.length; i++) {
                                if (currentTime < accumulated + chunkDurations[i]) {
                                    if (currentChunkIndex !== i) {
                                        currentTextStart = currentTime;
                                        currentChunkIndex = i;
                                        document.getElementById('text-overlay').textContent = textChunks[i];
                                    }
                                    break;
                                }
                                accumulated += chunkDurations[i];
                            }

                            // Animate character
                            if (model) {
                                model.traverse(child => {
                                    if (child.isMesh && child.morphTargetInfluences) {
                                        // Mouth animation
                                        const mouthValue = Math.sin(currentTime * 6) * 0.4 + 0.4;
                                        if (morphTargets.mouthOpen >= 0) {
                                            child.morphTargetInfluences[morphTargets.mouthOpen] = mouthValue;
                                        }
                                        
                                        // Blinking
                                        if (morphTargets.eyeBlinkLeft >= 0 && morphTargets.eyeBlinkRight >= 0) {
                                            const blink = Math.random() < 0.003 ? 1 : 
                                                Math.max(0, child.morphTargetInfluences[morphTargets.eyeBlinkLeft] - 0.05);
                                            child.morphTargetInfluences[morphTargets.eyeBlinkLeft] = blink;
                                            child.morphTargetInfluences[morphTargets.eyeBlinkRight] = blink;
                                        }
                                    }
                                });

                                // Subtle movements
                                model.rotation.y = Math.sin(currentTime * 0.5) * 0.1;
                                model.position.y = -1 + Math.sin(currentTime * 1.5) * 0.03;
                            }

                            renderer.render(scene, camera);
                        } catch (error) {
                            console.error('Render error:', error);
                        }
                    };

                    clock = new THREE.Clock();
                    window.isInitialized = true;
                }

                initScene().catch(error => {
                    console.error('Init error:', error);
                    window.initializationError = error.message;
                });
            </script>
        </body>
        </html>
        `);

        await page.waitForFunction(() => window.isInitialized || window.initializationError, {
            timeout: 60000,
            polling: 100
        });

        const error = await page.evaluate(() => window.initializationError);
        if (error) throw new Error(`Scene initialization failed: ${error}`);

        // Add rendering warmup
        await page.evaluate(() => new Promise(resolve => requestAnimationFrame(resolve)));
        await new Promise(resolve => setTimeout(resolve, 1000));

        const totalFrames = Math.ceil(duration * 30);
        for (let i = 0; i < totalFrames; i++) {
            await page.evaluate((t) => window.renderAtTime(t), i/30);
            await page.screenshot({
                path: path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.png`),
                omitBackground: false
            });
        }

    } catch (err) {
        console.error('Rendering error:', err);
        throw err;
    } finally {
        await browser.close();
    }
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
                '-crf 18',
                '-pix_fmt yuv420p',
                '-r 30',
                '-shortest',
                '-movflags +faststart',
                '-vf format=yuv420p',
                '-c:a aac',
                '-b:a 128k',
                '-ar 44100',
                '-y'
            ])
            .on('error', reject)
            .on('end', resolve)
            .save(outputPath);
    });
};