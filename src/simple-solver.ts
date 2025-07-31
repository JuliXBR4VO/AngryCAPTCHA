/**
 * Simple AngryCAPTCHA Solver
 * 
 * A simplified wrapper around the main AngryCAPTCHA class
 * for easier integration in common use cases.
 */

import { AngryCAPTCHA, CaptchaChallenge, CaptchaSolveResult } from './index';

export class SimpleAngryCAPTCHA {
  /**
   * Solve a FriendlyCaptcha from a webpage URL
   * 
   * @param url The URL of the page containing the FriendlyCaptcha
   * @returns A promise resolving to the solve result
   */
  static async solveFromUrl(url: string): Promise<CaptchaSolveResult> {
    try {
      console.log(`Solving FriendlyCaptcha from URL: ${url}`);
      
      // Fetch the page content
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch page: ${response.status}`);
      }
      
      const html = await response.text();
      
      // Check if the page contains a FriendlyCaptcha
      if (!AngryCAPTCHA.containsCaptcha(html)) {
        throw new Error('No FriendlyCaptcha found on the page');
      }
      
      // Extract the challenge
      const challenge = AngryCAPTCHA.extractCaptchaChallenge(html);
      if (!challenge) {
        throw new Error('Failed to extract CAPTCHA challenge');
      }
      
      // Solve the challenge
      return await AngryCAPTCHA.solveCaptcha(challenge);
      
    } catch (error) {
      console.error('Error solving CAPTCHA from URL:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Solve a FriendlyCaptcha from HTML content
   * 
   * @param html The HTML content containing the FriendlyCaptcha
   * @returns A promise resolving to the solve result
   */
  static async solveFromHtml(html: string): Promise<CaptchaSolveResult> {
    try {
      console.log('Solving FriendlyCaptcha from HTML content');
      
      // Check if the HTML contains a FriendlyCaptcha
      if (!AngryCAPTCHA.containsCaptcha(html)) {
        throw new Error('No FriendlyCaptcha found in the HTML content');
      }
      
      // Extract the challenge
      const challenge = AngryCAPTCHA.extractCaptchaChallenge(html);
      if (!challenge) {
        throw new Error('Failed to extract CAPTCHA challenge');
      }
      
      // Solve the challenge
      return await AngryCAPTCHA.solveCaptcha(challenge);
      
    } catch (error) {
      console.error('Error solving CAPTCHA from HTML:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Solve a FriendlyCaptcha with a known sitekey
   * 
   * @param sitekey The FriendlyCaptcha sitekey
   * @param puzzleEndpoint Optional custom puzzle endpoint
   * @returns A promise resolving to the solve result
   */
  static async solveWithSitekey(
    sitekey: string, 
    puzzleEndpoint?: string
  ): Promise<CaptchaSolveResult> {
    try {
      console.log(`Solving FriendlyCaptcha with sitekey: ${sitekey}`);
      
      const challenge: CaptchaChallenge = {
        sitekey,
        puzzleEndpoint
      };
      
      // Solve the challenge
      return await AngryCAPTCHA.solveCaptcha(challenge);
      
    } catch (error) {
      console.error('Error solving CAPTCHA with sitekey:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Submit a solved CAPTCHA to a form
   * 
   * @param formUrl The URL of the form to submit to
   * @param solveResult The result from a successful CAPTCHA solve
   * @param additionalFormData Additional form data to include in the submission
   * @returns The response from the form submission
   */
  static async submitForm(
    formUrl: string, 
    solveResult: CaptchaSolveResult,
    additionalFormData?: Record<string, string>
  ): Promise<Response> {
    if (!solveResult.success || !solveResult.solution) {
      throw new Error('Cannot submit form: CAPTCHA solve was not successful');
    }
    
    console.log(`Submitting form to ${formUrl} with solved CAPTCHA`);
    
    // Create form data
    const formData = new URLSearchParams();
    
    // Add CAPTCHA solution
    formData.append('frc-captcha-solution', solveResult.solution.solution);
    formData.append('frc-captcha-sitekey', solveResult.formData?.get('frc-captcha-sitekey') || '');
    
    // Add additional form data
    if (additionalFormData) {
      Object.entries(additionalFormData).forEach(([key, value]) => {
        formData.append(key, value);
      });
    }
    
    // Submit the form
    return fetch(formUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: formData
    });
  }
  
  /**
   * Clean up resources
   */
  static async cleanup(): Promise<void> {
    await AngryCAPTCHA.cleanup();
  }
}