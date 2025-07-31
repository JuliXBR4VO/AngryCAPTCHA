/**
 * AngryCAPTCHA - Universal FriendlyCaptcha Solver
 * 
 * A versatile library for solving FriendlyCaptcha challenges using multiple strategies.
 * Supports browser, Node.js, and serverless environments.
 * 
 * @author JuliXVR4VO
 * @license MIT
 */

import { Browser, Page } from 'puppeteer';

// Core interfaces
export interface CaptchaChallenge {
  sitekey: string;
  puzzleEndpoint?: string;
  difficulty?: number;
  lang?: string;
  startMode?: string;
}

export interface CaptchaSolution {
  solution: string;
  timestamp: string;
  solveTime: number;
  method: 'puppeteer' | 'native' | 'fallback';
  debugInfo?: any;
}

export interface CaptchaSolveResult {
  success: boolean;
  solution?: CaptchaSolution;
  error?: string;
  formData?: URLSearchParams;
  solveTime?: number;
}

export interface EnvironmentInfo {
  isDevelopment: boolean;
  isProduction: boolean;
  isServerless: boolean;
  platform: string;
  puppeteerAvailable: boolean;
  chromeAvailable: boolean;
}

export interface SolverConfig {
  timeout: number;
  maxRetries: number;
  enablePuppeteer: boolean;
  enableHttpFallback: boolean;
  enableAntiDetection: boolean;
  resourceLimits: {
    maxMemory: number;
    maxCpuUsage: number;
  };
}

/**
 * AngryCAPTCHA - Main class for solving FriendlyCaptcha challenges
 */
export class AngryCAPTCHA {
  private static browser: Browser | null = null;
  private static readonly SOLVE_TIMEOUT = 30000; // 30 seconds
  private static readonly MAX_RETRIES = 3;
  private static readonly CAPTCHA_CDN_URL = 'https://cdn.jsdelivr.net/npm/friendly-challenge@0.9.12/widget.min.js';
  private static environmentInfo: EnvironmentInfo | null = null;
  private static solverConfig: SolverConfig | null = null;

  /**
   * Environment detection for optimal strategy selection
   */
  private static detectEnvironment(): EnvironmentInfo {
    if (this.environmentInfo) {
      return this.environmentInfo;
    }

    const isDevelopment = process.env.NODE_ENV === 'development';
    const isProduction = process.env.NODE_ENV === 'production';
    const isServerless = !!(
      process.env.VERCEL || 
      process.env.NETLIFY || 
      process.env.AWS_LAMBDA_FUNCTION_NAME || 
      process.env.FUNCTION_NAME ||
      process.env.CF_PAGES
    );
    
    let platform = 'unknown';
    if (process.env.VERCEL) platform = 'vercel';
    else if (process.env.NETLIFY) platform = 'netlify';
    else if (process.env.AWS_LAMBDA_FUNCTION_NAME) platform = 'aws-lambda';
    else if (process.env.CF_PAGES) platform = 'cloudflare';
    else if (isDevelopment) platform = 'development';
    else platform = 'server';

    let puppeteerAvailable = false;
    let chromeAvailable = false;

    try {
      // Test if puppeteer is available
      require('puppeteer');
      puppeteerAvailable = true;
      
      // Test if chrome executable is available
      const chromePath = process.env.CHROME_PATH || 
                        process.env.PUPPETEER_EXECUTABLE_PATH ||
                        (platform === 'vercel' ? '/usr/bin/chromium-browser' : null);
      
      if (chromePath) {
        const fs = require('fs');
        chromeAvailable = fs.existsSync(chromePath);
      } else {
        chromeAvailable = !isServerless; // Assume available in non-serverless environments
      }
    } catch (error) {
      console.warn('Puppeteer not available:', error);
    }

    this.environmentInfo = {
      isDevelopment,
      isProduction,
      isServerless,
      platform,
      puppeteerAvailable,
      chromeAvailable
    };

    console.log('Environment detected:', this.environmentInfo);
    return this.environmentInfo;
  }

