import PDFDocument from 'pdf-lib';
import fs from 'fs';
import mammoth from 'mammoth';

// Extract text from .docx file
export const extractTextFromDocx = async (filePath) => {
    console.log("docx filepathsfsdf",filePath);
    // Check if the file exists
    if (!fs.existsSync(filePath)) {
        throw new Error(`File does not exist at path: ${filePath}`);
    }
    try{
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value;
    }catch(e){
        console.log("error of docx",e)
    }
  
};

// Extract text from .pdf file
export const extractTextFromPdf = async (filePath) => {
  const pdfDoc = await PDFDocument.load(fs.readFileSync(filePath));
  const content = pdfDoc.getTextContent().items.map((item) => item.str).join(' ');
  return content;
};