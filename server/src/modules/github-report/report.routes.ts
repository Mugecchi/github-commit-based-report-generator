import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { gitHubReportQuerySchema } from './report.schema.js';
import { GitHubReportService, ReportServiceError } from './report.service.js';
import { OllamaService } from './ollama.service.js';
import {
  generateReportExcelWorkbook,
  generateMultiAppZipArchive,
  isMultiAppRepo,
  resolveApplicationsForMonorepo,
  KNOWN_42SYSTEM_APPLICATIONS,
} from './report.xlsx.js';

export const reportRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const reportService = new GitHubReportService();
  const ollamaService = new OllamaService();

  // GET /api/ollama/status
  fastify.get('/api/ollama/status', async (_request, reply) => {
    try {
      const status = await ollamaService.getStatus();
      return reply.send(status);
    } catch {
      return reply.send({
        available: false,
        models: [],
        defaultModel: 'qwen2.5:7B',
      });
    }
  });

  // POST /api/reports/github/consolidate
  fastify.post('/api/reports/github/consolidate', async (request, reply) => {
    const body = (request.body || {}) as {
      commits?: any[];
      model?: string;
      repoInfo?: { owner: string; repo: string };
      useOllama?: boolean;
      application?: string;
    };

    if (!Array.isArray(body.commits)) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Request body must include an array of "commits".',
      });
    }

    try {
      const consolidated = await ollamaService.consolidateCommits(body.commits, {
        model: body.model,
        repoInfo: body.repoInfo,
        useOllama: body.useOllama,
        application: body.application,
      });
      return reply.send(consolidated);
    } catch (err: any) {
      request.log.error(err, 'Failed to consolidate commit messages');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to consolidate commit messages.',
      });
    }
  });

  const extractCustomToken = (req: any, queryToken?: string): string | undefined => {
    const xTokenHeader = (req.headers['x-github-token'] as string | undefined)?.trim();
    if (xTokenHeader) return xTokenHeader;
    const authHeader = (req.headers['authorization'] as string | undefined)?.trim();
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7).trim();
    }
    if (queryToken?.trim()) return queryToken.trim();
    return undefined;
  };

  // GET /api/reports/github/applications
  fastify.get('/api/reports/github/applications', async (request, reply) => {
    const query = (request.query || {}) as {
      owner?: string;
      repo?: string;
      branch?: string;
      githubToken?: string;
    };

    if (!query.owner?.trim() || !query.repo?.trim()) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'Owner and repository parameters are required.',
      });
    }

    try {
      const githubToken = extractCustomToken(request, query.githubToken);
      const structureInfo = await reportService.detectApplications({
        owner: query.owner.trim(),
        repo: query.repo.trim(),
        branch: query.branch?.trim(),
        githubToken,
      });
      return reply.send(structureInfo);
    } catch (err: any) {
      if (err instanceof ReportServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to detect applications in repository');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to detect applications in repository.',
      });
    }
  });

  // GET /api/reports/github/commits
  fastify.get('/api/reports/github/commits', async (request, reply) => {
    const parseResult = gitHubReportQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
        details: parseResult.error.issues,
      });
    }

    try {
      const githubToken = extractCustomToken(request, parseResult.data.githubToken);
      const data = await reportService.generateReport({
        ...parseResult.data,
        githubToken,
      });
      return reply.send(data);
    } catch (err: any) {
      if (err instanceof ReportServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Unexpected error generating GitHub report');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'An unexpected error occurred while processing the GitHub report.',
      });
    }
  });

  // GET /api/reports/github/commits.xlsx
  fastify.get('/api/reports/github/commits.xlsx', async (request, reply) => {
    const parseResult = gitHubReportQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
      });
    }

    try {
      const githubToken = extractCustomToken(request, parseResult.data.githubToken);
      const reportData = await reportService.generateReport({
        ...parseResult.data,
        githubToken,
      });
      const appCode = (parseResult.data.application || reportData.metadata.application || '').toUpperCase();
      const sinceStr = parseResult.data.since ? `_${parseResult.data.since.substring(0, 10)}` : '';
      const untilStr = parseResult.data.until ? `_${parseResult.data.until.substring(0, 10)}` : '';

      // If "ALL" applications (or no specific application filter) is selected on a multi-app repository,
      // deliver a zipped archive containing individual Excel workbooks for every detected program.
      const isMultiApp = isMultiAppRepo(reportData);
      const resolvedApps = resolveApplicationsForMonorepo(reportData);

      if ((appCode === 'ALL' || !appCode) && (isMultiApp || resolvedApps.length > 1)) {
        const { zipBuffer, count } = await generateMultiAppZipArchive(reportData, resolvedApps);
        const zipFilename = `github-report_${parseResult.data.owner}_${parseResult.data.repo}_all_applications${sinceStr}${untilStr}.zip`;

        return reply
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', `attachment; filename="${zipFilename}"`)
          .header('X-Report-Applications-Count', String(count))
          .send(zipBuffer);
      }

      let targetApp = undefined;
      if (appCode && appCode !== 'ALL' && appCode !== 'ROOT') {
        const known = KNOWN_42SYSTEM_APPLICATIONS.find((a) => a.code === appCode);
        if (known) {
          targetApp = known;
        } else if (reportData.metadata.structureInfo?.applications) {
          const detected = reportData.metadata.structureInfo.applications.find(
            (a) => a.id.toUpperCase() === appCode || a.code.toUpperCase() === appCode
          );
          if (detected) {
            targetApp = {
              code: detected.code,
              name: detected.name,
              fullName: detected.fullName || `${detected.name} Application`,
              owningOffice: `${detected.fullName || detected.name} (${detected.code})`,
              path: detected.path,
              isRoot: detected.isRoot,
            };
          }
        }
      }
      const xlsxBuffer = await generateReportExcelWorkbook(reportData, targetApp);

      const appSuffix = targetApp ? `_${targetApp.code}` : '';
      const filename = `github-report_${parseResult.data.owner}_${parseResult.data.repo}${appSuffix}${sinceStr}${untilStr}.xlsx`;

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(xlsxBuffer);
    } catch (err: any) {
      if (err instanceof ReportServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Unexpected error generating XLSX report');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to generate Excel workbook.',
      });
    }
  });

  // GET /api/reports/github/commits.zip
  fastify.get('/api/reports/github/commits.zip', async (request, reply) => {
    const parseResult = gitHubReportQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid query parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
      });
    }

    try {
      const githubToken = extractCustomToken(request, parseResult.data.githubToken);
      const reportData = await reportService.generateReport({
        ...parseResult.data,
        githubToken,
      });
      const resolvedApps = resolveApplicationsForMonorepo(reportData);
      const { zipBuffer, count } = await generateMultiAppZipArchive(reportData, resolvedApps);

      const sinceStr = parseResult.data.since ? `_${parseResult.data.since.substring(0, 10)}` : '';
      const untilStr = parseResult.data.until ? `_${parseResult.data.until.substring(0, 10)}` : '';
      const zipFilename = `github-report_${parseResult.data.owner}_${parseResult.data.repo}_all_applications${sinceStr}${untilStr}.zip`;

      return reply
        .header('Content-Type', 'application/zip')
        .header('Content-Disposition', `attachment; filename="${zipFilename}"`)
        .header('X-Report-Applications-Count', String(count))
        .send(zipBuffer);
    } catch (err: any) {
      if (err instanceof ReportServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Unexpected error generating ZIP report');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to generate ZIP archive.',
      });
    }
  });
};