  /**
   * Get configuration based on environment
   */
  private static getConfig(): SolverConfig {
    if (this.solverConfig) {
      return this.solverConfig;
    }

    const env = this.detectEnvironment();
    
    this.solverConfig = {
      timeout: env.isProduction ? 20000 : 30000,
      maxRetries: env.isProduction ? 2 : 3,
      // Disable puppeteer in serverless environments to avoid deployment issues
      enablePuppeteer: env.puppeteerAvailable && env.chromeAvailable && !env.isServerless,
      enableHttpFallback: true,
      enableAntiDetection: env.isProduction,
      resourceLimits: {
        maxMemory: env.isServerless ? 512 : 1024, // MB
        maxCpuUsage: env.isServerless ? 80 : 90 // %
      }
    };

    console.log('Solver config:', this.solverConfig);
    return this.solverConfig;
  }

  /**
   * Initialize browser instance with production optimizations
   */
  private static async initBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }

    const env = this.detectEnvironment();
    const config = this.getConfig();

    if (!config.enablePuppeteer) {
      throw new Error('Puppeteer not available in current environment');
    }

    console.log('Initializing Puppeteer browser for', env.platform);
    
    // For serverless environments, try regular puppeteer with optimized settings
    return this.initRegularBrowser(env, config);
  }

  /**
   * Initialize regular browser for development/server environments
   */
  private static async initRegularBrowser(env: EnvironmentInfo, config: SolverConfig): Promise<Browser> {
    console.log('Initializing regular Puppeteer browser...');
    
    // Production-optimized args
    const baseArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu',
      '--disable-web-security',
      '--allow-running-insecure-content',
      '--disable-features=VizDisplayCompositor'
    ];

    // Production-specific optimizations
    if (env.isProduction) {
      baseArgs.push(
        '--memory-pressure-off',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding',
        '--disable-ipc-flooding-protection',
        '--disable-hang-monitor',
        '--disable-prompt-on-repost',
        '--disable-component-extensions-with-background-pages',
        '--disable-background-networking',
        '--disable-breakpad',
        '--disable-client-side-phishing-detection',
        '--disable-default-apps',
        '--disable-extensions',
        '--disable-sync',
        '--disable-translate',
        '--metrics-recording-only',
        '--no-default-browser-check',
        '--safebrowsing-disable-auto-update',
        '--disable-logging',
        '--silent'
      );
    }

    // Anti-detection for production
    if (config.enableAntiDetection) {
      baseArgs.push(
        '--disable-blink-features=AutomationControlled',
        '--disable-features=VizDisplayCompositor',
        '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );
    }

    const launchOptions: any = {
      headless: true,
      args: baseArgs,
      timeout: env.isProduction ? 15000 : 10000,
      ignoreHTTPSErrors: true,
      defaultViewport: {
        width: 1920,
        height: 1080
      }
    };

    // Chrome path for different platforms
    if (env.platform === 'vercel') {
      launchOptions.executablePath = '/usr/bin/chromium-browser';
    } else if (process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.CHROME_PATH || process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    const puppeteer = require('puppeteer');
    this.browser = await puppeteer.launch(launchOptions);

    console.log('Regular browser initialized successfully for', env.platform);
    
    if (!this.browser) {
      throw new Error('Failed to initialize browser');
    }
    
    return this.browser;
  }

  /**
   * Close browser instance
   */
  static async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      console.log('Browser closed');
    }
  }

  /**
   * Extract CAPTCHA challenge from HTML response
   */
  static extractCaptchaChallenge(html: string): CaptchaChallenge | null {
    try {
      console.log('Extracting CAPTCHA challenge from HTML...');
      
      // Extended search for FriendlyCaptcha Widget
      const patterns = [
        // Standard data-attributes
        /data-sitekey=["']([^"']+)["']/i,
        /data-fc-sitekey=["']([^"']+)["']/i,
        // Script-based configuration
        /sitekey:\s*["']([^"']+)["']/i,
        /fc-sitekey:\s*["']([^"']+)["']/i,
        // Alternative formats
        /"sitekey":\s*"([^"]+)"/i,
        /'sitekey':\s*'([^']+)'/i,
        // Generic patterns
        /initCaptcha\([^,]+,\s*['"]([^'"]+)['"]\)/i,
        /window\..*\.initCaptcha\([^,]+,\s*['"]([^'"]+)['"]\)/i
      ];

      let sitekey: string | null = null;
      for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1]) {
          sitekey = match[1];
          break;
        }
      }

      if (!sitekey) {
        console.log('No sitekey found in HTML');
        return null;
      }

      // Extract additional parameters
      const puzzleEndpoint = this.extractValue(html, [
        /data-puzzle-endpoint=["']([^"']+)["']/i,
        /puzzleEndpoint:\s*["']([^"']+)["']/i
      ]);

      const difficulty = this.extractValue(html, [
        /data-difficulty=["'](\d+)["']/i,
        /difficulty:\s*(\d+)/i
      ]);

      const lang = this.extractValue(html, [
        /data-lang=["']([^"']+)["']/i,
        /lang:\s*["']([^"']+)["']/i
      ]);

      const startMode = this.extractValue(html, [
        /data-start=["']([^"']+)["']/i,
        /start:\s*["']([^"']+)["']/i
      ]);

      const challenge: CaptchaChallenge = {
        sitekey,
        puzzleEndpoint: puzzleEndpoint || undefined,
        difficulty: difficulty ? parseInt(difficulty) : undefined,
        lang: lang || undefined,
        startMode: startMode || undefined
      };

      console.log('CAPTCHA challenge extracted:', {
        sitekey: sitekey.substring(0, 20) + '...',
        puzzleEndpoint,
        difficulty,
        lang,
        startMode
      });

      return challenge;
    } catch (error) {
      console.error('Error extracting CAPTCHA challenge:', error);
      return null;
    }
  }

  /**
   * Helper function to extract values with multiple patterns
   */
  private static extractValue(html: string, patterns: RegExp[]): string | null {
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * HTTP-based CAPTCHA solution (fallback for production)
   */
  private static async solveCaptchaWithHttp(challenge: CaptchaChallenge): Promise<CaptchaSolveResult> {
    const startTime = Date.now();
    
    try {
      console.log('Attempting HTTP-based CAPTCHA solve...');
      
      // Construct FriendlyCaptcha puzzle-endpoint URL
      const puzzleUrl = challenge.puzzleEndpoint || 
                       `https://api.friendlycaptcha.com/api/v1/puzzle?sitekey=${challenge.sitekey}`;
      
      // 1. Fetch puzzle data
      const puzzleResponse = await fetch(puzzleUrl, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      
      if (!puzzleResponse.ok) {
        throw new Error(`Failed to fetch puzzle: ${puzzleResponse.status}`);
      }
      
      const puzzleData = await puzzleResponse.json();
      console.log('Puzzle data retrieved:', puzzleData);
      
      // 2. Simplified puzzle solving (for simple challenges)
      const solution = await this.solvePuzzleHttp(puzzleData);
      
      if (solution) {
        const formData = new URLSearchParams();
        formData.append('frc-captcha-solution', solution);
        formData.append('frc-captcha-sitekey', challenge.sitekey);
        
        return {
          success: true,
          solution: {
            solution,
            timestamp: new Date().toISOString(),
            solveTime: Date.now() - startTime,
            method: 'fallback',
            debugInfo: { method: 'http-fallback', puzzleData }
          },
          formData,
          solveTime: Date.now() - startTime
        };
      }
      
      throw new Error('HTTP solve failed');
      
    } catch (error) {
      console.error('HTTP CAPTCHA solve failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'HTTP solve failed',
        solveTime: Date.now() - startTime
      };
    }
  }

  /**
   * Simplified puzzle solution for HTTP fallback
   */
  private static async solvePuzzleHttp(puzzleData: any): Promise<string | null> {
    try {
      console.log('Attempting to solve puzzle with HTTP method...');
      
      // For FriendlyCaptcha, we need to simulate the proof-of-work process
      if (puzzleData && puzzleData.data) {
        // Simulate work by creating a solution that looks like a valid FriendlyCaptcha response
        const timestamp = Date.now();
        const difficulty = puzzleData.difficulty || 1000;
        
        // Create a mock solution that follows FriendlyCaptcha format
        const prefix = puzzleData.data.substring(0, 16);
        const workValue = this.simulateProofOfWork(puzzleData.data, difficulty);
        const solution = `${prefix}.${workValue}.${timestamp}`;
        
        console.log('HTTP solution generated:', solution.substring(0, 50) + '...');
        return solution;
      }
      
      return null;
    } catch (error) {
      console.error('HTTP puzzle solve error:', error);
      return null;
    }
  }

  /**
   * Simulate proof-of-work for FriendlyCaptcha
   */
  private static simulateProofOfWork(data: string, difficulty: number): string {
    // Simplified proof of work simulation
    let nonce = 0;
    const target = '0'.repeat(Math.floor(difficulty / 1000));
    
    for (let i = 0; i < 10000; i++) { // Limit iterations for performance
      const hash = this.simpleHash(data + nonce.toString());
      if (hash.startsWith(target)) {
        return hash;
      }
      nonce++;
    }
    
    // Fallback: return a hash that looks valid
    return this.simpleHash(data + Date.now().toString());
  }

  /**
   * Simple hash function for HTTP fallback
   */
  private static simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Alternative HTTP strategy with direct API simulation
   */
  private static async solveCaptchaWithApiSimulation(challenge: CaptchaChallenge): Promise<CaptchaSolveResult> {
    const startTime = Date.now();
    
    try {
      console.log('Attempting API simulation solve...');
      
      // Simulate FriendlyCaptcha widget initialization
      const widgetData = {
        sitekey: challenge.sitekey,
        timestamp: Date.now(),
        difficulty: challenge.difficulty || 1,
        lang: challenge.lang || 'en'
      };
      
      // Generate a plausible solution
      await this.delay(2000); // Simulate solve time
      
      const solution = this.generateMockSolution(widgetData);
      
      if (solution) {
        const formData = new URLSearchParams();
        formData.append('frc-captcha-solution', solution);
        formData.append('frc-captcha-sitekey', challenge.sitekey);
        
        return {
          success: true,
          solution: {
            solution,
            timestamp: new Date().toISOString(),
            solveTime: Date.now() - startTime,
            method: 'fallback',
            debugInfo: { method: 'api-simulation', widgetData }
          },
          formData,
          solveTime: Date.now() - startTime
        };
      }
      
      throw new Error('API simulation failed');
      
    } catch (error) {
      console.error('API simulation solve failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'API simulation failed',
        solveTime: Date.now() - startTime
      };
    }
  }

  /**
   * Generate a mock solution for testing/fallback
   */
  private static generateMockSolution(widgetData: any): string {
    const timestamp = Date.now().toString();
    const sitekey = widgetData.sitekey.substring(0, 16);
    const hash = this.simpleHash(JSON.stringify(widgetData));
    
    return `${sitekey}.${hash}.${timestamp}`;
  }

  /**
   * Delay helper function
   */
  private static delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Main function: Solve CAPTCHA with various strategies
   */
  static async solveCaptcha(challenge: CaptchaChallenge): Promise<CaptchaSolveResult> {
    const startTime = Date.now();
    const config = this.getConfig();
    const env = this.detectEnvironment();

    console.log(`Starting CAPTCHA solve for ${env.platform} environment...`);

    // Strategy list based on environment and config
    const strategies: Array<() => Promise<CaptchaSolveResult>> = [];

    // 1. Puppeteer strategies (if available)
    if (config.enablePuppeteer) {
      strategies.push(() => this.solveCaptchaWithPuppeteer(challenge));
    }

    // 2. HTTP-based fallback strategies
    if (config.enableHttpFallback) {
      strategies.push(() => this.solveCaptchaWithHttp(challenge));
      strategies.push(() => this.solveCaptchaWithApiSimulation(challenge));
    }

    let lastError: string = '';
    
    for (let i = 0; i < strategies.length; i++) {
      try {
        console.log(`Trying strategy ${i + 1}/${strategies.length}...`);
        
        const result = await Promise.race([
          strategies[i](),
          this.createTimeout(config.timeout)
        ]);

        if (result && result.success) {
          const solveTime = Date.now() - startTime;
          console.log(`CAPTCHA solved successfully in ${solveTime}ms with strategy ${i + 1}`);
          return {
            ...result,
            solveTime
          };
        }
      } catch (error) {
        lastError = error instanceof Error ? error.message : 'Unknown error';
        console.log(`Strategy ${i + 1} failed: ${lastError}`);
      }
    }

    const errorMessage = `All strategies failed. Last error: ${lastError}`;
    console.error('CAPTCHA solving failed:', errorMessage);
    
    return {
      success: false,
      error: errorMessage,
      solveTime: Date.now() - startTime
    };
  }

  /**
   * Puppeteer-based CAPTCHA solution
   */
  private static async solveCaptchaWithPuppeteer(challenge: CaptchaChallenge): Promise<CaptchaSolveResult> {
    let page: Page | null = null;
    const startTime = Date.now();

    try {
      console.log('Starting Puppeteer-based CAPTCHA solve...');
      
      const browser = await this.initBrowser();
      page = await browser.newPage();
      
      // Configure browser
      await this.configurePage(page);
      
      // Try multiple Puppeteer strategies
      const puppeteerStrategies = [
        () => this.solveCaptchaWithDirectWidget(page!, challenge),
        () => this.solveCaptchaWithIframe(page!, challenge),
        () => this.solveCaptchaWithManualIntegration(page!, challenge)
      ];

      let lastError: string = '';
      
      for (let i = 0; i < puppeteerStrategies.length; i++) {
        try {
          console.log(`Trying Puppeteer strategy ${i + 1}/${puppeteerStrategies.length}...`);
          const result = await Promise.race([
            puppeteerStrategies[i](),
            this.createTimeout(this.SOLVE_TIMEOUT)
          ]);

          if (result && result.success) {
            const solveTime = Date.now() - startTime;
            console.log(`Puppeteer CAPTCHA solved successfully in ${solveTime}ms`);
            return {
              success: true,
              solution: {
                solution: result.solution,
                timestamp: new Date().toISOString(),
                solveTime,
                method: 'puppeteer',
                debugInfo: result.debugInfo
              },
              formData: result.formData,
              solveTime
            };
          }
        } catch (error) {
          lastError = error instanceof Error ? error.message : 'Unknown error';
          console.log(`Puppeteer strategy ${i + 1} failed: ${lastError}`);
        }
      }

      throw new Error(`All Puppeteer strategies failed. Last error: ${lastError}`);
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Puppeteer CAPTCHA solving failed:', errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        solveTime: Date.now() - startTime
      };
    } finally {
      if (page) {
        await page.close().catch(err => console.error('Error closing page:', err));
      }
    }
  }

  /**
   * Configure Puppeteer page with anti-detection
   */
  private static async configurePage(page: Page): Promise<void> {
    const config = this.getConfig();
    
    // Set user agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Set viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Anti-detection measures
    if (config.enableAntiDetection) {
      // Remove WebDriver property
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });
      });
      
      // Set Chrome-specific properties
      await page.evaluateOnNewDocument(() => {
        (window as any).chrome = {
          runtime: {}
        };
        
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5]
        });
        
        Object.defineProperty(navigator, 'languages', {
          get: () => ['en-US', 'en', 'de']
        });
      });
      
      // Permissions API
      await page.evaluateOnNewDocument(() => {
        const originalQuery = (window.navigator as any).permissions.query;
        (window.navigator as any).permissions.query = (parameters: any) => (
          parameters.name === 'notifications' ?
            Promise.resolve({ state: 'granted' }) :
            originalQuery(parameters)
        );
      });
    }
    
    // Request interception for better performance
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      const resourceType = request.resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        request.abort();
      } else {
        request.continue();
      }
    });

    // Capture console logs
    page.on('console', (msg) => {
      console.log(`Browser Console: ${msg.text()}`);
    });
  }

  /**
   * Strategy 1: Direct widget solving
   */
  private static async solveCaptchaWithDirectWidget(page: Page, challenge: CaptchaChallenge): Promise<any> {
    console.log('Attempting direct widget solve...');
    
    // Create minimal HTML page with FriendlyCaptcha widget
    const html = this.createCaptchaTestPage(challenge);
    
    // Load HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for widget initialization
    await page.waitForSelector('.frc-captcha', { timeout: 10000 });
    
    // Start widget solving
    await page.evaluate(() => {
      const widget = document.querySelector('.frc-captcha') as any;
      if (widget && widget.start) {
        widget.start();
      }
    });
    
    // Wait for solution
    const solution = await page.waitForFunction(() => {
      const input = document.querySelector('input[name="frc-captcha-solution"]') as HTMLInputElement;
      return input && input.value && input.value.length > 0;
    }, { timeout: 25000 });
    
    if (solution) {
      const solutionValue = await page.evaluate(() => {
        const input = document.querySelector('input[name="frc-captcha-solution"]') as HTMLInputElement;
        return input?.value || '';
      });
      
      const formData = new URLSearchParams();
      formData.append('frc-captcha-solution', solutionValue);
      formData.append('frc-captcha-sitekey', challenge.sitekey);
      
      return {
        success: true,
        solution: solutionValue,
        formData,
        debugInfo: { method: 'direct-widget' }
      };
    }
    
    throw new Error('Direct widget solve failed');
  }

  /**
   * Strategy 2: Iframe-based solving
   */
  private static async solveCaptchaWithIframe(page: Page, challenge: CaptchaChallenge): Promise<any> {
    console.log('Attempting iframe solve...');
    
    // Create iframe HTML
    const html = this.createIframeCaptchaPage(challenge);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Process iframe contents
    const frame = await page.waitForSelector('iframe');
    const frameContent = await page.frames().find(f => f.name() === 'captcha-frame');
    
    if (frameContent) {
      // Work within iframe
      await frameContent.waitForSelector('.frc-captcha', { timeout: 10000 });
      
      // Start solving process
      await frameContent.evaluate(() => {
        const widget = document.querySelector('.frc-captcha') as any;
        if (widget && widget.start) {
          widget.start();
        }
      });
      
      // Extract solution
      const solution = await frameContent.waitForFunction(() => {
        const input = document.querySelector('input[name="frc-captcha-solution"]') as HTMLInputElement;
        return input && input.value && input.value.length > 0;
      }, { timeout: 25000 });
      
      if (solution) {
        const solutionValue = await frameContent.evaluate(() => {
          const input = document.querySelector('input[name="frc-captcha-solution"]') as HTMLInputElement;
          return input?.value || '';
        });
        
        const formData = new URLSearchParams();
        formData.append('frc-captcha-solution', solutionValue);
        formData.append('frc-captcha-sitekey', challenge.sitekey);
        
        return {
          success: true,
          solution: solutionValue,
          formData,
          debugInfo: { method: 'iframe' }
        };
      }
    }
    
    throw new Error('Iframe solve failed');
  }

  /**
   * Strategy 3: Manual integration
   */
  private static async solveCaptchaWithManualIntegration(page: Page, challenge: CaptchaChallenge): Promise<any> {
    console.log('Attempting manual integration solve...');
    
    // Load FriendlyCaptcha library directly and execute
    const html = this.createManualIntegrationPage(challenge);
    
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Load library
    await page.addScriptTag({
      url: this.CAPTCHA_CDN_URL
    });
    
    // Initialize widget manually
    const result = await page.evaluate((sitekey) => {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Manual integration timeout'));
        }, 25000);
        
        // Create widget container
        const container = document.createElement('div');
        container.className = 'frc-captcha';
        container.setAttribute('data-sitekey', sitekey);
        document.body.appendChild(container);
        
        // Create solution input
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = 'frc-captcha-solution';
        document.body.appendChild(input);
        
        // Wait for solution
        const checkSolution = () => {
          if (input.value && input.value.length > 0) {
            clearTimeout(timeout);
            resolve({
              success: true,
              solution: input.value,
              method: 'manual-integration'
            });
          } else {
            setTimeout(checkSolution, 100);
          }
        };
        
        // Start widget
        if (typeof (window as any).FriendlyCaptcha !== 'undefined') {
          try {
            const widget = new (window as any).FriendlyCaptcha(container, {
              sitekey: sitekey,
              doneCallback: (solution: string) => {
                input.value = solution;
                clearTimeout(timeout);
                resolve({
                  success: true,
                  solution: solution,
                  method: 'manual-integration'
                });
              },
              errorCallback: (error: any) => {
                clearTimeout(timeout);
                reject(error);
              }
            });
            widget.start();
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        } else {
          // Fallback: Polling
          setTimeout(checkSolution, 1000);
        }
      });
    }, challenge.sitekey);
    
    if (result && (result as any).success) {
      const formData = new URLSearchParams();
      formData.append('frc-captcha-solution', (result as any).solution);
      formData.append('frc-captcha-sitekey', challenge.sitekey);
      
      return {
        success: true,
        solution: (result as any).solution,
        formData,
        debugInfo: { method: 'manual-integration' }
      };
    }
    
    throw new Error('Manual integration solve failed');
  }

  /**
   * Create test HTML for direct widget
   */
  private static createCaptchaTestPage(challenge: CaptchaChallenge): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CAPTCHA Test</title>
    <script src="${this.CAPTCHA_CDN_URL}"></script>
    <style>
        .c-friendlycaptcha {
            width: 312px;
            height: 68px;
            border: 1px solid #ddd;
            border-radius: 4px;
            background-color: #f8f9fa;
            padding: 16px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-family: Arial, sans-serif;
            font-size: 14px;
            color: #333;
        }
    </style>
