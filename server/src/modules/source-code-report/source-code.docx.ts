import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  VerticalAlign,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  PageBreak,
  ShadingType,
} from 'docx';
import type { ApplicationSourceBundle } from './source-code.types.js';

const FONT_PRIMARY = 'Century Gothic';
const FONT_CODE = 'Consolas';

const COLOR_BRAND = '1D4ED8';       // Dark blue
const COLOR_TITLE = '0F172A';       // Dark slate
const COLOR_SUBTITLE = '475569';    // Medium slate
const COLOR_LINE_NUM = '64748B';    // Slate gray for line numbers
const COLOR_CODE_TEXT = '0F172A';   // Dark text for code
const COLOR_BORDER = 'CBD5E1';      // Border gray
const COLOR_TH_BG = '1E293B';       // Table header background (dark slate)
const COLOR_TH_TEXT = 'FFFFFF';     // White
const COLOR_ROW_ALT = 'F8FAFC';     // Soft gray for alternating rows
const COLOR_CARD_BG = 'EFF6FF';     // Soft light blue for file banner card

export interface GenerateDocxOptions {
  includeLineNumbers?: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Generates a comprehensive Word document (.docx) compiling all source code
 * for an individual application.
 */
export async function generateApplicationSourceCodeDocx(
  bundle: ApplicationSourceBundle,
  options: GenerateDocxOptions = {}
): Promise<Buffer> {
  const { includeLineNumbers = true } = options;
  const { application, repository, files, totalFiles, totalLines, totalSize, languageStats } = bundle;

  const thinBorder = {
    style: BorderStyle.SINGLE,
    size: 4,
    color: COLOR_BORDER,
  };

  const tableBorders = {
    top: thinBorder,
    bottom: thinBorder,
    left: thinBorder,
    right: thinBorder,
    insideHorizontal: thinBorder,
    insideVertical: thinBorder,
  };

  const dateStr = new Date(bundle.generatedAt || Date.now()).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const languageSummaryStr = Object.entries(languageStats)
    .sort((a, b) => b[1] - a[1])
    .map(([lang, count]) => `${lang} (${count})`)
    .join(', ');

  // =========================================================================
  // Document Header & Footer
  // =========================================================================
  const docHeader = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { after: 120 },
        children: [
          new TextRun({
            text: `${application.code} — Source Code Specification  |  ${repository.owner}/${repository.repo}`,
            font: FONT_PRIMARY,
            size: 16, // 8pt
            color: COLOR_SUBTITLE,
            italics: true,
          }),
        ],
      }),
    ],
  });

  const docFooter = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.BOTH,
        spacing: { before: 120 },
        children: [
          new TextRun({
            text: `Generated: ${dateStr}  •  GitHub Development Report Generator`,
            font: FONT_PRIMARY,
            size: 16, // 8pt
            color: COLOR_SUBTITLE,
          }),
          new TextRun({
            text: '         Page ',
            font: FONT_PRIMARY,
            size: 16,
            color: COLOR_SUBTITLE,
          }),
          new TextRun({
            children: [PageNumber.CURRENT],
            font: FONT_PRIMARY,
            size: 16,
            color: COLOR_SUBTITLE,
          }),
          new TextRun({
            text: ' of ',
            font: FONT_PRIMARY,
            size: 16,
            color: COLOR_SUBTITLE,
          }),
          new TextRun({
            children: [PageNumber.TOTAL_PAGES],
            font: FONT_PRIMARY,
            size: 16,
            color: COLOR_SUBTITLE,
          }),
        ],
      }),
    ],
  });

  // =========================================================================
  // Section 1: Title & Overview Cover Elements
  // =========================================================================
  const titleParagraph = new Paragraph({
    spacing: { before: 240, after: 80 },
    children: [
      new TextRun({
        text: 'APPLICATION SOURCE CODE SPECIFICATION',
        bold: true,
        size: 34, // 17pt
        font: FONT_PRIMARY,
        color: COLOR_TITLE,
      }),
    ],
  });

  const appSubtitleParagraph = new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: `${application.name}`,
        bold: true,
        size: 24, // 12pt
        font: FONT_PRIMARY,
        color: COLOR_BRAND,
      }),
      new TextRun({
        text: application.fullName && application.fullName !== application.name ? ` — ${application.fullName}` : '',
        font: FONT_PRIMARY,
        size: 20, // 10pt
        color: COLOR_SUBTITLE,
      }),
    ],
  });

  const descParagraph = new Paragraph({
    spacing: { after: 240 },
    children: [
      new TextRun({
        text: `This technical documentation contains the consolidated source code compiled for the `,
        font: FONT_PRIMARY,
        size: 20,
        color: COLOR_SUBTITLE,
      }),
      new TextRun({
        text: application.code,
        bold: true,
        font: FONT_PRIMARY,
        size: 20,
        color: COLOR_TITLE,
      }),
      new TextRun({
        text: ` application within `,
        font: FONT_PRIMARY,
        size: 20,
        color: COLOR_SUBTITLE,
      }),
      new TextRun({
        text: `${repository.owner}/${repository.repo}`,
        bold: true,
        font: FONT_PRIMARY,
        size: 20,
        color: COLOR_TITLE,
      }),
      new TextRun({
        text: ` (branch: ${repository.branch}). It serves as an audit-ready, full source code compilation archive.`,
        font: FONT_PRIMARY,
        size: 20,
        color: COLOR_SUBTITLE,
      }),
    ],
  });

  // Metadata Summary Card Table
  const metadataRows: TableRow[] = [
    // Header
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnSpan: 2,
          shading: { type: ShadingType.CLEAR, fill: 'F1F5F9' },
          children: [
            new Paragraph({
              spacing: { before: 80, after: 80 },
              alignment: AlignmentType.LEFT,
              children: [
                new TextRun({
                  text: 'APPLICATION & REPOSITORY METADATA',
                  bold: true,
                  font: FONT_PRIMARY,
                  size: 18,
                  color: COLOR_TITLE,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
    // Key/Value Pairs
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 60, after: 40 },
              children: [
                new TextRun({ text: 'Application: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: `${application.code} (${application.fullName || application.name})`, font: FONT_PRIMARY, size: 18 }),
              ],
            }),
            new Paragraph({
              spacing: { before: 40, after: 60 },
              children: [
                new TextRun({ text: 'Repository: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: `${repository.owner}/${repository.repo} (${repository.branch})`, font: FONT_PRIMARY, size: 18 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 60, after: 40 },
              children: [
                new TextRun({ text: 'Total Compiled Files: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: `${totalFiles} source files`, font: FONT_PRIMARY, size: 18 }),
              ],
            }),
            new Paragraph({
              spacing: { before: 40, after: 60 },
              children: [
                new TextRun({ text: 'Total Lines of Code: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: `${totalLines.toLocaleString()} LOC`, font: FONT_PRIMARY, size: 18 }),
              ],
            }),
          ],
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({ text: 'Total Source Size: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: formatBytes(totalSize), font: FONT_PRIMARY, size: 18 }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 50, type: WidthType.PERCENTAGE },
          children: [
            new Paragraph({
              spacing: { before: 60, after: 60 },
              children: [
                new TextRun({ text: 'Languages Breakdown: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                new TextRun({ text: languageSummaryStr || 'N/A', font: FONT_PRIMARY, size: 18 }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  if (application.owningOffice) {
    metadataRows.push(
      new TableRow({
        children: [
          new TableCell({
            width: { size: 100, type: WidthType.PERCENTAGE },
            columnSpan: 2,
            children: [
              new Paragraph({
                spacing: { before: 60, after: 60 },
                children: [
                  new TextRun({ text: 'Owning Office: ', bold: true, font: FONT_PRIMARY, size: 18 }),
                  new TextRun({ text: application.owningOffice, font: FONT_PRIMARY, size: 18 }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  const metadataTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: metadataRows,
  });

  // =========================================================================
  // Section 2: Source Code File Directory (TOC)
  // =========================================================================
  const directoryHeaderPara = new Paragraph({
    spacing: { before: 360, after: 120 },
    children: [
      new TextRun({
        text: 'SOURCE CODE FILE DIRECTORY',
        bold: true,
        size: 24, // 12pt
        font: FONT_PRIMARY,
        color: COLOR_TITLE,
      }),
    ],
  });

  const directoryDescPara = new Paragraph({
    spacing: { after: 160 },
    children: [
      new TextRun({
        text: `The following ${files.length} source code files are compiled into this application document:`,
        font: FONT_PRIMARY,
        size: 18,
        color: COLOR_SUBTITLE,
      }),
    ],
  });

  const tocRows: TableRow[] = [
    // Header Row
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 6, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_TH_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: '#', bold: true, font: FONT_PRIMARY, size: 18, color: COLOR_TH_TEXT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 54, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_TH_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: 'File Path', bold: true, font: FONT_PRIMARY, size: 18, color: COLOR_TH_TEXT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_TH_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: 'Language', bold: true, font: FONT_PRIMARY, size: 18, color: COLOR_TH_TEXT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 11, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_TH_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: 'Lines', bold: true, font: FONT_PRIMARY, size: 18, color: COLOR_TH_TEXT })],
            }),
          ],
        }),
        new TableCell({
          width: { size: 11, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.CLEAR, fill: COLOR_TH_BG },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 80, after: 80 },
              children: [new TextRun({ text: 'Size', bold: true, font: FONT_PRIMARY, size: 18, color: COLOR_TH_TEXT })],
            }),
          ],
        }),
      ],
    }),
  ];

  // Data Rows
  files.forEach((file, index) => {
    const isAlt = index % 2 === 1;
    const fill = isAlt ? COLOR_ROW_ALT : 'FFFFFF';

    tocRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            width: { size: 6, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: String(index + 1), font: FONT_PRIMARY, size: 17, color: COLOR_SUBTITLE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 54, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: file.relativePath || file.path,
                    font: FONT_CODE,
                    size: 16,
                    color: COLOR_TITLE,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: file.language, font: FONT_PRIMARY, size: 17, color: COLOR_SUBTITLE })],
              }),
            ],
          }),
          new TableCell({
            width: { size: 11, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40, after: 40 },
                children: [
                  new TextRun({
                    text: file.linesCount.toLocaleString(),
                    font: FONT_PRIMARY,
                    size: 17,
                    color: COLOR_TITLE,
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: 11, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.CLEAR, fill },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({ text: formatBytes(file.size), font: FONT_PRIMARY, size: 17, color: COLOR_SUBTITLE })],
              }),
            ],
          }),
        ],
      })
    );
  });

  const tocTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: tocRows,
  });

  // =========================================================================
  // Section 3: Source Code Listings
  // =========================================================================
  const listingsHeaderPara = new Paragraph({
    spacing: { before: 400, after: 120 },
    children: [
      new TextRun({
        text: 'APPLICATION SOURCE CODE LISTINGS',
        bold: true,
        size: 26, // 13pt
        font: FONT_PRIMARY,
        color: COLOR_TITLE,
      }),
    ],
  });

  const fileSectionsElements: (Paragraph | Table)[] = [];

  for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
    const file = files[fileIdx];

    // Page Break before each file (except immediately after title if desired, but consistent page break is cleanest)
    fileSectionsElements.push(
      new Paragraph({
        children: [new PageBreak()],
      })
    );

    // File Header Banner Card
    const bannerTable = new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        bottom: { style: BorderStyle.SINGLE, size: 8, color: COLOR_BORDER },
        left: { style: BorderStyle.SINGLE, size: 24, color: COLOR_BRAND }, // Bold accent left border
        right: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideHorizontal: { style: BorderStyle.NONE, size: 0, color: 'auto' },
        insideVertical: { style: BorderStyle.NONE, size: 0, color: 'auto' },
      },
      rows: [
        new TableRow({
          cantSplit: true,
          children: [
            new TableCell({
              width: { size: 100, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.CLEAR, fill: COLOR_CARD_BG },
              children: [
                new Paragraph({
                  spacing: { before: 80, after: 40 },
                  children: [
                    new TextRun({
                      text: `[${fileIdx + 1}/${files.length}]  `,
                      bold: true,
                      font: FONT_PRIMARY,
                      size: 20,
                      color: COLOR_BRAND,
                    }),
                    new TextRun({
                      text: file.relativePath || file.path,
                      bold: true,
                      font: FONT_CODE,
                      size: 22, // 11pt
                      color: COLOR_TITLE,
                    }),
                  ],
                }),
                new Paragraph({
                  spacing: { before: 0, after: 80 },
                  children: [
                    new TextRun({
                      text: `Language: ${file.language}   •   Lines: ${file.linesCount.toLocaleString()} LOC   •   Size: ${formatBytes(file.size)}`,
                      font: FONT_PRIMARY,
                      size: 16, // 8pt
                      color: COLOR_SUBTITLE,
                    }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });

    fileSectionsElements.push(bannerTable);

    // Spacing between banner and code block
    fileSectionsElements.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        children: [],
      })
    );

    // Code lines
    const rawContent = file.content || '// (Empty file)';
    const lines = rawContent.split(/\r?\n/);
    const totalLinesInFile = lines.length;
    const padWidth = String(totalLinesInFile).length;

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const lineNum = lineIndex + 1;
      const originalLine = lines[lineIndex];
      // Expand tabs to 2 spaces for consistent alignment
      const expandedLine = originalLine.replace(/\t/g, '  ');

      const runs: TextRun[] = [];

      if (includeLineNumbers) {
        const lineNumStr = String(lineNum).padStart(padWidth, ' ');
        runs.push(
          new TextRun({
            text: `${lineNumStr} │ `,
            font: FONT_CODE,
            size: 16, // 8pt
            color: COLOR_LINE_NUM,
          })
        );
      }

      runs.push(
        new TextRun({
          text: expandedLine.length > 0 ? expandedLine : ' ',
          font: FONT_CODE,
          size: 16, // 8pt
          color: COLOR_CODE_TEXT,
        })
      );

      const codeLineParagraph = new Paragraph({
        spacing: { before: 0, after: 0, line: 220 }, // Tight line height
        shading: { type: ShadingType.CLEAR, fill: 'F8FAFC' },
        border: {
          left: { color: 'E2E8F0', size: 8, style: BorderStyle.SINGLE },
          right: { color: 'E2E8F0', size: 4, style: BorderStyle.SINGLE },
        },
        children: runs,
      });

      fileSectionsElements.push(codeLineParagraph);
    }
  }

  // =========================================================================
  // Document Assembly
  // =========================================================================
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440,    // 1 inch
              right: 1440,
              bottom: 1440,
              left: 1440,
            },
          },
        },
        headers: {
          default: docHeader,
        },
        footers: {
          default: docFooter,
        },
        children: [
          titleParagraph,
          appSubtitleParagraph,
          descParagraph,
          metadataTable,
          directoryHeaderPara,
          directoryDescPara,
          tocTable,
          listingsHeaderPara,
          ...fileSectionsElements,
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
