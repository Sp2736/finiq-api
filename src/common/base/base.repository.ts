import { Injectable, Logger } from '@nestjs/common';
import { Repository, FindOptionsWhere, FindOptionsOrder, DeepPartial } from 'typeorm';
import { PaginationParams } from '../types';

/**
 * Generic base repository for reusable database operations
 * Implements common patterns like pagination, filtering, sorting
 */
@Injectable()
export class BaseRepository<Entity extends { id: string | number }> {
  protected logger: Logger;

  constructor(protected repository: Repository<Entity>) {
    this.logger = new Logger(this.constructor.name);
  }

  async findAll(
    pagination?: PaginationParams,
    where?: FindOptionsWhere<Entity>,
    order?: FindOptionsOrder<Entity>,
  ): Promise<[Entity[], number]> {
    try {
      return this.repository.findAndCount({
        where,
        order,
        skip: pagination?.skip || 0,
        take: pagination?.limit || 10,
      });
    } catch (error) {
      this.logger.error(`Error finding entities: ${error.message}`);
      throw error;
    }
  }

  async findOne(where: FindOptionsWhere<Entity>): Promise<Entity | null> {
    try {
      return this.repository.findOne({ where });
    } catch (error) {
      this.logger.error(`Error finding entity: ${error.message}`);
      throw error;
    }
  }

  async findById(id: string | number): Promise<Entity | null> {
    try {
      return this.repository.findOne({ 
        where: { id } as unknown as FindOptionsWhere<Entity>,
      });
    } catch (error) {
      this.logger.error(`Error finding entity by ID: ${error.message}`);
      throw error;
    }
  }

  async create(data: DeepPartial<Entity>): Promise<Entity> {
    try {
      const entity = this.repository.create(data);
      return this.repository.save(entity);
    } catch (error) {
      this.logger.error(`Error creating entity: ${error.message}`);
      throw error;
    }
  }

  async update(id: string | number, data: DeepPartial<Entity>): Promise<Entity | null> {
    try {
      await this.repository.update(
        { id } as unknown as FindOptionsWhere<Entity>,
        data as any,
      );
      return this.findById(id);
    } catch (error) {
      this.logger.error(`Error updating entity: ${error.message}`);
      throw error;
    }
  }

  async delete(id: string | number): Promise<boolean> {
    try {
      const result = await this.repository.delete(
        { id } as unknown as FindOptionsWhere<Entity>,
      );
      return (result.affected ?? 0) > 0;
    } catch (error) {
      this.logger.error(`Error deleting entity: ${error.message}`);
      throw error;
    }
  }

  async count(where?: FindOptionsWhere<Entity>): Promise<number> {
    try {
      return this.repository.count({ where });
    } catch (error) {
      this.logger.error(`Error counting entities: ${error.message}`);
      throw error;
    }
  }
}
