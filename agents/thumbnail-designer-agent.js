const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const { Logger } = require('../utils/logger');

class ThumbnailDesignerAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ThumbnailDesigner');
    this.templatesPath = path.join(__dirname, '..', 'data', 'thumbnail-templates');
  }

  async initialize() {
    this.logger.info('Initializing Thumbnail Designer Agent...');
    await this.ensureDirectories();
    return true;
  }

  async ensureDirectories() {
    const dirs = [
      this.templatesPath,
      path.join(__dirname, '..', 'uploads', 'thumbnails')
    ];

    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  async generateThumbnail(script) {
    try {
      this.logger.info(`Generating thumbnail for: ${script.title}`);

      const concept = this.generateConcept(script);

      const baseThumbnail = await this.createGradientBackground(concept);
      const finalThumbnail = await this.addTextOverlay(baseThumbnail, concept);
      const optimizedThumbnail = await this.optimizeForYouTube(finalThumbnail);

      const thumbnailData = {
        path: optimizedThumbnail,
        concept,
        dimensions: { width: 1280, height: 720 },
        fileSize: await this.getFileSize(optimizedThumbnail),
        createdAt: new Date().toISOString()
      };

      await this.db.saveThumbnail(thumbnailData);

      this.logger.info('Thumbnail generated successfully');
      return thumbnailData;

    } catch (error) {
      this.logger.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  generateConcept(script) {
    const title = script.title || 'Untitled';

    return {
      title,
      primaryText: this.extractPrimaryText(title),
      secondaryText: this.extractSecondaryText(title),
      colors: this.pickColorScheme(),
      composition: this.pickComposition()
    };
  }

  extractPrimaryText(title) {
    const words = title.split(' ');
    if (words.length > 0) return words[0].toUpperCase();
    return 'WATCH';
  }

  extractSecondaryText(title) {
    const words = title.split(' ');
    if (words.length > 1) return words.slice(1, 4).join(' ').toUpperCase();
    return 'MUST WATCH';
  }

  pickColorScheme() {
    const schemes = [
      ['#0066CC', '#00CC66', '#FFFFFF'],
      ['#CC0000', '#FFCC00', '#FFFFFF'],
      ['#6600CC', '#FF6600', '#FFFFFF'],
      ['#003366', '#FFD700', '#FFFFFF']
    ];

    const scheme = schemes[Math.floor(Math.random() * schemes.length)];

    return {
      primary: scheme[0],
      secondary: scheme[1],
      accent: scheme[2]
    };
  }

  pickComposition() {
    const comps = ['centered', 'rule-of-thirds', 'diagonal'];
    return comps[Math.floor(Math.random() * comps.length)];
  }

  async createGradientBackground(concept) {
    const width = 1280;
    const height = 720;

    const outputPath = path.join(
      __dirname,
      '..',
      'uploads',
      'thumbnails',
      `thumbnail_${Date.now()}.png`
    );

    const svg = `
      <svg width="${width}" height="${height}">
        <defs>
          <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${concept.colors.primary}" />
            <stop offset="100%" stop-color="${concept.colors.secondary}" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#grad)" />
      </svg>
    `;

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    return outputPath;
  }

  async addTextOverlay(imagePath, concept) {
    const outputPath = path.join(
      __dirname,
      '..',
      'uploads',
      'thumbnails',
      `thumbnail_final_${Date.now()}.png`
    );

    const textSvg = `
      <svg width="1280" height="720">
        <style>
          .primary {
            fill: ${concept.colors.accent};
            font-size: 140px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            text-anchor: middle;
          }
          .secondary {
            fill: ${concept.colors.accent};
            font-size: 70px;
            font-weight: bold;
            font-family: Arial, sans-serif;
            text-anchor: middle;
          }
        </style>

        <text x="640" y="300" class="primary">${concept.primaryText}</text>
        <text x="640" y="450" class="secondary">${concept.secondaryText}</text>
      </svg>
    `;

    const overlayBuffer = await sharp(Buffer.from(textSvg)).png().toBuffer();

    await sharp(imagePath)
      .composite([{ input: overlayBuffer, top: 0, left: 0 }])
      .toFile(outputPath);

    return outputPath;
  }

  async optimizeForYouTube(imagePath) {
    const outputPath = path.join(
      __dirname,
      '..',
      'uploads',
      'thumbnails',
      `thumbnail_optimized_${Date.now()}.jpg`
    );

    await sharp(imagePath)
      .resize(1280, 720)
      .jpeg({ quality: 90 })
      .toFile(outputPath);

    return outputPath;
  }

  async getFileSize(filePath) {
    const stats = await fs.stat(filePath);
    return stats.size;
  }
}

module.exports = { ThumbnailDesignerAgent };
