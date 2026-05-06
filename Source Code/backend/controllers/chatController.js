// Chat controller for handling AI responses, chat history, and conversation reports

const { GoogleGenerativeAI } = require('@google/generative-ai');
const History = require('../models/historyModel');
const { generateReport } = require('../utils/analytics');

// Load API key from environment variables and initialize Google Generative AI client
const apiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
if (!apiKey) {
  console.error('[Startup Error] GEMINI_API_KEY or GOOGLE_API_KEY is missing in .env file');
}

const genAI = new GoogleGenerativeAI(apiKey);


// Helper function to extract mental health information from AI response
const extractMentalHealthInfo = (response) => {
  if (!response || typeof response !== 'string') {
    return {
      mainConcern: 'General mental health',
      relatedSymptoms: [],
      severity: 'moderate',
      cleanedResponse: response || ''
    };
  }

  const cleanedResponse = response
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1');

  // List of disorders and symptoms to search for in the response
  const disorders = [
    'depression', 'anxiety', 'bipolar', 'ptsd', 'ocd', 'adhd', 'panic disorder',
    'social anxiety', 'generalized anxiety', 'major depression', 'schizophrenia',
    'eating disorder', 'anorexia', 'bulimia', 'borderline personality', 'stress',
    'insomnia', 'sleep disorder'
  ];

  // You can expand these lists based on common mental health concerns and symptoms
  const symptoms = [
    'sadness', 'hopelessness', 'fatigue', 'insomnia', 'anxiety', 'panic attacks',
    'mood swings', 'irritability', 'loss of interest', 'difficulty concentrating',
    'suicidal thoughts', 'worry', 'overwhelm', 'tired', 'restless', 'nervous'
  ];

// Find which disorders and symptoms are mentioned in the AI response
  const findingDisdors = disorders.filter(d => cleanedResponse.toLowerCase().includes(d));
  const findingSymptoms = symptoms.filter(s => cleanedResponse.toLowerCase().includes(s));

  // Determine severity based on keywords in the response
  return {
    mainConcern: findingDisdors[0] || 'General mental health',
    relatedSymptoms: findingSymptoms,
    severity: cleanedResponse.toLowerCase().includes('severe') ? 'high' :
              cleanedResponse.toLowerCase().includes('mild') ? 'low' : 'moderate',
    cleanedResponse
  };
};

/**
 * @desc    Generate AI response + save to history
 * @route   POST /api/chat/
 * @access  Private
 */

// Main controller function to generate AI response based on user prompt, save conversation history, and return analysis + helplines if needed
const generateResponse = async (req, res) => {
  const { prompt, sessionId, location } = req.body;
  const userId = req.user._id;

  if (!prompt?.trim()) {
    return res.status(400).json({ message: 'Prompt is required' });
  }

  try {
    const fullPrompt = `
You are a highly skilled, empathetic therapist. Your goal is to help the user gain self-understanding, emotional regulation, and meaningful progress.

Core Principles:
- Create a safe, non-judgmental space
- Listen actively and show genuine empathy
- Ask thoughtful, reflective questions
- Offer 2-3 practical next steps when appropriate
- Keep responses concise and clear
- Personalize based on user input
- Never give medical diagnoses

User's message: "${prompt}"
`;

    // Try multiple models as fallback
    const preferredModels = [
      (process.env.GEMINI_MODEL || 'gemini-2.5-flash').trim(),
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash'
    ];

    let aiResponse = null;
    let lastError = null;

    // Loop through preferred models and try to get a response
    for (const modelName of preferredModels) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(fullPrompt);
        aiResponse = await result.response.text();
        break;
      } catch (err) {
        lastError = err;
        if (err?.status === 404 || /not found|not supported/i.test(err?.message || '')) {
          continue;
        }
        throw err;
      }
    }

    if (!aiResponse) {
      throw lastError || new Error('Failed to get response from any Gemini model');
    }


    const analysis = extractMentalHealthInfo(aiResponse);

