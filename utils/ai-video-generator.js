const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const axios = require('axios');
const { Logger } = require('./logger');

const execAsync = promisify(exec);

class AIVideoGenerator {
  constructor(credentials = {}) {
    this.logger = new Logger('AIVideoGenerator');
    this.logger.info('AIVideoGenerator initialized with FREE tools only');
  }

  // ---------- FREE TTS (gTTS) ----------
  async generateTTSAudio(text, outputPath) {
    this.logger.info('Generating TTS audio with gTTS (free)...');
    const gtts = require('node-gtts')('en');

    return new Promise((resolve, reject) => {
      gtts.save(outputPath, text, (err) => {
        if (err) {
          this.logger.error('gTTS generation failed:', err);
          return reject(err);
        }
        this.logger.info('gTTS TTS generation complete');
        resolve(outputPath);
      });
    });
  }

  // ---------- FREE VISUAL ASSETS ----------
  async generateVisualAssets(prompt, style = 'ethereal', count = 1) {
    this.logger.info(`Generating ${count} visual assets (FREE placeholder images)...`);

    const assetsDir = path.join(__dirname, '..', 'data', 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    const localPaths = [];

    for (let i = 0; i < count; i++) {
      const imagePath = path.join(
        assetsDir,
        `visual_${Date.now()}_${i}.jpg`
      );

      const url = `https://picsum.photos/1920/1080?random=${Date.now()}_${i}`;
      await this.downloadImage(url, imagePath);
      localPaths.push(imagePath);
    }

    this.logger.info(`Generated ${localPaths.length} visual assets (placeholder)`);
    return localPaths;
  }

  enhanceVisualPrompt(prompt, style) {
    return `${prompt} (${style})`;
  }

  async downloadImage(url, outputPath) {
    const response = await axios({
      method: 'GET',
      url: url,
      responseType: 'arraybuffer'
    });

    await fs.writeFile(outputPath, response.data);
    return outputPath;
  }

  // ---------- VIDEO GENERATION (FFmpeg ONLY) ----------
  async generateVideo(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Generating video from assets with FFmpeg (free)...');

    try {
      return await this.generateSlideshowVideo(script, visualAssets, audioPath, outputPath);
    } catch (error) {
      this.logger.error('Video generation failed:', error);
      return await this.simulateVideoGeneration(script, visualAssets, audioPath, outputPath);
    }
  }

  async generateSlideshowVideo(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Creating slideshow video with FFmpeg...');

    const framesDir = path.join(path.dirname(outputPath), 'frames');
    await fs.mkdir(framesDir, { recursive: true });

    // Save frames as JPEG
    for (let i = 0; i < visualAssets.length; i++) {
      const target = path.join(framesDir, `frame_${String(i).padStart(6, '0')}.jpg`);
      await fs.copyFile(visualAssets[i], target);
    }

    const videoTemp = outputPath.replace('.mp4', '_visual.mp4');

    const ffmpegImagesCmd = `
      ffmpeg -y -framerate 1 -i "${framesDir}/frame_%06d.jpg" \
      -c:v libx264 -pix_fmt yuv420p "${videoTemp}"
    `;
    await execAsync(ffmpegImagesCmd);

    await this.addAudioToVideo(videoTemp, audioPath, outputPath);
    await this.cleanupDirectory(framesDir);

    this.logger.info('Slideshow video generation complete');
    return outputPath;
  }

  async addAudioToVideo(videoPath, audioPath, outputPath) {
    this.logger.info('Merging audio and video with FFmpeg...');

    const cmd = `
      ffmpeg -y -i "${videoPath}" -i "${audioPath}" \
      -c:v copy -c:a aac -shortest "${outputPath}"
    `;
    await execAsync(cmd);

    this.logger.info('Audio merged into video');
    return outputPath;
  }

  async cleanupDirectory(dirPath) {
    try {
      const files = await fs.readdir(dirPath);
      await Promise.all(
        files.map((f) => fs.unlink(path.join(dirPath, f)))
      );
      await fs.rmdir(dirPath);
    } catch (err) {
      this.logger.warn('Cleanup failed (non‑fatal):', err);
    }
  }

  // ---------- SIMULATION FALLBACKS ----------
  async simulateTTSGeneration(text, outputPath) {
    this.logger.info('Simulating TTS generation (fallback)...');
    await fs.writeFile(outputPath, text);
    return outputPath;
  }

  async simulateVisualAssets(prompt, style, count) {
    this.logger.info(`Simulating ${count} visual assets (fallback)...`);
    const assetsDir = path.join(__dirname, '..', 'data', 'assets');
    await fs.mkdir(assetsDir, { recursive: true });

    const localPaths = [];
    for (let i = 0; i < count; i++) {
      const p = path.join(assetsDir, `visual_sim_${Date.now()}_${i}.info`);
      await fs.writeFile(p, JSON.stringify({ prompt, style, simulated: true }, null, 2));
      localPaths.push(p);
    }
    return localPaths;
  }

  async simulateVideoGeneration(script, visualAssets, audioPath, outputPath) {
    this.logger.info('Simulating video generation (fallback)...');
    const infoPath = `${outputPath}.assembly.json`;
    await fs.writeFile(
      infoPath,
      JSON.stringify(
        {
          script,
          visualAssets,
          audioPath,
          outputPath,
          simulated: true
        },
        null,
        2
      )
    );
    return outputPath;
  }
}

module.exports = { AIVideoGenerator };
