import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CamsBrokerageData } from '../../entities/cams-brokerage-data.entity';
import { CamsInvestorTransaction } from '../../entities/cams-investor-transaction.entity';
import * as xlsx from 'xlsx';

@Injectable()
export class CamsBrokerageUploadService {
    private readonly logger = new Logger(CamsBrokerageUploadService.name);

    constructor(
        @InjectRepository(CamsBrokerageData)
        private readonly repo: Repository<CamsBrokerageData>,
        @InjectRepository(CamsInvestorTransaction)
        private readonly transactionRepo: Repository<CamsInvestorTransaction>,
    ) { }

    async processAndDumpXls(buffer: Buffer, companyId: string): Promise<number> {
        const workbook = xlsx.read(buffer, { type: 'buffer', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet) as any[];

        if (!data.length) {
            throw new Error('No data found in the provided Excel sheet.');
        }

        // Pre-fetch investor IDs to optimize lookups
        const allTrxnNos = data.map(row => this.toString(row['trxn_no'] || row['TRXN_NO'])).filter(Boolean);
        const uniqueTrxnNos = [...new Set(allTrxnNos)];

        const trxnToInv = new Map<string, string>();
        if (uniqueTrxnNos.length) {
            const transRecords = await this.transactionRepo
                .createQueryBuilder('t')
                .select(['t.trxnno', 't.investor_id'])
                .where('t.trxnno IN (:...uniqueTrxnNos)', { uniqueTrxnNos })
                .getMany();
            transRecords.forEach(t => trxnToInv.set(t.trxnno, t.investor_id));
        }

        const recordsToInsert: Partial<CamsBrokerageData>[] = [];

        for (const row of data) {
            const trxnNo = this.toString(row['trxn_no'] || row['TRXN_NO']) || '';
            const mappedRow: Partial<CamsBrokerageData> = {
                company_id: companyId,
                investor_id: (trxnToInv.get(trxnNo) || undefined) as any,
                amc_code: this.toString(row['amc_code'] || row['AMC_CODE']),
                proc_date: this.parseExcelDate(row['proc_date'] || row['PROC_DATE']),
                folio_no: this.toString(row['folio_no'] || row['FOLIO_NO']),
                scheme_code: this.toString(row['scheme_code'] || row['SCHEME_CODE']),
                trxn_type: this.toString(row['trxn_type'] || row['TRXN_TYPE']),
                trxn_no: trxnNo,
                plot_amount: this.parseNumeric(row['plot_amount'] || row['PLOT_AMOUNT']),
                plot_units: this.parseNumeric(row['plot_units'] || row['PLOT_UNITS']),
                post_date: this.parseExcelDate(row['post_date'] || row['POST_DATE']),
                trade_date_time: this.parseExcelDate(row['trade_date_time'] || row['TRADE_DATE_TIME']),
                entry_date: this.parseExcelDate(row['entry_date'] || row['ENTRY_DATE']),
                user_code: this.toString(row['user_code'] || row['USER_CODE']),
                user_trxnno: this.toString(row['user_trxnno'] || row['USER_TRXNNO']),
                trxn_nature: this.toString(row['trxn_nature'] || row['TRXN_NATURE']),
                ter_location: this.toString(row['ter_location'] || row['TER_LOCATION']),
                sys_reg_date: this.parseExcelDate(row['sys_reg_date'] || row['SYS_REG_DATE']),
                aut_txn_no: this.toString(row['aut_txn_no'] || row['AUT_TXN_NO']),
                auto_amount: this.parseNumeric(row['auto_amount'] || row['AUTO_AMOUNT']),
                aut_txn_type: this.toString(row['aut_txn_type'] || row['AUT_TXN_TYPE']),
                cease_date: this.parseExcelDate(row['cease_date'] || row['CEASE_DATE']),
                remed_date: this.parseExcelDate(row['remed_date'] || row['REMED_DATE']),
                forf_date: this.parseExcelDate(row['forf_date'] || row['FORF_DATE']),
                src_brk_code: this.toString(row['src_brk_code'] || row['SRC_BRK_CODE']),
                brok_code: this.toString(row['brok_code'] || row['BROK_CODE']),
                brh_code: this.toString(row['brh_code'] || row['BRH_CODE']),
                sub_brk_arn: this.toString(row['sub_brk_arn'] || row['SUB_BRK_ARN']),
                ae_code: this.toString(row['ae_code'] || row['AE_CODE']),
                arn_emp_code: this.toString(row['arn_emp_code'] || row['ARN_EMP_CODE']),
                euin_opted: this.toString(row['euin_opted'] || row['EUIN_OPTED']),
                euin_valid: this.toString(row['euin_valid'] || row['EUIN_VALID']),
                brk_comm_paid: this.toString(row['brk_comm_paid'] || row['BRK_COMM_PAID']),
                adj_flag: this.toString(row['adj_flag'] || row['ADJ_FLAG']),
                brkage_type: this.toString(row['brkage_type'] || row['BRKAGE_TYPE']),
                brkage_rate: this.parseNumeric(row['brkage_rate'] || row['BRKAGE_RATE']),
                total_upfront: this.parseNumeric(row['total_upfront'] || row['TOTAL_UPFRONT']),
                defer_frequency: this.toString(row['defer_frequency'] || row['DEFER_FREQUENCY']),
                defer_no_of_installment: this.parseNumeric(row['defer_no_of_installment'] || row['DEFER_NO_OF_INSTALLMENT']),
                pay_installment_no: this.parseNumeric(row['pay_installment_no'] || row['PAY_INSTALLMENT_NO']),
                brkage_amt: this.parseNumeric(row['brkage_amt'] || row['BRKAGE_AMT']),
                brkage_from: this.parseExcelDate(row['brkage_from'] || row['BRKAGE_FROM']),
                brkage_to: this.parseExcelDate(row['brkage_to'] || row['BRKAGE_TO']),
                proc_from_date: this.parseExcelDate(row['proc_from_date'] || row['PROC_FROM_DATE']),
                proc_to_date: this.parseExcelDate(row['proc_to_date'] || row['PROC_TO_DATE']),
                trxn_desc: this.toString(row['trxn_desc'] || row['TRXN_DESC']),
                spl_upf_tenure: this.toString(row['spl_upf_tenure'] || row['SPL_UPF_TENURE']),
                upf_tenure_end_date: this.parseExcelDate(row['upf_tenure_end_date'] || row['UPF_TENURE_END_DATE']),
                brk_pay_dt: this.parseExcelDate(row['brk_pay_dt'] || row['BRK_PAY_DT']),
                clw_type: this.toString(row['clw_type'] || row['CLW_TYPE']),
                clw_period: this.toString(row['clw_period'] || row['CLW_PERIOD']),
                rec_flag: this.toString(row['rec_flag'] || row['REC_FLAG']),
                p_si_date: this.parseExcelDate(row['p_si_date'] || row['P_SI_DATE']),
                rec_period: this.toString(row['rec_period'] || row['REC_PERIOD']),
                clw_amt: this.parseNumeric(row['clw_amt'] || row['CLW_AMT']),
                upf_paid: this.parseNumeric(row['upf_paid'] || row['UPF_PAID']),
                fee_id: this.toString(row['fee_id'] || row['FEE_ID']),
                am_code: this.toString(row['am_code'] || row['AM_CODE']),
                am_comm: this.parseNumeric(row['am_comm'] || row['AM_COMM']),
                am_rate: this.parseNumeric(row['am_rate'] || row['AM_RATE']),
                avg_assets: this.parseNumeric(row['avg_assets'] || row['AVG_ASSETS']),
                cam_comm: this.parseNumeric(row['cam_comm'] || row['CAM_COMM']),
                cam_rate: this.parseNumeric(row['cam_rate'] || row['CAM_RATE']),
                mam_comm: this.parseNumeric(row['mam_comm'] || row['MAM_COMM']),
                mam_rate: this.parseNumeric(row['mam_rate'] || row['MAM_RATE']),
                no_of_days: this.parseNumeric(row['no_of_days'] || row['NO_OF_DAYS']),
                brok_gst_state_code: this.toString(row['brok_gst_state_code'] || row['BROK_GST_STATE_CODE']),
                igst_rate: this.parseNumeric(row['igst_rate'] || row['IGST_RATE']),
                cgst_rate: this.parseNumeric(row['cgst_rate'] || row['CGST_RATE']),
                sgst_rate: this.parseNumeric(row['sgst_rate'] || row['SGST_RATE']),
                igst_value: this.parseNumeric(row['igst_value'] || row['IGST_VALUE']),
                cgst_value: this.parseNumeric(row['cgst_value'] || row['CGST_VALUE']),
                sgst_value: this.parseNumeric(row['sgst_value'] || row['SGST_VALUE']),
                remarks: this.toString(row['remarks'] || row['REMARKS']),
                inv_name: this.toString(row['inv_name'] || row['INV_NAME']),
                request_ref_no: this.toString(row['request_ref_no'] || row['REQUEST_REF_NO']),
                brokerage_acrual_month: this.parseExcelDate(row['brokerage_acrual_month'] || row['BROKERAGE_ACRUAL_MONTH']),
            };

            recordsToInsert.push(mappedRow);
        }

        try {
            // We process dumps in chunks to avoid overwhelming the db
            await this.repo.save(recordsToInsert, { chunk: 100 });
            return recordsToInsert.length;
        } catch (e) {
            this.logger.error('Failed to dump cams brokerage data', e);
            throw e;
        }
    }

    private parseExcelDate(val: any): Date | undefined {
        if (val === undefined || val === null || val === '') return undefined;
        if (val instanceof Date) return val;
        if (typeof val === 'number') {
            // Excel serial date to JS Date
            return new Date((val - 25569) * 86400 * 1000);
        }
        const date = new Date(val);
        return isNaN(date.getTime()) ? undefined : date;
    }

    private parseNumeric(val: any): number | undefined {
        if (val === undefined || val === null || val === '') return undefined;
        const num = parseFloat(val);
        return isNaN(num) ? undefined : num;
    }

    private toString(val: any): string | undefined {
        if (val === undefined || val === null || val === '') return undefined;
        return String(val).trim();
    }


}
