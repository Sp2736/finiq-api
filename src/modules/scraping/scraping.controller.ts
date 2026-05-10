import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { ScrapingService } from './scraping.service';
import type { LoginPayload } from './scraping.service';

@Controller('scraping')
export class ScrapingController {
    private readonly logger = new Logger(ScrapingController.name);

    constructor(private readonly scrapingService: ScrapingService) { }

    /**
     * POST /scraping/login
     * Runs login directly (synchronous — good for testing)
     *
     * Body: { "username": "ARN-164871", "password": "Azo@12345" }
     */
    @Post('login')
    async login(@Body() payload: LoginPayload) {
        this.logger.log(`Direct login request for: ${payload.username}`);
        return this.scrapingService.login(payload);
    }

    /**
     * POST /scraping/queue/login
     * Adds login to Bull queue (async — good for production / multiple investors)
     *
     * Body: { "username": "ARN-164871", "password": "Azo@12345" }
     */
    @Post('queue/login')
    async queueLogin(@Body() payload: LoginPayload) {
        this.logger.log(`Queuing login job for: ${payload.username}`);
        return this.scrapingService.queueLoginJob(payload);
    }

    /**
     * GET /scraping/job/:id
     * Check status of a queued job
     */
    @Get('job/:id')
    async getJobStatus(@Param('id') id: string) {
        return this.scrapingService.getJobStatus(id);
    }
}