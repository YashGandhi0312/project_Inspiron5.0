import { useState, useCallback } from 'react';
import FileUpload from './components/FileUpload';
import ParsedTreeViewer from './components/ParsedTreeViewer';
import ValidationPanel from './components/ValidationPanel';
import AIChatPanel from './components/AIChatPanel';
import RemittanceSummary from './components/RemittanceSummary';
import EnrollmentDashboard from './components/EnrollmentDashboard';

type TabId = 'upload' | 'results' | 'chat';

interface ParseData {
  parse_result: any;
  validation_result: any;
  transaction_type: string;
  transaction_type_label: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<TabId>('upload');
  const [loading, setLoading] = useState(false);
  const [parseData, setParseData] = useState<ParseData | null>(null);
  const [rawContent, setRawContent] = useState<string>('');
  const [remittance, setRemittance] = useState<any>(null);
  const [enrollment, setEnrollment] = useState<any>(null);

  const handleFileProcessed = useCallback(async (data: any) => {
    setParseData(data);
    setActiveTab('results');

    if (data.transaction_type === '835' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/remittance-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        const summary = await res.json();
        setRemittance(summary);
      } catch { /* graceful fail */ }
    }

    if (data.transaction_type === '834' && data.parse_result?.raw_content) {
      try {
        const res = await fetch('/api/enrollment-summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw_content: data.parse_result.raw_content }),
        });
        const summary = await res.json();
        setEnrollment(summary);
      } catch { /* graceful fail */ }
    }
  }, []);

  const handleFix = useCallback(async (errorId: string, fixValue: string) => {
    if (!rawContent) return;
    try {
      const res = await fetch('/api/fix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error_id: errorId, fix_value: fixValue, raw_content: rawContent }),
      });
      const data = await res.json();
      if (data.corrected_content) {
        setRawContent(data.corrected_content);
        setParseData((prev) => prev ? { ...prev, validation_result: data.validation_result } : prev);
      }
    } catch (err) {
      console.error('Fix error:', err);
    }
  }, [rawContent]);

  const handleFixAll = useCallback(async () => {
    if (!rawContent) return;
    try {
      const res = await fetch('/api/fix-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: rawContent }),
      });
      const data = await res.json();
      if (data.corrected_content) {
        setRawContent(data.corrected_content);
        setParseData((prev) => prev ? { ...prev, validation_result: data.validation_result } : prev);
      }
    } catch (err) {
      console.error('Fix all error:', err);
    }
  }, [rawContent]);

  const handleExport = useCallback(async (format: string) => {
    if (!rawContent) return;
    try {
      const res = await fetch('/api/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ raw_content: rawContent, format }),
      });

      if (format === 'json') {
        const data = await res.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'edi_parsed.json';
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = format === 'edi' ? 'corrected.edi' : 'errors.csv';
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Export error:', err);
    }
  }, [rawContent]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-black text-[#3B82F6]">
      {/* Ultra-Wide Dynamic Island Navbar */}
      <header className="fixed top-6 w-[96%] max-w-[1800px] left-1/2 -translate-x-1/2 z-50">
        <div className="relative flex items-center justify-between px-10 h-[80px] bg-[#0A0A0A] border border-[#1E3A8A] rounded-[40px] shadow-2xl">
          
          {/* Logo - Left */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#1D4ED8] flex items-center justify-center text-black font-bold text-base">
              ⚡
            </div>
            <h1 className="text-xl font-bold text-white tracking-tight hidden lg:block">ClaimGuard</h1>
          </div>

          {/* Nav Tabs - Absolute Centered for perfect alignment */}
          <nav className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-4">
            {[
              { id: 'upload' as TabId, label: 'Upload', show: true },
              { id: 'results' as TabId, label: 'Results', show: !!parseData },
              { id: 'chat' as TabId, label: 'AI Chat', show: true },
            ].filter(t => t.show).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-2.5 rounded-full text-base font-bold transition-colors ${
                  activeTab === tab.id
                    ? 'bg-[#1E3A8A] text-white'
                    : 'text-gray-300 hover:bg-[#1A1A1A] hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Export Buttons - Right */}
          <div className="flex gap-3">
            {parseData && (
              <>
                <button onClick={() => handleExport('json')} className="btn-secondary text-sm font-bold py-2 px-5 rounded-full border-[#1E3A8A]">
                  JSON
                </button>
                <button onClick={() => handleExport('edi')} className="btn-secondary text-sm font-bold py-2 px-5 rounded-full border-[#1E3A8A]">
                  EDI
                </button>
                <button onClick={() => handleExport('csv')} className="btn-secondary text-sm font-bold py-2 px-5 rounded-full border-[#1E3A8A]">
                  CSV
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Loading Bar */}
      {loading && (
        <div className="h-1 bg-[#0A0A0A]">
          <div className="h-full bg-[#2563EB] w-2/3" />
        </div>
      )}

      {/* Main Content */}
      <main className="w-full flex flex-col items-center px-4 pb-12 relative z-10">
        {/* Fixed Spacer to push content exactly below navbar */}
        <div style={{ height: '140px', width: '100%' }} aria-hidden="true" />
        
        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="w-full max-w-7xl flex flex-col items-center justify-center mx-auto">
            {/* Hero */}
            <div className="text-center mb-6 animate-fade-in delay-100 flex flex-col items-center justify-center w-full">
              <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6 w-full text-center tracking-tight">
                Parse & Validate EDI Files
              </h2>
              <p className="text-gray-500 max-w-2xl text-lg leading-relaxed font-medium text-center mx-auto w-full">
                Upload X12 837P/837I, 835, or 834 files for instant structural parsing,
                HIPAA 5010 validation, AI error explanations, and deterministic fixes.
              </p>
            </div>

            <div className="w-full max-w-3xl flex flex-col items-center mx-auto animate-fade-in delay-200">
              <FileUpload
                onFileProcessed={handleFileProcessed}
                onRawContent={setRawContent}
                onLoading={setLoading}
              />
            </div>

            {/* Features section (still part of upload tab) */}
            <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3" style={{ gap: '24px', marginTop: '64px', marginBottom: '96px' }}>
              {/* Feature 1 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>Parse</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>Recursive-descent hierarchy mapping</p>
              </div>
              {/* Feature 2 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>Validate</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>HIPAA 5010 compliance rules</p>
              </div>
              {/* Feature 3 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>Auto-Fix</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>Deterministic error correction</p>
              </div>
              {/* Feature 4 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>AI Assistant</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>Gemini-powered claim diagnosis</p>
              </div>
              {/* Feature 5 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>835 Remittance</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>Automated claim payment extraction</p>
              </div>
              {/* Feature 6 */}
              <div className="rounded-2xl bg-[#050505] border border-gray-800 hover:border-gray-600 transition-colors" style={{ padding: '24px' }}>
                <h3 className="text-xl font-bold text-white tracking-wide" style={{ marginBottom: '12px' }}>834 Enrollment</h3>
                <p className="text-sm text-gray-400 font-medium" style={{ lineHeight: '1.6' }}>Member dashboard with additions</p>
              </div>
            </div>
          </div>
        )}

        {/* Results Tab */}
        {activeTab === 'results' && parseData && (
          <div className="space-y-6 animate-fade-in">
            {/* File Info Bar */}
            <div className="glass-card p-4 flex items-center justify-between border-l-4 border-l-[#2563EB]">
              <div className="flex items-center gap-4">
                <span className="px-2 py-1 bg-[#1D4ED8] text-black rounded text-sm font-bold">
                  {parseData.transaction_type}
                </span>
                <span className="text-[#3B82F6] font-bold">{parseData.transaction_type_label}</span>
                <span className="text-xs text-[#60A5FA]">
                  {parseData.parse_result?.segment_count} segments
                </span>
              </div>
              <div className="flex items-center gap-4 text-sm">
                {parseData.parse_result?.sender_id && (
                  <div>
                    <span className="text-[#60A5FA] text-xs uppercase pr-2">Sender</span>
                    <span className="text-[#3B82F6] font-mono">{parseData.parse_result.sender_id}</span>
                  </div>
                )}
                {parseData.parse_result?.receiver_id && (
                  <div>
                    <span className="text-[#60A5FA] text-xs uppercase pr-2">Receiver</span>
                    <span className="text-[#3B82F6] font-mono">{parseData.parse_result.receiver_id}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Left: Tree */}
              <ParsedTreeViewer
                loops={parseData.parse_result?.loops || []}
                transactionType={parseData.transaction_type}
              />

              {/* Right: Validation */}
              <ValidationPanel
                validation={parseData.validation_result}
                onFix={handleFix}
                onFixAll={handleFixAll}
              />
            </div>

            {/* 835 Remittance Summary */}
            {parseData.transaction_type === '835' && remittance && (
              <RemittanceSummary summary={remittance} />
            )}

            {/* 834 Enrollment Dashboard */}
            {parseData.transaction_type === '834' && enrollment && (
              <EnrollmentDashboard summary={enrollment} />
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="max-w-4xl mx-auto">
            <AIChatPanel context={rawContent || undefined} />
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1E3A8A] mt-12 py-6 text-center">
        <p className="text-xs text-[#60A5FA]">EDI ClaimGuard — Black & Blue Theme | Hackathon Project</p>
      </footer>
    </div>
  );
}