// Save conversation to history with session management
    let history;
    if (sessionId) {
      history = await History.findOne({ user: userId, sessionId });

      // If session exists, append to it; otherwise, create new session with provided sessionId
      if (history) {
        history.messages.push({
          prompt: prompt.trim(),
          response: aiResponse,
          analysis,
          timestamp: new Date()
        });

        
        // Update main session fields for quick access
        history.prompt = prompt.trim();
        history.response = aiResponse;
        history.analysis = analysis;
        await history.save();
      } else {
        // SessionId provided but not found → create new one
        history = await History.create({
          user: userId,
          sessionId,
          prompt: prompt.trim(),
          response: aiResponse,
          analysis,
          messages: [{
            prompt: prompt.trim(),
            response: aiResponse,
            analysis,
            timestamp: new Date()
          }]
        });
      }
    } else {
      // No sessionId provided → create new session with generated sessionId
      const newSessionId = `session_${Date.now()}_${userId}`;
      history = await History.create({
        user: userId,
        sessionId: newSessionId,
        prompt: prompt.trim(),
        response: aiResponse,
        analysis,
        messages: [{
          prompt: prompt.trim(),
          response: aiResponse,
          analysis,
          timestamp: new Date()
        }]
      });
    }

    // Get nearby helplines if severity is high or moderate
    const helplines = (analysis.severity === 'high' || analysis.severity === 'moderate')
      ? await getNearbyHelplines(location)
      : [];

    res.status(200).json({
      sessionId: history.sessionId,
      response: analysis.cleanedResponse,
      analysis,
      helplines,
      message: 'Response generated successfully'
    });

  } catch (error) {
    const reason = error?.errorDetails?.[0]?.reason || error?.response?.data?.error || error?.message;

    console.error('generateResponse Error:', {
      message: error?.message,
      status: error?.status,
      reason
    });

    const msg = String(reason || error?.message || '').toLowerCase();

    // Gemini/GCP common quota/rate-limit/auth failure patterns
    const isApiKeyOrAuth =
      msg.includes('api key') ||
      msg.includes('invalid api key') ||
      msg.includes('unauthenticated') ||
      msg.includes('authentication') ||
      msg.includes('permission denied');

    const isQuotaOrExpired =
      msg.includes('quota') ||
      msg.includes('insufficient quota') ||
      msg.includes('expired') ||
      msg.includes('billing') ||
      msg.includes('free tier') ||
      msg.includes('request is not allowed') ||
      msg.includes('rate limit') ||
      msg.includes('per minute') ||
      msg.includes('too many requests');

    const isRateLimit =
      error?.status === 429 ||
      msg.includes('429') ||
      msg.includes('too many requests') ||
      msg.includes('rate limit');

    if (isApiKeyOrAuth) {
      return res.status(401).json({
        message: 'AI service authentication failed (check API key).',
        code: 'GEMINI_AUTH_ERROR',
        details: reason
      });
    }

    if (isRateLimit) {
      return res.status(429).json({
        message: 'AI service is rate limited. Try again in a moment.',
        code: 'GEMINI_RATE_LIMIT',
        details: reason
      });
    }

    if (isQuotaOrExpired) {
      return res.status(429).json({
        message: 'Your AI quota is expired. Try again later.',
        code: 'GEMINI_QUOTA_EXPIRED',
        details: reason
      });
    }

    // Fallback: preserve status if provided by SDK
    if (error?.status && Number(error.status) >= 400 && Number(error.status) < 500) {
      return res.status(error.status).json({
        message: 'AI request failed.',
        code: 'GEMINI_REQUEST_FAILED',
        details: reason
      });
    }

    return res.status(500).json({
      message: 'Failed to generate AI response.',
      code: 'GEMINI_INTERNAL_ERROR',
      details: reason
    });
  }
};

/**
 * @desc    Get live conversation report (for ConversationReport.jsx)
 * @route   GET /api/chat/report
 * @access  Private
 */
