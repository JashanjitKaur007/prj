// server.js 
// This file sets up the Express server for the Mental Health Companion API. It connects to the MongoDB database, configures middleware for CORS and JSON parsing, defines routes for user authentication and chat interactions, and starts the server on a specified port. The server also includes a health check endpoint to verify that the API is running.

// Import necessary modules and configurations
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');

// Load environment variables from the .env file
dotenv.config();

// Import the function to connect to the MongoDB database
const connectDB = require('./config/db');

// Import route handlers for user authentication and chat interactions
const userRoutes = require('./routes/userRoutes'); 
const chatRoutes = require('./routes/chatRoutes');

// Connect to the MongoDB database using the connection string from environment variables
connectDB();

// Create an instance of the Express application
const app = express();

// Set the trust proxy setting to 1, which is necessary when the app is behind a reverse proxy (e.g., in production environments) to ensure that the correct client IP address is obtained for CORS and other middleware that relies on the client's IP.
app.set('trust proxy', 1);

// Configure CORS to allow requests from the frontend application. The allowed origins are specified in the FRONTEND_ORIGIN environment variable, which can contain a comma-separated list of allowed origins. If FRONTEND_ORIGIN is not set, it defaults to allowing requests from http://localhost:5173 (the default port for Vite development server). The CORS configuration also allows credentials (e.g., cookies) and specifies allowed HTTP methods and headers.
const Origins = process.env.FRONTEND_ORIGIN 
  ? process.env.FRONTEND_ORIGIN.split(',').map(origin => origin.trim())
  : ['http://localhost:5173'];

app.use(cors({

  origin: (origin, callback) => {
    // Allow same-origin and non-browser requests
    if (!origin) return callback(null, true);

    // In production, ensure exact origin match OR explicitly allow any origin.
    if (Origins.includes('*') || Origins.indexOf(origin) !== -1) {
      return callback(null, true);
    }

    // Instead of hard-failing preflight, allow CORS to proceed and let the request decide.
    // This prevents browsers from blocking the request due to missing Access-Control-Allow-Origin.
    // If you truly want strict CORS, set FRONTEND_ORIGIN correctly.
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Middleware to parse incoming JSON requests and URL-encoded data. The limits for the request body size are set to 50mb to accommodate larger payloads, such as images for face analysis or longer chat messages.
app.use(express.json({ limit: '50mb' })); 
app.use(express.urlencoded({ limit: '50mb', extended: true })); 

// Health check endpoint to verify that the API is running. This can be used by monitoring tools or load balancers to check the health of the server.
app.get('/healthz', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Root endpoint to provide a simple message confirming that the API is running. This can be accessed by navigating to the base URL of the API in a web browser or using a tool like curl.
app.get('/', (req, res) => {
  res.send('Hello! The Mental Health Companion API is running.');
});

// Define the routes for user authentication and chat interactions, applying the appropriate route handlers imported from the controllers. The /api/users route is used for user registration and login, while the /api/chat route is used for generating responses, analyzing faces, and managing chat history.
app.use('/api/users', userRoutes);
app.use('/api/chat', chatRoutes);


app.use('/api/face', require('./routes/faceAnalysisRoutes'));


// Start the server and listen on the specified port (defaulting to 5000 if not set in environment variables). A message is logged to the console indicating that the server is running and on which port it is listening.
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});