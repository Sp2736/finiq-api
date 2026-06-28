import { Injectable, InternalServerErrorException, OnModuleInit } from '@nestjs/common';
import db from '../../lib/db'; // Adjust path to your raw pg pool
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ThemesService implements OnModuleInit {

  /**
   * Auto-migrate: ensure the company_themes table and all required columns exist.
   * This is idempotent and runs once on startup.
   */
  async onModuleInit() {
    try {
      // The company_themes table already exists in production (schema-managed).
      // We only ensure the active_theme_id column exists — safe to run every startup.
      await db.query(`
        ALTER TABLE company_themes
        ADD COLUMN IF NOT EXISTS active_theme_id TEXT DEFAULT NULL
      `);
      console.log('[ThemesService] company_themes schema verified.');
    } catch (err) {
      console.error('[ThemesService] Migration error:', err);
    }
  }

  private parseSavedThemes(val: any): Record<string, any> {
    if (typeof val === 'string') {
      try {
        return JSON.parse(val);
      } catch (e) {
        return {};
      }
    }
    return val || {};
  }

  async getActiveTheme(companyId: string) {
    const query = `
      SELECT theme_name, theme_variables, active_theme_id, saved_themes 
      FROM company_themes 
      WHERE company_id = $1
    `;
    const res = await db.query(query, [companyId]);

    if (res.rows.length === 0) {
      return {
        theme_name: 'System Default',
        theme_variables: {},
        active_theme_id: null,
        saved_themes: {},
      };
    }

    const row = res.rows[0];
    return {
      theme_name: row.theme_name || 'System Default',
      theme_variables: row.theme_variables || {},
      active_theme_id: row.active_theme_id || null,
      saved_themes: this.parseSavedThemes(row.saved_themes),
    };
  }

  async listSavedThemes(companyId: string) {
    const data = await this.getActiveTheme(companyId);
    return Object.values(data.saved_themes || {});
  }

  async saveTheme(
    companyId: string,
    name: string,
    variables: Record<string, string>,
  ) {
    const newThemeId = uuidv4();
    const newTheme = {
      id: newThemeId,
      name,
      variables,
      is_default: false,
      created_at: new Date().toISOString(),
    };

    const query = `
      INSERT INTO company_themes (company_id, saved_themes)
      VALUES ($1, jsonb_build_object($2::text, $3::jsonb))
      ON CONFLICT (company_id) 
      DO UPDATE SET 
        saved_themes = company_themes.saved_themes || jsonb_build_object($2::text, $3::jsonb),
        updated_at   = CURRENT_TIMESTAMP
      RETURNING saved_themes
    `;

    await db.query(query, [companyId, newThemeId, newTheme]);
    return newTheme;
  }

  async updateSavedTheme(
    companyId: string,
    themeId: string,
    variables: Record<string, string>,
    name?: string,
  ) {
    const selectQuery = `SELECT saved_themes FROM company_themes WHERE company_id = $1`;
    const selectRes = await db.query(selectQuery, [companyId]);

    if (selectRes.rows.length === 0) {
      throw new InternalServerErrorException('Theme not found');
    }
    
    const savedThemes = this.parseSavedThemes(selectRes.rows[0].saved_themes);

    if (!savedThemes[themeId]) {
      throw new InternalServerErrorException('Theme not found');
    }

    const theme = { ...savedThemes[themeId] };
    theme.variables = variables;
    if (name) theme.name = name;

    const updateQuery = `
      UPDATE company_themes
      SET 
        saved_themes = saved_themes || jsonb_build_object($2::text, $3::jsonb),
        updated_at   = CURRENT_TIMESTAMP
      WHERE company_id = $1
      RETURNING saved_themes
    `;
    await db.query(updateQuery, [companyId, themeId, theme]);
    return theme;
  }

  async deleteSavedTheme(companyId: string, themeId: string) {
    const query = `
      UPDATE company_themes
      SET
        saved_themes    = saved_themes - $2::text,
        active_theme_id = CASE WHEN active_theme_id = $2 THEN NULL         ELSE active_theme_id  END,
        theme_variables = CASE WHEN active_theme_id = $2 THEN '{}'::jsonb  ELSE theme_variables   END,
        theme_name      = CASE WHEN active_theme_id = $2 THEN 'System Default' ELSE theme_name   END,
        updated_at      = CURRENT_TIMESTAMP
      WHERE company_id = $1
    `;
    await db.query(query, [companyId, themeId]);
  }

  async activateTheme(companyId: string, themeId: string) {
    const selectQuery = `SELECT saved_themes FROM company_themes WHERE company_id = $1`;
    const selectRes = await db.query(selectQuery, [companyId]);

    if (selectRes.rows.length === 0) {
      throw new InternalServerErrorException('Theme not found');
    }
    
    const savedThemes = this.parseSavedThemes(selectRes.rows[0].saved_themes);

    if (!savedThemes[themeId]) {
      throw new InternalServerErrorException('Theme not found');
    }

    const theme = savedThemes[themeId];

    const updateQuery = `
      UPDATE company_themes
      SET 
        theme_variables = $2,
        theme_name      = $3,
        active_theme_id = $4,
        updated_at      = CURRENT_TIMESTAMP
      WHERE company_id = $1
    `;
    await db.query(updateQuery, [companyId, theme.variables, theme.name, themeId]);
  }

  async activateDefault(companyId: string) {
    const updateQuery = `
      UPDATE company_themes
      SET 
        theme_variables = '{}'::jsonb,
        theme_name      = 'System Default',
        active_theme_id = NULL,
        updated_at      = CURRENT_TIMESTAMP
      WHERE company_id = $1
    `;
    await db.query(updateQuery, [companyId]);
  }
}
