import { Processor, Process } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import type { Job } from 'bull';
import { ScrapingService } from './scraping.service';
import type { LoginPayload } from './scraping.service';

@Processor('scraping')
export class ScrapingProcessor {
    private readonly logger = new Logger(ScrapingProcessor.name);

    constructor(private readonly scrapingService: ScrapingService) { }

    @Process('login')
    async handleLoginJob(job: Job<LoginPayload>) {
        this.logger.log(`Processing login job ${job.id} for: ${job.data.username}`);

        const result = await this.scrapingService.login(job.data);

        if (!result.success) {
            // Throwing causes Bull to retry based on the attempts config
            throw new Error(result.error || 'Login failed');
        }

        this.logger.log(`Job ${job.id} completed. Next step: ${result.nextStep}`);
        return result;
    }
}