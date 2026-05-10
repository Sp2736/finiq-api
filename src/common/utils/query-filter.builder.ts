/**
 * Query filter builder utility - Handles complex filtering
 */

export interface FilterValue {
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  value: any;
}

export class QueryFilterBuilder {
  /**
   * Build TypeORM where clause from query filters
   * Example: ?filter={"name":{"operator":"like","value":"%john%"}}
   */
  static buildWhereClause(filters: Record<string, any>): Record<string, any> {
    if (!filters || typeof filters !== 'object') {
      return {};
    }

    const where = {};

    for (const [field, config] of Object.entries(filters)) {
      if (typeof config === 'object' && config.operator) {
        const { operator, value } = config as FilterValue;

        switch (operator) {
          case 'eq':
            where[field] = value;
            break;
          case 'ne':
            where[field] = { $ne: value };
            break;
          case 'gt':
            where[field] = { $gt: value };
            break;
          case 'gte':
            where[field] = { $gte: value };
            break;
          case 'lt':
            where[field] = { $lt: value };
            break;
          case 'lte':
            where[field] = { $lte: value };
            break;
          case 'like':
            where[field] = { $regex: value };
            break;
          case 'in':
            where[field] = { $in: Array.isArray(value) ? value : [value] };
            break;
          case 'between':
            if (Array.isArray(value) && value.length === 2) {
              where[field] = { $gte: value[0], $lte: value[1] };
            }
            break;
        }
      } else if (typeof config === 'string' || typeof config === 'number') {
        // Simple equality
        where[field] = config;
      }
    }

    return where;
  }

  /**
   * Parse filter string from query params
   */
  static parseFilters(filterString: string): Record<string, any> {
    if (!filterString) return {};

    try {
      return JSON.parse(filterString);
    } catch (error) {
      return {};
    }
  }

  /**
   * Build sort order for TypeORM
   * Example: ?sort=-created_at,name (- prefix for DESC)
   */
  static buildOrderClause(sortString: string): Record<string, 'ASC' | 'DESC'> {
    if (!sortString) return { created_at: 'DESC' };

    const order = {};
    const fields = sortString.split(',');

    fields.forEach((field) => {
      if (field.startsWith('-')) {
        order[field.substring(1)] = 'DESC';
      } else {
        order[field] = 'ASC';
      }
    });

    return order;
  }
}
