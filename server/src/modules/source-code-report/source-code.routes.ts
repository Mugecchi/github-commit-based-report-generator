import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  sourceCodeDownloadQuerySchema,
  sourceCodeScanQuerySchema,
} from './source-code.schema.js';
import { SourceCodeReportService, SourceCodeServiceError } from './source-code.service.js';
import { generateApplicationSourceCodeDocx } from './source-code.docx.js';
import { generateAllApplicationsSourceCodeZip } from './source-code.zip.js';

export const sourceCodeRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new SourceCodeReportService();

  const extractCustomToken = (req: any, explicitToken?: string): string | undefined => {
    const xTokenHeader = (req.headers['x-github-token'] as string | undefined)?.trim();
    if (xTokenHeader) return xTokenHeader;
    const authHeader = (req.headers['authorization'] as string | undefined)?.trim();
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7).trim();
    }
    if (explicitToken?.trim()) return explicitToken.trim();
    return undefined;
  };

  // GET /api/reports/source-code/scan
  fastify.get('/api/reports/source-code/scan', async (request, reply) => {
    const parseResult = sourceCodeScanQuerySchema.safeParse(request.query);

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
      const customToken = extractCustomToken(request, parseResult.data.githubToken);
      const scanResult = await service.scanRepository({
        ...parseResult.data,
        githubToken: customToken,
      });
      return reply.send(scanResult);
    } catch (err: any) {
      if (err instanceof SourceCodeServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to scan repository source files');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to scan repository for source code files.',
      });
    }
  });

  // POST /api/reports/source-code/scan
  fastify.post('/api/reports/source-code/scan', async (request, reply) => {
    const parseResult = sourceCodeScanQuerySchema.safeParse(request.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
        details: parseResult.error.issues,
      });
    }

    try {
      const customToken = extractCustomToken(request, parseResult.data.githubToken);
      const scanResult = await service.scanRepository({
        ...parseResult.data,
        githubToken: customToken,
      });
      return reply.send(scanResult);
    } catch (err: any) {
      if (err instanceof SourceCodeServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to scan repository source files');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to scan repository for source code files.',
      });
    }
  });

  // GET /api/reports/source-code/download
  fastify.get('/api/reports/source-code/download', async (request, reply) => {
    const parseResult = sourceCodeDownloadQuerySchema.safeParse(request.query);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid download parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
        details: parseResult.error.issues,
      });
    }

    try {
      const customToken = extractCustomToken(request, parseResult.data.githubToken);
      const params = {
        ...parseResult.data,
        githubToken: customToken,
      };

      const cleanRepo = params.repo.replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetApp = (params.application || 'ALL').toUpperCase();

      // If "ALL" applications requested: generate one Word doc per application, bundled in ZIP
      if (targetApp === 'ALL') {
        const bundles = await service.compileAllApplicationBundles(params);

        if (bundles.length === 0) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'No application source code found to compile.',
          });
        }

        // If only 1 application in repository, return the single docx directly
        if (bundles.length === 1) {
          const singleBundle = bundles[0];
          const docxBuffer = await generateApplicationSourceCodeDocx(singleBundle, {
            includeLineNumbers: params.includeLineNumbers,
          });
          const cleanAppCode = singleBundle.application.code.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${cleanRepo}_${cleanAppCode}_Source_Code.docx`;

          return reply
            .header(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(docxBuffer);
        }

        const { zipBuffer, count } = await generateAllApplicationsSourceCodeZip(bundles, {
          includeLineNumbers: params.includeLineNumbers,
        });

        const zipFilename = `${cleanRepo}_all_applications_source_code.zip`;

        return reply
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', `attachment; filename="${zipFilename}"`)
          .header('X-Applications-Count', String(count))
          .send(zipBuffer);
      }

      // Single specific application
      const bundle = await service.compileApplicationBundle(
        params,
        targetApp,
        params.selectedFiles
      );

      const docxBuffer = await generateApplicationSourceCodeDocx(bundle, {
        includeLineNumbers: params.includeLineNumbers,
      });

      const cleanAppCode = bundle.application.code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanRepo}_${cleanAppCode}_Source_Code.docx`;

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(docxBuffer);
    } catch (err: any) {
      if (err instanceof SourceCodeServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to generate source code document');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to compile application source code document.',
      });
    }
  });

  // POST /api/reports/source-code/download
  fastify.post('/api/reports/source-code/download', async (request, reply) => {
    const parseResult = sourceCodeDownloadQuerySchema.safeParse(request.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid download parameters';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
        details: parseResult.error.issues,
      });
    }

    try {
      const customToken = extractCustomToken(request, parseResult.data.githubToken);
      const params = {
        ...parseResult.data,
        githubToken: customToken,
      };

      const cleanRepo = params.repo.replace(/[^a-zA-Z0-9_-]/g, '_');
      const targetApp = (params.application || 'ALL').toUpperCase();

      if (targetApp === 'ALL') {
        const bundles = await service.compileAllApplicationBundles(params);

        if (bundles.length === 0) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'Not Found',
            message: 'No application source code found to compile.',
          });
        }

        if (bundles.length === 1) {
          const singleBundle = bundles[0];
          const docxBuffer = await generateApplicationSourceCodeDocx(singleBundle, {
            includeLineNumbers: params.includeLineNumbers,
          });
          const cleanAppCode = singleBundle.application.code.replace(/[^a-zA-Z0-9_-]/g, '_');
          const filename = `${cleanRepo}_${cleanAppCode}_Source_Code.docx`;

          return reply
            .header(
              'Content-Type',
              'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            )
            .header('Content-Disposition', `attachment; filename="${filename}"`)
            .send(docxBuffer);
        }

        const { zipBuffer, count } = await generateAllApplicationsSourceCodeZip(bundles, {
          includeLineNumbers: params.includeLineNumbers,
        });

        const zipFilename = `${cleanRepo}_all_applications_source_code.zip`;

        return reply
          .header('Content-Type', 'application/zip')
          .header('Content-Disposition', `attachment; filename="${zipFilename}"`)
          .header('X-Applications-Count', String(count))
          .send(zipBuffer);
      }

      const bundle = await service.compileApplicationBundle(
        params,
        targetApp,
        params.selectedFiles
      );

      const docxBuffer = await generateApplicationSourceCodeDocx(bundle, {
        includeLineNumbers: params.includeLineNumbers,
      });

      const cleanAppCode = bundle.application.code.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${cleanRepo}_${cleanAppCode}_Source_Code.docx`;

      return reply
        .header(
          'Content-Type',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(docxBuffer);
    } catch (err: any) {
      if (err instanceof SourceCodeServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to generate source code document');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: err.message || 'Failed to compile application source code document.',
      });
    }
  });
};
