import chatRoutes from './module/routes/chatRoutes.js';

const registerRoutes = (app) => {
    // Register your routes here
    app.use('/api/chat', chatRoutes);
  };
  
  export default registerRoutes;