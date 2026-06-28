const { Logger } = require('../utils/logger');

class ScriptWriterAgent {
  constructor(db, credentials) {
    this.db = db;
    this.credentials = credentials;
    this.logger = new Logger('ScriptWriter');
    this.templates = this.loadTemplates();
  }

  async initialize() {
    this.logger.info('Initializing Script Writer Agent...');
    return true;
  }

  loadTemplates() {
    return {
      tutorial: {
        structure: ['hook', 'introduction', 'problem', 'solution_steps', 'recap', 'cta'],
        tone: 'educational',
        pacing: 'moderate'
      },
      explainer: {
        structure: ['hook', 'introduction', 'explanation', 'examples', 'summary', 'cta'],
        tone: 'informative',
        pacing: 'steady'
      },
      list: {
        structure: ['hook', 'introduction', 'list_items', 'summary', 'cta'],
        tone: 'engaging',
        pacing: 'quick'
      },
      review: {
        structure: ['hook', 'introduction', 'overview', 'pros', 'cons', 'verdict', 'cta'],
        tone: 'analytical',
        pacing: 'detailed'
      },
      story: {
        structure: ['hook', 'setup', 'conflict', 'journey', 'resolution', 'lesson', 'cta'],
        tone: 'narrative',
        pacing: 'dynamic'
      }
    };
  }

  async generateScript(strategy) {
    try {
      this.logger.info(`Generating script for: ${strategy.topic}`);

      const template =
        this.templates[strategy.contentType?.toLowerCase()] ||
        this.templates.explainer;

      const script = {
        title: this.generateTitle(strategy),
        hook: this.generateHook(strategy),
        introduction: this.generateIntroduction(strategy),
        mainContent: this.generateMainContent(strategy, template),
        conclusion: this.generateConclusion(strategy),
        callToAction: this.generateCTA(strategy),
        duration: this.estimateDuration(strategy, template),
        tone: template.tone,
        pacing: template.pacing,
        keywords: strategy.keywords || [],
        metadata: {
          strategy,
          generatedAt: new Date().toISOString(),
          version: 'free-local-1.0'
        }
      };

      script.fullScript = this.formatFullScript(script);

      await this.db.saveScript(script);

      this.logger.info(`Script generated: ${script.title}`);
      return script;

    } catch (error) {
      this.logger.error('Failed to generate script:', error);
      throw error;
    }
  }

  generateTitle(strategy) {
    const topic = strategy.topic;

    const presets = [
      `The Truth About ${topic}`,
      `Everything You Need to Know About ${topic}`,
      `How to Master ${topic}`,
      `${topic}: Complete Breakdown`,
      `${topic} Explained Simply`,
      `${topic} — What Nobody Tells You`,
      `Top ${Math.floor(Math.random() * 7) + 5} ${topic} Tips`
    ];

    if (strategy.contentType === 'Tutorial')
      return `How to ${topic}: Step-by-Step Guide`;

    if (strategy.contentType === 'List')
      return `Top ${Math.floor(Math.random() * 7) + 5} ${topic} Tips`;

    if (strategy.contentType === 'Review')
      return `${topic} Review: Honest Breakdown`;

    return presets[Math.floor(Math.random() * presets.length)];
  }

  generateHook(strategy) {
    const topic = strategy.topic;

    const hooks = [
      `Most people misunderstand ${topic} — but today we fix that.`,
      `Here’s the truth about ${topic} nobody talks about.`,
      `If you care about ${topic}, this will change everything.`,
      `Let’s break down ${topic} in the simplest way possible.`,
      `This is the fastest way to understand ${topic}.`
    ];

    return {
      text: hooks[Math.floor(Math.random() * hooks.length)],
      duration: 5
    };
  }

  generateIntroduction(strategy) {
    return {
      greeting: "Welcome back! Today we're diving into something important.",
      topicIntro: `We're talking about ${strategy.topic}.`,
      valueProposition: `By the end, you'll understand exactly how ${strategy.topic} works.`,
      credibility: "This breakdown is based on real experience and proven methods.",
      duration: 15
    };
  }

  generateMainContent(strategy, template) {
    const sections = [];

    for (const sectionType of template.structure) {
      if (['hook', 'introduction', 'cta'].includes(sectionType)) continue;
      sections.push(this.generateSection(sectionType, strategy));
    }

    return {
      sections,
      totalDuration: sections.reduce((t, s) => t + s.duration, 0)
    };
  }

  generateSection(type, strategy) {
    const topic = strategy.topic;

    const generators = {
      problem: () => ({
        type: 'problem',
        title: 'The Problem',
        content: [
          `People struggle with ${topic} because it seems complicated.`,
          `The real issue is lack of clear guidance.`,
          `Let’s break it down simply.`
        ],
        duration: 30
      }),

      solution_steps: () => {
        const steps = [];
        const count = 3 + Math.floor(Math.random() * 3);

        for (let i = 1; i <= count; i++) {
          steps.push({
            number: i,
            title: `Step ${i}`,
            description: `Here’s what you need to know about step ${i} in ${topic}.`,
            tip: `Pro tip: Stay consistent.`
          });
        }

        return {
          type: 'solution_steps',
          title: 'Solution Steps',
          steps,
          duration: count * 40
        };
      },

      explanation: () => ({
        type: 'explanation',
        title: 'Explanation',
        content: [
          `${topic} can be understood in simple parts.`,
          `Let’s break down the core ideas.`,
          `Once you see the pattern, it becomes easy.`
        ],
        duration: 45
      }),

      examples: () => ({
        type: 'examples',
        title: 'Examples',
        content: [
          `Example 1: A simple real-world case.`,
          `Example 2: How ${topic} applies in daily life.`,
          `Example 3: A practical demonstration.`
        ],
        duration: 40
      }),

      list_items: () => {
