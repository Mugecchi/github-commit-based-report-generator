import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { FastifyInstance } from 'fastify';
import { buildApp } from '../../../app.js';
import { getSourceLanguage } from '../source-code.constants.js';
import { SourceCodeReportService } from '../source-code.service.js';
import { generateApplicationSourceCodeDocx } from '../source-code.docx.js';
import { generateAllApplicationsSourceCodeZip } from '../source-code.zip.js';
import type { ApplicationSourceBundle } from '../source-code.types.js';

describe('Source Code Report Module', () => {
  describe('getSourceLanguage', () => {
    it('should correctly identify standard source code extensions', () => {
      expect(getSourceLanguage('src/app.ts')).toBe('TypeScript');
      expect(getSourceLanguage('client/src/App.tsx')).toBe('TypeScript (React)');
      expect(getSourceLanguage('index.js')).toBe('JavaScript');
      expect(getSourceLanguage('script.py')).toBe('Python');
      expect(getSourceLanguage('styles/main.css')).toBe('CSS');
      expect(getSourceLanguage('schema.sql')).toBe('SQL');
      expect(getSourceLanguage('config.json')).toBe('JSON');
    });

    it('should ignore lockfiles and minified files', () => {
      expect(getSourceLanguage('pnpm-lock.yaml')).toBeNull();
      expect(getSourceLanguage('package-lock.json')).toBeNull();
      expect(getSourceLanguage('app.min.js')).toBeNull();
      expect(getSourceLanguage('app.bundle.js')).toBeNull();
      expect(getSourceLanguage('app.js.map')).toBeNull();
      expect(getSourceLanguage('image.png')).toBeNull();
      expect(getSourceLanguage('doc.pdf')).toBeNull();
    });
  });

  describe('SourceCodeReportService (Local scan)', () => {
    const service = new SourceCodeReportService();

    it('should scan local workspace and identify client and server applications', async () => {
      const scanResult = await service.scanRepository({
        owner: 'local',
        repo: 'commitreport generator',
        sourceType: 'local',
        srcOnly: true,
      });

      expect(scanResult).toBeDefined();
      expect(scanResult.totalApplications).toBeGreaterThanOrEqual(1);
      expect(scanResult.totalFiles).toBeGreaterThan(0);
      expect(scanResult.applications.length).toBeGreaterThanOrEqual(1);

      const clientApp = scanResult.applications.find((a) => a.code === 'CLIENT');
      const serverApp = scanResult.applications.find((a) => a.code === 'SERVER');

      expect(clientApp || serverApp).toBeDefined();
      if (clientApp) {
        expect(clientApp.files.length).toBeGreaterThan(0);
        expect(clientApp.files.some((f) => f.path.includes('src/'))).toBe(true);
      }
    });

    it('should compile application bundle with loaded file contents', async () => {
      const scanResult = await service.scanRepository({
        owner: 'local',
        repo: 'commitreport generator',
        sourceType: 'local',
        srcOnly: true,
      });

      const targetApp = scanResult.applications[0];
      expect(targetApp).toBeDefined();

      const bundle = await service.compileApplicationBundle(
        {
          owner: 'local',
          repo: 'commitreport generator',
          sourceType: 'local',
          srcOnly: true,
        },
        targetApp.code
      );

      expect(bundle.application.code).toBe(targetApp.code);
      expect(bundle.totalFiles).toBe(targetApp.fileCount);
      expect(bundle.totalLines).toBeGreaterThan(0);
      expect(bundle.files.length).toBeGreaterThan(0);
      expect(bundle.files[0].content).toBeDefined();
      expect(bundle.files[0].linesCount).toBeGreaterThan(0);
    });
  });

  describe('Word (.docx) Generation', () => {
    const mockBundle: ApplicationSourceBundle = {
      application: {
        code: 'CGSO',
        name: 'CGSO — City General Services Office',
        fullName: 'City General Services Office',
        path: 'CGSO',
        isRoot: false,
        owningOffice: 'City General Services Office (CGSO)',
      },
      repository: {
        owner: 'Mugecchi',
        repo: '42System',
        branch: 'main',
      },
      totalFiles: 2,
      totalLines: 15,
      totalSize: 450,
      languageStats: { TypeScript: 1, 'TypeScript (React)': 1 },
      generatedAt: '2026-10-06T12:00:00.000Z',
      files: [
        {
          path: 'CGSO/src/index.ts',
          relativePath: 'src/index.ts',
          filename: 'index.ts',
          language: 'TypeScript',
          extension: '.ts',
          size: 150,
          linesCount: 5,
          content: 'import { bootstrap } from "./app";\n\nbootstrap();\n',
          applicationCode: 'CGSO',
        },
        {
          path: 'CGSO/src/App.tsx',
          relativePath: 'src/App.tsx',
          filename: 'App.tsx',
          language: 'TypeScript (React)',
          extension: '.tsx',
          size: 300,
          linesCount: 10,
          content: 'import React from "react";\n\nexport const App = () => {\n  return <div>CGSO</div>;\n};\n',
          applicationCode: 'CGSO',
        },
      ],
    };

    it('should generate a valid Word document buffer for an application', async () => {
      const docxBuffer = await generateApplicationSourceCodeDocx(mockBundle, {
        includeLineNumbers: true,
      });

      expect(docxBuffer).toBeInstanceOf(Buffer);
      expect(docxBuffer.length).toBeGreaterThan(1000);

      // Verify DOCX / ZIP magic header (PK\x03\x04)
      expect(docxBuffer[0]).toBe(0x50); // P
      expect(docxBuffer[1]).toBe(0x4b); // K
      expect(docxBuffer[2]).toBe(0x03);
      expect(docxBuffer[3]).toBe(0x04);
    });

    it('should package multiple application documents into a ZIP archive', async () => {
      const mockBundle2: ApplicationSourceBundle = {
        ...mockBundle,
        application: {
          code: 'CDRRMO',
          name: 'CDRRMO — Disaster Office',
          fullName: 'City Disaster Risk Reduction and Management Office',
          path: 'CDRRMO',
          isRoot: false,
        },
      };

      const result = await generateAllApplicationsSourceCodeZip([mockBundle, mockBundle2]);

      expect(result.count).toBe(2);
      expect(result.filenames).toHaveLength(2);
      expect(result.filenames).toContain('42System_CGSO_Source_Code.docx');
      expect(result.filenames).toContain('42System_CDRRMO_Source_Code.docx');

      expect(result.zipBuffer).toBeInstanceOf(Buffer);
      expect(result.zipBuffer.length).toBeGreaterThan(2000);
      // ZIP magic header
      expect(result.zipBuffer[0]).toBe(0x50);
      expect(result.zipBuffer[1]).toBe(0x4b);
    });
  });

  describe('Fastify Routes Integration', () => {
    let app: FastifyInstance;

    beforeAll(async () => {
      app = buildApp();
      await app.ready();
    });

    afterAll(async () => {
      await app.close();
    });

    it('GET /api/reports/source-code/scan should return scan results for local repository', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reports/source-code/scan?owner=local&repo=commitreport_generator&sourceType=local&srcOnly=true',
      });

      expect(response.statusCode).toBe(200);
      const json = response.json();
      expect(json.totalApplications).toBeGreaterThanOrEqual(1);
      expect(json.totalFiles).toBeGreaterThan(0);
      expect(json.applications).toBeInstanceOf(Array);
    });

    it('GET /api/reports/source-code/download should return docx or zip file', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/reports/source-code/download?owner=local&repo=commitreport_generator&sourceType=local&srcOnly=true&application=ALL',
      });

      expect(response.statusCode).toBe(200);
      const contentType = response.headers['content-type'];
      expect(
        contentType?.includes('application/zip') ||
          contentType?.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')
      ).toBe(true);
      expect(response.rawPayload.length).toBeGreaterThan(1000);
    });
  });
});
