import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (Navy / Steel-Blue / White palette)
// ─────────────────────────────────────────────────────────────────────────────
const C = {
    navy: [15, 40, 80] as [number, number, number],
    navyMid: [25, 65, 120] as [number, number, number],
    steel: [52, 100, 163] as [number, number, number],
    steelLight: [220, 232, 247] as [number, number, number],
    accent: [0, 122, 204] as [number, number, number],
    positive: [14, 120, 80] as [number, number, number],
    negative: [180, 35, 35] as [number, number, number],
    white: [255, 255, 255] as [number, number, number],
    offWhite: [248, 250, 253] as [number, number, number],
    border: [200, 215, 235] as [number, number, number],
    textPrimary: [18, 25, 40] as [number, number, number],
    textMuted: [100, 115, 140] as [number, number, number],
    rowAlt: [245, 248, 254] as [number, number, number],
};

const fmt = (num: any): string => {
    const val = Number(num);
    return isNaN(val) ? '0.00' : val.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtDate = (d: any): string => {
    if (!d || d === 'N/A') return '—';
    try { return new Date(d).toLocaleDateString('en-GB'); } catch { return '—'; }
};

const toTitleCase = (str: string): string => {
    if (!str) return '';
    return str.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
};

@Injectable()
export class CapitalGainsExportService {

    public async exportCapitalGains(format: 'pdf' | 'excel', data: any, fy: string, distributorInfo: any): Promise<Buffer> {
        if (format === 'excel') {
            return await this.generateExcel(data, fy);
        } else {
            return this.generatePDF(data, fy, distributorInfo);
        }
    }

    private async generateExcel(data: any, fy: string): Promise<Buffer> {
        const wb = new ExcelJS.Workbook();
        const inv = data.investorDetails;
        const investorNameFormatted = toTitleCase(inv.name);

        const THEME = {
            navy: "FF0F2850",
            navyMid: "FF194178",
            steel: "FF3464A3",
            steelLight: "FFDCE8F7",
            positive: "FF0E7850",
            negative: "FFDC2626",
            white: "FFFFFFFF",
            offWhite: "FFF8FAFD",
            textPrimary: "FF121928",
            textMuted: "FF64738C",
            border: "FFC8D7EB"
        };

        const borderAll = {
            top: { style: 'thin' as const, color: { argb: THEME.border } },
            bottom: { style: 'thin' as const, color: { argb: THEME.border } },
            left: { style: 'thin' as const, color: { argb: THEME.border } },
            right: { style: 'thin' as const, color: { argb: THEME.border } }
        };

        const createSheet = (sheetName: string, funds: any[], isEquity: boolean) => {
            const ws = wb.addWorksheet(sheetName);

            ws.columns = [
                { width: 15 }, { width: 10 }, { width: 15 }, { width: 12 }, { width: 12 },
                { width: 15 }, { width: 12 }, { width: 15 }, { width: 12 }, { width: 12 },
                { width: 15 }, { width: 12 }, { width: 15 }, { width: 15 }, { width: 15 }
            ];

            const applyStyle = (sRow: number, sCol: number, eRow: number, eCol: number, style: any) => {
                for (let r = sRow; r <= eRow; r++) {
                    for (let c = sCol; c <= eCol; c++) {
                        const cell = ws.getCell(r, c);
                        if (style.font) cell.font = { ...cell.font, ...style.font };
                        if (style.fill) cell.fill = style.fill;
                        if (style.border) cell.border = style.border;
                        if (style.alignment) cell.alignment = { ...cell.alignment, ...style.alignment };
                    }
                }
            };

            const r1 = ws.addRow(['Capital Gain Detail Report']).number;
            ws.mergeCells(r1, 1, r1, 15);
            applyStyle(r1, 1, r1, 15, { font: { bold: true, size: 14, color: { argb: THEME.navy } }, alignment: { horizontal: 'right' } });

            const reportMeta = `FY: ${fy.replace('-', ' – ')}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`;
            const r2 = ws.addRow([reportMeta]).number;
            ws.mergeCells(r2, 1, r2, 15);
            applyStyle(r2, 1, r2, 15, { font: { italic: true, size: 10, color: { argb: THEME.textMuted } }, alignment: { horizontal: 'right' } });

            ws.addRow([]);

            const r4 = ws.addRow([investorNameFormatted]).number;
            ws.mergeCells(r4, 1, r4, 15);
            applyStyle(r4, 1, r4, 15, {
                fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.offWhite } },
                font: { bold: true, size: 11, color: { argb: THEME.navy } },
                alignment: { horizontal: 'left' },
                border: { top: borderAll.top, left: borderAll.left, right: borderAll.right }
            });

            const r5 = ws.addRow([`PAN: ${inv.pan}`, '', '', '', '', '', '', '', '', '', '', '', '', `Mobile: ${inv.mobile}`, '']).number;
            ws.mergeCells(r5, 1, r5, 13);
            ws.mergeCells(r5, 14, r5, 15);
            applyStyle(r5, 1, r5, 13, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.offWhite } }, font: { size: 9, color: { argb: THEME.textPrimary } }, alignment: { horizontal: 'left' }, border: { left: borderAll.left } });
            applyStyle(r5, 14, r5, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.offWhite } }, font: { size: 9, color: { argb: THEME.textPrimary } }, alignment: { horizontal: 'right' }, border: { right: borderAll.right } });

            const r6 = ws.addRow([inv.address, '', '', '', '', '', '', '', '', '', '', '', '', `Email: ${inv.email}`, '']).number;
            ws.mergeCells(r6, 1, r6, 13);
            ws.mergeCells(r6, 14, r6, 15);
            applyStyle(r6, 1, r6, 13, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.offWhite } }, font: { size: 9, color: { argb: THEME.textPrimary } }, alignment: { horizontal: 'left' }, border: { bottom: borderAll.bottom, left: borderAll.left } });
            applyStyle(r6, 14, r6, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.offWhite } }, font: { size: 9, color: { argb: THEME.textPrimary } }, alignment: { horizontal: 'right' }, border: { bottom: borderAll.bottom, right: borderAll.right } });

            ws.addRow([]);

            if (funds.length > 0) {
                const rMF = ws.addRow(['Mutual Funds']).number;
                ws.mergeCells(rMF, 1, rMF, 15);
                applyStyle(rMF, 1, rMF, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white }, size: 12 }, alignment: { horizontal: 'left' } });
                ws.addRow([]);

                funds.forEach((mf: any) => {
                    const fundTitle = `${mf.fundName} | Folio No: ${mf.folioNo} | ISIN: ${mf.isin} | Asset Class: ${mf.assetClass}`;
                    const rTitle = ws.addRow([fundTitle]).number;
                    ws.mergeCells(rTitle, 1, rTitle, 15);
                    applyStyle(rTitle, 1, rTitle, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steelLight } }, font: { bold: true, color: { argb: THEME.navy } }, border: borderAll });

                    const rSuper = ws.addRow([
                        'Withdrawal', '', '', '', '', '', '',
                        'Corresponding Subscription', '', '', '', '',
                        'Grandfathered Value',
                        'Profit & Loss', ''
                    ]).number;
                    ws.mergeCells(rSuper, 1, rSuper, 7);
                    ws.mergeCells(rSuper, 8, rSuper, 12);
                    ws.mergeCells(rSuper, 14, rSuper, 15);

                    applyStyle(rSuper, 1, rSuper, 7, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                    applyStyle(rSuper, 8, rSuper, 12, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                    applyStyle(rSuper, 13, rSuper, 13, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderAll });
                    applyStyle(rSuper, 14, rSuper, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });

                    const rSub = ws.addRow([
                        'Sell Date', 'Hold Days', 'Trxn Type', 'Units/Qty', 'Sell NAV', 'Sell Amount', 'STT & Others',
                        'Pur. Date', 'Trxn Type', 'Pur. NAV', 'Net Pur. Amount', 'Stamp Duty',
                        'Cost Acqn.',
                        'Short Term', 'Long Term'
                    ]).number;
                    applyStyle(rSub, 1, rSub, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steel } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle', wrapText: true }, border: borderAll });

                    let totalSell = 0, totalPur = 0, totalST = 0, totalLT = 0;

                    mf.transactions.forEach((tx: any, idx: number) => {
                        totalSell += Number(tx.sellAmount || 0);
                        totalPur += Number(tx.netPurchaseAmount || 0);
                        totalST += Number(tx.shortTermPL || 0);
                        totalLT += Number(tx.longTermPL || 0);

                        const rTx = ws.addRow([
                            fmtDate(tx.sellDate), tx.holdingDays ?? '—', tx.transactionType || 'Redemption', tx.units, tx.sellNav, tx.sellAmount, tx.sttAndOthers,
                            fmtDate(tx.purchaseDate), 'Fresh', tx.purchaseNav, tx.netPurchaseAmount, tx.stampDuty, tx.costAcquisition,
                            tx.shortTermPL, tx.longTermPL
                        ]).number;

                        const rowColor = idx % 2 === 0 ? THEME.white : THEME.offWhite;
                        applyStyle(rTx, 1, rTx, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: rowColor } }, border: borderAll });

                        for (let c = 1; c <= 15; c++) {
                            const align = (c >= 4 && c !== 8 && c !== 9) ? 'right' : 'center';
                            ws.getCell(rTx, c).alignment = { horizontal: align, vertical: 'middle' };

                            if ([4, 5, 6, 7, 10, 11, 12, 13, 14, 15].includes(c)) ws.getCell(rTx, c).numFmt = '#,##0.00';
                        }

                        if (Number(tx.shortTermPL) > 0) ws.getCell(rTx, 14).font = { color: { argb: THEME.positive }, bold: true };
                        else if (Number(tx.shortTermPL) < 0) ws.getCell(rTx, 14).font = { color: { argb: THEME.negative }, bold: true };

                        if (Number(tx.longTermPL) > 0) ws.getCell(rTx, 15).font = { color: { argb: THEME.positive }, bold: true };
                        else if (Number(tx.longTermPL) < 0) ws.getCell(rTx, 15).font = { color: { argb: THEME.negative }, bold: true };
                    });

                    const rTot = ws.addRow(['TOTAL', '', '', '', '', totalSell, '', '', '', '', totalPur, '', '', totalST, totalLT]).number;
                    ws.mergeCells(rTot, 1, rTot, 5);
                    applyStyle(rTot, 1, rTot, 15, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steelLight } }, font: { bold: true, color: { argb: THEME.navy } }, border: borderAll });
                    ws.getCell(rTot, 1).alignment = { horizontal: 'center' };
                    for (let c = 6; c <= 15; c++) {
                        ws.getCell(rTot, c).alignment = { horizontal: 'right' };
                        if ([6, 11, 14, 15].includes(c)) ws.getCell(rTot, c).numFmt = '#,##0.00';
                    }
                    ws.addRow([]);
                });
            }

            if (isEquity && data.capitalGainSummary) {
                const rEq1 = ws.addRow(['Mutual Funds — Period-Wise Capital Gain Summary']).number;
                ws.mergeCells(rEq1, 1, rEq1, 9);
                applyStyle(rEq1, 1, rEq1, 9, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'left' } });

                const rEq2 = ws.addRow(['Investor Name', 'Type', 'Short Term', '', '', 'Long Term', '', '', '']).number;
                ws.mergeCells(rEq2, 1, rEq2 + 1, 1);
                ws.mergeCells(rEq2, 2, rEq2 + 1, 2);
                ws.mergeCells(rEq2, 3, rEq2, 5);
                ws.mergeCells(rEq2, 6, rEq2, 9);

                applyStyle(rEq2, 1, rEq2, 2, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rEq2, 3, rEq2, 5, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rEq2, 6, rEq2, 9, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steel } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });

                const rEq3 = ws.addRow(['', '', 'Buy Value', 'Sell Value', 'P&L', 'Buy Value', 'Sell Value', 'Cost Acqn.', 'P&L']).number;
                applyStyle(rEq3, 3, rEq3, 5, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rEq3, 6, rEq3, 9, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steel } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rEq3, 1, rEq3, 2, { border: borderAll });

                const rEq4 = ws.addRow([
                    investorNameFormatted, 'Purchase on/after 31-Jan-2018',
                    data.capitalGainSummary.shortTerm, data.capitalGainSummary.shortTerm, data.capitalGainSummary.shortTerm,
                    data.capitalGainSummary.longTerm, data.capitalGainSummary.longTerm, 0, data.capitalGainSummary.longTerm
                ]).number;
                applyStyle(rEq4, 1, rEq4, 9, { border: borderAll });
                for (let c = 3; c <= 9; c++) {
                    ws.getCell(rEq4, c).alignment = { horizontal: 'right' };
                    ws.getCell(rEq4, c).numFmt = '#,##0.00';
                }
                ws.addRow([]);

                const rTax1 = ws.addRow([`Mutual Funds Other Taxes Details — FY ${fy.replace('-', ' – ')}`]).number;
                ws.mergeCells(rTax1, 1, rTax1, 13);
                applyStyle(rTax1, 1, rTax1, 13, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'left' } });

                const rTax2 = ws.addRow([
                    'Investor Name', 'Type',
                    'Short Term — Quarter-wise', '', '', '', '',
                    'Long Term — Quarter-wise', '', '', '', '',
                    'Total'
                ]).number;
                ws.mergeCells(rTax2, 1, rTax2 + 1, 1);
                ws.mergeCells(rTax2, 2, rTax2 + 1, 2);
                ws.mergeCells(rTax2, 3, rTax2, 7);
                ws.mergeCells(rTax2, 8, rTax2, 12);
                ws.mergeCells(rTax2, 13, rTax2 + 1, 13);

                applyStyle(rTax2, 1, rTax2, 2, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rTax2, 3, rTax2, 7, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rTax2, 8, rTax2, 12, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steel } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rTax2, 13, rTax2, 13, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navy } }, font: { bold: true, color: { argb: THEME.white } }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });

                const rTax3 = ws.addRow([
                    '', '',
                    'Upto 15-6', '16-6 to 15-9', '16-9 to 15-12', '16-12 to 15-3', '16-3 to 31-3',
                    'Upto 15-6', '16-6 to 15-9', '16-9 to 15-12', '16-12 to 15-3', '16-3 to 31-3',
                    ''
                ]).number;
                applyStyle(rTax3, 3, rTax3, 7, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.navyMid } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rTax3, 8, rTax3, 12, { fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: THEME.steel } }, font: { bold: true, color: { argb: THEME.white }, size: 9 }, alignment: { horizontal: 'center', vertical: 'middle' }, border: borderAll });
                applyStyle(rTax3, 1, rTax3, 2, { border: borderAll });
                applyStyle(rTax3, 13, rTax3, 13, { border: borderAll });

                const rTax4 = ws.addRow([
                    investorNameFormatted, 'Purchase on/after 31-Jan-2018',
                    0, data.capitalGainSummary.shortTerm, 0, 0, 0,
                    0, 0, 0, 0, 0,
                    data.capitalGainSummary.shortTerm + data.capitalGainSummary.longTerm
                ]).number;
                applyStyle(rTax4, 1, rTax4, 13, { border: borderAll });
                for (let c = 3; c <= 13; c++) {
                    ws.getCell(rTax4, c).alignment = { horizontal: 'right' };
                    ws.getCell(rTax4, c).numFmt = '#,##0.00';
                }
                ws.addRow([]);
            }

            const disclaimer = "Disclaimer:\nWe are not tax consultants and nor do we provide any tax or legal advice. You are requested to kindly consult your own tax or professional advisors for any tax or legal matter. The Company or its employees accept no responsibility for any loss suffered by any investor as a result of the information contained in this report.";
            const rowDisc = ws.addRow([disclaimer]);
            rowDisc.height = 65;
            const rDisc = rowDisc.number;
            ws.mergeCells(rDisc, 1, rDisc, 15);
            applyStyle(rDisc, 1, rDisc, 15, { font: { bold: true, size: 12, color: { argb: THEME.negative } }, alignment: { wrapText: true, vertical: 'top' } });
        };

        const equityFunds = data.mutualFunds.filter((mf: any) => String(mf.assetClass).toLowerCase().includes('equity'));
        const otherFunds = data.mutualFunds.filter((mf: any) => !String(mf.assetClass).toLowerCase().includes('equity') && !String(mf.assetClass).toLowerCase().includes('debt'));
        if (otherFunds.length > 0) equityFunds.push(...otherFunds);

        const debtFunds = data.mutualFunds.filter((mf: any) => String(mf.assetClass).toLowerCase().includes('debt'));

        createSheet('Equity Detail', equityFunds, true);
        createSheet('Debt Detail', debtFunds, false);

        const arrayBuffer = await wb.xlsx.writeBuffer();
        return Buffer.from(arrayBuffer);
    }

    private generatePDF(data: any, fy: string, distributorInfo: any): Buffer {
        const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
        const inv = data.investorDetails;
        const investorNameFormatted = toTitleCase(inv.name);
        
        const PW = doc.internal.pageSize.getWidth();
        const PH = doc.internal.pageSize.getHeight();
        const ML = 12;
        const MR = 12;
        const CW = PW - ML - MR;
        let Y = 0;

        const needsPage = (h: number) => {
            if (Y + h > PH - 18) {
                doc.addPage();
                Y = 16;
                return true;
            }
            return false;
        };

        const drawHeader = () => {
            const HEADER_H = 22;
            if (distributorInfo && distributorInfo.logoBase64) {
                doc.addImage(distributorInfo.logoBase64, 'PNG', ML, 5, 24, 16);
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text('Capital Gain Detail Report', PW - MR, 12, { align: 'right' });

            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.textMuted);
            const reportMeta = `FY: ${fy.replace('-', ' – ')}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`;
            doc.text(reportMeta, PW - MR, 17, { align: 'right' });

            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.4);
            doc.line(ML, HEADER_H + 2, PW - MR, HEADER_H + 2);

            Y = HEADER_H + 8;
        };

        const drawInvestorBand = () => {
            const BAND_H = 18;
            doc.setFillColor(...C.offWhite);
            doc.rect(ML, Y, CW, BAND_H, 'F');
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.3);
            doc.rect(ML, Y, CW, BAND_H);

            doc.setFontSize(9);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text(investorNameFormatted, ML + 4, Y + 5.5);

            doc.setFontSize(7.5);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.textPrimary);
            doc.text(`PAN: ${inv.pan}`, ML + 4, Y + 10);
            doc.text(`${inv.address || '—'}`, ML + 4, Y + 14.5);

            doc.setFontSize(7.5);
            doc.setTextColor(...C.textPrimary);
            doc.text(`Mobile: ${inv.mobile}`, PW - MR - 4, Y + 6, { align: 'right' });
            doc.text(`Email: ${inv.email}`, PW - MR - 4, Y + 10.5, { align: 'right' });

            Y += BAND_H + 5;
        };

        const drawGroupTitle = (title: string) => {
            needsPage(12);
            doc.setFillColor(...C.navyMid);
            doc.rect(ML, Y, CW, 8, 'F');

            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.white);
            doc.text(title, ML + 4, Y + 5.5);

            Y += 10;
        };

        const drawFundCard = (mf: any, idx: number) => {
            needsPage(12);
            doc.setFillColor(...C.offWhite);
            doc.setDrawColor(...C.border);
            doc.setLineWidth(0.2);
            doc.rect(ML, Y, CW, 10, 'FD');

            doc.setFillColor(...C.steel);
            doc.rect(ML, Y, 2, 10, 'F');

            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.navy);
            doc.text(`${idx + 1}. ${mf.fundName}`, ML + 5, Y + 4);

            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...C.textMuted);
            doc.text(
                `Folio: ${mf.folioNo}  |  ISIN: ${mf.isin}  |  Asset Class: ${mf.assetClass}`,
                ML + 5, Y + 8,
            );

            Y += 11;
        };

        const drawFundTable = (mf: any) => {
            let totalSell = 0, totalPur = 0, totalST = 0, totalLT = 0;

            const rows = mf.transactions.map((tx: any) => {
                totalSell += Number(tx.sellAmount || 0);
                totalPur += Number(tx.netPurchaseAmount || 0);
                totalST += Number(tx.shortTermPL || 0);
                totalLT += Number(tx.longTermPL || 0);

                const stVal = Number(tx.shortTermPL || 0);
                const ltVal = Number(tx.longTermPL || 0);

                return [
                    fmtDate(tx.sellDate),
                    tx.holdingDays ?? '—',
                    tx.transactionType || 'Redemption',
                    fmt(tx.units),
                    fmt(tx.sellNav),
                    fmt(tx.sellAmount),
                    fmt(tx.sttAndOthers),
                    fmtDate(tx.purchaseDate),
                    'Fresh',
                    fmt(tx.purchaseNav),
                    fmt(tx.netPurchaseAmount),
                    fmt(tx.stampDuty),
                    fmt(tx.costAcquisition),
                    fmt(stVal),
                    fmt(ltVal),
                ];
            });

            rows.push([
                { content: 'TOTAL', colSpan: 5, styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: C.steelLight, textColor: C.navy } },
                { content: fmt(totalSell), styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: C.steelLight, textColor: C.navy } },
                { content: '', styles: { fillColor: C.steelLight } },
                { content: '', colSpan: 3, styles: { fillColor: C.steelLight } },
                { content: fmt(totalPur), styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: C.steelLight, textColor: C.navy } },
                { content: '', styles: { fillColor: C.steelLight } },
                { content: '', styles: { fillColor: C.steelLight } },
                { content: fmt(totalST), styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: C.steelLight, textColor: totalST >= 0 ? C.positive : C.negative } },
                { content: fmt(totalLT), styles: { fontStyle: 'bold', halign: 'right' as const, fillColor: C.steelLight, textColor: totalLT >= 0 ? C.positive : C.negative } },
            ]);

            autoTable(doc, {
                startY: Y,
                margin: { left: ML, right: MR },
                head: [
                    [
                        { content: 'Withdrawal', colSpan: 7, styles: { halign: 'center', fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 7 } },
                        { content: 'Corresponding Subscription', colSpan: 5, styles: { halign: 'center', fillColor: C.navyMid, textColor: C.white, fontStyle: 'bold', fontSize: 7 } },
                        { content: 'Grandfathered Value', colSpan: 1, styles: { halign: 'center', fillColor: C.navy, textColor: C.white, fontStyle: 'bold', fontSize: 6.5 } },
                        { content: 'Profit & Loss', colSpan: 2, styles: { halign: 'center', fillColor: C.navyMid, textColor: C.white, fontStyle: 'bold', fontSize: 7 } },
                    ],
                    [
                        'Sell Date', 'Hold\nDays', 'Txn\nType', 'Units', 'Sell\nNAV', 'Sell\nAmt', 'STT &\nOthers',
                        'Pur.\nDate', 'Txn\nType', 'Pur.\nNAV', 'Net Pur.\nAmt', 'Stamp\nDuty',
                        'Cost\nAcqn.',
                        'Short\nTerm', 'Long\nTerm',
                    ],
                ],
                body: rows,
                theme: 'grid',
                styles: {
                    fontSize: 6.5,
                    cellPadding: { top: 1.5, bottom: 1.5, left: 2, right: 2 },
                    lineColor: C.border,
                    lineWidth: 0.15,
                    textColor: C.textPrimary,
                    font: 'helvetica',
                },
                headStyles: {
                    textColor: C.white,
                    halign: 'center',
                    valign: 'middle',
                    fontStyle: 'bold',
                    fillColor: C.steel,
                    minCellHeight: 6,
                },
                alternateRowStyles: { fillColor: C.rowAlt },
                columnStyles: {
                    0: { halign: 'center' }, 1: { halign: 'center' }, 2: { halign: 'center' },
                    3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' },
                    6: { halign: 'center' }, 7: { halign: 'center' }, 8: { halign: 'right' },
                    9: { halign: 'right' }, 10: { halign: 'right' }, 11: { halign: 'right' },
                    12: { halign: 'right' }, 13: { halign: 'right' }, 14: { halign: 'right' },
                },
                didParseCell: (hookData) => {
                    const { section, column, cell, row } = hookData;
                    if (section === 'body' && row.index < rows.length - 1) {
                        if (column.index === 13 || column.index === 14) {
                            const rawVal = Number(String(cell.raw).replace(/,/g, ''));
                            if (!isNaN(rawVal)) {
                                cell.styles.textColor = rawVal >= 0 ? C.positive : C.negative;
                            }
                        }
                    }
                },
            });

            Y = (doc as any).lastAutoTable.finalY + 6;
        };

        const drawSummaryTable = () => {
            needsPage(50);

            doc.setFillColor(...C.navy);
            doc.rect(ML, Y, CW, 8, 'F');
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.white);
            doc.text('Mutual Funds — Period-Wise Capital Gain Summary', ML + 4, Y + 5.5);
            Y += 10;

            autoTable(doc, {
                startY: Y,
                margin: { left: ML, right: MR },
                head: [
                    [
                        { content: 'Investor Name', rowSpan: 2, styles: { valign: 'middle', fillColor: C.navy, textColor: C.white } },
                        { content: 'Type', rowSpan: 2, styles: { valign: 'middle', fillColor: C.navy, textColor: C.white } },
                        { content: 'Short Term', colSpan: 3, styles: { halign: 'center', fillColor: C.navyMid, textColor: C.white } },
                        { content: 'Long Term', colSpan: 4, styles: { halign: 'center', fillColor: C.steel, textColor: C.white } },
                    ],
                    [
                        { content: 'Buy Value', styles: { fillColor: C.navyMid, textColor: C.white } },
                        { content: 'Sell Value', styles: { fillColor: C.navyMid, textColor: C.white } },
                        { content: 'P&L', styles: { fillColor: C.navyMid, textColor: C.white } },
                        { content: 'Buy Value', styles: { fillColor: C.steel, textColor: C.white } },
                        { content: 'Sell Value', styles: { fillColor: C.steel, textColor: C.white } },
                        { content: 'Cost Acqn.', styles: { fillColor: C.steel, textColor: C.white } },
                        { content: 'P&L', styles: { fillColor: C.steel, textColor: C.white } },
                    ],
                ],
                body: [[
                    investorNameFormatted,
                    'Purchase on/after 31-Jan-2018',
                    fmt(data.capitalGainSummary.shortTerm),
                    fmt(data.capitalGainSummary.shortTerm),
                    fmt(data.capitalGainSummary.shortTerm),
                    fmt(data.capitalGainSummary.longTerm),
                    fmt(data.capitalGainSummary.longTerm),
                    '0.00',
                    fmt(data.capitalGainSummary.longTerm),
                ]],
                theme: 'grid',
                styles: { fontSize: 7, halign: 'right', cellPadding: 2, lineColor: C.border, lineWidth: 0.15 },
                headStyles: { fontStyle: 'bold', fontSize: 7, halign: 'center', valign: 'middle' },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
            });

            Y = (doc as any).lastAutoTable.finalY + 8;
        };

        const drawTaxesTable = () => {
            needsPage(40);

            doc.setFillColor(...C.navy);
            doc.rect(ML, Y, CW, 8, 'F');
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...C.white);
            doc.text(`Mutual Funds Other Taxes Details — FY ${fy.replace('-', ' – ')}`, ML + 4, Y + 5.5);
            Y += 10;

            autoTable(doc, {
                startY: Y,
                margin: { left: ML, right: MR },
                head: [[
                    { content: 'Investor Name', rowSpan: 2, styles: { valign: 'middle', fillColor: C.navy, textColor: C.white } },
                    { content: 'Type', rowSpan: 2, styles: { valign: 'middle', fillColor: C.navy, textColor: C.white } },
                    { content: 'Short Term — Quarter-wise', colSpan: 5, styles: { halign: 'center', fillColor: C.navyMid, textColor: C.white } },
                    { content: 'Long Term — Quarter-wise', colSpan: 5, styles: { halign: 'center', fillColor: C.steel, textColor: C.white } },
                    { content: 'Total', rowSpan: 2, styles: { valign: 'middle', halign: 'center', fillColor: C.navy, textColor: C.white } },
                ], [
                    'Upto 15-6', '16-6 to 15-9', '16-9 to 15-12', '16-12 to 15-3', '16-3 to 31-3',
                    'Upto 15-6', '16-6 to 15-9', '16-9 to 15-12', '16-12 to 15-3', '16-3 to 31-3',
                ]],
                body: [[
                    investorNameFormatted,
                    'Purchase on/after 31-Jan-2018',
                    '0.00', fmt(data.capitalGainSummary.shortTerm), '0.00', '0.00', '0.00',
                    '0.00', '0.00', '0.00', '0.00', '0.00',
                    fmt(data.capitalGainSummary.shortTerm + data.capitalGainSummary.longTerm),
                ]],
                theme: 'grid',
                styles: { fontSize: 6.5, halign: 'right', cellPadding: 1.8, lineColor: C.border, lineWidth: 0.15 },
                headStyles: { fontStyle: 'bold', fontSize: 6.5, halign: 'center', valign: 'middle' },
                columnStyles: { 0: { halign: 'left' }, 1: { halign: 'left' } },
            });

            Y = (doc as any).lastAutoTable.finalY + 12;
        };

        const drawFooters = () => {
            const total = (doc as any).internal.getNumberOfPages();
            for (let i = 1; i <= total; i++) {
                doc.setPage(i);
                doc.setFontSize(7);
                doc.setTextColor(...C.textMuted);
                doc.text(`Page ${i} of ${total}`, PW - MR, PH - 7, { align: 'right' });
            }
        };

        drawHeader();
        drawInvestorBand();

        const equityFunds = data.mutualFunds.filter((mf: any) => String(mf.assetClass).toLowerCase().includes('equity'));
        const debtFunds = data.mutualFunds.filter((mf: any) => String(mf.assetClass).toLowerCase().includes('debt'));
        const otherFunds = data.mutualFunds.filter((mf: any) => !String(mf.assetClass).toLowerCase().includes('equity') && !String(mf.assetClass).toLowerCase().includes('debt'));

        const renderGroup = (title: string, funds: any[]) => {
            if (funds.length === 0) return;
            drawGroupTitle(title);
            funds.forEach((mf, i) => {
                drawFundCard(mf, i);
                drawFundTable(mf);
            });
        };

        renderGroup('EQUITY ASSETS', equityFunds);
        renderGroup('DEBT ASSETS', debtFunds);
        if (otherFunds.length > 0) renderGroup('OTHER ASSETS', otherFunds);

        if (data.capitalGainSummary) {
            doc.addPage();
            drawHeader();
            Y = 26;
            drawSummaryTable();
            drawTaxesTable();
        }

        const disclaimerText = "Disclaimer:\nWe are not tax consultants and nor do we provide any tax or legal advice. You are requested to kindly consult your own tax or professional\nadvisors for any tax or legal matter. The Company or its employees accept no responsibility for any loss suffered by any investor as a result of\nthe information contained in this report.";
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(220, 38, 38);
        const lines = doc.splitTextToSize(disclaimerText, CW);
        doc.text(lines, ML, Y);

        drawFooters();

        // Output as Buffer instead of triggering a download
        const arrayBuffer = doc.output('arraybuffer');
        return Buffer.from(arrayBuffer);
    }
}
