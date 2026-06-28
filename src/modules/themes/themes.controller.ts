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
    // Priority 1: Extract from roles[] (real company_id from user_profiles table)
    // This is reliable for staff users in multi-tenant setups.
    const companyIdFromRoles =
      req.user?.roles?.find((r: any) => r.company_id)?.company_id;

    // Priority 2: Top-level claim (reliable for investors; hardcoded fallback for staff)
    const companyIdDirect = req.user?.company_id;

    const companyId = companyIdFromRoles || companyIdDirect;

    if (!companyId) {
      throw new Error(
        `Cannot resolve company_id. type=${req.user?.type}, id=${req.user?.id}`,
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
