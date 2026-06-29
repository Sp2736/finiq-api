import { Injectable, Logger } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (Navy / Steel-Blue / White palette)
// Kept identical to capital-gains-export.service.ts so every PDF export in
// the app shares the same visual language.
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  navy: [15, 40, 80] as [number, number, number],
  steel: [52, 100, 163] as [number, number, number],
  steelLight: [220, 232, 247] as [number, number, number],
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
  return isNaN(val)
    ? '0.00'
    : val.toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
};

const fmtDate = (d: any): string => {
  if (!d || d === 'N/A') return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB');
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

@Injectable()
export class TransactionsExportService {
  private readonly logger = new Logger(TransactionsExportService.name);

  /**
   * Builds the Transactions Report PDF buffer from the exact snake_case
   * payload returned by InvestorsHoldingsService.getTransactionReport():
   *   { investor_name, mobile_no, email, transactions: [...] }
   */
  public generatePDF(data: any, distributorInfo?: any): Buffer {
    // Landscape to comfortably fit the detailed transaction columns
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    let parsedData = data;
    if (Array.isArray(data)) {
      parsedData = {
        investor_name: data[0]?.investor_name || 'Investor',
        mobile_no: data[0]?.mobile_no,
        email: data[0]?.email,
        transactions: data,
      };
    }

    const rawName = parsedData?.investor_name || 'Investor';
    const investorNameFormatted = toTitleCase(rawName);
    const transactions: any[] = Array.isArray(parsedData?.transactions)
      ? parsedData.transactions
      : [];

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

      if (distributorInfo?.logoBase64) {
        let logoData = distributorInfo.logoBase64;
        if (!logoData.startsWith('data:image')) {
          logoData = `data:image/png;base64,${logoData}`;
        }
        try {
          doc.addImage(logoData, 'PNG', ML, 5, 48, 16);
        } catch (err) {
          this.logger.warn(`Could not render distributor logo: ${err}`);
        }
      }

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text('Mutual Fund Transactions Report', PW - MR, 12, {
        align: 'right',
      });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.textMuted);
      doc.text(
        `Generated: ${new Date().toLocaleDateString('en-GB')}`,
        PW - MR,
        17,
        { align: 'right' },
      );

      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.4);
      doc.line(ML, HEADER_H + 2, PW - MR, HEADER_H + 2);

      Y = HEADER_H + 8;
    };

    const drawInvestorBand = () => {
      const BAND_H = 16;
      doc.setFillColor(...C.offWhite);
      doc.rect(ML, Y, CW, BAND_H, 'F');
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(ML, Y, CW, BAND_H);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(investorNameFormatted, ML + 4, Y + 6);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.textPrimary);
      doc.text(`Total Records: ${transactions.length}`, ML + 4, Y + 11.5);

      // Right-aligned contact block, matching capital-gains-export's band layout
      doc.text(`Mobile: ${data?.mobile_no || 'N/A'}`, PW - MR - 4, Y + 6, {
        align: 'right',
      });
      doc.text(`Email: ${data?.email || 'N/A'}`, PW - MR - 4, Y + 11.5, {
        align: 'right',
      });

      Y += BAND_H + 5;
    };

    const drawEmptyState = () => {
      needsPage(20);
      doc.setFillColor(...C.offWhite);
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(ML, Y, CW, 18, 'FD');

      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(...C.textMuted);
      doc.text(
        'No transactions were found for this investor.',
        ML + CW / 2,
        Y + 10,
        { align: 'center' },
      );
      Y += 18 + 8;
    };

    const drawTable = () => {
      const rows = transactions.map((tx: any) => [
        fmtDate(tx.transaction_date),
        toTitleCase(tx.transaction_type) || '—',
        tx.fund_description || '—',
        tx.folio_number || '—',
        fmt(tx.amount),
        fmt(tx.nav),
        fmt(tx.units),
        fmt(tx.current_amount),
        tx.rta || '—',
      ]);

      autoTable(doc, {
        startY: Y,
        margin: { left: ML, right: MR },
        head: [
          [
            'Date',
            'Type',
            'Fund Description',
            'Folio Number',
            'Amount (Rs)',
            'NAV',
            'Units',
            'Current Amt (Rs)',
            'RTA',
          ],
        ],
        body: rows,
        theme: 'grid',
        styles: {
          fontSize: 7.5,
          cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
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
          fillColor: C.navy,
        },
        alternateRowStyles: { fillColor: C.rowAlt },
        columnStyles: {
          0: { halign: 'center', cellWidth: 20 },
          1: { halign: 'center', cellWidth: 22 },
          2: { halign: 'left', cellWidth: 'auto' },
          3: { halign: 'center', cellWidth: 25 },
          4: { halign: 'right', cellWidth: 22 },
          5: { halign: 'right', cellWidth: 15 },
          6: { halign: 'right', cellWidth: 15 },
          7: { halign: 'right', cellWidth: 22 },
          8: { halign: 'center', cellWidth: 15 },
        },
      });

      Y = (doc as any).lastAutoTable.finalY + 6;
    };

    const drawTotalsBand = () => {
      needsPage(14);

      const totalAmount = transactions.reduce(
        (sum, tx) => sum + (Number(tx.amount) || 0),
        0,
      );
      const totalUnits = transactions.reduce(
        (sum, tx) => sum + (Number(tx.units) || 0),
        0,
      );
      const totalCurrentAmount = transactions.reduce(
        (sum, tx) => sum + (Number(tx.current_amount) || 0),
        0,
      );

      doc.setFillColor(...C.navy);
      doc.rect(ML, Y, CW, 10, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(
        `Total Amount: Rs ${fmt(totalAmount)}      |      Net Units: ${fmt(totalUnits)}      |      Current Value: Rs ${fmt(totalCurrentAmount)}`,
        ML + 4,
        Y + 6.5,
      );

      Y += 10 + 6;
    };

    const drawFooters = () => {
      const totalPages = (doc as any).internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...C.textMuted);
        doc.text(`Page ${i} of ${totalPages}`, PW - MR, PH - 7, {
          align: 'right',
        });
      }
    };

    try {
      doc.setProperties({
        title: `${investorNameFormatted} - Transactions Report`,
      });
    } catch {
      // Non-critical; ignore if jsPDF version doesn't support it.
    }

    drawHeader();
    drawInvestorBand();

    if (transactions.length === 0) {
      drawEmptyState();
    } else {
      drawTable();
      drawTotalsBand();
    }

    drawFooters();

    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }
}
