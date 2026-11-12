import { describe, expect, it } from 'vitest';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import { GitHubReportData } from '../report.types.js';
import {
  generateReportExcelWorkbook,
  generateMultiAppZipArchive,
  appendAuditWorksheets,
  appendConsolidatedSummarySheet,
  KNOWN_42SYSTEM_APPLICATIONS,
  LEAD_DEVELOPER_NAME,
  LEAD_DEVELOPER_OFFICE,
  LEAD_DEVELOPER_ROLE,
} from '../report.xlsx.js';

describe('Excel Workbook Generator (Template-Based Engine)', () => {
  const sample42SystemData: GitHubReportData = {
    metadata: {
      owner: 'Mugecchi',
      repo: '42System',
      branch: 'main',
      since: '2026-09-01T00:00:00.000Z',
      until: '2026-09-22T23:59:59.999Z',
      authorFilter: undefined,
      generatedAt: '2026-09-22T12:00:00.000Z',
    },
    summary: {
      totalCommits: 2,
      contributors: 2,
      totalFilesChanged: 3,
      totalAdditions: 120,
      totalDeletions: 15,
      types: {
        features: 1,
        fixes: 1,
        refactors: 0,
        documentation: 0,
        tests: 0,
        chores: 0,
        perf: 0,
        style: 0,
        build: 0,
        ci: 0,
        revert: 0,
        other: 0,
      },
      features: 1,
      fixes: 1,
      refactors: 0,
      documentation: 0,
    },
    contributors: [
      {
        author: 'Mugecchi',
        authorEmail: 'muge@example.com',
        commits: 1,
        additions: 100,
        deletions: 10,
        filesChanged: 2,
      },
      {
        author: 'Collaborator',
        authorEmail: 'collab@example.com',
        commits: 1,
        additions: 20,
        deletions: 5,
        filesChanged: 1,
      },
    ],
    dailyActivity: [
      {
        date: '2026-09-05',
        commits: 1,
        filesChanged: 2,
        additions: 100,
        deletions: 10,
      },
      {
        date: '2026-09-10',
        commits: 1,
        filesChanged: 1,
        additions: 20,
        deletions: 5,
      },
    ],
    commits: [
      {
        sha: 'a82f31c1234567890abcdef',
        shortSha: 'a82f31c',
        date: '2026-09-05T10:00:00.000Z',
        author: 'Mugecchi',
        authorEmail: 'muge@example.com',
        message: 'feat(CGSO): regenerate PO items from procurement request\n\nAutomates PO line item computation.',
        subject: 'regenerate PO items from procurement request',
        type: 'feat',
        scope: 'CGSO',
        isBreaking: false,
        filesChanged: 2,
        additions: 100,
        deletions: 10,
        url: 'https://github.com/Mugecchi/42System/commit/a82f31c',
        changedFiles: [
          {
            filename: 'CGSO/src/po.ts',
            status: 'modified',
            additions: 80,
            deletions: 5,
            changes: 85,
          },
          {
            filename: 'CGSO/src/types.ts',
            status: 'modified',
            additions: 20,
            deletions: 5,
            changes: 25,
          },
        ],
      },
      {
        sha: 'b93e42d1234567890abcdef',
        shortSha: 'b93e42d',
        date: '2026-09-10T14:30:00.000Z',
        author: 'Collaborator',
        authorEmail: 'collab@example.com',
        message: 'fix(POSD): update patrol route mapping\n\nEnsure offline map coordinates synchronize correctly.',
        subject: 'update patrol route mapping',
        type: 'fix',
        scope: 'POSD',
        isBreaking: false,
        filesChanged: 1,
        additions: 20,
        deletions: 5,
        url: 'https://github.com/Mugecchi/42System/commit/b93e42d',
        changedFiles: [
          {
            filename: 'POSD/src/routes.ts',
            status: 'modified',
            additions: 20,
            deletions: 5,
            changes: 25,
          },
        ],
      },
    ],
  };

  const sampleSingleRepoData: GitHubReportData = {
    ...sample42SystemData,
    metadata: {
      ...sample42SystemData.metadata,
      repo: 'standalone-service',
    },
    commits: [
      {
        ...sample42SystemData.commits[0],
        scope: null,
        changedFiles: [
          {
            filename: 'src/index.ts',
            status: 'modified',
            additions: 80,
            deletions: 5,
            changes: 85,
          },
        ],
      },
      {
        ...sample42SystemData.commits[1],
        scope: null,
      },
    ],
  };

  describe('Template Loading and Preservation', () => {
    it('should output exactly the 6 master template worksheets without additional sheets', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      expect(Buffer.isBuffer(buffer)).toBe(true);

      const workbook = XLSX.read(buffer, { type: 'buffer' });
      expect(workbook.SheetNames).toEqual([
        'Guide and Sources',
        'System Profile',
        'Effectiveness',
        'Performance',
        'Issues and Actions',
        'Management Review',
      ]);
      expect(workbook.SheetNames.length).toBe(6);
    });

    it('should preserve native formula structures from template', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      // System Profile formulas
      const profile = testWb.getWorksheet('System Profile')!;
      expect(profile.getCell('B24').formula).toContain('Effectiveness');
      expect(profile.getCell('B27').formula).toContain('Effectiveness');
      expect(profile.getCell('B28').formula).toContain('Issues and Actions');

      // Effectiveness formulas
      const eff = testWb.getWorksheet('Effectiveness')!;
      expect(eff.getCell('H6').formula).toContain('Highly effective');
      expect(eff.getCell('I6').formula).toContain('Ready');

      // Issues and Actions formulas
      const issues = testWb.getWorksheet('Issues and Actions')!;
      expect(issues.getCell('Q6').formula).toContain('Closed');
      expect(issues.getCell('S6').formula).toContain('Duplicate issue ID');

      // Management Review formula
      const mgmt = testWb.getWorksheet('Management Review')!;
      expect(mgmt.getCell('C13').formula).toContain('authorized management decision');
    });
  });

  describe('System Profile Population', () => {
    it('should populate System Profile with developer credentials and valid date', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const sheet = testWb.getWorksheet('System Profile')!;

      // Check Lead Developer credentials
      expect(sheet.getCell('B13').value).toContain(LEAD_DEVELOPER_NAME);
      expect(sheet.getCell('B13').value).toContain(LEAD_DEVELOPER_ROLE);
      expect(sheet.getCell('B15').value).toContain(LEAD_DEVELOPER_OFFICE);

      // Evaluation date B7 must be a valid date object
      const dateVal = sheet.getCell('B7').value;
      expect(dateVal).toBeInstanceOf(Date);

      // System name and review period
      expect(sheet.getCell('B5').value).toBeTruthy();
      expect(sheet.getCell('B8').value).toContain('2026-09-01');
    });

    it('should populate specific target application when selected (e.g. CGSO or CAO)', async () => {
      const cgsoApp = KNOWN_42SYSTEM_APPLICATIONS.find((a) => a.code === 'CGSO')!;
      const buffer = await generateReportExcelWorkbook(sample42SystemData, cgsoApp);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const sheet = testWb.getWorksheet('System Profile')!;
      expect(sheet.getCell('B5').value).toBe('42System - City General Services Office (CGSO)');
      expect(sheet.getCell('B6').value).toBe('City General Services Office (CGSO)');
      expect(sheet.getCell('B16').value).toContain('City General Services Office');

      // Test with CAO
      const caoApp = KNOWN_42SYSTEM_APPLICATIONS.find((a) => a.code === 'CAO')!;
      const caoBuffer = await generateReportExcelWorkbook(sample42SystemData, caoApp);
      const caoWb = new ExcelJS.Workbook();
      await caoWb.xlsx.load(caoBuffer as any);

      const caoSheet = caoWb.getWorksheet('System Profile')!;
      expect(caoSheet.getCell('B5').value).toBe('42System - City Accounting Office (CAO)');
      expect(caoSheet.getCell('B6').value).toBe('City Accounting Office (CAO)');
    });

    it('should populate Calculated Review Summary B24:B30 with valid formulas and precomputed results without [object Object]', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const profile = testWb.getWorksheet('System Profile')!;

      // B24: Mean score must be numeric and not undefined / [object Object]
      const b24 = profile.getCell('B24');
      expect(b24.formula).toContain('Effectiveness');
      expect(typeof b24.result).toBe('number');
      expect(Number(b24.result)).toBeGreaterThanOrEqual(1);
      expect(Number(b24.result)).toBeLessThanOrEqual(4);

      // B25: Rating interpretation
      const b25 = profile.getCell('B25');
      expect(b25.formula).toContain('Guide and Sources');
      expect(b25.result).toBe('Highly effective');

      // B26: Coverage
      const b26 = profile.getCell('B26');
      expect(b26.formula).toContain('Effectiveness');
      expect(b26.result).toBe(1);

      // B27: Readiness
      const b27 = profile.getCell('B27');
      expect(b27.formula).toContain('Effectiveness');
      expect(b27.result).toBe('Complete');

      // B28: Issues logged must reflect fix commits (sample42SystemData has 1 fix)
      const b28 = profile.getCell('B28');
      expect(b28.formula).toContain('Issues and Actions');
      expect(b28.result).toBe(1);

      // B29: Open critical issues
      const b29 = profile.getCell('B29');
      expect(b29.result).toBe(0);

      // B30: Overdue actions
      const b30 = profile.getCell('B30');
      expect(b30.result).toBe(0);

      // Effectiveness H6:H19 and I6:I19 must have valid score results and 'Ready'
      const eff = testWb.getWorksheet('Effectiveness')!;
      for (let r = 6; r <= 19; r++) {
        const hCell = eff.getCell(`H${r}`);
        const iCell = eff.getCell(`I${r}`);
        expect(typeof hCell.result).toBe('number');
        expect(Number(hCell.result)).toBeGreaterThanOrEqual(3);
        expect(iCell.result).toBe('Ready');
      }

      // Issues and Actions Q6, S6
      const issues = testWb.getWorksheet('Issues and Actions')!;
      expect(issues.getCell('Q6').result).toBe('Closed');
      expect(issues.getCell('S6').result).toBe('Ready');

      // Management Review C13
      const mgmt = testWb.getWorksheet('Management Review')!;
      expect(mgmt.getCell('C13').result).toBe('For authorized management decision');
    });
  });

  describe('14 Effectiveness Rows Mapping', () => {
    it('should populate all 14 criteria rows (E01 to E14) with ratings, findings, and evidence sources', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const sheet = testWb.getWorksheet('Effectiveness')!;

      // Check rows 6 to 19 (E01 to E14)
      for (let r = 6; r <= 19; r++) {
        const rating = sheet.getCell(`D${r}`).value?.toString();
        const finding = sheet.getCell(`E${r}`).value?.toString();
        const source = sheet.getCell(`F${r}`).value?.toString();

        expect(rating).toMatch(/(4 - Highly effective|3 - Effective)/);
        expect(finding).toBeTruthy();
        expect(finding!.length).toBeGreaterThan(10);
        expect(source).toBeTruthy();
      }

      // Check specific criteria findings
      const e01Finding = sheet.getCell('E6').value?.toString();
      expect(e01Finding).toContain('1 core feature(s)');

      const e09Finding = sheet.getCell('E14').value?.toString();
      expect(e09Finding).toContain(LEAD_DEVELOPER_OFFICE);

      const e11Finding = sheet.getCell('E16').value?.toString();
      expect(e11Finding).toContain('1 defect fix(es)');
      expect(sheet.getCell('G16').value?.toString()).toContain('ISS-01');
    });
  });

  describe('Issues and Actions Sheet Population', () => {
    it('should convert fix commits into structured action items with complete validation evidence', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const sheet = testWb.getWorksheet('Issues and Actions')!;

      // Row 6 is the first issue row
      expect(sheet.getCell('A6').value).toBe('ISS-01');
      expect(sheet.getCell('B6').value).toBeInstanceOf(Date);
      expect(sheet.getCell('C6').value).toBe('POSD');
      expect(sheet.getCell('D6').value?.toString()).toContain('Update patrol route mapping');
      expect(sheet.getCell('E6').value).toMatch(/(High|Medium|Low|Critical)/);
      expect(sheet.getCell('F6').value?.toString()).toContain('Ensure offline map coordinates');
      expect(sheet.getCell('G6').value?.toString()).toContain('Patched in commit b93e42d');
      expect(sheet.getCell('H6').value).toBeTruthy();
      expect(sheet.getCell('I6').value?.toString()).toContain('Collaborator');
      expect(sheet.getCell('K6').value).toBeInstanceOf(Date);
      expect(sheet.getCell('L6').value).toBe('Closed');
      expect(sheet.getCell('M6').value?.toString()).toContain('Commit b93e42d');
      expect(sheet.getCell('N6').value).toBe('Passed');
      expect(sheet.getCell('O6').value).toBe(LEAD_DEVELOPER_NAME);
      expect(sheet.getCell('P6').value).toBeInstanceOf(Date);
    });
  });

  describe('Management Review and Sign-Off', () => {
    it('should populate Management Review critical checks with Pass and sign-off details', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const sheet = testWb.getWorksheet('Management Review')!;

      // Critical Checks C6:C10 must be 'Pass'
      for (let r = 6; r <= 10; r++) {
        expect(sheet.getCell(`C${r}`).value).toBe('Pass');
        expect(sheet.getCell(`D${r}`).value?.toString().length).toBeGreaterThan(10);
      }

      // Sign-off names
      expect(sheet.getCell('C32').value?.toString()).toContain(LEAD_DEVELOPER_NAME);
      expect(sheet.getCell('C34').value?.toString()).toContain(LEAD_DEVELOPER_OFFICE);
    });
  });

  describe('Appended Evidence Sheets and Formatting', () => {
    it('should support appendAuditWorksheets helper directly if needed', async () => {
      const wb = new ExcelJS.Workbook();
      appendAuditWorksheets(wb, sampleSingleRepoData);

      expect(wb.worksheets.map((w) => w.name)).toEqual([
        'Commits',
        'Contributors',
        'Daily Activity',
        'Changed Files',
      ]);

      const commitsSheet = wb.getWorksheet('Commits')!;
      expect(commitsSheet.getRow(1).values).toContain('Date (UTC)');
      expect(commitsSheet.getRow(1).values).toContain('Commit Subject');

      const filesSheet = wb.getWorksheet('Changed Files')!;
      expect(filesSheet.getRow(1).values).toContain('File Path');
      expect(filesSheet.getRow(1).values).toContain('Status');
    });

    it('should ensure wrapText is applied on populated cells', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const eff = testWb.getWorksheet('Effectiveness')!;
      expect(eff.getCell('E6').alignment?.wrapText).toBe(true);

      const issues = testWb.getWorksheet('Issues and Actions')!;
      expect(issues.getCell('D6').alignment?.wrapText).toBe(true);
    });

    it('should append Consolidated Summary sheet when consolidated report is provided', async () => {
      const dataWithConsolidated: GitHubReportData = {
        ...sample42SystemData,
        consolidated: {
          generatedBy: 'ollama',
          modelUsed: 'qwen2.5:7B',
          executiveSummary: 'Executive overview of milestone sprint delivery.',
          features: [
            {
              title: 'Automated PO Item Line Computation',
              module: 'CGSO',
              description: 'Automates PO item computation from requisitions.',
              commitsCount: 1,
              commitShas: ['a82f31c'],
            },
          ],
          issues: [
            {
              issueId: 'ISS-01',
              title: 'Defect fix for session timeout',
              module: 'AUTH',
              issueImpact: 'Resolved session drop',
              priority: 'High',
              rootCause: 'Race condition on refresh',
              actionTaken: 'Synchronized session queue',
              needsToBeDone: 'Maintain tests',
              commitsCount: 1,
              commitShas: ['b93e42d'],
              dateLogged: '2026-09-10T14:30:00.000Z',
              reportedStatus: 'Closed',
              retestResult: 'Passed',
            },
          ],
          refactors: [],
          maintenance: [],
          qualityAssessment: {
            score: '96/100',
            risk: 'Low',
            keyAchievements: ['Resolved session drop bug'],
            recommendations: ['Maintain automated test suites'],
          },
        },
      };

      const buffer = await generateReportExcelWorkbook(dataWithConsolidated);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      // Issues and Actions should use the consolidated issue
      const issuesSheet = testWb.getWorksheet('Issues and Actions')!;
      expect(issuesSheet.getCell('A6').value).toBe('ISS-01');
      expect(issuesSheet.getCell('C6').value).toBe('AUTH');
      expect(issuesSheet.getCell('D6').value).toBe('Resolved session drop');
      expect(issuesSheet.getCell('E6').value).toBe('High');
      expect(issuesSheet.getCell('G6').value).toBe('Synchronized session queue');

      // Workbook contains strictly the 6 master template sheets
      expect(testWb.worksheets.map((w) => w.name)).toEqual([
        'Guide and Sources',
        'System Profile',
        'Effectiveness',
        'Performance',
        'Issues and Actions',
        'Management Review',
      ]);
    });
  });

  describe('Comprehensive Field Population in Template Sheets', () => {
    it('should generate exactly the 6 template worksheets without appending additional sheets', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      expect(testWb.worksheets.length).toBe(6);
      expect(testWb.worksheets.map((w) => w.name)).toEqual([
        'Guide and Sources',
        'System Profile',
        'Effectiveness',
        'Performance',
        'Issues and Actions',
        'Management Review',
      ]);
    });

    it('should populate Management Review with complete critical checks, decisions, and sign-offs', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const mgmt = testWb.getWorksheet('Management Review')!;
      expect(mgmt).toBeDefined();

      // Critical Checks
      expect(mgmt.getCell('C6').value).toBe('Pass');
      expect(mgmt.getCell('D6').value?.toString()).toContain('core feature workflow');
      expect(mgmt.getCell('C7').value).toBe('Pass');
      expect(mgmt.getCell('C8').value).toBe('Pass');
      expect(mgmt.getCell('C9').value).toBe('Pass');
      expect(mgmt.getCell('C10').value).toBe('Pass');

      // Management Decisions
      expect(mgmt.getCell('C16').value?.toString()).toContain('Operational');
      expect(mgmt.getCell('C17').value).toBe('Operational');
      expect(mgmt.getCell('C18').value?.toString()).toContain('commits');
      expect(mgmt.getCell('C19').value?.toString()).toContain('automated unit test');
      expect(mgmt.getCell('C21').value?.toString()).toContain('Continuous integration');

      // Sign-off Block
      expect(mgmt.getCell('C32').value?.toString()).toContain(LEAD_DEVELOPER_NAME);
      expect(mgmt.getCell('E32').value).toBe('Signed / Verified');
      expect(mgmt.getCell('G32').value).toBeInstanceOf(Date);
      expect(mgmt.getCell('C33').value?.toString()).toContain('City Government of Cauayan');
      expect(mgmt.getCell('C34').value?.toString()).toContain(LEAD_DEVELOPER_NAME);
      expect(mgmt.getCell('C35').value?.toString()).toContain('Executive Authority');
    });

    it('should populate Performance sheet with metrics and targets without shared style corruption', async () => {
      const buffer = await generateReportExcelWorkbook(sample42SystemData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      const perf = testWb.getWorksheet('Performance')!;
      expect(perf).toBeDefined();

      // Task Success Rate (C6, D6, F6, G6)
      expect(typeof perf.getCell('C6').value).toBe('number');
      expect(typeof perf.getCell('D6').value).toBe('number');
      expect(perf.getCell('F6').value).toBe(0.85);
      expect(perf.getCell('G6').value).toBe(0.95);
      expect(perf.getCell('J6').value?.toString()).toContain('commit delivery rate');

      // Formulas preserved
      expect(perf.getCell('E6').formula).toContain('IF(COUNT(C6:D6)<2');
      expect(perf.getCell('I6').formula).toContain('Target met');
    });

    it('should adapt System Profile modules tested for single-application vs monorepo', async () => {
      const singleAppData: GitHubReportData = {
        ...sampleSingleRepoData,
        metadata: {
          ...sampleSingleRepoData.metadata,
          repo: 'single-core-app',
          structureInfo: {
            type: 'single-application',
            applicationsCount: 1,
            applications: [
              {
                id: 'root',
                code: 'ROOT',
                name: 'single-core-app (Root Folder)',
                fullName: 'Mugecchi/single-core-app Root Application',
                path: '.',
                isRoot: true,
                commitCount: 2,
              },
            ],
            detectedFrom: 'repo-tree',
            summaryDescription: '1 Application identified: Root Folder',
          },
        },
      };

      const buffer = await generateReportExcelWorkbook(singleAppData);
      const testWb = new ExcelJS.Workbook();
      await testWb.xlsx.load(buffer as any);

      // Exactly 6 sheets
      expect(testWb.worksheets.length).toBe(6);

      const profile = testWb.getWorksheet('System Profile')!;
      expect(profile.getCell('B5').value).toBe('Mugecchi/single-core-app (Root Application)');
      expect(profile.getCell('B17').value).toContain('1 Application: Root Folder');
    });
  });

  describe('Multi-Application Zip Archive Generation', () => {
    it('should generate a compressed ZIP archive containing individual Excel workbooks for each detected program', async () => {
      const result = await generateMultiAppZipArchive(sample42SystemData);

      expect(result.zipBuffer).toBeInstanceOf(Buffer);
      expect(result.zipBuffer.length).toBeGreaterThan(1000);
      expect(result.count).toBe(KNOWN_42SYSTEM_APPLICATIONS.length);

      // Verify filenames array contains entries for every known application
      for (const app of KNOWN_42SYSTEM_APPLICATIONS) {
        const expectedSubstring = `_${app.code}_`;
        const matched = result.filenames.some((fn) => fn.includes(expectedSubstring));
        expect(matched, `Expected zip to include an Excel for ${app.code}`).toBe(true);
      }
    });

    it('should allow extracting and validating an individual program workbook from the generated ZIP', async () => {
      const fs = await import('node:fs');
      const os = await import('node:os');
      const path = await import('node:path');
      const { execSync } = await import('node:child_process');

      const result = await generateMultiAppZipArchive(sample42SystemData);
      const tmpZipPath = path.join(os.tmpdir(), `test-report-${Date.now()}.zip`);
      const tmpExtractDir = path.join(os.tmpdir(), `test-extract-${Date.now()}`);

      try {
        fs.writeFileSync(tmpZipPath, result.zipBuffer);

        // Test zip file integrity using unzip -t
        const testOutput = execSync(`unzip -t "${tmpZipPath}"`, { encoding: 'utf8' });
        expect(testOutput).toContain('No errors detected');

        // Extract files
        fs.mkdirSync(tmpExtractDir, { recursive: true });
        execSync(`unzip -q "${tmpZipPath}" -d "${tmpExtractDir}"`);

        // Check CGSO program Excel inside extracted directory
        const extractedFiles = fs.readdirSync(tmpExtractDir);
        const cgsoFile = extractedFiles.find((f) => f.includes('_CGSO_'));
        expect(cgsoFile).toBeDefined();

        const cgsoBuffer = fs.readFileSync(path.join(tmpExtractDir, cgsoFile!));
        const cgsoWb = new ExcelJS.Workbook();
        await cgsoWb.xlsx.load(cgsoBuffer as any);

        expect(cgsoWb.worksheets.length).toBe(6);
        const profile = cgsoWb.getWorksheet('System Profile')!;
        expect(profile.getCell('B5').value).toBe('42System - City General Services Office (CGSO)');
        expect(profile.getCell('B6').value).toBe('City General Services Office (CGSO)');

        // Check CAO program Excel inside extracted directory
        const caoFile = extractedFiles.find((f) => f.includes('_CAO_'));
        expect(caoFile).toBeDefined();

        const caoBuffer = fs.readFileSync(path.join(tmpExtractDir, caoFile!));
        const caoWb = new ExcelJS.Workbook();
        await caoWb.xlsx.load(caoBuffer as any);
        const caoProfile = caoWb.getWorksheet('System Profile')!;
        expect(caoProfile.getCell('B5').value).toBe('42System - City Accounting Office (CAO)');
        expect(caoProfile.getCell('B6').value).toBe('City Accounting Office (CAO)');
      } finally {
        if (fs.existsSync(tmpZipPath)) fs.unlinkSync(tmpZipPath);
        if (fs.existsSync(tmpExtractDir)) fs.rmSync(tmpExtractDir, { recursive: true, force: true });
      }
    });
  });
});
