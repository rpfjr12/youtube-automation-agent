const { Logger } = require('../utils/logger');

class SEOOptimizerAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('SEOOptimizer');
  }

  async initialize() {
    this.logger.info('Initializing SEO Optimizer Agent...');
    return true;
  }

  async optimize(script, strategy) {
    try {
      this.logger.info(`Optimizing SEO for: ${script.title}`);

      const title = this.optimizeTitle(script.title, strategy);
      const description = this.generateDescription(script, strategy);
      const tags = this.generateTags(script, strategy);
      const hashtags = this.generateHashtags(strategy);
      const chapters = this.generateChapters(script);
      const endScreen = this.generateEndScreen();
      const seoScore = this.calculateSEOScore(title, description, tags);

      const seoData = {
        title,
        description,
        tags,
        hashtags,
        chapters,
        endScreen,
        seoScore,
        metadata: {
          primaryKeyword: strategy.keywords?.[0] || strategy.topic,
          secondaryKeywords: strategy.keywords?.slice(1, 5) || [],
          category: this.selectCategory(strategy),
          language: 'en'
        },
        createdAt: new Date().toISOString()
      };

      await this.db.saveSEOData(seoData);

      this.logger.info(`SEO optimization complete. Score: ${seoScore}/100`);
      return seoData;

    } catch (error) {
      this.logger.error('Failed to optimize SEO:', error);
      throw error;
    }
  }

  optimizeTitle(originalTitle, strategy) {
    const powerWords = ['Ultimate', 'Complete', 'Essential', 'Proven', 'Secret', 'Amazing'];
    const year = new Date().getFullYear();
    let title = originalTitle;

    if (!powerWords.some(w => title.includes(w))) {
      title = `${powerWords[Math.floor(Math.random() * powerWords.length)]} ${title}`;
    }

    if (!title.includes(year.toString())) {
      title = `${title} (${year})`;
    }

    const keyword = strategy.keywords?.[0];
    if (keyword && !title.toLowerCase().includes(keyword.toLowerCase())) {
      title = `${title} - ${keyword}`;
    }

    if (title.length > 100) title = title.slice(0, 97) + '...';

    return this.titleCase(title);
  }

  titleCase(str) {
    const smallWords = ['a','an','and','as','at','but','by','for','if','in','of','on','or','the','to','via','vs'];
    return str.split(' ').map((word, i) =>
      i === 0 || !smallWords.includes(word.toLowerCase())
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase()
    ).join(' ');
  }

  generateDescription(script, strategy) {
    const desc = [];

    desc.push(`${script.title} — In this video, you'll learn ${strategy.angle.toLowerCase()}.`);
    desc.push('');
    desc.push('📺 WHAT YOU WILL LEARN:');
    script.mainContent.sections.slice(0, 5).forEach(sec => {
      desc.push(`• ${sec.title}`);
    });

    desc.push('');
    desc.push('⏱️ TIMESTAMPS:');
    desc.push('00:00 Introduction');

    let t = 20;
    script.mainContent.sections.forEach(sec => {
      const m = Math.floor(t / 60).toString().padStart(2, '0');
      const s = (t % 60).toString().padStart(2, '0');
      desc.push(`${m}:${s} ${sec.title}`);
      t += sec.duration || 60;
    });

    desc.push('');
    desc.push('📝 ABOUT THIS VIDEO:');
    desc.push(`This video covers everything about ${strategy.topic}.`);
    desc.push(`Perfect for viewers interested in ${strategy.keywords?.slice(0,3).join(', ') || strategy.topic}.`);

    desc.push('');
    desc.push('🏷️ TAGS:');
    desc.push(this.generateHashtags(strategy).join(' '));

    desc.push('');
    desc.push(`© ${new Date().getFullYear()} All Rights Reserved`);

    return desc.join('\n');
  }

  generateTags(script, strategy) {
    const tags = new Set();

    const topic = strategy.topic.toLowerCase();
    const keywords = strategy.keywords || [];

    keywords.forEach(k => tags.add(k));
    tags.add(topic);
    tags.add(topic.replace(/\s+/g, ''));
    tags.add(topic.replace(/\s+/g, '_'));

    const typeTags = {
      tutorial: ['how to', 'tutorial', 'guide'],
      explainer: ['explained', 'what is', 'understanding'],
      list: ['top 10', 'best', 'countdown'],
      review: ['review', 'comparison', 'vs'],
      story: ['story', 'journey', 'experience']
    };

    (typeTags[strategy.contentType?.toLowerCase()] || []).forEach(t => tags.add(t));

    tags.add(new Date().getFullYear().toString());

    const final = [];
    let total = 0;

    for (const tag of tags) {
      if (total + tag.length + 1 <= 500) {
        final.push(tag);
        total += tag.length + 1;
      }
    }

    return final;
  }

  generateHashtags(strategy) {
    const topicTag = `#${strategy.topic.replace(/\s+/g, '')}`;
    const typeTag = `#${strategy.contentType?.toLowerCase() || 'video'}`;

    const trending = ['#youtube', '#viral', '#trending'];

    return [topicTag, typeTag, ...trending, `#${new Date().getFullYear()}`].slice(0, 10);
  }

  generateChapters(script) {
    const chapters = [];
    let t = 0;

    chapters.push({ time: '00:00', title: 'Introduction' });
    t = 20;

    script.mainContent.sections.forEach(sec => {
      const m = Math.floor(t / 60).toString().padStart(2, '0');
      const s = (t % 60).toString().padStart(2, '0');
      chapters.push({ time: `${m}:${s}`, title: sec.title });
      t += sec.duration || 60;
    });

    return chapters;
  }

  generateEndScreen() {
    return {
      elements: [
        { type: 'video', title: 'Recommended Video' },
        { type: 'playlist', title: 'Watch More' },
        { type: 'subscribe', title: 'Subscribe' }
      ],
      startTime: -20
    };
  }

  calculateSEOScore(title, description, tags) {
    let score = 0;

    if (title.length >= 50 && title.length <= 70) score += 10;
    if (/\d/.test(title)) score += 5;
    if (title.includes(new Date().getFullYear().toString())) score += 5;

    if (description.length > 200) score += 10;
    if (description.includes('TIMESTAMPS')) score += 5;

    if (tags.length >= 10) score += 10;
    if (tags.length >= 15) score += 5;

    return Math.min(100, score);
  }

  selectCategory(strategy) {
    const topic = strategy.topic.toLowerCase();

    if (topic.includes('tech')) return 28;
    if (topic.includes('game')) return 20;
    if (topic.includes('learn')) return 27;
    if (topic.includes('business')) return 27;
    if (topic.includes('life')) return 22;
    if (topic.includes('health')) return 26;

    return 22;
  }
}

module.exports = { SEOOptimizerAgent };
