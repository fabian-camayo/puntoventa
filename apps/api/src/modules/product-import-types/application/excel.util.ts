import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';

export async function readExcelHeaders(
  buffer: Buffer,
  headerRow = 1,
): Promise<{ headers: string[]; sheetName?: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('El archivo Excel no tiene hojas');

  const row = sheet.getRow(headerRow);
  const headers: string[] = [];
  row.eachCell({ includeEmpty: false }, (cell) => {
    const value = cellValueToString(cell.value).trim();
    if (value) headers.push(value);
  });

  if (!headers.length) {
    throw new BadRequestException(
      `No se encontraron encabezados en la fila ${headerRow}`,
    );
  }

  return { headers, sheetName: sheet.name };
}

export async function readExcelDataRows(
  buffer: Buffer,
  headerRow = 1,
): Promise<{ headers: string[]; rows: Array<Record<string, string>> }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new BadRequestException('El archivo Excel no tiene hojas');

  const headerRowData = sheet.getRow(headerRow);
  const colIndexToHeader = new Map<number, string>();
  headerRowData.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const header = cellValueToString(cell.value).trim();
    if (header) colIndexToHeader.set(colNumber, header);
  });

  if (!colIndexToHeader.size) {
    throw new BadRequestException(
      `No se encontraron encabezados en la fila ${headerRow}`,
    );
  }

  const headers = [...colIndexToHeader.values()];
  const rows: Array<Record<string, string>> = [];

  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const record: Record<string, string> = {};
    let hasValue = false;
    for (const [col, header] of colIndexToHeader) {
      const raw = cellValueToString(row.getCell(col).value).trim();
      if (raw) hasValue = true;
      record[header] = raw;
    }
    if (hasValue) rows.push(record);
  });

  return { headers, rows };
}

function cellValueToString(value: ExcelJS.CellValue): string {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    if ('text' in value && value.text != null) return String(value.text);
    if ('result' in value && value.result != null) return String(value.result);
    if ('richText' in value && Array.isArray(value.richText)) {
      return value.richText.map((p) => p.text).join('');
    }
  }
  return String(value);
}
