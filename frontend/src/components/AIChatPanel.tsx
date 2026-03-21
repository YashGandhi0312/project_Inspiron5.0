import { useState, useRef, useEffect } from 'react';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatPanelProps {
  context?: string;
}

export default function AIChatPanel({ context }: AIChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: '👋 Hi! I\'m your **EDI ClaimGuard AI Assistant**. I can help you understand X12 segments, decode CARC/RARC codes, explain validation errors, and more.\n\nTry asking:\n- "What does the CLM segment mean?"\n- "Explain CARC code 45"\n- "Why was my claim denied?"',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg.content,
          context: context || null,
          history: messages.slice(-6),
        }),
      });

      const data = await res.json();
      const reply = data.reply || data.error || 'No response received.';
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `⚠️ Error: ${err.message}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const quickQuestions = [
    'What are common claim denial reasons?',
    'Explain the ISA segment',
    'What is CARC code 45?',
    'How to fix NPI validation errors?',
  ];

  return (
    <div className="glass-card flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b border-slate-700/50">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          🤖 AI Chat Assistant
          <span className="badge badge-info text-xs">Gemini</span>
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in`}
          >
            <div
              className={`max-w-[80%] rounded-xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-accent-blue text-white rounded-br-sm'
                  : 'bg-surface-light text-slate-300 rounded-bl-sm border border-slate-700/30'
              }`}
            >
              <div className="whitespace-pre-wrap" dangerouslySetInnerHTML={{
                __html: msg.content
                  .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                  .replace(/\n/g, '<br />')
              }} />
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start animate-fade-in">
            <div className="bg-surface-light rounded-xl px-4 py-3 border border-slate-700/30">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-accent-blue rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Questions */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {quickQuestions.map((q) => (
            <button
              key={q}
              onClick={() => { setInput(q); }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-600 text-slate-400 hover:border-accent-blue hover:text-accent-blue transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-slate-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about EDI segments, errors, CARC codes..."
            className="flex-1 bg-surface border border-slate-700 rounded-lg px-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:border-accent-blue transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="btn-primary px-4 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ➤
          </button>
        </div>
      </div>
    </div>
  );
}
