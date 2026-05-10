import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException, HttpStatus, HttpCode, Logger } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KarvySchemeDetailsService } from './karvy-scheme-details.service';
import { ResponseFormatter } from 'src/common';

@Controller('api/karvy-scheme-details')
export class KarvySchemeDetailsController {
    private readonly logger = new Logger(KarvySchemeDetailsController.name);

    constructor(private readonly service: KarvySchemeDetailsService) { }

    @Post('upload')
    @HttpCode(HttpStatus.OK)
    @UseInterceptors(FileInterceptor('file'))
    async uploadSchemeDetails(@UploadedFile() file: any) {
        if (!file) {
            throw new BadRequestException('File is required');
        }

        this.logger.debug(`Received file: ${file.originalname}, size: ${file.size}`);

        const result = await this.service.processFile(file.buffer);
        return ResponseFormatter.success(result, 'Karvy scheme details successfully processed');
    }
}
