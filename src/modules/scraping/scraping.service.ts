import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as path from 'path';
import * as fs from 'fs';
import Tesseract from 'tesseract.js';
import sharp from 'sharp';
import { logAndSanitize } from '../../common/utils/safe-error';

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────
const CAMS_URL = 'https://edge360.camsonline.com';
const DEBUG_DIR = path.join(process.cwd(), 'debug_screenshots');

const SELECTORS = {
  username: 'input[data-placeholder="Enter username"]',
  password: 'input[data-placeholder="Enter password"]',
  checkbox: 'mat-checkbox input[type="checkbox"]',
  captchaInput: 'input[data-placeholder="Enter captcha"]',
  captchaSvg: 'form svg', // SVG is inside <form> > <span> > <svg>
  captchaRefresh: '.iconrefresh mat-icon, .Lticonrefresh mat-icon',
  securityAnswers: 'input[formcontrolname="txtanswer"]',
  nextBtn: 'button.btnb',
};

// ─────────────────────────────────────────────
//  TYPES
// ─────────────────────────────────────────────
export interface LoginPayload {
  username: string;
  password: string;
  sec_ans1: string;
  sec_ans2: string;
}

export interface LoginResult {
  success: boolean;
  nextStep?: string;
  screenshotPath?: string;
  captchaText?: string;
  error?: string;
}

// ─────────────────────────────────────────────
//  SERVICE
// ─────────────────────────────────────────────
@Injectable()
export class ScrapingService {
  private readonly logger = new Logger(ScrapingService.name);

  constructor(@InjectQueue('scraping') private readonly scrapingQueue: Queue) {}

  // ── Ensure debug dir exists ──────────────────
  private ensureDebugDir(): void {
    if (!fs.existsSync(DEBUG_DIR)) {
      fs.mkdirSync(DEBUG_DIR, { recursive: true });
    }
  }

  // ── Human-like delay ─────────────────────────
  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ── Take a full-page screenshot ──────────────
  private async screenshot(page: Page, label: string): Promise<string> {
    this.ensureDebugDir();
    const filePath = path.join(DEBUG_DIR, `${label}_${Date.now()}.png`);
    await page.screenshot({ path: filePath, fullPage: true });
    this.logger.log(`Screenshot saved: ${filePath}`);
    return filePath;
  }

  // ── Launch browser + context ─────────────────
  private async launchBrowser(): Promise<{
    browser: Browser;
    context: BrowserContext;
  }> {
    const browser = await chromium.launch({
      headless: false,
      slowMo: 80,
      args: [
        '--disable-blink-features=AutomationControlled',
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ],
    });

    const context = await browser.newContext({
      acceptDownloads: true,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      locale: 'en-IN',
      timezoneId: 'Asia/Kolkata',
      geolocation: { latitude: 23.02, longitude: 72.57 },
      permissions: ['geolocation'],
    });

    // Hide Playwright fingerprint
    await context.addInitScript(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    });

