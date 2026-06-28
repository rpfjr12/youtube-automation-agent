const { Logger } = require('../utils/logger');

class ContentStrategyAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ContentStrategy');

    this.trendingTopics = [];
    this.historicalPerformance = [];
  }

  async initialize() {
    this.logger.info('Initializing Content Strategy Agent...');
    await this.loadHistoricalData();
    await this.generateLocalTrends();
    return true;
  }

  async loadHistoricalData() {
    try {
      const history = await this.db.getContentHistory();
      this.historicalPerformance = history || [];
    } catch {
      this.historicalPerformance = [];
    }
  }

  async generateLocalTrends() {
    // Local simulated trending topics (free, no API)
    const baseTopics = [
      'AI Tools',
      'Productivity Hacks',
      'Side Hustles',
      'Tech News',
      'Beginner Coding Tips',
      'Money Saving Tricks',
      'Fitness Motivation',
      'Healthy Eating',
      'Life Advice',
      'Motivation Tips',
      'YouTube Growth',
      'Viral Content Ideas',
      'Digital Marketing',
      'Self Improvement',
      'Home Organization',
      'Budgeting Tips',
      'Crypto Basics',
      'Gadget Reviews',
      'Top Apps 2026',
      'Automation Tricks'
    ];

    this.trendingTopics = baseTopics.map(topic => ({
      topic,
      score: Math.random() * 10,
      sources: ['local']
    }));

    this.logger.info(`Loaded ${this.trendingTopics.length} local trending topics`);
  }

  async generateContentStrategy(requestedTopic = null) {
    try {
      let topic = requestedTopic || this.pickTrendingTopic();
      let angle = this.generateAngle(topic);
      let targetAudience = this.identifyAudience(topic);
      let contentType = this.pickContentType(topic);

      const strategy = {
        topic,
        angle,
        targetAudience,
        contentType,
        keywords: this.extractKeywords(topic),
        estimatedViews: this.predictViews(topic),
        bestPublishTime: this.pickPublishTime(),
        competitorAnalysis: [], // no external API
        createdAt: new Date().toISOString()
      };

      await this.db.saveContentStrategy(strategy);

      this.logger.info(`Generated strategy for: ${topic}`);
      return strategy;

    } catch (err) {
      this.logger.error('Failed to generate content strategy:', err);
      throw err;
    }
  }

  pickTrendingTopic() {
    const recent = this.getRecentTopics();

    const filtered = this.trendingTopics.filter(
      t => !recent.includes(t.topic)
    );

    if (filtered.length === 0) return this.trendingTopics[0];

    return filtered.sort((a, b) => b.score - a.score)[0];
  }

  generateAngle(topic) {
    const angles = [
      `The Ultimate Guide to ${topic}`,
      `${topic}: What Nobody Tells You`,
      `Why ${topic} Matters in ${new Date().getFullYear()}`,
      `${topic} Explained Simply`,
      `The Hidden Truth About ${topic}`,
      `How to Master ${topic} Fast`,
      `${topic}: Beginner Breakdown`,
      `${topic} — Full Tutorial`
    ];

    return angles[Math.floor(Math.random() * angles.length)];
  }

  identifyAudience(topic) {
    const t = topic.toLowerCase();

    if (t.includes('ai') || t.includes('tech')) return 'Tech beginners & enthusiasts';
    if (t.includes('money') || t.includes('budget')) return 'People wanting financial improvement';
    if (t.includes('fitness') || t.includes('health')) return 'Health & fitness beginners';
    if (t.includes('productivity')) return 'Students & professionals';
    if (t.includes('coding')) return 'New developers';

    return 'General YouTube audience';
  }

  pickContentType(topic) {
    const t = topic.toLowerCase();

    if (t.includes('how') || t.includes('guide')) return 'Tutorial';
    if (t.includes('top') || t.includes('best')) return 'List';
    if (t.includes('review')) return 'Review';
    if (t.includes('story')) return 'Story';

    return 'Explainer';
  }

  extractKeywords(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 3);
  }

  predictViews(topic) {
    const base = Math.random() * 20000 + 5000;
    return Math.floor(base);
  }

  pickPublishTime() {
    const bestHours = [10, 12, 14, 16];
    const hour = bestHours[Math.floor(Math.random() * bestHours.length)];

    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(hour, 0, 0, 0);

    return date.toISOString();
  }

  getRecentTopics() {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    return this.historicalPerformance
      .filter(item => new Date(item.createdAt) > weekAgo)
      .map(item => item.topic);
  }
}

module.exports = { ContentStrategyAgent };