const getConversationReport = async (req, res) => {
  try {
    const userId = req.user._id;

// Get the latest conversation history for the user to generate the report from - this ensures we analyze the most recent conversation for live analytics
    const latestHistory = await History.findOne({ user: userId })
      .sort({ updatedAt: -1 })
      .lean();

    if (!latestHistory || !latestHistory.messages || latestHistory.messages.length === 0) {
      return res.status(200).json({
        sentimentSummary: { positive: 0, neutral: 0, negative: 0 },
        sentimentPercentages: { positive: 0, neutral: 0, negative: 0 },
        keywords: [],
        roadmap: [],
        totalMessages: 0,
        summary: "No conversation found. Start chatting to see live analytics."
      });
    }

// Format messages for analysis - we want to analyze the full conversation (both user prompts and AI responses) for better insights, but we can prioritize AI responses for sentiment and keyword extraction
    const formattedMessages = latestHistory.messages.map(msg => ({
      text: msg.response || msg.prompt || '',   
      sender: 'ai',                             
      timestamp: msg.timestamp
    }));


    // We can also include user prompts in the analysis if needed - this can help capture user sentiment and concerns more accurately, but we want to keep AI responses prioritized for clearer insights
    latestHistory.messages.forEach(msg => {
      if (msg.prompt) {
        formattedMessages.unshift({
          text: msg.prompt,
          sender: 'user',
          timestamp: msg.timestamp
        });
      }
    });

    const report = generateReport(formattedMessages);

    res.status(200).json(report);
  } catch (error) {
    console.error('getConversationReport Error:', error);
    res.status(500).json({ 
      error: 'Failed to generate conversation report',
      message: error.message 
    });
  }
};

/**
 * @desc    Get user's chat history
 * @route   GET /api/chat/history
 * @access  Private
 */
const getHistory = async (req, res) => {
  try {
    const history = await History.find({ user: req.user._id })
      .sort({ updatedAt: -1 })
      .select('-__v');

    res.json(history);
  } catch (error) {
    res.status(500).json({ message: 'Failed to retrieve history' });
  }
};

/**
 * @desc    Delete a specific chat session
 * @route   DELETE /api/chat/history/:id
 * @access  Private
 */
const deleteHistory = async (req, res) => {
  try {
    const deletedItem = await History.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id
    });

    if (!deletedItem) {
      return res.status(404).json({ message: 'Chat session not found' });
    }

    res.json({ message: 'Chat session deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete chat session' });
  }
};

/**
 * @desc    Analyze face from image
 * @route   POST /api/chat/analyze-face
 * @access  Private
 */
const analyzeFace = async (req, res) => {
  // This endpoint is designed to analyze a user's facial expression from an uploaded image to provide insights into their emotional state. It can be used as an additional tool for mental health support, allowing the AI to offer more personalized responses based on the user's current mood.
  console.log('analyzeFace endpoint hit');

  const { image, location } = req.body;
  const userId = req.user._id;

  if (!image) {
    return res.status(400).json({ message: 'Image is required' });
  }

  try {
    const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
    
    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType: 'image/jpeg'
      }
    };

    const prompt = `...`; 
    // The prompt can be designed to instruct the AI to analyze the facial expression in the image and provide insights into the user's emotional state. You can include instructions for the AI to look for specific emotions (e.g., happiness, sadness, anger, anxiety) and provide a summary of the analysis.

  } catch (error) {
    console.error('Face analysis error:', error);
    res.status(500).json({ message: 'Failed to analyze face' });
  }
};

// Helper function to get nearby helplines based on user location and severity of their mental health state
const getNearbyHelplines = async (location) => {
  const defaultHelplines = [
    { name: 'National Suicide Prevention Lifeline', phone: '988', type: 'crisis' },
    { name: 'Crisis Text Line', phone: 'Text HOME to 741741', type: 'crisis' },
    { name: 'SAMHSA National Helpline', phone: '1-800-662-4357', type: 'general' },
    { name: 'NAMI Helpline', phone: '1-800-950-6264', type: 'general' }
  ];

// Check if location data is available
  if (location?.latitude && location?.longitude) {
  }

  return defaultHelplines;
};

// Export the controller functions for use in other parts of the application
module.exports = {
  generateResponse,
  getConversationReport,
  getHistory,
  deleteHistory,
  analyzeFace
};