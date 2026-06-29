import { Injectable } from '@nestjs/common';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const formatCurrency = (val: any) => {
  const num = Number(val);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

const toTitleCase = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .split(' ')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
};

// Pure jsPDF Pie Chart Drawer (Dependency-Free, Gapless)
const drawPieSlice = (
  doc: any,
  cx: number,
  cy: number,
  radius: number,
  startAngle: number,
  endAngle: number,
  color: number[],
) => {
  doc.setFillColor(color[0], color[1], color[2]);
  doc.setDrawColor(color[0], color[1], color[2]);
  doc.setLineWidth(0.5);

  const segments = 60;
  const angleStep = (endAngle - startAngle) / segments;

  for (let i = 0; i < segments; i++) {
    const a1 = startAngle + i * angleStep;
    const a2 = startAngle + (i + 1) * angleStep + 0.01;

    const x1 = cx + radius * Math.cos(a1);
    const y1 = cy + radius * Math.sin(a1);
    const x2 = cx + radius * Math.cos(a2);
    const y2 = cy + radius * Math.sin(a2);

    doc.triangle(cx, cy, x1, y1, x2, y2, 'FD');
  }
};

@Injectable()
export class InvestorsExportService {
  public generatePortfolioValuationPDF(
    clientData: any,
    distributorInfo?: any,
  ): Buffer {
    const doc = new jsPDF('landscape', 'pt', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    const today = new Date().toLocaleDateString('en-GB');
    const time = new Date().toLocaleTimeString('en-GB');

    // Finance-grade palette (Blue/Black/White/Slate)
    const C = {
      navy: [15, 40, 80] as [number, number, number],
      steel: [52, 100, 163] as [number, number, number],
      slate900: [15, 23, 42] as [number, number, number],
      slate700: [51, 65, 85] as [number, number, number],
      slate500: [100, 116, 139] as [number, number, number],
      slate400: [148, 163, 184] as [number, number, number],
      slate200: [226, 232, 240] as [number, number, number],
      slate50: [248, 250, 252] as [number, number, number],
      brand100: [238, 242, 255] as [number, number, number],
      white: [255, 255, 255] as [number, number, number],
    };

    let pageCount = 1;
    const rawClientName =
      clientData.investor_name || clientData.clientName || 'Investor';
    const clientName = toTitleCase(rawClientName);

    const drawPageHeader = () => {
      if (
        distributorInfo?.logoBase64 &&
        distributorInfo.logoBase64.trim() !== ''
      ) {
        try {
          doc.addImage(
            distributorInfo.logoBase64,
            'PNG',
            40,
            30,
            120,
            50,
            '',
            'FAST',
          );
        } catch (err) {
          console.warn('Could not render logo to PDF:', err);
        }
      }

      doc.setTextColor(C.slate500[0], C.slate500[1], C.slate500[2]);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`NAV As on Date: ${today}`, pageWidth - 40, 45, {
        align: 'right',
      });
      doc.text(`Report As On Date: ${today}`, pageWidth - 40, 60, {
        align: 'right',
      });
      doc.text(`Run Date: ${today} ${time}`, pageWidth - 40, 75, {
        align: 'right',
      });

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
      doc.text('Portfolio Holdings Report', 40, 115);

      const pan = clientData.pan || 'N/A';
      doc.setFontSize(10);
      doc.text(`Name: ${clientName} (${pan})`, 40, 135);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      const email =
        clientData.email || clientData.funds?.[0]?.email || 'Not Provided';
      const mobile =
        clientData.mobile || clientData.funds?.[0]?.mobile || 'Not Provided';

      doc.text(`Mobile No: ${mobile}`, 40, 150);
      doc.text(`Email: ${email}`, 40, 165);
    };

    // PAGE 1: DETAILED HOLDINGS TABLE
    drawPageHeader();

    const tableColumn = [
      'Fund Name\nISIN/Folio No.',
      'Pur. Date\nAvg. Days',
      'Principal Amount\nInvested Capital',
      'Curr. Value\nUnits',
      'Curr. Nav\nAvg. Nav',
      'Div. Payout',
      'Unrealised\nUnrealised LT\nUnrealised ST',
      'Realised\nRealised LT\nRealised ST',
      'Net P&L',
      'RED/SWP\nS-Out/STP',
      "Today's P&L\nToday's P&L%",
      'XIRR%\nABS%',
    ];

    const tableRows: any[] = [];
    let totalPrincipal = 0,
      totalCurrent = 0,
      totalDividend = 0;
    let totalUnrealST = 0,
      totalUnrealLT = 0,
      totalRealST = 0,
      totalRealLT = 0;
    let totalNetPnl = 0,
      totalToday = 0;

    const fundsList = clientData.funds || [];

    fundsList.forEach((fund: any) => {
      const investedCapital = fund.total_capital ?? fund.invested_capital ?? 0;
      const currentValue = fund.current_value ?? 0;
      const uST = fund.unrealised_gains_st || 0;
      const uLT = fund.unrealised_gains_lt || 0;
      const rST = fund.realised_gains_st || 0;
      const rLT = fund.realised_gains_lt || 0;
      const availableUnits = fund.available_units ?? 0;
      const currentNAV = fund.current_nav ?? 0;
      const avgNav = fund.avg_nav ?? 0;
      const avgDays = fund.avg_days ?? 0;
      const dividendPayout = fund.dividend_payout ?? fund.dividendPayout ?? 0;
      const netPnl = fund.net_pnl ?? fund.netPL ?? 0;
      const redSwp = fund.redemption_swp_switch_stp ?? 0;
      const todaysPnl = fund.todays_pnl ?? 0;
      const todaysPnlPct = fund.todays_pnl_percent ?? 0;
      const xirr = fund.xirr_percent ?? 0;
      const abs = fund.abs_percent ?? 0;

      let purchaseDate = 'N/A';
      if (fund.purchase_date) {
        try {
          purchaseDate = new Date(fund.purchase_date).toLocaleDateString(
            'en-GB',
          );
        } catch (e) {
          purchaseDate = fund.purchase_date;
        }
      }

      totalPrincipal += investedCapital;
      totalCurrent += currentValue;
      totalDividend += dividendPayout;
      totalUnrealST += uST;
      totalUnrealLT += uLT;
      totalRealST += rST;
      totalRealLT += rLT;
      totalNetPnl += netPnl;
      totalToday += todaysPnl;

      tableRows.push([
        `${fund.fund_name || 'Unknown Fund'}\n${fund.folio_number || 'N/A'}`,
        `${purchaseDate}\n${avgDays}`,
        `${formatCurrency(investedCapital)}\n${formatCurrency(investedCapital)}`,
        `${formatCurrency(currentValue)}\n${availableUnits.toFixed(3)}`,
        `${currentNAV}\n${avgNav}`,
        `${formatCurrency(dividendPayout)}`,
        `${formatCurrency(uST + uLT)}\n${formatCurrency(uLT)}\n${formatCurrency(uST)}`,
        `${formatCurrency(rST + rLT)}\n${formatCurrency(rLT)}\n${formatCurrency(rST)}`,
        `${formatCurrency(netPnl)}`,
        `${formatCurrency(redSwp)}/0.00\n0.00/0.00`,
        `${formatCurrency(todaysPnl)}\n${todaysPnlPct.toFixed(2)}`,
        `${xirr.toFixed(2)}\n${abs.toFixed(2)}`,
      ]);
    });

    tableRows.push([
      'MUTUAL FUNDS TOTAL',
      '',
      formatCurrency(totalPrincipal),
      formatCurrency(totalCurrent),
      '',
      formatCurrency(totalDividend),
      `${formatCurrency(totalUnrealST + totalUnrealLT)}\n${formatCurrency(totalUnrealLT)}\n${formatCurrency(totalUnrealST)}`,
      `${formatCurrency(totalRealST + totalRealLT)}\n${formatCurrency(totalRealLT)}\n${formatCurrency(totalRealST)}`,
      formatCurrency(totalNetPnl),
      '0.00/0.00\n0.00/0.00',
      `${formatCurrency(totalToday)}\n`,
      `${clientData.xirr_percent?.toFixed(2) || '0.00'}\n${clientData.abs_percent?.toFixed(2) || '0.00'}`,
    ]);

    autoTable(doc, {
      startY: 195,
      head: [tableColumn],
      body: tableRows,
      theme: 'striped',
      styles: {
        fontSize: 6.5,
        cellPadding: 4,
        textColor: C.slate700,
        lineColor: C.slate200,
        lineWidth: 0.1,
      },
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        halign: 'right',
      },
      alternateRowStyles: { fillColor: C.slate50 },
      columnStyles: {
        0: { halign: 'left', cellWidth: 140 },
        1: { halign: 'center', cellWidth: 50 },
        2: { halign: 'right' },
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' },
        6: { halign: 'right' },
        7: { halign: 'right' },
        8: { halign: 'right' },
        9: { halign: 'right' },
        10: { halign: 'right' },
        11: { halign: 'right' },
      },
      willDrawCell: function (data) {
        if (data.row.index === tableRows.length - 1) {
          data.cell.styles.fontStyle = 'bold';
          data.cell.styles.fillColor = C.brand100;
          data.cell.styles.textColor = C.slate900;
        }
      },
      didDrawPage: function () {
        doc.setFontSize(8);
        doc.setTextColor(C.slate400[0], C.slate400[1], C.slate400[2]);
        doc.text(`Page No ${pageCount} of 3`, pageWidth / 2, pageHeight - 20, {
          align: 'center',
        });
        pageCount++;
      },
    });

