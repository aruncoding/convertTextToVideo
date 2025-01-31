import PDFDocument from 'pdf-lib';
import fs from 'fs';
import mammoth from 'mammoth';

export const extractTextFromDocx = async (filePath) => {
    const result = await mammoth.extractRawText({ path: filePath });
    return result.value.replace(/\n{3,}/g, '\n\n'); // Clean up excessive newlines
};

export const extractTextFromPdf = async (filePath) => {
    const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath));
    return pdfDoc.getPages().map(page => {
        return page.getTextContent().items.map(item => item.str).join(' ');
    }).join('\n\n');
};