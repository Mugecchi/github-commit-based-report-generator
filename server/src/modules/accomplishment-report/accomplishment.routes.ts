import { FastifyInstance, FastifyPluginAsync } from 'fastify';
import {
  generateAccomplishmentSchema,
  downloadAccomplishmentDocxSchema,
} from './accomplishment.schema.js';
import { AccomplishmentService } from './accomplishment.service.js';
import { generateAccomplishmentDocx } from './accomplishment.docx.js';
import { ReportServiceError } from '../github-report/report.service.js';

export const accomplishmentRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  const service = new AccomplishmentService();

  const extractCustomToken = (req: any, bodyToken?: string): string | undefined => {
    const xTokenHeader = (req.headers['x-github-token'] as string | undefined)?.trim();
    if (xTokenHeader) return xTokenHeader;
    const authHeader = (req.headers['authorization'] as string | undefined)?.trim();
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return authHeader.substring(7).trim();
    }
    if (bodyToken?.trim()) return bodyToken.trim();
    return undefined;
  };

  // POST /api/reports/accomplishment/calendar
  // Quickly generates the initial calendar days checklist for a date range
  fastify.post('/api/reports/accomplishment/calendar', async (request, reply) => {
    const body = (request.body || {}) as {
      startDate?: string;
      endDate?: string;
      excludeFridays?: boolean;
      excludeWeekends?: boolean;
      hoursPerDay?: string;
    };

    if (!body.startDate || !body.endDate) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: 'startDate and endDate are required.',
      });
    }

    try {
      const days = service.generateCalendarDays(body.startDate, body.endDate, {
        excludeFridays: body.excludeFridays !== false,
        excludeWeekends: body.excludeWeekends !== false,
        hoursPerDay: body.hoursPerDay || '10 hours',
      });
      const periodLabel = service.formatPeriodLabel(body.startDate, body.endDate);

      return reply.send({
        periodLabel,
        days,
      });
    } catch (err: any) {
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: err.message || 'Failed to generate calendar days.',
      });
    }
  });

  // POST /api/reports/accomplishment/generate
  // Generates populated report data (disregarding commit dates)
  fastify.post('/api/reports/accomplishment/generate', async (request, reply) => {
    const parseResult = generateAccomplishmentSchema.safeParse(request.body);

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
      const reportData = await service.generateReport({
        ...parseResult.data,
        githubToken: customToken,
      });
      return reply.send(reportData);
    } catch (err: any) {
      if (err instanceof ReportServiceError) {
        return reply.status(err.statusCode).send({
          statusCode: err.statusCode,
          error: err.name,
          message: err.message,
        });
      }

      request.log.error(err, 'Failed to generate accomplishment report');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to generate accomplishment report from commits.',
      });
    }
  });

  // POST /api/reports/accomplishment/docx
  // Generates and downloads the Word document
  fastify.post('/api/reports/accomplishment/docx', async (request, reply) => {
    const parseResult = downloadAccomplishmentDocxSchema.safeParse(request.body);

    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid report data';
      return reply.status(400).send({
        statusCode: 400,
        error: 'Bad Request',
        message: firstError,
      });
    }

    try {
      const { reportData } = parseResult.data;
      const docxBuffer = await generateAccomplishmentDocx(reportData as any);

      const safeName = reportData.metadata.name.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Accomplishment_Report_${safeName}_${reportData.metadata.startDate}_to_${reportData.metadata.endDate}.docx`;

      return reply
        .header('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
        .header('Content-Disposition', `attachment; filename="${filename}"`)
        .send(docxBuffer);
    } catch (err: any) {
      request.log.error(err, 'Failed to export Word document');
      return reply.status(500).send({
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Failed to export Accomplishment Report as Word document.',
      });
    }
  });
};