    // PAGE 2: SUMMARY
    doc.addPage();
    drawPageHeader();

    const summaryColumn = [
      'Avg. Days - MF\nOnly',
      'Invested Capital',
      'Curr. Value',
      'Div. Payout',
      'Unrealised LT\nUnrealised ST',
      'Realised LT\nRealised ST',
      'Net P&L',
      "Today's P&L%",
      'ABS%',
    ];

    const avgDaysPortfolio =
      fundsList.length > 0
        ? Math.round(
            fundsList.reduce(
              (acc: number, curr: any) => acc + (curr.avg_days || 0),
              0,
            ) / fundsList.length,
          )
        : 0;

    const summaryRows = [
      [
        avgDaysPortfolio.toString(),
        formatCurrency(totalPrincipal),
        formatCurrency(totalCurrent),
        formatCurrency(totalDividend),
        `${formatCurrency(totalUnrealLT)}\n${formatCurrency(totalUnrealST)}`,
        `${formatCurrency(totalRealLT)}\n${formatCurrency(totalRealST)}`,
        formatCurrency(totalNetPnl),
        clientData.todays_pnl_percent?.toFixed(2) || '0.00',
        clientData.abs_percent?.toFixed(2) || '0.00',
      ],
    ];

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    doc.text(`TOTAL - ${clientName}`, 40, 199);

