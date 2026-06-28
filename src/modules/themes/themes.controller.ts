import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ThemesService } from './themes.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CreateThemeDto } from './dto/create-theme.dto';
import { UpdateThemeDto } from './dto/update-theme.dto';

@Controller('api/themes')
@UseGuards(JwtAuthGuard)
@UsePipes(new ValidationPipe({ whitelist: true }))
export class ThemesController {
  constructor(private readonly themesService: ThemesService) {}

  private getCompanyId(req: any): string {
    const companyId =
      req.user?.company_id ||
      req.user?.roles?.find((r: any) => r.company_id)?.company_id;

    if (!companyId) {
      throw new Error(
        `Could not extract company_id from token. User type: ${req.user?.type}, id: ${req.user?.id}`,
      );
    }
    return companyId;
  }

  @Get('active')
  async getActiveTheme(@Request() req) {
    return this.themesService.getActiveTheme(this.getCompanyId(req));
  }

  @Get('saved')
  async listSavedThemes(@Request() req) {
    return this.themesService.listSavedThemes(this.getCompanyId(req));
  }

  @Post('saved')
  async saveTheme(
    @Request() req,
    @Body() body: CreateThemeDto,
  ) {
    return this.themesService.saveTheme(
      this.getCompanyId(req),
      body.name,
      body.variables,
    );
  }

  @Put('saved/:id')
  async updateSavedTheme(
    @Request() req,
    @Param('id') id: string,
    @Body() body: UpdateThemeDto,
  ) {
    return this.themesService.updateSavedTheme(
      this.getCompanyId(req),
      id,
      body.variables,
      body.name,
    );
  }

  @Delete('saved/:id')
  async deleteSavedTheme(@Request() req, @Param('id') id: string) {
    return this.themesService.deleteSavedTheme(this.getCompanyId(req), id);
  }

  @Put('activate/:id')
  async activateTheme(@Request() req, @Param('id') id: string) {
    await this.themesService.activateTheme(this.getCompanyId(req), id);
    return { success: true };
  }

  @Put('activate-default')
  async activateDefault(@Request() req) {
    await this.themesService.activateDefault(this.getCompanyId(req));
    return { success: true };
  }
}
