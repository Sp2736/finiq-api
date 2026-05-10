import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { KarvyBrokerageData, KarvyInvestorTransaction, Investor } from '../../entities';
import * as xlsx from 'xlsx';
import moment from 'moment';
import { In } from 'typeorm';

@Injectable()
export class KarvyBrokerageUploadService {
    private readonly logger = new Logger(KarvyBrokerageUploadService.name);

    constructor(
        @InjectRepository(KarvyBrokerageData)
        private readonly repo: Repository<KarvyBrokerageData>,
        @InjectRepository(KarvyInvestorTransaction)
        private readonly transactionRepo: Repository<KarvyInvestorTransaction>,
        @InjectRepository(Investor)
        private readonly investorRepo: Repository<Investor>,
    ) { }

    async processAndDump(buffer: Buffer, companyId: string): Promise<number> {
        const workbook = xlsx.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const data = xlsx.utils.sheet_to_json(sheet, { raw: false }) as any[];

        if (!data.length) {
            throw new Error('No data found in the provided file.');
        }

        const recordsToInsert: Partial<KarvyBrokerageData>[] = [];

        for (const row of data) {
            const mappedRow: Partial<KarvyBrokerageData> = {
                company_id: companyId,
                investor_id: row['investor_id'] || undefined,
                product_code: this.toString(row['Product Code']),
                fund_description: this.toString(row['Fund Description']),
                fund: this.toString(row['Fund']),
                scheme: this.toString(row['Scheme']),
                plan: this.toString(row['Plan']),
                option: this.toString(row['Option']),
                account_number: this.toString(row['Account Number']),
                application_number: this.toString(row['Application Number']),
                investor_name: this.toString(row['Investor Name']),
                address_1: this.toString(row['Address #1']),
                address_2: this.toString(row['Address #2']),
                address_3: this.toString(row['Address #3']),
                city: this.toString(row['City']),
                pincode: this.toString(row['Pincode']),
                transaction_description: this.toString(row['Transaction Description']),
                from_date: this.parseDate(row['From Date']),
                to_date: this.parseDate(row['To Date']),
                amount_in_rs: this.parseNumeric(row['Amount (in Rs.)']),
                units: this.parseNumeric(row['Units']),
                transaction_date: this.parseDate(row['Transaction Date']),
                process_date: this.parseDate(row['Process Date']),
                percentage_pct: this.parseNumeric(row['Percentage (%)']),
                brokerage_in_rs: this.parseNumeric(row['Brokerage (in Rs.)']),
                sub_broker: this.toString(row['Sub-Broker']),
                account_type: this.parseNumeric(row['Account Type']),
                brokerage_head: this.toString(row['Brokerage Head']),
                transaction_number: this.toString(row['Transaction Number']),
                branch_code: this.toString(row['Branch Code']),
                cheque_number: this.toString(row['Cheque Number']),
                starting_date: this.parseDate(row['Starting Date']),
                ending_date: this.parseDate(row['Ending Date']),
                warrant_number: this.toString(row['Warrant Number']),
                warrant_date: this.parseDate(row['Warrant Date']),
                daily_product: this.parseNumeric(row['Daily Product']),
                cumulative_nav: this.parseNumeric(row['Cumulative NAV']),
                average_assets: this.parseNumeric(row['Average Assets']),
                transaction_id: this.toString(row['Transaction ID']),
                scheme_code: this.toString(row['Scheme Code']),
                transaction_head: this.toString(row['Transaction Head']),
                fee_type: this.toString(row['Fee Type']),
                adjustment_flag: this.toString(row['Adjustment Flag']),
                switch_flag: this.toString(row['Switch Flag']),
                brokerage_type: this.toString(row['Brokerage Type']),
                grossbrokerage: this.parseNumeric(row['GrossBrokerage']),
                sttamount: this.parseNumeric(row['STTAmount']),
                educessamount: this.parseNumeric(row['EducessAmount']),
                broker_code: this.toString(row['Broker Code']),
                valuedate: this.toString(row['ValueDate']),
                dpid: this.toString(row['DPID'] || row['dpid']),
                clientid: this.toString(row['Clientid'] || row['clientid']),
                ihno: this.parseNumeric(row['IHNO'] || row['ihno']),
                prxybranch: this.toString(row['prxybranch']),
                invcityname: this.toString(row['InvCityName']),
                invcitycategory: this.toString(row['InvCityCategory']),
                navdate: this.parseDate(row['NavDate']),
                trantypecode: this.toString(row['TranTypeCode']),
                assettype: this.toString(row['AssetType']),
                redtrdt: this.parseDate(row['RedTrdt']),
                redtrno: this.parseNumeric(row['RedTrno']),
                redtrtype: this.toString(row['RedTrtype']),
                redbranch: this.toString(row['RedBranch']),
                redunits: this.parseNumeric(row['Redunits']),
                redamt: this.parseNumeric(row['RedAmt']),
                recoverytype: this.toString(row['Recoverytype']),
                recoveryremarks: this.toString(row['RecoveryRemarks']),
                invpan: this.toString(row['InvPAN']),
                brkpan: this.toString(row['BrkPAN']),
                euin: this.toString(row['EUIN']),
                benacno: this.toString(row['BENacno']),
                redcrunits: this.parseNumeric(row['Redcrunits']),
                clbperiod: this.parseNumeric(row['CLBperiod']),
                clbslabmaxperiod: this.parseNumeric(row['CLBslabmaxperiod']),
                clbfromdt: this.toString(row['CLBFromdt']),
                clbdays: this.parseNumeric(row['CLBDays']),
                purbroktype: this.toString(row['purbroktype']),
                purnetamt: this.parseNumeric(row['purnetamt']),
                inwardno: this.toString(row['Inwardno']),
                subtrtype: this.toString(row['subtrtype']),
                pur_gross_amount: this.parseNumeric(row['Pur Gross Amount']),
                sipregdate: this.parseDate(row['SipRegDate']),
                agentcity: this.toString(row['AgentCity']),
                agentstate: this.toString(row['AgentState']),
                agentbranch: this.toString(row['AgentBranch']),
                amccity: this.toString(row['AMCCity']),
                amcstate: this.toString(row['AMCState']),
                cgstrate: this.parseNumeric(row['CGSTRate']),
                cgstamt: this.parseNumeric(row['CGSTAmt']),
                sgstrate: this.parseNumeric(row['SGSTRate']),
                sgstamt: this.parseNumeric(row['SGSTAmt']),
                igstrate: this.parseNumeric(row['IGSTRate']),
                igstamt: this.parseNumeric(row['IGSTAmt']),
                ugstrate: this.parseNumeric(row['UGSTRate']),
                ugstamt: this.parseNumeric(row['UGSTAmt']),
                totgstrate: this.parseNumeric(row['TotGSTRate']),
                totgstamt: this.parseNumeric(row['TotGSTAmt']),
                gstamcschemeflag: this.toString(row['GSTAMCSchemeFlag']),
                gstregno: this.toString(row['GSTRegNo']),
                paymentdt: this.toString(row['PaymentDt']),
                amc_scheme_bifurcation_gst_reg_number: this.toString(row['AMC/Scheme Bifurcation GST Reg Number']),
                gst_applicable_flag_for_transaction: this.toString(row['GST Applicable Flag for transaction']),
                purchase_trxn_type: this.toString(row['PURCHASE TRXN TYPE']),
                purchase_trxn_no: this.parseNumeric(row['PURCHASE TRXN_NO']),
                investor_category: this.toString(row['Investor Category']),
                purchase_trxn_unit: this.parseNumeric(row['PURCHASE TRXN UNIT']),
                purchase_trxn_date: this.parseDate(row['PURCHASE TRXN DATE']),
                purchase_trxn_amt: this.parseNumeric(row['PURCHASE TRXN AMT']),
            };

            recordsToInsert.push(mappedRow);
        }

        // Map investor_id from Investor table using PAN (invpan)
        const pans = recordsToInsert
            .map(r => r.invpan)
            .filter(Boolean) as string[];

        if (pans.length > 0) {
            const uniquePans = [...new Set(pans)];
            const investors = await this.investorRepo.find({
                where: { pan: In(uniquePans) },
                select: { id: true, pan: true }
            });

            const panMap = new Map<string, string>();
            investors.forEach(inv => panMap.set(inv.pan, inv.id));

            for (const record of recordsToInsert) {
                if (!record.investor_id && record.invpan) {
                    record.investor_id = panMap.get(record.invpan);
                }
            }
        }

        try {
            await this.repo.save(recordsToInsert, { chunk: 100 });
            return recordsToInsert.length;
        } catch (e) {
            this.logger.error('Failed to dump karvy brokerage data', e);
            throw e;
        }
    }

    private parseDate(val: any): any {
        if (val === undefined || val === null || val === '') return undefined;

        const dateStr = String(val).trim();
        const formats = ['DD/MM/YYYY', 'D/M/YYYY', 'DD/MM/YY', 'D/M/YY'];
        const m = moment(dateStr, formats, true);

        if (!m.isValid()) {
            throw new Error(`Invalid date format for value "${dateStr}". Expected DD/MM/YYYY, D/M/YYYY, DD/MM/YY, or D/M/YY format.`);
        }

        return m.format('YYYY-MM-DD');
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
