const { google } = require('googleapis');
const chalk = require('chalk');
const { Logger } = require('./logger');

class CredentialManager {
  constructor() {
    this.logger = new Logger('CredentialManager');

    // Load everything directly from environment variables
    this.credentials = {
      youtube: this.loadYouTubeCredentials(),
      openai: this.loadOpenAICredentials(),
      gemini: this.loadGeminiCredentials()
    };

    this.tokens = {
      youtube: this.loadYouTubeTokens()
    };
  }

  // -----------------------------
  // LOADERS
  // -----------------------------

  loadYouTubeCredentials() {
    try {
      const raw = process.env.YT_CREDENTIALS_JSON;
      if (!raw || raw.trim() === "") return null;
      return JSON.parse(raw);
    } catch (err) {
      this.logger.error('Invalid YT_CREDENTIALS_JSON format');
      return null;
    }
  }

  loadYouTubeTokens() {
    try {
      const token = process.env.YT_REFRESH_TOKEN;
      if (!token || token.trim() === "") return null;
      return { refresh_token: token };
    } catch (err) {
      this.logger.error('Invalid YouTube token');
      return null;
    }
  }

  loadOpenAICredentials() {
    if (!process.env.OPENAI_API_KEY) return null;
    return {
      apiKey: process.env.OPENAI_API_KEY,
      model: process.env.OPENAI_MODEL || 'gpt-5.5'
    };
  }

  loadGeminiCredentials() {
    if (!process.env.GEMINI_API_KEY) return null;
    return {
      apiKey: process.env.GEMINI_API_KEY,
      model: process.env.GEMINI_MODEL || 'gemini-3.5-flash'
    };
  }

  // -----------------------------
  // VALIDATION
  // -----------------------------

  async validateYouTube() {
    // Validate JSON
    if (!this.credentials.youtube) {
      this.logger.error('Missing YouTube OAuth credentials');
      return false;
    }

    // Validate refresh token
    if (!this.tokens.youtube || !this.tokens.youtube.refresh_token) {
      this.logger.error('Missing YouTube refresh token');
      return false;
    }

    // Validate required fields inside JSON
    const { client_id, client_secret } = this.credentials.youtube;
    if (!client_id || !client_secret) {
      this.logger.error('YouTube OAuth JSON missing client_id or client_secret');
      return false;
    }

    return true;
  }

  async validateAll() {
    const missing = [];

    if (!await this.validateYouTube()) missing.push('youtube');
    if (!this.credentials.openai && !this.credentials.gemini) missing.push('ai-provider');

    if (missing.length > 0) {
      console.log(chalk.yellow(`\n⚠ Missing credentials: ${missing.join(', ')}`));
      return false;
    }

    return true;
  }

  // -----------------------------
  // YOUTUBE CLIENT
  // -----------------------------

  getYouTubeAuth() {
    if (!this.credentials.youtube || !this.tokens.youtube) {
      throw new Error('YouTube credentials not configured');
    }

    const { client_id, client_secret, redirect_uris } = this.credentials.youtube;

    const oauth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      redirect_uris?.[0] || 'http://localhost'
    );

    oauth2Client.setCredentials({
      refresh_token: this.tokens.youtube.refresh_token
    });

    return oauth2Client;
  }

  getYouTubeClient() {
    return google.youtube({
      version: 'v3',
      auth: this.getYouTubeAuth()
    });
  }

  // -----------------------------
  // TEST CONNECTIONS
  // -----------------------------

  async testConnections() {
    console.log(chalk.cyan('\n🔍 Testing API connections...'));

    const results = {
      youtube: false,
      openai: false,
      gemini: false
    };

    // Test YouTube
    try {
      const yt = this.getYouTubeClient();
      await yt.channels.list({ part: 'snippet', mine: true });
      results.youtube = true;
      console.log(chalk.green('✅ YouTube API OK'));
    } catch (err) {
      console.log(chalk.red('❌ YouTube API failed'));
      this.logger.error(err);
    }

    // Test OpenAI
    if (this.credentials.openai) {
      try {
        const OpenAI = require('openai');
        const openai = new OpenAI({ apiKey: this.credentials.openai.apiKey });
        await openai.models.list();
        results.openai = true;
        console.log(chalk.green('✅ OpenAI API OK'));
      } catch (err) {
        console.log(chalk.red('❌ OpenAI API failed'));
        this.logger.error(err);
      }
    }

    // Test Gemini
    if (this.credentials.gemini) {
      try {
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI = new GoogleGenerativeAI(this.credentials.gemini.apiKey);
        await genAI.getModel(this.credentials.gemini.model);
        results.gemini = true;
        console.log(chalk.green('✅ Gemini API OK'));
      } catch (err) {
        console.log(chalk.red('❌ Gemini API failed'));
        this.logger.error(err);
      }
    }

    return results;
  }
}

module.exports = { CredentialManager };
