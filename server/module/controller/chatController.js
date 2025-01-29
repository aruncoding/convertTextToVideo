import axios from 'axios';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import PDFDocument from 'pdf-lib';
import mammoth from 'mammoth';
import { fileURLToPath } from 'url';
import { extractTextFromDocx, extractTextFromPdf } from '../services/fileService.js';
import {convertTextToSpeech} from '../services/textToSpeechService.js';
import {createVideoFromAudio} from '../services/videoService.js'

dotenv.config(); // Load environment variables from .env

class ChatController {
    static getAllChat = async (req, res) => {
        const userQuery = req.body.query; // Assuming the query comes from the request body
        console.log("userQuery", userQuery)
        if (!userQuery) {
            return res.status(400).json({ error: 'Query is required' });
        }

        try {
            // Call the OpenAI API
            const openaiResponse = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: 'gpt-3.5-turbo', // Specify the model
                    messages: [
                        {
                            role: 'user',
                            content: userQuery,
                        },
                    ],
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // Extract the reply from OpenAI's response
            const reply = openaiResponse.data.choices[0].message.content;

            // Send the reply back to the client
            res.status(200).json({ reply });
        } catch (error) {
            console.error('Error while communicating with OpenAI:', error.message);
            res.status(500).json({ error: 'An error occurred while processing your request.' });
        }
    }

    static processDocument = async (req, res) => {
        try {
            const __filename = fileURLToPath(import.meta.url);
            const __dirname = path.dirname(__filename);
            console.log("dsgdsgsdg",path.join(__dirname, '../../output/output.mp3'));
            const filePath = req.file.path;
            console.log(filePath, "filespathsfs")
            const fileType = path.extname(req.file.originalname).toLowerCase();
            const outputAudioPath = path.join(__dirname, '../../output/output.mp3');
            const outputVideoPath = path.join(__dirname, '../../output/output.mp4');
            const imagesDirectory = 'C:/Users/mindz/Pictures/javascriptImage'
            let content = '';

            // Extract text from file
            if (fileType === '.docx') {
                console.log("docx call")
                content = await extractTextFromDocx(filePath);
            } else if (fileType === '.pdf') {
                content = await extractTextFromPdf(filePath);
            } else {
                return res.status(400).json({ error: 'Unsupported file type' });
            }
            // Convert text to speech
            await convertTextToSpeech(content, outputAudioPath);

            // Create video from audio
            await createVideoFromAudio(outputAudioPath, content, outputVideoPath);

            res.json({
                message: 'File processed successfully!',
                audioPath: '/output/output.mp3',
                videoPath: '/output/output.mp4',
            });
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

}

export default ChatController