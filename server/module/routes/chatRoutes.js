import express from "express";
const router = express.Router();
import ChatController from "../controller/chatController.js";
import multer from "multer";
import path from 'path'; 
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Configure Multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '../../uploads'),
});

router.post('/chat', ChatController.getAllChat)
router.post('/convert/video',upload.single('file'), ChatController.processDocument)

export default router;