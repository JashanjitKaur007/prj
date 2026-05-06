// frontend/src/pages/Home.jsx
// The Home component is the main interface for the chat application. It manages the state of the conversation, user input, and interactions with the backend API. The component includes a sidebar for navigation between different views (Chat, Crisis Support, Conversation Report, My Profile) and a main content area that displays the chat interface or other views based on user selection. The chat interface allows users to send messages to the AI companion and receive responses, while also providing features like auto-saving conversations, displaying analysis results, and showing crisis support resources when needed.


// frontend/src/pages/Home.jsx
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Send, Plus, MessageSquare, BarChart3, Clock, User, Menu, 
  Brain, Leaf, Phone, MessageCircle, Heart, Globe, Sparkles 
} from 'lucide-react';
import axios from 'axios';
import { Link } from 'react-router-dom';

import ConversationReport from '../components/ConversationReport';
import AccountInformation from '../components/AccountInformation';

const Home = () => {
  const [message, setMessage] = useState('');
  const [conversation, setConversation] = useState([]);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [helplines, setHelplines] = useState([]);
  const [sessionId, setSessionId] = useState(null);
  const [location, setLocation] = useState(null);
  const [currentView, setCurrentView] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const { user } = useAuth();
  const messagesEndRef = useRef(null);

  // Get user location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => console.log('Location access denied:', error)
      );
    }
  }, []);

  // Load saved data from localStorage
  useEffect(() => {
    if (!user?.id) return;

    const savedConversation = localStorage.getItem(`conversation_${user.id}`);
    const savedAnalysis = localStorage.getItem(`analysis_${user.id}`);
    const savedSessionId = localStorage.getItem(`sessionId_${user.id}`);

    if (savedConversation) {
      try {
        const parsed = JSON.parse(savedConversation);
        setConversation(parsed.map(msg => ({
          ...msg,
          timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
          sender: msg.sender || (msg.isUser ? 'user' : 'ai')
        })));
      } catch (e) {
        console.error('Failed to parse conversation:', e);
        localStorage.removeItem(`conversation_${user.id}`);
      }
    }

    if (savedAnalysis) {
      try { setAnalysis(JSON.parse(savedAnalysis)); } 
      catch (e) { localStorage.removeItem(`analysis_${user.id}`); }
    }

    if (savedSessionId) setSessionId(savedSessionId);
  }, [user?.id]);

  // Auto-save conversation & analysis
  useEffect(() => {
    if (user?.id && conversation.length > 0) {
      localStorage.setItem(`conversation_${user.id}`, JSON.stringify(conversation));
    }
  }, [conversation, user?.id]);

  useEffect(() => {
    if (user?.id && analysis) {
      localStorage.setItem(`analysis_${user.id}`, JSON.stringify(analysis));
    }
  }, [analysis, user?.id]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversation]);

  const handleSend = async () => {
    if (!message.trim() || loading) return;

    const userMsg = {
      id: Date.now(),
      sender: 'user',
      text: message,
      timestamp: new Date()
    };

    setConversation(prev => [...prev, userMsg]);
    const currentPrompt = message;
    setMessage('');
    setLoading(true);

    try {
      let currentSessionId = sessionId;
      if (!currentSessionId) {
        currentSessionId = `session_${Date.now()}_${user?.id}`;
        setSessionId(currentSessionId);
        localStorage.setItem(`sessionId_${user?.id}`, currentSessionId);
      }

      const res = await axios.post('/chat/', {
        prompt: currentPrompt,
        sessionId: currentSessionId,
        location: location
      });

      setAnalysis(res.data.analysis);
      if (res.data.helplines?.length > 0) setHelplines(res.data.helplines);

      const aiMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text: res.data.response,
        timestamp: new Date()
      };

      setConversation(prev => [...prev, aiMsg]);
    } catch (error) {
      console.error('Chat error:', error);

      const backendMessage = error?.response?.data?.message;
      const backendCode = error?.response?.data?.code;

      // Prefer backend-provided message.
      // If backend doesn't return message (or returns generic 500), avoid the old hardcoded quota text.
      const text = backendMessage || (backendCode === 'GEMINI_QUOTA_EXPIRED'
        ? 'Your AI quota is expired. Try again later.'
        : (backendCode
            ? `Chat failed (${backendCode}). Please try again.`
            : 'Chat failed. Please try again.'));

      const errorMsg = {
        id: Date.now() + 1,
        sender: 'ai',
        text,
        timestamp: new Date(),
        isError: true,
        backendCode: backendCode || null
      };
      setConversation(prev => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };



  // Function to start a new chat by clearing the conversation, analysis, helplines, and session ID. It also removes any saved data from localStorage for the current user. This allows the user to start fresh with a new conversation without any previous context.
  const startNewChat = () => {
    setConversation([]);
    setAnalysis(null);
    setHelplines([]);
    setSessionId(null);
    setCurrentView('chat');

    if (user?.id) {
      localStorage.removeItem(`conversation_${user.id}`);
      localStorage.removeItem(`analysis_${user.id}`);
      localStorage.removeItem(`sessionId_${user.id}`);
    }
  };


  // Sidebar items
  const sidebarItems = [
    { view: 'chat', label: 'Chat', icon: MessageSquare },
    { view: 'crisis', label: 'Crisis Support', icon: Heart },
    { view: 'report', label: 'Conversation Report', icon: BarChart3 },
    { view: 'profile', label: 'My Profile', icon: User },
  ];

  // Updated Crisis Resources with new design
  const CrisisResources = () => (
    <div className="flex-1 overflow-y-auto bg-[#f8fafc] py-12 px-6 md:px-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-3 bg-red-100 text-red-700 px-6 py-2 rounded-3xl mb-6">
            <Heart className="w-5 h-5" />
            <span className="uppercase tracking-widest text-xs font-semibold">24/7 Support</span>
          </div>
          <h1 className="text-5xl font-semibold tracking-tight text-slate-950 mb-4">
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
            Crisis Resources
            </span>
          </h1>
          <p className="text-xl text-slate-600 max-w-xl mx-auto">
            You're not alone. Help is available right now.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[
            {
              icon: Phone,
              color: "text-red-600",
              title: "Suicide & Crisis Lifeline",
              info: "Call or Text 988",
              desc: "24/7 • Free • Confidential"
            },
            {
              icon: MessageCircle,
              color: "text-blue-600",
              title: "Crisis Text Line",
              info: "Text HELLO to 741741",
              desc: "24/7 • Confidential"
            },
            {
              icon: Phone,
              color: "text-pink-600",
              title: "Domestic Violence Hotline",
              info: "1-800-799-SAFE (7233)",
              desc: "Or text START to 88788 • 24/7"
            },
            {
              icon: Globe,
              color: "text-emerald-600",
              title: "International Support",
              info: "Find local help worldwide",
              desc: "Resources tailored to your location"
            }
          ].map((item, index) => (
            <div key={index} className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm hover:shadow-xl transition-all group">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <item.icon className={`w-7 h-7 ${item.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-slate-900">{item.title}</h3>
              </div>

              <p className="text-3xl font-medium text-slate-800 mb-3">{item.info}</p>
              <p className="text-slate-600 mb-8">{item.desc}</p>

              <button className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-medium transition-all active:scale-[0.985]">
                {item.info.includes("Text") ? "Send Text" : "Call Now"}
              </button>
            </div>
          ))}
        </div>

        <p className="text-center text-sm text-slate-500 mt-12">
          eyra is a supportive companion, not a replacement for professional care.
        </p>
      </div>
    </div>
  );



  // Conversation Report view that displays the analysis results and extracted keywords in a visually appealing format. It also includes a roadmap of the conversation with sentiment indicators for each message, providing insights into the emotional flow of the conversation. This view helps users understand their conversations better and identify key themes or areas of concern.
  return (
    <div className="flex h-screen overflow-hidden bg-[#f8fafc]">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-72' : 'w-0'} bg-white border-r border-slate-200 flex flex-col transition-all duration-300 overflow-hidden shadow-sm`}>



        <Link to="/about" className="p-6 border-b border-slate-100 flex items-center gap-4 hover:bg-slate-50 transition-colors">
          <div className="w-11 h-11 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-3xl flex items-center justify-center flex-shrink-0 shadow-inner">
            {/* <Leaf className="w-7 h-7 text-white" /> */}
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-3xl tracking-[-1.5px] text-slate-950">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              eyra
              </span>
              </span>
              </h1>
            <p className="text-xs text-slate-500 -mt-1">Gentle AI Companion</p>
          </div>
        </Link>

        <div className="p-6">
          <button
            onClick={startNewChat}
            className="w-full flex items-center justify-center gap-3 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 py-4 px-6 rounded-3xl font-semibold border border-emerald-200 transition-all active:scale-[0.985]"
          >
            <Plus className="w-5 h-5" />
            <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">New Conversation</span>
          </button>
        </div>

        <div className="px-3 flex flex-col">
          {sidebarItems.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              onClick={() => setCurrentView(view)}
              className={`w-full flex items-center gap-4 px-6 py-4 rounded-3xl transition-all text-sm font-medium
                ${currentView === view 
                  ? 'bg-emerald-50 text-emerald-700 shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-50'}`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 mt-8 px-6">
          <div className="text-xs uppercase tracking-widest text-slate-400 font-medium mb-4 px-2">Recent Activity</div>
          <p className="text-slate-400 text-sm italic px-2">Your conversations are saved locally</p>
        </div>

        <div className="p-6 border-t border-slate-100">
          <button className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-3.5 rounded-3xl font-semibold hover:shadow-lg transition-all">
            Upgrade to Pro
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Navigation Bar */}
        <div className="h-16 border-b border-slate-200 bg-white/90 backdrop-blur-md flex items-center px-8 justify-between z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition"
            >
              <Menu size={24} />
            </button>
            <div className="flex items-center gap-3">
              <Sparkles className="w-6 h-6 text-emerald-600" />
              <h2 className="font-semibold text-2xl tracking-tight text-slate-900"><span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              eyra
              </span></h2>
            </div>
          </div>

          <div className="flex items-center gap-3 text-slate-600">
            <span className="text-sm">
              <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">
              Hello, {user?.name || 'Parneet'}
              </span>
              </span>
            <div className="w-8 h-8 bg-emerald-100 rounded-2xl flex items-center justify-center">
              <User className="w-4 h-4 text-emerald-700" />
            </div>
          </div>
        </div>

        {/* Main View Content */}
        {currentView === 'chat' && (
          <>

{/* Messages Area */}
<div className="flex-1 overflow-y-auto p-6 md:p-8 bg-white/90 backdrop-blur-md space-y-8">
  {conversation.length === 0 ? (
    <div className="flex flex-col items-center justify-center h-full text-center pt-12">
      <div className="mb-12">
        <div className="w-32 h-32 mx-auto bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
          <Leaf className="w-20 h-20 text-emerald-600" />
        </div>
      </div>
      <h1 className="text-5xl font-semibold tracking-tight text-slate-950 mb-6">
        <span className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 bg-clip-text text-transparent">Hello, {user?.name || 'Parneet'}</span></h1>
      <p className="text-2xl text-slate-600 max-w-lg leading-relaxed">
        I'm here to listen with kindness.<br />
        What's been weighing on your heart today?
      </p>
    </div>
  ) : (
    conversation.map((msg) => (
      <div 
        key={msg.id} 
        className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
      >
        <div className={`max-w-[85%] md:max-w-2xl flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
          {msg.sender === 'ai' && (
            <div className="w-9 h-9 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 flex-shrink-0 mt-1 flex items-center justify-center">
              <Leaf className="w-5 h-5 text-white" />
            </div>
          )}
          <div
            className={`px-6 py-4 rounded-3xl text-[17px] leading-relaxed shadow-sm
              ${msg.sender === 'user' 
                ? 'bg-emerald-600 text-white rounded-tr-none' 
                : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}
          >
            {msg.sender === 'ai' ? formatAIResponse(msg.text) : msg.text}
          </div>
        </div>
      </div>
    ))
  )}

  {loading && (
    <div className="flex justify-start">
      <div className="flex gap-4">
        <div className="w-9 h-9 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0">
          <Leaf className="w-5 h-5 text-white" />
        </div>
        <div className="px-6 py-4 bg-white border border-slate-100 rounded-3xl text-slate-600 rounded-tl-none">
          Thinking gently...
        </div>
      </div>
    </div>
  )}

  <div ref={messagesEndRef} />
</div>





{/* Message Input Area - Fixed to remove weird separation */}
<div className="bg-white px-6 md:px-8 py-4">
  <div className="max-w-4xl mx-auto">
    
    <div className="flex items-end bg-slate-50 rounded-2xl px-4 py-3 shadow-sm transition-all focus-within:bg-slate-100">
      
      <textarea
        rows={1}
        value={message}
        disabled={loading}
        placeholder="Message eyra..."
        onChange={(e) => {
          setMessage(e.target.value);

          // Auto expand
          e.target.style.height = "auto";
          e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();

            // Reset height after send
            setTimeout(() => {
              e.target.style.height = "auto";
            }, 0);
          }
        }}
        style={{
          outline: "none",
          boxShadow: "none",
          border: "none"
        }}
        className="flex-1 resize-none bg-transparent border-none outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0 text-lg placeholder-slate-400 max-h-[120px]"
      />

      <button
        onClick={handleSend}
        disabled={!message.trim() || loading}
        className="ml-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white p-3 rounded-full transition-all active:scale-95"
      >
        <Send size={20} />
      </button>

    </div>
    <br />
  </div>
</div>




            {/* Messages Area */}
            {/* <div className="flex-1 overflow-y-auto p-8 md:p-12 space-y-10 bg-[#f8fafc]">
              {conversation.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center pt-12">
                  <div className="mb-12">
                    <div className="w-32 h-32 mx-auto bg-gradient-to-br from-emerald-100 to-teal-100 rounded-full flex items-center justify-center">
                      <Leaf className="w-20 h-20 text-emerald-600" />
                    </div>
                  </div>
                  <h1 className="text-5xl font-semibold tracking-tight text-slate-950 mb-6">
                    Hello, {user?.name || 'Parneet'}
                  </h1>
                  <p className="text-2xl text-slate-600 max-w-lg leading-relaxed">
                    I'm here to listen with kindness.<br />
                    What's been weighing on your heart today?
                  </p>
                </div>
              ) : (
                conversation.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-2xl flex gap-4 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
                      {msg.sender === 'ai' && (
                        <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 flex-shrink-0 mt-1 flex items-center justify-center">
                          <Leaf className="w-5 h-5 text-white" />
                        </div>
                      )}
                      <div
                        className={`px-7 py-5 rounded-3xl text-[17px] leading-relaxed shadow-sm
                          ${msg.sender === 'user' 
                            ? 'bg-emerald-600 text-white rounded-tr-none' 
                            : 'bg-white border border-slate-100 text-slate-800 rounded-tl-none'}`}
                      >
                        {msg.sender === 'ai' ? formatAIResponse(msg.text) : msg.text}
                      </div>
                    </div>
                  </div>
                ))
              )}

              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 rounded-3xl bg-gradient-to-br from-emerald-600 to-teal-600 flex items-center justify-center flex-shrink-0">
                      <Leaf className="w-5 h-5 text-white" />
                    </div>
                    <div className="px-7 py-5 bg-white border border-slate-100 rounded-3xl text-slate-600 rounded-tl-none">
                      Thinking gently...
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div> */}

            {/* Message Input */}
            {/* <div className="p-8 bg-white border-t border-slate-100">
              <div className="max-w-4xl mx-auto">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    placeholder="Share what's on your mind..."
                    className="flex-1 bg-slate-50 border border-slate-200 focus:border-emerald-300 rounded-full py-5 px-8 text-lg placeholder-slate-400 focus:outline-none transition-all"
                    disabled={loading}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!message.trim() || loading}
                    className="absolute right-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white p-4 rounded-full transition-all active:scale-95"
                  >
                    <Send size={22} />
                  </button>
                </div>
                <p className="text-center text-xs text-slate-500 mt-4">
                  eyra offers supportive insights. Always consult professionals for serious concerns.
                </p>
              </div>
            </div> */}
          </>
        )}

        {currentView === 'crisis' && <CrisisResources />}

        {currentView === 'profile' && (
          <div className="flex-1 overflow-y-auto p-12 bg-[#f8fafc]">
            <AccountInformation />
          </div>
        )}

        {currentView === 'report' && (
          <div className="flex-1 overflow-y-auto p-12 bg-[#f8fafc]">
            <ConversationReport 
              messages={conversation} 
              analysis={analysis} 
              helplines={helplines} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

const formatAIResponse = (text) => {
  if (!text) return text;

  const lines = text.split('\n');
  const formattedLines = [];

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (!line) continue;

    if (line.startsWith('*')) {
      const bulletText = line.replace(/^\s*\*\s*/, '');
      formattedLines.push(
        <div key={i} className="flex items-start gap-3 mb-3">
          <span className="text-emerald-600 mt-1.5">•</span>
          <span className="text-slate-700">{bulletText}</span>
        </div>
      );
    } else if (line.includes('**')) {
      const formatted = line.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold">$1</strong>');
      formattedLines.push(
        <p key={i} className="mb-3" dangerouslySetInnerHTML={{ __html: formatted }} />
      );
    } else {
      formattedLines.push(<p key={i} className="mb-3 text-slate-700">{line}</p>);
    }
  }

  return <div className="space-y-1">{formattedLines}</div>;
};

export default Home; 
