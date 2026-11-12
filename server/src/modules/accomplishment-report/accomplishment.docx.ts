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
} from 'docx';
import { AccomplishmentReportData } from './accomplishment.types.js';

const FONT_FAMILY = 'Century Gothic';
const FONT_SIZE_HALF_PTS = 22; // 11pt = 22 half-pts

export async function generateAccomplishmentDocx(
  data: AccomplishmentReportData
): Promise<Buffer> {
  const { metadata, days } = data;

  const singleBorder = {
    style: BorderStyle.SINGLE,
    size: 4, // 0.5 pt
    color: '000000',
  };

  const tableBorders = {
    top: singleBorder,
    bottom: singleBorder,
    left: singleBorder,
    right: singleBorder,
    insideHorizontal: singleBorder,
    insideVertical: singleBorder,
  };

  const noBorder = {
    style: BorderStyle.NONE,
    size: 0,
    color: 'auto',
  };

  const noBorders = {
    top: noBorder,
    bottom: noBorder,
    left: noBorder,
    right: noBorder,
    insideHorizontal: noBorder,
    insideVertical: noBorder,
  };

  // Filter out excluded days for the document table
  const visibleDays = days.filter((d) => d.status !== 'excluded');

  // Build table rows
  const tableRows: TableRow[] = [
    // Header Row
    new TableRow({
      cantSplit: true,
      children: [
        new TableCell({
          width: { size: 20, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new TextRun({
                  text: 'Date',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZE_HALF_PTS,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 45, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new TextRun({
                  text: 'Accomplishment/Outputs',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZE_HALF_PTS,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 17, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new TextRun({
                  text: 'Time Spent',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZE_HALF_PTS,
                }),
              ],
            }),
          ],
        }),
        new TableCell({
          width: { size: 18, type: WidthType.PERCENTAGE },
          verticalAlign: VerticalAlign.CENTER,
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 120, after: 120 },
              children: [
                new TextRun({
                  text: 'Remarks',
                  bold: true,
                  font: FONT_FAMILY,
                  size: FONT_SIZE_HALF_PTS,
                }),
              ],
            }),
          ],
        }),
      ],
    }),
  ];

  // Data rows
  for (const day of visibleDays) {
    let accomplishmentParas: Paragraph[];
    let timeSpentText = '';
    let remarksText = '';

    if (day.status === 'working') {
      timeSpentText = day.timeSpent || metadata.hoursPerDay || '10 hours';
      remarksText = day.remarks || '';

      // Format bullet accomplishment
      const text = day.accomplishment || '';
      accomplishmentParas = [
        new Paragraph({
          bullet: { level: 0 },
          spacing: { before: 60, after: 60, line: 278 },
          children: [
            new TextRun({
              text,
              font: FONT_FAMILY,
              size: FONT_SIZE_HALF_PTS,
            }),
          ],
        }),
      ];
    } else if (day.status === 'holiday') {
      timeSpentText = 'Holiday';
      remarksText = '';
      accomplishmentParas = [
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [],
        }),
      ];
    } else if (day.status === 'leave') {
      timeSpentText = 'On Leave';
      remarksText = '';
      accomplishmentParas = [
        new Paragraph({
          spacing: { before: 60, after: 60 },
          children: [],
        }),
      ];
    } else {
      continue;
    }

    tableRows.push(
      new TableRow({
        cantSplit: true,
        children: [
          // Date
          new TableCell({
            width: { size: 20, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: day.formattedDate,
                    font: FONT_FAMILY,
                    size: FONT_SIZE_HALF_PTS,
                  }),
                ],
              }),
            ],
          }),
          // Accomplishment / Outputs
          new TableCell({
            width: { size: 45, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: accomplishmentParas,
          }),
          // Time Spent
          new TableCell({
            width: { size: 17, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: timeSpentText,
                    font: FONT_FAMILY,
                    size: FONT_SIZE_HALF_PTS,
                  }),
                ],
              }),
            ],
          }),
          // Remarks
          new TableCell({
            width: { size: 18, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80, after: 80 },
                children: [
                  new TextRun({
                    text: remarksText,
                    font: FONT_FAMILY,
                    size: FONT_SIZE_HALF_PTS,
                  }),
                ],
              }),
            ],
          }),
        ],
      })
    );
  }

  // Construct Document
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              bottom: 720,
              left: 720,
              right: 720,
            },
          },
        },
        children: [
          // Header titles
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 0 },
            children: [
              new TextRun({
                text: 'Accomplishment Report for the Month of',
                bold: true,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 180 },
            children: [
              new TextRun({
                text: metadata.periodLabel,
                bold: true,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
            ],
          }),

          // Empty line
          new Paragraph({
            spacing: { after: 60 },
            children: [],
          }),

          // Employee Details
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: 'Name: ',
                bold: true,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
              new TextRun({
                text: metadata.name,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 40 },
            children: [
              new TextRun({
                text: 'Office: ',
                bold: true,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
              new TextRun({
                text: metadata.office,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
            ],
          }),
          new Paragraph({
            spacing: { after: 160 },
            children: [
              new TextRun({
                text: 'Position/Designation: ',
                bold: true,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
              new TextRun({
                text: metadata.position,
                font: FONT_FAMILY,
                size: FONT_SIZE_HALF_PTS,
              }),
            ],
          }),

          // The Main Accomplishment Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: tableBorders,
            rows: tableRows,
          }),

          // Spacing before signatures
          new Paragraph({
            spacing: { before: 240, after: 120 },
            children: [],
          }),

          // Signatory block (2-column borderless table)
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            borders: noBorders,
            rows: [
              new TableRow({
                children: [
                  // Left: Prepared By
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        spacing: { after: 280 },
                        children: [
                          new TextRun({
                            text: 'Prepared by:',
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 20 },
                        children: [
                          new TextRun({
                            text: metadata.name.toUpperCase(),
                            bold: true,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: metadata.position,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                    ],
                  }),
                  // Right: Noted By
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    children: [
                      new Paragraph({
                        spacing: { after: 280 },
                        children: [
                          new TextRun({
                            text: 'Noted by:',
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                      new Paragraph({
                        spacing: { after: 20 },
                        children: [
                          new TextRun({
                            text: metadata.notedByName.toUpperCase(),
                            bold: true,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: metadata.notedByPosition,
                            font: FONT_FAMILY,
                            size: FONT_SIZE_HALF_PTS,
                          }),
                        ],
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      },
    ],
  });

  return await Packer.toBuffer(doc);
}
