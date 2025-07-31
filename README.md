# AngryCAPTCHA

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![npm version](https://img.shields.io/npm/v/angry-captcha.svg)](https://www.npmjs.com/package/angry-captcha)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.9%2B-blue)](https://www.typescriptlang.org/)

A versatile library for automatically solving FriendlyCaptcha challenges using multiple strategies. Works in Node.js, serverless environments, and various deployment scenarios.

## Features

- 🚀 **Multiple solving strategies** - Puppeteer-based, HTTP-based, and API simulation
- 🔄 **Automatic fallback** - Tries different methods if one fails
- 🌐 **Environment detection** - Adapts to different environments (development, production, serverless)
- 🛡️ **Anti-detection measures** - Avoids being detected as automation
- 📊 **Detailed diagnostics** - Comprehensive logging and debugging tools
- 🧩 **Simple API** - Easy to use in various scenarios

## Installation

```bash
npm install angry-captcha
# or
yarn add angry-captcha
```

### Dependencies

The library has the following peer dependencies:

```bash
npm install puppeteer
# or
yarn add puppeteer
```

For serverless environments, you might need to use `puppeteer-core` instead and provide a browser executable path.

## Quick Start

### Basic Usage

```typescript
import { SimpleAngryCAPTCHA } from 'angry-captcha';

// Solve from a URL
async function solveCaptcha() {
  const url = 'https://example.com/page-with-captcha';
  const result = await SimpleAngryCAPTCHA.solveFromUrl(url);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully!');
    console.log('Solution:', result.solution.solution);
    
    // Submit a form with the solution
    const formUrl = 'https://example.com/submit-form';
    const additionalFormData = {
      'username': 'testuser',
      'email': 'test@example.com'
    };
    
    const response = await SimpleAngryCAPTCHA.submitForm(
      formUrl, 
      result, 
      additionalFormData
    );
    
    console.log('Form submission status:', response.status);
  } else {
    console.error('Failed to solve CAPTCHA:', result.error);
  }
  
  // Clean up resources
  await SimpleAngryCAPTCHA.cleanup();
}

solveCaptcha().catch(console.error);
```

### Solve with a Known Sitekey

```typescript
import { SimpleAngryCAPTCHA } from 'angry-captcha';

async function solveWithSitekey() {
  const sitekey = 'YOUR_FRIENDLY_CAPTCHA_SITEKEY';
  const result = await SimpleAngryCAPTCHA.solveWithSitekey(sitekey);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully!');
    console.log('Solution:', result.solution.solution);
  } else {
    console.error('Failed to solve CAPTCHA:', result.error);
  }
}
```

### Advanced Usage

```typescript
import { AngryCAPTCHA, CaptchaChallenge } from 'angry-captcha';

async function advancedUsage() {
  // Fetch a page with FriendlyCaptcha
  const response = await fetch('https://example.com/page-with-captcha');
  const html = await response.text();
  
  // Check if the page contains a FriendlyCaptcha
  if (!AngryCAPTCHA.containsCaptcha(html)) {
    console.log('No FriendlyCaptcha found on the page');
    return;
  }
  
  // Extract the challenge
  const challenge = AngryCAPTCHA.extractCaptchaChallenge(html);
  if (!challenge) {
    console.error('Failed to extract CAPTCHA challenge');
    return;
  }
  
  // Solve the challenge
  const result = await AngryCAPTCHA.solveCaptcha(challenge);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully!');
    console.log('Solution:', result.solution.solution);
    
    // Create form data for submission
    const formData = AngryCAPTCHA.createCaptchaFormData(result.solution, challenge);
    
    // Add additional form fields
    formData.append('username', 'testuser');
    formData.append('email', 'test@example.com');
    
    // Submit the form
    const submitResponse = await fetch('https://example.com/submit-form', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });
    
    console.log('Form submission status:', submitResponse.status);
  }
  
  // Clean up resources
  await AngryCAPTCHA.cleanup();
}
```

## Environment Support

The library automatically detects the environment it's running in and adapts its strategies accordingly:

- **Development**: Uses all available strategies with longer timeouts
- **Production**: Optimizes for reliability and performance
- **Serverless** (Vercel, Netlify, AWS Lambda, etc.): Uses HTTP-based strategies to avoid browser dependencies

## API Reference

### SimpleAngryCAPTCHA

A simplified wrapper for common use cases.

#### `solveFromUrl(url: string): Promise<CaptchaSolveResult>`

Solves a FriendlyCaptcha from a webpage URL.

#### `solveFromHtml(html: string): Promise<CaptchaSolveResult>`

Solves a FriendlyCaptcha from HTML content.

#### `solveWithSitekey(sitekey: string, puzzleEndpoint?: string): Promise<CaptchaSolveResult>`

Solves a FriendlyCaptcha with a known sitekey.

#### `submitForm(formUrl: string, solveResult: CaptchaSolveResult, additionalFormData?: Record<string, string>): Promise<Response>`

Submits a form with a solved CAPTCHA.

#### `cleanup(): Promise<void>`

Cleans up resources.

### AngryCAPTCHA

The main solver class with advanced functionality.

#### `solveCaptcha(challenge: CaptchaChallenge): Promise<CaptchaSolveResult>`

Solves a FriendlyCaptcha challenge.

#### `extractCaptchaChallenge(html: string): CaptchaChallenge | null`

Extracts a FriendlyCaptcha challenge from HTML content.

#### `containsCaptcha(html: string): boolean`

Checks if HTML content contains a FriendlyCaptcha.

#### `createCaptchaFormData(solution: CaptchaSolution, challenge: CaptchaChallenge): URLSearchParams`

Creates form data for submission with a solved CAPTCHA.

#### `diagnoseDeployment(): Promise<any>`

Provides diagnostic information about the current environment.

#### `cleanup(): Promise<void>`

Cleans up resources.

## Serverless Deployment

For serverless environments, the library automatically falls back to HTTP-based strategies. If you want to use Puppeteer in serverless environments, you need to:

1. Install the required dependencies:
   ```bash
   npm install puppeteer-core
   ```

2. Set the environment variables:
   ```
   PUPPETEER_EXECUTABLE_PATH=/path/to/chrome
   ```

3. For Vercel, you can use the Chrome AWS Lambda layer or similar solutions.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Author

Created by JuliXVR4VO

## Disclaimer

This library is provided for educational and research purposes only. Use responsibly and in accordance with the terms of service of the websites you interact with.