import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KarvySchemeDetail } from 'src/entities';
import * as xlsx from 'xlsx';
import { logAndSanitize } from '../../common/utils/safe-error';

@Injectable()
export class KarvySchemeDetailsService {
    private readonly logger = new Logger(KarvySchemeDetailsService.name);

    constructor(
        @InjectRepository(KarvySchemeDetail)
        private readonly schemeRepo: Repository<KarvySchemeDetail>,
    ) { }

    async processFile(buffer: Buffer): Promise<{ totalProcessed: number; newRecords: number; updated: number }> {
        try {
            const workbook = xlsx.read(buffer, { type: 'buffer' });
            if (!workbook.SheetNames.length) {
                throw new BadRequestException('No sheets found in the provided Excel/CSV file.');
            }

            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data: any[] = xlsx.utils.sheet_to_json(worksheet, { defval: null });

            if (!data || data.length === 0) {
                return { totalProcessed: 0, newRecords: 0, updated: 0 };
            }

            this.logger.debug(`Extracted ${data.length} rows from file.`);

            let newRecords = 0;
            let updated = 0;

            const batchSize = 1000;
            const entriesMap = new Map<string, any>();

            for (const row of data) {
                // Ensure product code is valid. "Product Code" in header usually
                // The keys will be the exact headers from Excel
                const getVal = (possibleKeys: string[]) => {
                    for (const key of possibleKeys) {
                        if (row[key] !== undefined) return row[key] ? String(row[key]) : null;
                    }
                    return null;
                };

                const prodCode = getVal(['Product Code']);
                if (!prodCode) continue;

                // Let's create an entity payload
                const payload = {
                    product_code: prodCode,
                    amc_code: getVal(['AMC Code']),
                    amc_name: getVal(['AMC Name']),
                    scheme_code: getVal(['Scheme Code']),
                    scheme_description: getVal(['Scheme Description']),
                    plan_code: getVal(['Plan Code']),
                    plan_description: getVal(['Plan Description']),
                    option_code: getVal(['Option Code']),
                    option_description: getVal(['Option Description']),
                    nature: getVal(['Nature']),
                    fund_type: getVal(['Fund Type']),
                    nfo_start_date: getVal(['NFO Start Date']),
                    nfo_end_date: getVal(['NFO End Date']),
                    open_date: getVal(['Open Date']),
                    close_date: getVal(['Close Date']),
                    isin_number: getVal(['ISIN Number']),
                    isin_type: getVal(['ISIN Type']),
                    purchased_allowed: getVal(['Purchased Allowed']),
                    ipo_amount: parseFloat(getVal(['IPO Amount']) || '0') || null,
                    ipo_min_amount: parseFloat(getVal(['IPO Min Amount']) || '0') || null,
                    ipo_multiple_amount: parseFloat(getVal(['IPO Multiple Amount']) || '0') || null,
                    new_purchase_amount: parseFloat(getVal(['New Purchase Amount']) || '0') || null,
                    new_purchase_multiple_amount: parseFloat(getVal(['New Purchase Multiple Amount']) || '0') || null,
                    nri_new_min_amount: parseFloat(getVal(['NRI New Min Amount']) || '0') || null,
                    nri_new_multiple_amount: parseFloat(getVal(['NRI New Multiple Amount']) || '0') || null,
                    add_purchase_amount: parseFloat(getVal(['Add Purchase Amount']) || '0') || null,
                    add_purchase_multiple_amount: parseFloat(getVal(['Add Purchase Multiple Amount']) || '0') || null,
                    redemption_allowed: getVal(['Redemption Allowed']),
                    redemption_min_amount: parseFloat(getVal(['Redemption Min Amount']) || '0') || null,
                    redemption_multiple_amount: parseFloat(getVal(['Redemption Multiple Amount']) || '0') || null,
                    redemption_min_units: parseFloat(getVal(['Redemption Min Units']) || '0') || null,
                    redemption_multiple_units: parseFloat(getVal(['Redemption Multiple Units']) || '0') || null,
                    switch_in_allowed: getVal(['Switch In Allowed']),
                    switch_out_allowed: getVal(['Switch Out Allowed']),
                    switch_out_min_amount: parseFloat(getVal(['Switch Out Min Amount']) || '0') || null,
                    switch_in_min_amount: parseFloat(getVal(['Switch In Min Amount']) || '0') || null,
                    lateral_in_allowed: getVal(['Lateral In Allowed']),
                    lateral_out_allowed: getVal(['Lateral Out Allowed']),
                    stp_in_allowed: getVal(['STP In Allowed']),
                    stp_out_allowed: getVal(['STP Out Allowed']),
                    stp_frequency: getVal(['STP Frequency']),
                    stp_min_amount: parseFloat(getVal(['STP Min Amount']) || '0') || null,
                    stp_dates: getVal(['STP Dates']),
                    sip_allowed: getVal(['SIP Allowed']),
                    sip_min_amount: parseFloat(getVal(['SIP Min Amount']) || '0') || null,
                    sip_dates: getVal(['SIP Dates']),
                    sip_frequency: getVal(['SIP Frequency']),
                    swp_in_allowed: getVal(['SWP In Allowed']),
                    swp_out_allowed: getVal(['SWP Out Allowed']),
                    swp_frequency: getVal(['SWP Frequency']),
                    swp_min_amount: parseFloat(getVal(['SWP Min Amount']) || '0') || null,
                    swp_dates: getVal(['SWP Dates']),
                    load_details: getVal(['Load Details']),
                    purchase_cutoff_time: getVal(['Purchase Cutoff Time']),
                    redemption_cutoff_time: getVal(['Redemption Cutoff Time']),
                    switch_cutoff_time: getVal(['Switch Cutoff Time']),
                    maturity_date: getVal(['Maturity Date']),
                    re_open_date: getVal(['Re-Open Date']),
                    nfo_face_value: getVal(['NFO Face Value']),
                    demat_allowed: getVal(['Demat Allowed']),
                    risk_type: getVal(['Risk Type']),
                    allotment_date: getVal(['Allotment Date']),
                    last_update_date: getVal(['Last Update Date'])
                };

                entriesMap.set(payload.product_code, payload);
            }

            const entriesToSave = Array.from(entriesMap.values());

            // Using standard typeorm repository `upsert` or find + save for safe insertion
            for (let i = 0; i < entriesToSave.length; i += batchSize) {
                const batch = entriesToSave.slice(i, i + batchSize);

                await this.schemeRepo.createQueryBuilder()
                    .insert()
                    .into(KarvySchemeDetail)
                    .values(batch)
                    .orUpdate(
                        // list columns to update on conflict
                        Object.keys(entriesToSave[0]).filter(k => k !== 'product_code'),
                        ['product_code'],
                        { skipUpdateIfNoValuesChanged: true }
                    )
                    .execute();
            }

            this.logger.log(`Successfully processed Karvy Scheme Info. Total Rows: ${entriesToSave.length}`);
            return {
                totalProcessed: entriesToSave.length,
                newRecords: entriesToSave.length, // upsert doesn't cleanly return new vs existing in mysql/pg always
                updated: entriesToSave.length
            };

        } catch (error) {
            throw new BadRequestException(
                logAndSanitize(this.logger, 'Error processing Karvy Scheme Excel', error, 'Failed to parse file. Please try again.')
            );
        }
    }
}
