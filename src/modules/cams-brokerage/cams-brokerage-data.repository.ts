
import { DataSource, Repository } from 'typeorm';
import { Injectable } from '@nestjs/common';
import { CamsBrokerageData } from '../../entities/cams-brokerage-data.entity';

@Injectable()
export class CamsBrokerageDataRepository extends Repository<CamsBrokerageData> {
    constructor(private dataSource: DataSource) {
        super(CamsBrokerageData, dataSource.createEntityManager());
    }
}