    return { browser, context };
  }

  // ─────────────────────────────────────────────
  //  OCR — pre-process image buffer + run Tesseract
  // ─────────────────────────────────────────────
  private async runOcr(imageBuffer: Buffer): Promise<string> {
    // Pre-process: upscale → grayscale → normalize → sharpen → binarize
    // This significantly improves Tesseract accuracy on styled SVG captchas
    const processed = await sharp(imageBuffer)
      .resize({ width: 500, height: 100, fit: 'fill' })
      .grayscale()
      .normalise()
      .sharpen()
      .threshold(128)
      .png()
      .toBuffer();

    const worker = await Tesseract.createWorker('eng');

    await worker.setParameters({
      // Only allow uppercase alphanumeric characters
      tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
      // PSM 8 = single word, best for short captchas
      tessedit_pageseg_mode: '8' as any,
      // OEM 1 = LSTM neural net only
      tessedit_ocr_engine_mode: '1' as any,
    });

    const {
      data: { text },
    } = await worker.recognize(processed);
    await worker.terminate();

    const cleaned = text.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    this.logger.log(`OCR raw: "${text.trim()}" → cleaned: "${cleaned}"`);
    return cleaned;
  }

  // ─────────────────────────────────────────────
  //  CAPTCHA READER
  //  The captcha is a pure SVG (paths, no text nodes).
  //  Strategy: screenshot the SVG element → OCR with Tesseract.
  //
  //  DOM structure (from inspect):
  //    <form>
  //      ...
  //      <span class="ng-star-inserted">
  //        <svg>...</svg>           ← captcha lives here
  //      </span>
  //      <div fxlayout="row">
  //        <input data-placeholder="Enter captcha"> ← captcha input
  //      </div>
  //    </form>
  // ─────────────────────────────────────────────
  private async readCaptcha(page: Page): Promise<string> {
    this.logger.log('Reading captcha SVG via screenshot + OCR...');
    await this.delay(800);

    await page.waitForSelector(SELECTORS.captchaSvg, { timeout: 10000 });

    // Retry OCR up to 3 times with fresh captcha if length is wrong
    for (let attempt = 1; attempt <= 3; attempt++) {
      this.logger.log(`Captcha OCR attempt ${attempt}/3`);

      const svgElement = await page.$(SELECTORS.captchaSvg);
      if (!svgElement) throw new Error('Captcha SVG not found');

      const boundingBox = await svgElement.boundingBox();
      if (!boundingBox) throw new Error('Could not get SVG bounding box');

      const captchaBuffer = await page.screenshot({
        clip: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height,
        },
      });

      // Save debug crop
      this.ensureDebugDir();
      fs.writeFileSync(
        path.join(
          DEBUG_DIR,
          `captcha_crop_attempt${attempt}_${Date.now()}.png`,
        ),
        captchaBuffer,
      );

      const result = await this.runOcr(captchaBuffer);

      // CAMS captcha is always exactly 6 chars — enforce this
      if (result.length === 6) {
        this.logger.log(`✅ Captcha resolved: "${result}"`);
        return result;
      }

      this.logger.warn(
        `Attempt ${attempt}: OCR result "${result}" has wrong length (${result.length}/6). ` +
          `${attempt < 3 ? 'Refreshing captcha and retrying...' : 'Giving up.'}`,
      );

      if (attempt < 3) {
        // Refresh to get a cleaner captcha for next attempt
        try {
          await page.click(SELECTORS.captchaRefresh, { timeout: 3000 });
        } catch {
          await page.click('.iconrefresh', { timeout: 3000 }).catch(() => {});
        }
        await this.delay(1000);
      }
    }

    throw new Error(
      'Could not OCR captcha correctly after 3 attempts. Check debug_screenshots/.',
    );
  }

  // ─────────────────────────────────────────────
  //  REFRESH CAPTCHA & RE-READ
  // ─────────────────────────────────────────────
  private async refreshAndReadCaptcha(page: Page): Promise<string> {
    this.logger.log('Refreshing captcha...');

    try {
      await page.click(SELECTORS.captchaRefresh, { timeout: 3000 });
      this.logger.log('Clicked captcha refresh icon');
    } catch {
      try {
        await page.click('.iconrefresh', { timeout: 3000 });
        this.logger.log('Clicked .iconrefresh fallback');
      } catch {
        this.logger.warn(
          'Could not click captcha refresh — reading current captcha',
        );
      }
    }

    await this.delay(1000); // Wait for new SVG to render
    return this.readCaptcha(page);
  }

  // ─────────────────────────────────────────────
  //  CORE LOGIN LOGIC
  // ─────────────────────────────────────────────
  async login(payload: LoginPayload): Promise<LoginResult> {
    let browser: Browser | null = null;

    try {
      // 1. Launch browser
      const { browser: b, context } = await this.launchBrowser();
      browser = b;
      const page = await context.newPage();

      // 2. Navigate to CAMS edge360
      this.logger.log('Navigating to CAMS edge360...');
      await page.goto(CAMS_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await this.delay(1500);

      // 3. Wait for username field
      await page.waitForSelector(SELECTORS.username, { timeout: 15000 });
      await this.screenshot(page, '01_login_page_loaded');

      // 4. Fill username
      this.logger.log('Filling username...');
      await page.click(SELECTORS.username);
      await page.fill(SELECTORS.username, payload.username);
      await this.delay(500);

      // 5. Fill password
      this.logger.log('Filling password...');
      await page.click(SELECTORS.password);
      await page.fill(SELECTORS.password, payload.password);
      await this.delay(500);

      // 6. Check T&C checkbox if not already checked
      const isChecked = await page.isChecked(SELECTORS.checkbox);
      if (!isChecked) {
        await page.click(SELECTORS.checkbox);
        this.logger.log('Checked T&C checkbox');
        await this.delay(400);
      }

      // 7. Read captcha via SVG screenshot + OCR
      this.logger.log('Reading captcha...');
      const captchaValue = await this.readCaptcha(page);
      this.logger.log(`Captcha to enter: "${captchaValue}"`);

      // 8. Fill captcha input
      await page.waitForSelector(SELECTORS.captchaInput, { timeout: 10000 });
      await page.click(SELECTORS.captchaInput);
      await page.fill(SELECTORS.captchaInput, captchaValue);
      await this.delay(500);

      await this.screenshot(page, '02_before_next_click');

      // 9. Click Next
      this.logger.log('Clicking Next...');
      await page.click(SELECTORS.nextBtn);

      // 10. Detect what comes after login
      const nextStep = await Promise.race([
        page
          .waitForSelector(
            'input[placeholder*="security"], input[placeholder*="Security"], input[placeholder*="answer"]',
            { timeout: 10000 },
          )
          .then(() => 'security_question'),

        page
          .waitForSelector(
            'input[placeholder*="OTP"], input[placeholder*="otp"], input[placeholder*="One Time"]',
            { timeout: 10000 },
          )
          .then(() => 'otp'),

        page
          .waitForSelector(
            'mat-sidenav, app-dashboard, .example-sidenav-container, .mat-drawer-container',
            { timeout: 10000 },
          )
          .then(() => 'dashboard'),

        page
          .waitForURL('**/dashboard**', { timeout: 10000 })
          .then(() => 'dashboard'),

        page
          .waitForSelector('.mat-error, text=Invalid captcha, text=invalid', {
            timeout: 10000,
          })
          .then(() => 'captcha_error'),
      ]).catch(() => 'unknown');

      this.logger.log(`Next step detected: ${nextStep}`);

      // 11. Retry once with a fresh captcha if OCR was wrong
      if (nextStep === 'captcha_error') {
        this.logger.warn('Captcha incorrect — refreshing and retrying...');
        await this.delay(1000);

        const freshCaptcha = await this.refreshAndReadCaptcha(page);
        this.logger.log(`Retry captcha: "${freshCaptcha}"`);

        await page.fill(SELECTORS.captchaInput, '');
        await page.fill(SELECTORS.captchaInput, freshCaptcha);
        await this.delay(500);
        await page.click(SELECTORS.nextBtn);
        await this.delay(3000);
      }

      const screenshotPath = await this.screenshot(
        page,
        `03_after_next_${nextStep}`,
      );

      await browser.close();

      return {
        success: true,
        nextStep,
        screenshotPath,
        captchaText: captchaValue,
      };
    } catch (error) {
      const safeMsg = logAndSanitize(
        this.logger,
        'Login failed',
        error,
        'Login failed. Please try again.',
      );

      if (browser) {
        await browser.close();
      }

      return {
        success: false,
        error: safeMsg,
      };
    }
  }

  // ─────────────────────────────────────────────
  //  BULL QUEUE
  // ─────────────────────────────────────────────
  async queueLoginJob(
    payload: LoginPayload,
  ): Promise<{ jobId: string | number }> {
    const job = await this.scrapingQueue.add('login', payload, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false,
      removeOnFail: false,
    });

    this.logger.log(
      `Queued login job: ${job.id} for user: ${payload.username}`,
    );
    return { jobId: job.id };
  }

  async getJobStatus(jobId: string): Promise<object> {
    const job = await this.scrapingQueue.getJob(jobId);
    if (!job) return { error: 'Job not found' };

    const state = await job.getState();
    return {
      jobId: job.id,
      state,
      result: job.returnvalue,
      failedReason: job.failedReason,
      attemptsMade: job.attemptsMade,
      createdAt: new Date(job.timestamp).toISOString(),
    };
  }
}
