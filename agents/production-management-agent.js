const path = require('path');
const fs = require('fs').promises;
const { Logger } = require('../utils/logger');
const { AIVideoGenerator } = require('../utils/ai-video-generator');

class ProductionManagementAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ProductionManagement');
    this.pipeline = [];
    this.assets = new Map();
    this.aiVideoGenerator = new AIVideoGenerator(credentials);
  }

  async initialize() {
    this.logger.info('Initializing Production Management Agent...');
    await this.setupDirectories();
    await this.loadPipeline();
    return true;
  }

  async setupDirectories() {
    const dirs = [
      'data/production',
      'data/assets',
      'data/videos',
      'data/audio',
      'data/scripts',
      'data/captions',
      'temp/processing'
    ];

    for (const dir of dirs) {
      await fs.mkdir(path.join(__dirname, '..', dir), { recursive: true });
    }
  }

  async loadPipeline() {
    try {
      const pipeline = await this.db.getProductionPipeline();
      this.pipeline = pipeline || [];
    } catch (error) {
      this.logger.warn('No existing pipeline found, starting fresh');
    }
  }

  async processContent(contentData) {
    try {
      this.logger.info('Processing content for production...');

      const { strategy, script, thumbnail, seo } = contentData;

      const productionId = this.generateProductionId();

      const productionData = {
        id: productionId,
        strategy,
        script,
        thumbnail,
        seo,
        status: 'processing',
        assets: {
          script: await this.processScript(script),
          thumbnail: await this.processThumbnail(thumbnail),
          audio: null,
          video: null,
          captions: null
        },
        timeline: {
          created: new Date().toISOString(),
          scriptReady: new Date().toISOString(),
          thumbnailReady: new Date().toISOString(),
          audioGenerated: null,
          videoGenerated: null,
          captionsGenerated: null,
          readyForUpload: null
        },
        scheduledPublishTime: this.calculatePublishTime(strategy),
        priority: this.calculatePriority(strategy),
        estimatedDuration: script.duration,
        createdAt: new Date().toISOString()
      };

      this.pipeline.push(productionData);
      await this.db.saveProductionData(productionData);

      await this.generateVideoContent(productionData);
      await this.generateAudioNarration(productionData);
      await this.generateCaptions(productionData);
      await this.assembleVideo(productionData);

      productionData.status = 'ready';
      productionData.timeline.readyForUpload = new Date().toISOString();

      await this.db.updateProductionData(productionData);

      this.logger.info(`Content processing complete: ${productionId}`);
      return productionData;
    } catch (error) {
      this.logger.error('Failed to process content:', error);
      throw error;
    }
  }

  generateProductionId() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 15);
    const extra = Math.random().toString(36).substring(2, 15);
    return `prod_${timestamp}_${random}_${extra}`;
  }

  async processScript(script) {
    const scriptPath = path.join(__dirname, '..', 'data', 'scripts', `${Date.now()}_script.json`);

    const ttsScript = this.formatScriptForTTS(script);

    await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));
    await fs.writeFile(scriptPath.replace('.json', '_tts.txt'), ttsScript);

    return {
      originalPath: scriptPath,
      ttsPath: scriptPath.replace('.json', '_tts.txt'),
      duration: script.duration,
      sections: script.mainContent.sections.length
    };
  }

  formatScriptForTTS(script) {
    let ttsText = '';

    if (script.hook) {
      ttsText += `${script.hook.text}\n\n`;
    }

    if (script.introduction) {
      ttsText += `${script.introduction.greeting}\n`;
      ttsText += `${script.introduction.topicIntro}\n`;
      ttsText += `${script.introduction.valueProposition}\n`;
      ttsText += `${script.introduction.credibility}\n\n`;
    }

    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach((section, index) => {
        ttsText += `Section ${index + 1}: ${section.title}\n`;

        if (Array.isArray(section.content)) {
          section.content.forEach(line => {
            if (typeof line === 'string' && !line.startsWith('[')) {
              ttsText += `${line}\n`;
            }
          });
        } else if (section.steps) {
          section.steps.forEach(step => {
            ttsText += `${step.title}. ${step.description}\n`;
            ttsText += `${step.tip}\n`;
          });
        } else if (section.items) {
          section.items.forEach(item => {
            ttsText += `Number ${item.number}: ${item.title}. ${item.description}\n`;
          });
        } else if (typeof section.content === 'string') {
          ttsText += `${section.content}\n`;
        }

        ttsText += '\n';
      });
    }

    if (script.conclusion) {
      script.conclusion.recap.forEach(line => {
        if (typeof line === 'string') {
          ttsText += `${line}\n`;
        }
      });
      ttsText += `\n${script.conclusion.finalThought}\n\n`;
    }

    if (script.callToAction) {
      ttsText += `${script.callToAction.subscribe}\n`;
      ttsText += `${script.callToAction.like}\n`;
      ttsText += `${script.callToAction.comment}\n`;
    }

    return ttsText;
  }

  async processThumbnail(thumbnail) {
    try {
      this.logger.info('Using existing thumbnail from ThumbnailDesigner...');

      const productionThumbnailPath = path.join(
        __dirname,
        '..',
        'data',
        'assets',
        `thumbnail_${Date.now()}.jpg`
      );

      if (thumbnail.path && await fs.access(thumbnail.path).then(() => true).catch(() => false)) {
        const originalBuffer = await fs.readFile(thumbnail.path);
        await fs.writeFile(productionThumbnailPath, originalBuffer);
      } else {
        await fs.writeFile(productionThumbnailPath + '.placeholder', 'Thumbnail placeholder');
      }

      return {
        path: productionThumbnailPath,
        originalPath: thumbnail.path || productionThumbnailPath,
        dimensions: thumbnail.dimensions || { width: 1280, height: 720 },
        fileSize: thumbnail.fileSize || 0,
        generatedWith: 'AI'
      };
    } catch (error) {
      this.logger.error('Thumbnail processing failed, creating placeholder:', error);

      const productionThumbnailPath = path.join(
        __dirname,
        '..',
        'data',
        'assets',
        `thumbnail_${Date.now()}.jpg.placeholder`
      );

      await fs.writeFile(productionThumbnailPath, 'Thumbnail placeholder');

      return {
        path: productionThumbnailPath,
        originalPath: thumbnail.path || productionThumbnailPath,
        dimensions: { width: 1280, height: 720 },
        fileSize: 0,
        generatedWith: 'simulated'
      };
    }
  }

  calculatePublishTime(strategy) {
    if (strategy.bestPublishTime) {
      return strategy.bestPublishTime;
    }

    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(now.getDate() + 1);
    tomorrow.setHours(14, 0, 0, 0);

    return tomorrow.toISOString();
  }

  calculatePriority(strategy) {
    let priority = 50;

    if (strategy.estimatedViews > 100000) priority += 30;
    else if (strategy.estimatedViews > 50000) priority += 20;
    else if (strategy.estimatedViews > 10000) priority += 10;

    if (strategy.competitorAnalysis && strategy.competitorAnalysis.length > 0) {
      priority += 10;
    }

    if (strategy.bestPublishTime) {
      const hoursUntilPublish =
        (new Date(strategy.bestPublishTime) - new Date()) / (1000 * 60 * 60);
      if (hoursUntilPublish < 24) priority += 20;
      else if (hoursUntilPublish < 48) priority += 10;
    }

    return Math.min(100, priority);
  }

  async generateVideoContent(productionData) {
    this.logger.info('Generating AI video content...');

    try {
      const { script } = productionData;

      const visualPrompts = this.createVisualPromptsFromScript(script);
      const visualAssets = [];

      for (const prompt of visualPrompts) {
        const assets = await this.aiVideoGenerator.generateVisualAssets(prompt, 'ethereal', 1);
        visualAssets.push(...assets);
      }

      productionData.assets.video = {
        visualAssets,
        duration: productionData.estimatedDuration,
        format: 'mp4',
        resolution: '1920x1080',
        fps: 30,
        generatedWith: 'AI'
      };

      productionData.timeline.videoGenerated = new Date().toISOString();

      return visualAssets;
    } catch (error) {
      this.logger.error('AI video content generation failed:', error);
      const elements = await this.createVideoElements(productionData);

      productionData.assets.video = {
        visualAssets: [],
        elements,
        duration: productionData.estimatedDuration,
        format: 'mp4',
        resolution: '1920x1080',
        fps: 30,
        generatedWith: 'simulated'
      };

      productionData.timeline.videoGenerated = new Date().toISOString();

      return elements;
    }
  }

  async createVideoElements(productionData) {
    const { script } = productionData;
    const elements = [];

    elements.push({
      type: 'title_slide',
      content: script.title,
      duration: 3,
      style: 'modern',
      animation: 'fade_in'
    });

    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        elements.push({
          type: 'section_title',
          content: section.title,
          duration: 2,
          style: 'minimal',
          animation: 'slide_in'
        });

        if (section.type === 'list_items' && section.items) {
          section.items.forEach(item => {
            elements.push({
              type: 'list_item',
              content: {
                number: item.number,
                title: item.title,
                description: item.description
              },
              duration: 15,
              style: 'countdown',
              animation: 'zoom_in'
            });
          });
        } else if (section.type === 'solution_steps' && section.steps) {
          section.steps.forEach(step => {
            elements.push({
              type: 'step',
              content: {
                number: step.number,
                title: step.title,
                description: step.description
              },
              duration: 20,
              style: 'tutorial',
              animation: 'step_by_step'
            });
          });
        } else {
          elements.push({
            type: 'content_slide',
            content: section.title,
            duration: section.duration || 30,
            style: 'informative',
            animation: 'fade_transition'
          });
        }
      });
    }

    elements.push({
      type: 'conclusion',
      content: 'Key Takeaways',
      duration: 5,
      style: 'summary',
      animation: 'reveal'
    });

    elements.push({
      type: 'subscribe_reminder',
      content: 'Subscribe for More!',
      duration: 3,
      style: 'call_to_action',
      animation: 'bounce'
    });

    return elements;
  }

  async generateAudioNarration(productionData) {
    this.logger.info('Generating AI audio narration...');

    try {
      const audioPath = path.join(
        __dirname,
        '..',
        'data',
        'audio',
        `${productionData.id}_narration.mp3`
      );

      const ttsText = await fs.readFile(productionData.assets.script.ttsPath, 'utf8');

      await this.aiVideoGenerator.generateTTSAudio(ttsText, audioPath);

      productionData.assets.audio = {
        path: audioPath,
        duration: productionData.estimatedDuration,
        format: 'mp3',
        generatedWith: 'AI',
        quality: 'high'
      };

      productionData.timeline.audioGenerated = new Date().toISOString();

      return audioPath;
    } catch (error) {
      this.logger.error('AI audio generation failed:', error);
      return await this.simulateAudioGeneration(productionData);
    }
  }

  async generateCaptions(productionData) {
    this.logger.info('Generating captions...');

    const captionsPath = path.join(
      __dirname,
      '..',
      'data',
      'captions',
      `${productionData.id}_captions.srt`
    );

    const captions = await this.createSRTCaptions(productionData);

    await fs.mkdir(path.dirname(captionsPath), { recursive: true });
    await fs.writeFile(captionsPath, captions);

    productionData.assets.captions = {
      path: captionsPath,
      format: 'srt',
      language: 'en',
      autoGenerated: true
    };

    productionData.timeline.captionsGenerated = new Date().toISOString();

    return captionsPath;
  }

  async createSRTCaptions(productionData) {
    const { script } = productionData;
    let srt = '';
    let captionIndex = 1;
    let currentTime = 0;

    const formatSRTTime = seconds => {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const secs = Math.floor(seconds % 60);
      const ms = Math.floor((seconds % 1) * 1000);

      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')},${ms
        .toString()
        .padStart(3, '0')}`;
    };

    const processText = (text, startTime, duration) => {
      const words = text.split(' ');
      const wordsPerCaption = 8;

      for (let i = 0; i < words.length; i += wordsPerCaption) {
        const captionWords = words.slice(i, i + wordsPerCaption);
        const captionDuration = duration / Math.ceil(words.length / wordsPerCaption);
        const captionStartTime = startTime + (i / words.length) * duration;
        const captionEndTime = captionStartTime + captionDuration;

        srt += `${captionIndex}\n`;
        srt += `${formatSRTTime(captionStartTime)} --> ${formatSRTTime(
          captionEndTime
        )}\n`;
        srt += `${captionWords.join(' ')}\n\n`;

        captionIndex++;
      }
    };

    if (script.hook && script.hook.text) {
      processText(script.hook.text, currentTime, 5);
      currentTime += 5;
    }

    if (script.introduction) {
      const introText = `${script.introduction.greeting} ${script.introduction.topicIntro} ${script.introduction.valueProposition}`;
      processText(introText, currentTime, 15);
      currentTime += 15;
    }

    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        let sectionText = '';

        if (Array.isArray(section.content)) {
          sectionText = section.content
            .filter(line => typeof line === 'string' && !line.startsWith('['))
            .join(' ');
        } else if (section.steps) {
          sectionText = section.steps
            .map(step => `${step.title}. ${step.description}`)
            .join(' ');
        } else if (section.items) {
          sectionText = section.items
            .map(item => `Number ${item.number}: ${item.title}. ${item.description}`)
            .join(' ');
        } else if (typeof section.content === 'string') {
          sectionText = section.content;
        }

        if (sectionText) {
          processText(sectionText, currentTime, section.duration || 60);
          currentTime += section.duration || 60;
        }
      });
    }

    if (script.conclusion) {
      const conclusionText =
        script.conclusion.recap.join(' ') + ' ' + script.conclusion.finalThought;
      processText(conclusionText, currentTime, 30);
      currentTime += 30;
    }

    return srt;
  }

  async assembleVideo(productionData) {
    this.logger.info('Assembling final AI-generated video...');

    try {
      const finalVideoPath = path.join(
        __dirname,
        '..',
        'data',
        'videos',
        `${productionData.id}_final.mp4`
      );

      const visualAssets =
        (productionData.assets.video && productionData.assets.video.visualAssets) || [];
      const audioPath = productionData.assets.audio && productionData.assets.audio.path;

      await this.aiVideoGenerator.generateVideo(
        productionData.script,
        visualAssets,
        audioPath,
        finalVideoPath
      );

      const stats = await fs.stat(finalVideoPath);

      productionData.assets.finalVideo = {
        path: finalVideoPath,
        fileSize: stats.size,
        duration: productionData.estimatedDuration,
        generatedWith: 'AI',
        resolution: '1920x1080',
        format: 'mp4'
      };

      this.logger.info('AI video assembly complete');
      return finalVideoPath;
    } catch (error) {
      this.logger.error('AI video assembly failed:', error);
      return await this.simulateVideoAssembly(productionData);
    }
  }

  async getPipelineStatus() {
    return this.pipeline.map(item => ({
      id: item.id,
      title: item.script?.title || 'Untitled',
      status: item.status,
      priority: item.priority,
      scheduledPublishTime: item.scheduledPublishTime,
      progress: this.calculateProgress(item)
    }));
  }

  calculateProgress(productionData) {
    const milestones = [
      'scriptReady',
      'thumbnailReady',
      'audioGenerated',
      'videoGenerated',
      'captionsGenerated',
      'readyForUpload'
    ];

    const completed = milestones.filter(
      milestone => productionData.timeline[milestone] !== null
    ).length;

    return Math.round((completed / milestones.length) * 100);
  }

  async getNextReadyContent() {
    const ready = this.pipeline
      .filter(item => item.status === 'ready')
      .sort((a, b) => b.priority - a.priority);

    return ready[0] || null;
  }

  createVisualPromptsFromScript(script) {
    const prompts = [];

    prompts.push(`${script.title}, ethereal storytelling, mystical background`);

    if (script.mainContent && script.mainContent.sections) {
      script.mainContent.sections.forEach(section => {
        if (section.title) {
          prompts.push(`${section.title}, ethereal dreamscape, creative visualization`);
        }
      });
    }

    while (prompts.length < 3) {
      prompts.push('ethereal dreamscape, mystical storytelling, creative visualization');
    }

    return prompts.slice(0, 5);
  }

  async simulateAudioGeneration(productionData) {
    const audioPath = path.join(
      __dirname,
      '..',
      'data',
      'audio',
      `${productionData.id}_narration.mp3`
    );

    await fs.writeFile(
      audioPath + '.info',
      JSON.stringify(
        {
          message: 'AI TTS audio would be generated here',
          timestamp: new Date().toISOString()
        },
        null,
        2
      )
    );

    productionData.assets.audio = {
      path: audioPath + '.info',
      duration: productionData.estimatedDuration,
      format: 'mp3',
      simulated: true
    };

    return audioPath + '.info';
  }

  async simulateVideoAssembly(productionData) {
    const finalVideoPath = path.join(
      __dirname,
      '..',
      'data',
      'videos',
      `${productionData.id}_final.mp4`
    );

    const assemblyInstructions = {
      message: 'AI video would be assembled here',
      assets: productionData.assets,
      timestamp: new Date().toISOString()
    };

    await fs.writeFile(
      finalVideoPath + '.assembly.json',
      JSON.stringify(assemblyInstructions, null, 2)
    );

    productionData.assets.finalVideo = {
      path: finalVideoPath + '.assembly.json',
      fileSize: 0,
      duration: productionData.estimatedDuration,
      simulated: true
    };

    return finalVideoPath + '.assembly.json';
  }
}

module.exports = { ProductionManagementAgent };
