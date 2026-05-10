import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScrapingService } from './scraping.service';
import { ScrapingProcessor } from './scraping.processor';
import { ScrapingController } from './scraping.controller';

@Module({
    imports: [
        BullModule.registerQueue({
            name: 'scraping',
        }),
    ],
    controllers: [ScrapingController],
    providers: [ScrapingService, ScrapingProcessor],
    exports: [ScrapingService],
})
export class ScrapingModule { }