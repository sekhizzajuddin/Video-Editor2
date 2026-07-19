import type { AISelfTestReport } from '../../types';
import { CATEGORY_LABELS } from './testDefinitions';

/**
 * TestReportGenerator — formats AISelfTestReport as Markdown for the AI chat
 * + plain-text summary lines.
 *
 * Output structure:
 *  🧪 Testing Summary
 *  ✅ WORKING (list)
 *  ❌ NOT WORKING (list)
 *  ## Per-category breakdown (with stats)
 *  ## Detailed tests (expandable)
 */
export class TestReportGenerator {
  static toMarkdown(report: AISelfTestReport): string {
    const lines: string[] = [];

    lines.push('## 🧪 AI Copilot System Test Results');
    lines.push('');
    lines.push('```');
    lines.push(`Total:      ${report.totalTests}`);
    lines.push(`Passed:     ${report.passed} ✅`);
    lines.push(`Failed:     ${report.failed} ❌`);
    lines.push(`Skipped:    ${report.skipped} ⏸️`);
    lines.push(`Pass rate:  ${report.passRate.toFixed(0)}%`);
    lines.push(`Duration:   ${(report.durationMs / 1000).toFixed(1)}s`);
    lines.push('```');
    lines.push('');

    if (report.summary) {
      lines.push(`**${report.summary}**`);
      lines.push('');
    }

    // Per-category summary
    lines.push('### 📊 Per-Category Results');
    lines.push('');
    lines.push('| Category | Pass | Fail | Total |');
    lines.push('|----------|------|------|-------|');
    for (const cat of Object.keys(report.byCategory)) {
      const c = report.byCategory[cat];
      const catLabel = (CATEGORY_LABELS as any)[cat] ?? cat;
      const pct = c.total > 0 ? ((c.passed / c.total) * 100).toFixed(0) : '0';
      lines.push(`| ${catLabel} | ${c.passed} ✅ | ${c.failed} ❌ | ${c.total} (${pct}%) |`);
    }
    lines.push('');

    // Working features
    if (report.workingFeatures.length > 0) {
      lines.push(`### ✅ WORKING (${report.workingFeatures.length})`);
      lines.push('');
      for (const f of report.workingFeatures) {
        lines.push(`- ✓ ${f}`);
      }
      lines.push('');
    }

    // Not working features
    if (report.notWorkingFeatures.length > 0) {
      lines.push(`### ❌ NOT WORKING (${report.notWorkingFeatures.length})`);
      lines.push('');
      for (const f of report.notWorkingFeatures) {
        lines.push(`- ✗ ${f}`);
      }
      lines.push('');
    }

    // Detailed per-test lines
    if (report.results.length > 0) {
      lines.push('### 📋 Detailed Test Log');
      lines.push('');
      for (const r of report.results) {
        const icon = r.status === 'pass' ? '✅' : r.status === 'fail' ? '❌' : '⏸';
        const time = `(${r.durationMs}ms)`;
        const catLabel = (CATEGORY_LABELS as any)[r.category] ?? r.category;
        lines.push(`${icon} **[${catLabel}]** ${r.testName} ${time}`);
        if (r.status !== 'pass' && r.error) {
          lines.push(`   └─ ${r.error}`);
        } else if (r.details) {
          lines.push(`   └─ ${r.details}`);
        }
      }
      lines.push('');
    }

    lines.push('---');
    lines.push(`_Report generated at ${new Date().toLocaleString()}_`);
    lines.push('');
    lines.push('💡 **Tip:** If any tests failed, paste the failing test name here for troubleshooting help.');

    return lines.join('\n');
  }

  /**
   * Compact one-line summary for the chat header.
   */
  static toCompactLine(report: AISelfTestReport): string {
    const pct = report.passRate.toFixed(0);
    return `🧪 Test ${pct}% pass — ${report.passed}/${report.totalTests} ${report.failed > 0 ? `(${report.failed} ❌)` : 'all green'}`;
  }
}

export { CATEGORY_LABELS };
