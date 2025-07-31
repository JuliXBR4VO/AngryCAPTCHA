/**
 * Basic Usage Example for AngryCAPTCHA
 * 
 * This example demonstrates how to use the AngryCAPTCHA
 * to solve a FriendlyCaptcha challenge.
 * 
 * @author JuliXVR4VO
 */

import { AngryCAPTCHA, CaptchaChallenge } from '../src/index';
import { SimpleAngryCAPTCHA } from '../src/simple-solver';

// Example 1: Solve from a URL
async function solveFromUrl() {
  console.log('Example 1: Solving FriendlyCaptcha from a URL');
  
  const url = 'https://example.com/page-with-captcha';
  const result = await SimpleAngryCAPTCHA.solveFromUrl(url);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully!');
    console.log('Solution:', result.solution.solution.substring(0, 20) + '...');
    console.log('Solve time:', result.solution.solveTime, 'ms');
    console.log('Method:', result.solution.method);
  } else {
    console.error('Failed to solve CAPTCHA:', result.error);
  }
}

// Example 2: Solve with a known sitekey
async function solveWithSitekey() {
  console.log('Example 2: Solving FriendlyCaptcha with a known sitekey');
  
  const sitekey = 'YOUR_FRIENDLY_CAPTCHA_SITEKEY';
  const result = await SimpleAngryCAPTCHA.solveWithSitekey(sitekey);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully!');
    console.log('Solution:', result.solution.solution.substring(0, 20) + '...');
    console.log('Solve time:', result.solution.solveTime, 'ms');
    console.log('Method:', result.solution.method);
    
    // Submit the form with the solution
    try {
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
      console.log('Form submission response:', await response.text());
    } catch (error) {
      console.error('Form submission failed:', error);
    }
  } else {
    console.error('Failed to solve CAPTCHA:', result.error);
  }
}

// Example 3: Advanced usage with the main solver
async function advancedUsage() {
  console.log('Example 3: Advanced usage with the main solver');
  
  try {
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
    
    // Debug the challenge
    AngryCAPTCHA.debugChallenge(challenge);
    
    // Solve the challenge
    const result = await AngryCAPTCHA.solveCaptcha(challenge);
    
    if (result.success && result.solution) {
      console.log('CAPTCHA solved successfully!');
      console.log('Solution:', result.solution.solution.substring(0, 20) + '...');
      console.log('Solve time:', result.solution.solveTime, 'ms');
      console.log('Method:', result.solution.method);
      
      // Create form data for submission
      const formData = AngryCAPTCHA.createCaptchaFormData(result.solution, challenge);
      
      // Add additional form fields
      formData.append('username', 'testuser');
      formData.append('email', 'test@example.com');
      
      // Submit the form
      const submitResponse = await fetch('https://example.com/submit-form', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        body: formData
      });
      
      console.log('Form submission status:', submitResponse.status);
    } else {
      console.error('Failed to solve CAPTCHA:', result.error);
    }
  } catch (error) {
    console.error('Error in advanced usage example:', error);
  }
}

// Example 4: Solving in a serverless environment
async function serverlessExample() {
  console.log('Example 4: Solving in a serverless environment');
  
  // Diagnose the deployment environment
  const diagnostics = await AngryCAPTCHA.diagnoseDeployment();
  console.log('Environment diagnostics:', diagnostics);
  
  // Create a challenge object directly
  const challenge: CaptchaChallenge = {
    sitekey: 'YOUR_FRIENDLY_CAPTCHA_SITEKEY',
    // Optional parameters
    puzzleEndpoint: 'https://api.friendlycaptcha.com/api/v1/puzzle',
    difficulty: 1000,
    lang: 'en',
    startMode: 'auto'
  };
  
  // Solve the challenge
  const result = await AngryCAPTCHA.solveCaptcha(challenge);
  
  if (result.success && result.solution) {
    console.log('CAPTCHA solved successfully in serverless environment!');
    console.log('Solution:', result.solution.solution.substring(0, 20) + '...');
    console.log('Solve time:', result.solution.solveTime, 'ms');
    console.log('Method:', result.solution.method);
  } else {
    console.error('Failed to solve CAPTCHA in serverless environment:', result.error);
  }
}

// Run the examples
async function runExamples() {
  try {
    // Uncomment the examples you want to run
    // await solveFromUrl();
    // await solveWithSitekey();
    // await advancedUsage();
    // await serverlessExample();
    
    // Clean up resources
    await AngryCAPTCHA.cleanup();
    
    console.log('Examples completed');
  } catch (error) {
    console.error('Error running examples:', error);
  }
}

// Run the examples if this file is executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}