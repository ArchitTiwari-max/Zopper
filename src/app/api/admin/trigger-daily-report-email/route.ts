import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { sendDailyReportEmail } from '@/lib/email';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const prisma = new PrismaClient();

function formatVisitStatus(status: string) {
  if (status === 'PENDING_REVIEW') return 'Pending';
  if (status === 'REVIEWD') return 'Reviewed';
  return status;
}

export async function POST(req: NextRequest) {
  try {
    const recipientEmails = [
      'amit.srivastava@zopper.com',
      'harshdeep.singh@zopper.com',
      'vikash.dubey@zopper.com',
      'assurance.tech@zopper.com'
    ];

    // Get Today's Date boundaries
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date();
    endOfDay.setHours(23, 59, 59, 999);

    // Fetch visits from today
    const visits = await prisma.visit.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        store: true,
        executive: {
          include: { user: true }
        }
      },
    });

    if (visits.length === 0) {
      return NextResponse.json({ message: 'No visits found today. No email sent.' }, { status: 200 });
    }

    // Generate PDF
    const doc = new jsPDF('landscape');
    
    // Add title
    doc.setFontSize(18);
    doc.setTextColor(33, 33, 33);
    doc.text('Daily Visit Reports', 14, 20);
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const dateString = new Date().toLocaleDateString();
    doc.text(`Generated on: ${dateString}`, 14, 28);

    // Group visits by executiveName
    const groupedVisits: Record<string, any[]> = {};
    visits.forEach(visit => {
      const name = visit.executive?.name || 'Unknown Executive';
      if (!groupedVisits[name]) groupedVisits[name] = [];
      groupedVisits[name].push(visit);
    });

    let currentY = 35;

    Object.entries(groupedVisits).forEach(([executiveName, execVisits]) => {
      if (currentY > 160) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(14);
      doc.setTextColor(37, 99, 235);
      doc.text(`Executive: ${executiveName} (${execVisits.length} Visits)`, 14, currentY);
      currentY += 8;

      const headers = [
        'Date', 'Store', 'City', 'Persons Met', 'Remarks / Feedback', 'Photos', 'Status'
      ];

      const data = execVisits.map(v => {
        const personsArr = Array.isArray(v.personMet) ? v.personMet : [];
        const persons = personsArr
          .map((p: any, idx: number) => `${idx + 1}. ${p.name}${p.designation ? ` (${p.designation})` : ''}`)
          .join('\n');
        
        const remarks = v.remarks && v.remarks.trim() !== '' ? v.remarks : '-';
        
        const photos = (v.imageUrls || [])
          .map((_: string, idx: number) => `Photo ${idx + 1}`)
          .join('\n');

        const visitDateStr = v.visitDate ? new Date(v.visitDate).toLocaleDateString() : new Date(v.createdAt).toLocaleDateString();

        return [
          visitDateStr,
          v.store?.storeName || 'Unknown Store',
          v.store?.city || '-',
          persons || '-',
          remarks,
          photos || '-',
          formatVisitStatus(v.status)
        ];
      });

      autoTable(doc, {
        head: [headers],
        body: data,
        startY: currentY,
        theme: 'grid',
        rowPageBreak: 'avoid',
        styles: { fontSize: 8, cellPadding: 3, overflow: 'linebreak', textColor: [50, 50, 50], valign: 'top' },
        headStyles: { fillColor: [240, 244, 248], textColor: [37, 99, 235], fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [250, 250, 250] },
        columnStyles: {
          0: { cellWidth: 22 }, // Date
          1: { cellWidth: 35 }, // Store
          2: { cellWidth: 25 }, // City
          3: { cellWidth: 40 }, // Persons Met
          4: { cellWidth: 80 }, // Remarks
          5: { cellWidth: 25, textColor: [37, 99, 235] }, // Photos
          6: { cellWidth: 25 }, // Status
        },
        didDrawCell: (dataHook: any) => {
          if (dataHook.column.index === 5 && dataHook.cell.section === 'body') {
            const rowIndex = dataHook.row.index;
            const visit = execVisits[rowIndex];
            if (visit && visit.imageUrls && visit.imageUrls.length > 0) {
              const lineSpacing = dataHook.cell.styles.fontSize * 0.3527 * 1.5;
              let yPos = dataHook.cell.y + dataHook.cell.padding('top') / 2;
              visit.imageUrls.forEach((url: string) => {
                doc.link(dataHook.cell.x, yPos, dataHook.cell.width, lineSpacing, { url });
                yPos += lineSpacing;
              });
            }
          }
        }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;
    });

    // Convert PDF to Buffer
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    // Convert array of emails to comma-separated string for nodemailer
    const toEmails = recipientEmails.join(', ');

    // Send email
    const emailSent = await sendDailyReportEmail(toEmails, pdfBuffer, dateString);

    if (emailSent) {
      return NextResponse.json({ message: `Daily report emailed successfully to ${toEmails}`, visits: visits.length }, { status: 200 });
    } else {
      return NextResponse.json({ message: 'Failed to send email' }, { status: 500 });
    }

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ message: 'Internal server error' }, { status: 500 });
  }
}