    autoTable(doc, {
      startY: 205,
      head: [summaryColumn],
      body: summaryRows,
      theme: 'plain',
      styles: {
        fontSize: 8,
        cellPadding: 5,
        halign: 'right',
        textColor: C.slate900,
      },
      headStyles: {
        fillColor: C.navy,
        textColor: C.white,
        fontStyle: 'bold',
        lineWidth: 0,
      },
      columnStyles: { 0: { halign: 'center' } },
    });

    // PAGE 3: ASSET & CLIENT ALLOCATION CHARTS
    doc.addPage();
    drawPageHeader();

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    doc.text('ASSET ALLOCATION', 40, 200);

    let equityVal = 0,
      debtVal = 0,
      hybridVal = 0;
    fundsList.forEach((f: any) => {
      const name = (f.fund_name || '').toLowerCase();
      if (
        name.includes('debt') ||
        name.includes('liquid') ||
        name.includes('bond')
      ) {
        debtVal += f.current_value || 0;
      } else if (
        name.includes('hybrid') ||
        name.includes('asset allocation') ||
        name.includes('advantage')
      ) {
        hybridVal += f.current_value || 0;
      } else {
        equityVal += f.current_value || 0;
      }
    });

    const totalChartVal = equityVal + debtVal + hybridVal || 1;
    const eqPct = equityVal / totalChartVal;
    const debtPct = debtVal / totalChartVal;
    const hyPct = hybridVal / totalChartVal;

    const cx = 150,
      cy1 = 280,
      radius = 60;

    // Strict Finance Theme Chart Colors
    const eqColor = [0, 0, 128]; // Navy Blue
    const hyColor = [16, 185, 129]; // Emerald Green
    const dbColor = [245, 158, 11]; // Amber

    let currentAngle = -Math.PI / 2;
    if (eqPct > 0) {
      const angle = eqPct * 2 * Math.PI;
      drawPieSlice(
        doc,
        cx,
        cy1,
        radius,
        currentAngle,
        currentAngle + angle,
        eqColor,
      );
      currentAngle += angle;
    }
    if (hyPct > 0) {
      const angle = hyPct * 2 * Math.PI;
      drawPieSlice(
        doc,
        cx,
        cy1,
        radius,
        currentAngle,
        currentAngle + angle,
        hyColor,
      );
      currentAngle += angle;
    }
    if (debtPct > 0) {
      const angle = debtPct * 2 * Math.PI;
      drawPieSlice(
        doc,
        cx,
        cy1,
        radius,
        currentAngle,
        currentAngle + angle,
        dbColor,
      );
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C.slate700[0], C.slate700[1], C.slate700[2]);

    let legendY = 250;
    if (eqPct > 0) {
      doc.setFillColor(eqColor[0], eqColor[1], eqColor[2]);
      doc.rect(300, legendY, 10, 10, 'F');
      doc.text(`Equity: ${(eqPct * 100).toFixed(2)}%`, 315, legendY + 8);
    }
    if (hyPct > 0) {
      doc.setFillColor(hyColor[0], hyColor[1], hyColor[2]);
      doc.rect(420, legendY, 10, 10, 'F');
      doc.text(`Hybrid: ${(hyPct * 100).toFixed(2)}%`, 435, legendY + 8);
    }
    if (debtPct > 0) {
      doc.setFillColor(dbColor[0], dbColor[1], dbColor[2]);
      doc.rect(540, legendY, 10, 10, 'F');
      doc.text(`Debt: ${(debtPct * 100).toFixed(2)}%`, 555, legendY + 8);
    }

    const cy2 = 450;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(C.slate900[0], C.slate900[1], C.slate900[2]);
    doc.text('CLIENT ALLOCATION', 40, 370);

    doc.setFillColor(eqColor[0], eqColor[1], eqColor[2]);
    doc.setDrawColor(eqColor[0], eqColor[1], eqColor[2]);
    doc.circle(cx, cy2, radius, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(C.slate700[0], C.slate700[1], C.slate700[2]);
    doc.rect(300, cy2 - 20, 10, 10, 'F');
    doc.text(`${clientName}: 100.00%`, 315, cy2 - 12);

    // Return ArrayBuffer for the API response
    const arrayBuffer = doc.output('arraybuffer');
    return Buffer.from(arrayBuffer);
  }
}
