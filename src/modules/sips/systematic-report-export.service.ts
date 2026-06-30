import { Injectable, Logger } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS (Navy / Steel-Blue / White palette)
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
  if (!d || String(d).startsWith('2999') || String(d).startsWith('2099')) return '—';
  const date = new Date(d);
  if (isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(' ');
};

const getStatus = (item: any): string => {
  const now = new Date();
  if (item.termination_date) {
    return 'Terminated';
  }
  if (item.end_date && new Date(item.end_date) < now) {
    return 'Expired';
  }
  return 'Running';
};

export interface SystematicReportExportOpts {
  type: string;
  investorLabel: string;
  groupBy: string;
}

@Injectable()
export class SystematicReportExportService {
  private readonly logger = new Logger(SystematicReportExportService.name);

  public generatePDF(data: any[], opts: SystematicReportExportOpts, distributorInfo?: any): Buffer {
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

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
      doc.text('Systematic Transactions Report', PW - MR, 12, {
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

    const drawContactBand = () => {
      const BAND_H = 16;
      doc.setFillColor(...C.offWhite);
      doc.rect(ML, Y, CW, BAND_H, 'F');
      doc.setDrawColor(...C.border);
      doc.setLineWidth(0.3);
      doc.rect(ML, Y, CW, BAND_H);

      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.navy);
      doc.text(opts.investorLabel, ML + 4, Y + 6);

      doc.setFontSize(7.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...C.textPrimary);
      doc.text(`Total Records: ${data.length}  |  Type: ${opts.type}  |  Group By: ${opts.groupBy}`, ML + 4, Y + 11.5);

      if (distributorInfo) {
        if (distributorInfo.name) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(...C.navy);
          doc.text(distributorInfo.name, PW - MR - 4, Y + 6, { align: 'right' });
        }
        
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...C.textPrimary);
        
        let contactStr: string[] = [];
        if (distributorInfo.phone) contactStr.push(`Ph: ${distributorInfo.phone}`);
        if (distributorInfo.email) contactStr.push(`Email: ${distributorInfo.email}`);
        
        if (contactStr.length > 0) {
          doc.text(contactStr.join('  |  '), PW - MR - 4, Y + 11.5, { align: 'right' });
        }
      }

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
        'No systematic transactions were found for the selected criteria.',
        ML + CW / 2,
        Y + 10,
        { align: 'center' },
      );
      Y += 18 + 8;
    };

    const drawGroupSummary = () => {
      const groups: Record<string, { count: number; totalAmount: number }> = {};
      
      data.forEach((item) => {
        let key = "Unknown";
        if (opts.groupBy === "Client")
          key = toTitleCase(item.investor_name || "Unknown Client");
        else if (opts.groupBy === "AMC") key = item.amc_name || "Unknown AMC";
        else if (opts.groupBy === "Scheme")
          key = item.scheme_name || "Unknown Scheme";
        else if (opts.groupBy === "Registrar")
          key = item.source || "Unknown Registrar";

        if (!groups[key]) groups[key] = { count: 0, totalAmount: 0 };
        groups[key].count += 1;
        groups[key].totalAmount += Number(item.amount) || 0;
      });

      const groupedData = Object.entries(groups)
        .map(([name, data]) => ({
          groupName: name,
          count: data.count,
          totalAmount: data.totalAmount,
        }))
        .sort((a, b) => b.totalAmount - a.totalAmount);

      const rows = groupedData.map((g) => [
        g.groupName,
        String(g.count),
        fmt(g.totalAmount),
      ]);

      autoTable(doc, {
        startY: Y,
        margin: { left: ML, right: MR },
        head: [[opts.groupBy, 'No. of Mandates', 'Total Amount (Rs)']],
        body: rows,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: { top: 3, bottom: 3, left: 3, right: 3 },
          lineColor: C.border,
          lineWidth: 0.15,
          textColor: C.textPrimary,
          font: 'helvetica',
        },
        headStyles: {
          textColor: C.white,
          halign: 'left',
          valign: 'middle',
          fontStyle: 'bold',
          fillColor: C.navy,
        },
        alternateRowStyles: { fillColor: C.rowAlt },
        columnStyles: {
          0: { halign: 'left', cellWidth: 'auto', fontStyle: 'bold' },
          1: { halign: 'right', cellWidth: 40 },
          2: { halign: 'right', cellWidth: 50, fontStyle: 'bold' },
        },
      });

      Y = (doc as any).lastAutoTable.finalY + 10;
    };

    const drawDetailTable = () => {
      const rows = data.map((tx: any) => [
        tx.trxn_no || 'N/A',
        tx.folio_number || '—',
        tx.investor_name ? toTitleCase(tx.investor_name) : '—',
        tx.scheme_name || '—',
        fmt(tx.amount),
        fmtDate(tx.start_date),
        fmtDate(tx.end_date),
        tx.source || 'N/A',
      ]);

      autoTable(doc, {
        startY: Y,
        margin: { left: ML, right: MR },
        head: [
          [
            'Trxn No.',
            'Folio Number',
            'Investor Name',
            'Scheme Name',
            'Amount (Rs.)',
            'Start Date',
            'End Date',
            'Source',
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
          1: { halign: 'center', cellWidth: 25 },
          2: { halign: 'left', cellWidth: 40 },
          3: { halign: 'left', cellWidth: 'auto' },
          4: { halign: 'right', cellWidth: 20 },
          5: { halign: 'center', cellWidth: 20 },
          6: { halign: 'center', cellWidth: 20 },
          7: { halign: 'center', cellWidth: 15 },
        },
      });

      Y = (doc as any).lastAutoTable.finalY + 6;
    };

    const drawTotalsBand = () => {
      needsPage(14);

      const totalAmount = data.reduce(
        (sum, tx) => sum + (Number(tx.amount) || 0),
        0,
      );

      doc.setFillColor(...C.navy);
      doc.rect(ML, Y, CW, 10, 'F');

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...C.white);
      doc.text(
        `Total Mandates: ${data.length}      |      Total Amount: Rs ${fmt(totalAmount)}`,
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

    drawHeader();
    drawContactBand();

    if (data.length === 0) {
      drawEmptyState();
    } else {
      if (opts.groupBy && opts.groupBy !== 'None') {
        drawGroupSummary();
      } else {
        drawDetailTable();
        drawTotalsBand();
      }
    }

    drawFooters();

    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }
}