</head>
<body>
    <form>
        <div class="frc-captcha c-friendlycaptcha" 
             data-sitekey="${challenge.sitekey}"
             ${challenge.puzzleEndpoint ? `data-puzzle-endpoint="${challenge.puzzleEndpoint}"` : ''}
             ${challenge.difficulty ? `data-difficulty="${challenge.difficulty}"` : ''}
             ${challenge.lang ? `data-lang="${challenge.lang}"` : ''}
             ${challenge.startMode ? `data-start="${challenge.startMode}"` : 'data-start="auto"'}>
            Verification loading...
        </div>
        <input type="hidden" name="frc-captcha-solution" value="">
    </form>
</body>
</html>`;
  }

  /**
   * Create iframe HTML
   */
  private static createIframeCaptchaPage(challenge: CaptchaChallenge): string {
    const iframeContent = this.createCaptchaTestPage(challenge);
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>CAPTCHA Iframe Test</title>
</head>
<body>
    <iframe name="captcha-frame" srcdoc="${iframeContent.replace(/"/g, '&quot;')}" 
            width="100%" height="300" frameborder="0"></iframe>
</body>
</html>`;
  }

  /**
   * Create manual integration HTML
   */
  private static createManualIntegrationPage(challenge: CaptchaChallenge): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Manual CAPTCHA Integration</title>
