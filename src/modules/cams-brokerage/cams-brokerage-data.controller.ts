import { Controller, Post, Param, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CamsBrokerageUploadService } from './cams-brokerage-upload.service';

@Controller('api/cams-brokerage-data')
export class CamsBrokerageDataController {
    constructor(
        private readonly camsBrokerageUploadService: CamsBrokerageUploadService,
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

        const count = await this.camsBrokerageUploadService.processAndDumpXls(file.buffer, companyId);
        return { message: `Successfully dumped ${count} records` };
    }
}
