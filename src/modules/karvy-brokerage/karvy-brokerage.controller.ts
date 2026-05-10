import { Controller, Post, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { KarvyBrokerageUploadService } from './karvy-brokerage-upload.service';

@Controller('api/karvy-brokerage-data')
export class KarvyBrokerageController {
    constructor(
        private readonly karvyBrokerageUploadService: KarvyBrokerageUploadService,
    ) { }

    @Post('company/:companyId/upload')
    @UseInterceptors(FileInterceptor('file'))
    async uploadBrokerageData(
        @Param('companyId') companyId: string,
        @UploadedFile() file: Express.Multer.File,
    ) {
        if (!file) {
            throw new BadRequestException('No file provided');
        }

        const count = await this.karvyBrokerageUploadService.processAndDump(file.buffer, companyId);
        return { message: `Successfully dumped ${count} records` };
    }
}