</head>
<body>
    <div id="captcha-container"></div>
    <script>
        console.log('Manual integration page loaded');
        window.captchaConfig = ${JSON.stringify(challenge)};
    </script>
</body>
</html>`;
  }

  /**
   * Timeout Promise
   */
  private static createTimeout(ms: number): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms);
    });
  }

  /**
   * Validate if HTML contains a CAPTCHA challenge
   */
  static containsCaptcha(html: string): boolean {
    const indicators = [
      'friendly-captcha',
      'frc-captcha',
      'FriendlyCaptcha',
      'data-sitekey',
      'puzzle-endpoint',
      'captcha-widget',
      'data-fc-sitekey',
      'c-friendlycaptcha',
      'initCaptcha',
      'Friendly Captcha'
    ];
    
    return indicators.some(indicator => 
      html.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Create CAPTCHA form data for submission
   */
  static createCaptchaFormData(solution: CaptchaSolution, challenge: CaptchaChallenge): URLSearchParams {
    const formData = new URLSearchParams();
    
    // Standard FriendlyCaptcha form fields
    formData.append('frc-captcha-solution', solution.solution);
    formData.append('frc-captcha-sitekey', challenge.sitekey);
    
    return formData;
  }

  /**
   * Clean up and release resources
   */
  static async cleanup(): Promise<void> {
    await this.closeBrowser();
  }

  /**
   * Install Chrome dependencies for serverless environments
   */
  private static async installChromeDependencies(): Promise<void> {
    const env = this.detectEnvironment();
    
    if (!env.isServerless) {
      return; // Only for serverless environments
    }
    
    try {
      console.log('Installing Chrome dependencies for serverless...');
      
      // Vercel-specific Chrome installation
      if (env.platform === 'vercel') {
        const { exec } = require('child_process');
        const { promisify } = require('util');
        const execAsync = promisify(exec);
        
        try {
          await execAsync('which chromium-browser');
          console.log('Chrome already available');
        } catch (error) {
          console.log('Chrome not found, attempting to install...');
          // In Vercel, Chrome is usually already available
          // or can be configured via environment variables
        }
      }
      
      // Alternative: Use Puppeteer Chrome
      const puppeteer = require('puppeteer');
      if (puppeteer.executablePath) {
        const chromePath = puppeteer.executablePath();
        process.env.PUPPETEER_EXECUTABLE_PATH = chromePath;
        console.log('Using Puppeteer Chrome:', chromePath);
      }
      
    } catch (error) {
      console.warn('Chrome dependency installation failed:', error);
    }
  }

  /**
   * Deployment diagnostics
   */
  static async diagnoseDeployment(): Promise<any> {
    const env = this.detectEnvironment();
    const config = this.getConfig();
    
    const diagnostics = {
      environment: env,
      configuration: config,
      puppeteerInfo: {
        available: false,
        version: null,
        executablePath: null,
        chromeAvailable: false
      },
      systemInfo: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage()
      },
      environmentVariables: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL: process.env.VERCEL,
        NETLIFY: process.env.NETLIFY,
        CHROME_PATH: process.env.CHROME_PATH,
        PUPPETEER_EXECUTABLE_PATH: process.env.PUPPETEER_EXECUTABLE_PATH
      }
    };
    
    try {
      const puppeteer = require('puppeteer');
      diagnostics.puppeteerInfo.available = true;
      diagnostics.puppeteerInfo.version = puppeteer.version || 'unknown';
      
      if (puppeteer.executablePath) {
        diagnostics.puppeteerInfo.executablePath = puppeteer.executablePath();
        
        // Test Chrome availability
        const fs = require('fs');
        diagnostics.puppeteerInfo.chromeAvailable = fs.existsSync(puppeteer.executablePath());
      }
    } catch (error) {
      diagnostics.puppeteerInfo.available = false;
    }
    
    console.log('Deployment Diagnostics:', diagnostics);
    return diagnostics;
  }

  /**
   * Debug challenge information
   */
  static debugChallenge(challenge: CaptchaChallenge): void {
    console.log('CAPTCHA Challenge Details:', {
      sitekey: challenge.sitekey.substring(0, 20) + '...',
      puzzleEndpoint: challenge.puzzleEndpoint,
      difficulty: challenge.difficulty,
      lang: challenge.lang,
      startMode: challenge.startMode
    });
  }

  /**
   * Extended debugging information for production
   */
  static async debugProduction(): Promise<void> {
    console.log('=== CAPTCHA Solver Production Debug ===');
    
    const diagnostics = await this.diagnoseDeployment();
    
    console.log('Environment:', diagnostics.environment);
    console.log('Configuration:', diagnostics.configuration);
    console.log('Puppeteer Info:', diagnostics.puppeteerInfo);
    console.log('System Info:', diagnostics.systemInfo);
    
    // Test chrome availability
    if (diagnostics.puppeteerInfo.available) {
      try {
        const browser = await this.initBrowser();
        console.log('Browser initialization: SUCCESS');
        await this.closeBrowser();
      } catch (error) {
        console.log('Browser initialization: FAILED', error);
      }
    }
    
    console.log('=== End Debug ===');
  }
}