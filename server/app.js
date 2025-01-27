import dotenv from 'dotenv'
dotenv.config() // Make availble all variable created on .env file to access to this page
import express from 'express'
import cors from 'cors'
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import registerRoutes from './registerRoutes.js';
import db from './models/index.js';
import path, { dirname, join } from 'path'; 
import { fileURLToPath } from 'url';

const app = express()
const port = process.env.PORT || 5000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

app.use(cookieParser());
app.use(bodyParser.json());
app.use(cors());

registerRoutes(app);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use('/output', express.static(path.join(__dirname, 'output')));

db.sequelize.sync({alter : true})
    .then(() => {
      console.log("Synced db success...");
    }).catch((err) => {
      console.log("Failed to sync db...", err.message)
    });

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});