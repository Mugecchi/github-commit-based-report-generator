import { PassThrough } from 'node:stream';
import { ZipArchive } from 'archiver';
import { generateApplicationSourceCodeDocx, GenerateDocxOptions } from './source-code.docx.js';
import type { ApplicationSourceBundle } from './source-code.types.js';

export interface MultiAppSourceCodeZipResult {
  zipBuffer: Buffer;
  count: number;
  filenames: string[];
}

/**
 * Compiles each application source bundle into its own individual Word document (.docx)
 * and packages all documents into a compressed ZIP archive.
 */
export async function generateAllApplicationsSourceCodeZip(
  bundles: ApplicationSourceBundle[],
  options: GenerateDocxOptions = {}
): Promise<MultiAppSourceCodeZipResult> {
  const generatedFiles: Array<{ filename: string; buffer: Buffer }> = [];

  for (const bundle of bundles) {
    const docxBuffer = await generateApplicationSourceCodeDocx(bundle, options);
    const cleanRepo = bundle.repository.repo.replace(/[^a-zA-Z0-9_-]/g, '_');
    const cleanAppCode = bundle.application.code.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = `${cleanRepo}_${cleanAppCode}_Source_Code.docx`;

    generatedFiles.push({
      filename,
      buffer: docxBuffer,
    });
  }

  const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
    const archive = new ZipArchive({ zlib: { level: 9 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];

    passthrough.on('data', (chunk) => chunks.push(chunk));
    passthrough.on('end', () => resolve(Buffer.concat(chunks)));
    passthrough.on('error', (err) => reject(err));
    archive.on('error', (err) => reject(err));

    archive.pipe(passthrough);

    for (const item of generatedFiles) {
      archive.append(item.buffer, { name: item.filename });
    }

    archive.finalize().catch(reject);
  });

  return {
    zipBuffer,
    count: generatedFiles.length,
    filenames: generatedFiles.map((f) => f.filename),
  };
}
