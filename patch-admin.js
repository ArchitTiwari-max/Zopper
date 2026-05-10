const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/app/admin/visit-report/page.tsx');
let lines = fs.readFileSync(filePath, 'utf8').split('\n');

for (let i = 0; i < lines.length; i++) {
  // 1. VisitReportData
  if (lines[i].includes("previousVisitDate?: string | null;") && lines[i+1].includes("visitStatus: 'PENDING_REVIEW' | 'REVIEWD';")) {
    lines.splice(i + 1, 0, "  nextScheduledDate?: string | null;");
    i++;
  }
  
  // 2. XLS Headers
  if (lines[i].includes("'POSM Available',") && lines[i+1].includes("'Remarks',") && lines[i+2].includes("'Issues',") && lines[i-1].includes("'Persons Met',")) {
    lines.splice(i + 1, 0, "      'Next Schedule',");
    i++;
  }
  
  // 3. XLS Rows
  if (lines[i].includes("posm,") && lines[i+1].includes("v.feedback || 'No feedback provided',") && lines[i-1].includes("persons,")) {
    lines.splice(i + 1, 0, "        v.nextScheduledDate || '',");
    i++;
  }
  
  // 4. XLS Col Widths
  if (lines[i].includes("{ wch: 14 }, // POSM") && lines[i+1].includes("{ wch: 40 }, // Remarks") && lines[i-1].includes("{ wch: 40 }, // Persons Met")) {
    lines.splice(i + 1, 0, "      { wch: 16 }, // Next Schedule");
    i++;
  }
  
  // 5. Table Header
  if (lines[i].includes("<div className=\"admin-visit-report-header-cell\">Issues</div>") && lines[i+1].includes("<div className=\"admin-visit-report-header-cell\">Sales</div>") && lines[i-2].includes("isDigital ? 'Connect Date' : 'Visit Date'")) {
    lines.splice(i, 0, '            <div className="admin-visit-report-header-cell">Next Schedule</div>');
    i++;
  }
  
  // 6. Table Cell
  if (lines[i].includes('<div className="admin-visit-report-cell admin-visit-report-issues-cell">') && lines[i+1].includes('<div className="admin-visit-report-issues-content">') && lines[i-2].includes('</div>')) {
    const cellLines = [
      '                  <div className="admin-visit-report-cell admin-visit-report-next-schedule-cell" style={{ display: \'flex\', alignItems: \'center\' }}>',
      '                    {visit.nextScheduledDate ? (',
      '                      <span style={{ fontWeight: \'500\', color: \'#0f172a\', whiteSpace: \'nowrap\' }}>',
      '                        📅 {visit.nextScheduledDate}',
      '                      </span>',
      '                    ) : (',
      '                      <span style={{ color: \'#94a3b8\' }}>—</span>',
      '                    )}',
      '                  </div>',
      ''
    ];
    lines.splice(i, 0, ...cellLines);
    i += cellLines.length;
  }
}

fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
console.log('Successfully patched page.tsx fully with lines splitting');
