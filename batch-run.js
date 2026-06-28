const chalk = require('chalk');
const { Logger } = require('./utils/logger');
const { Database } = require('./database/db');
const { CredentialManager } = require('./utils/credential-manager');

const { ContentStrategyAgent } = require('./agents/content-strategy-agent');
const { ScriptWriterAgent } = require('./agents/script-writer-agent');
const { ThumbnailDesignerAgent } = require('./agents/thumbnail-designer-agent');
const { SEOOptimizerAgent } = require('./agents/seo-optimizer-agent');
const { ProductionManagementAgent } = require('./agents/production-management-agent');
const { PublishingSchedulingAgent } = require('./agents/publishing-scheduling-agent');
const { AnalyticsOptimizationAgent } = require('./agents/analytics-optimization-agent');

(async () => {
  const logger = new Logger('BatchRunner');

  console.log(chalk.cyan.bold('\n🎬 Autonomous Batch Run (Free Mode)\n'));
  console.log(chalk.gray('─'.repeat(50)));

  // -----------------------------
  // 1. Initialize Database
  // -----------------------------
  logger.info('Initializing database...');
  const db = new Database();
  await db.initialize();

  // -----------------------------
  // 2. Load & Validate Credentials
  // -----------------------------
  logger.info('Loading credentials...');
  const credentials = new CredentialManager();

  const youtubeValid = await credentials.validateYouTube();
  if (!youtubeValid) {
    console.log(chalk.yellow('\n⚠ YouTube credentials missing or invalid.'));
    console.log(chalk.yellow('Run: npm run credentials:setup'));
    process.exit(1);
  }

  // -----------------------------
  // 3. Initialize Agents
  // -----------------------------
  logger.info('Initializing agents...');
  const agents = {
    strategy: new ContentStrategyAgent(db, credentials),
    scriptWriter: new ScriptWriterAgent(db, credentials),
    thumbnailDesigner: new ThumbnailDesignerAgent(db, credentials),
    seoOptimizer: new SEOOptimizerAgent(db, credentials),
    production: new ProductionManagementAgent(db, credentials),
    publishing: new PublishingSchedulingAgent(db, credentials),
    analytics: new AnalyticsOptimizationAgent(db, credentials)
  };

  for (const [name, agent] of Object.entries(agents)) {
    await agent.initialize();
    logger.info(`✓ ${name} agent initialized`);
  }

  console.log(chalk.green('\n✨ Agents ready. Generating videos...\n'));

  // -----------------------------
  // 4. Batch Size
  // -----------------------------
  const BATCH_SIZE = 1; // adjust later for volume

  for (let i = 1; i <= BATCH_SIZE; i++) {
    console.log(chalk.white(`\n📹 Generating video ${i}/${BATCH_SIZE}...\n`));

    // Strategy
    const strategy = await agents.strategy.generateContentStrategy(null);
    logger.info(`Strategy topic: ${strategy.topic}`);

    // Script
    const script = await agents.scriptWriter.generateScript(strategy);
    logger.info(`Script generated: ${script.title}`);

    // Thumbnail
    const thumbnail = await agents.thumbnailDesigner.generateThumbnail(script);
    logger.info('Thumbnail generated');

    // SEO
    const seoData = await agents.seoOptimizer.optimize(script, strategy);
    logger.info('SEO optimization complete');

    // Production (audio, visuals, video assembly)
    const productionData = await agents.production.processContent({
      strategy,
      script,
      thumbnail,
      seo: seoData
    });
    logger.info('Production processing complete');

    // Save content
    const contentId = await db.saveProductionData(productionData);
    logger.info(`Content saved with ID: ${contentId}`);

    // Upload to YouTube
    console.log(chalk.white('\n📤 Uploading to YouTube...\n'));
    const uploadResult = await agents.publishing.publishContent(contentId);

    console.log(chalk.green('✅ Upload complete!'));
    console.log(uploadResult);
  }

  console.log(chalk.yellow('\n🎉 Batch run finished. Exiting.\n'));
  process.exit(0);
})();
