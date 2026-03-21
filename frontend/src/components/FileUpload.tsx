import { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileProcessed: (data: any) => void;
  onRawContent: (content: string) => void;
  onLoading: (loading: boolean) => void;
}

export default function FileUpload({ onFileProcessed, onRawContent, onLoading }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(async (file: File) => {
    setError(null);
    setFileName(file.name);
    onLoading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const isZip = file.name.toLowerCase().endsWith('.zip');
      const endpoint = isZip ? '/api/upload-batch' : '/api/upload';

      const response = await fetch(endpoint, { method: 'POST', body: formData });
      
      if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: 'Upload failed' }));
        throw new Error(err.detail || 'Upload failed');
      }

      const data = await response.json();
      
      if (!isZip && data.parse_result?.raw_content) {
        onRawContent(data.parse_result.raw_content);
      }
      
      onFileProcessed(data);
    } catch (err: any) {
      setError(err.message || 'Failed to process file');
    } finally {
      onLoading(false);
    }
  }, [onFileProcessed, onRawContent, onLoading]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }, [processFile]);

  const loadSample = useCallback(async (sampleName: string) => {
    onLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/samples/${sampleName}`);
      const { content } = await res.json();

      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], sampleName, { type: 'text/plain' });
      await processFile(file);
    } catch (err: any) {
      setError(err.message || 'Failed to load sample');
      onLoading(false);
    }
  }, [processFile, onLoading]);

  return (
    <div className="animate-fade-in">
      {/* Drop Zone */}
      <div
        className={`drop-zone ${isDragOver ? 'active' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input')?.click()}
      >
        <input
          id="file-input"
          type="file"
          accept=".edi,.txt,.x12,.zip"
          onChange={handleFileSelect}
          className="hidden"
        />
        
        <div className="mb-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-[#1A1A1A] flex flex-col items-center justify-center border border-gray-700">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
        </div>
        
        <p className="text-xl font-bold text-white mb-2">
          {isDragOver ? <span className="text-gray-300">Drop your EDI file here</span> : 'Drag & drop your EDI file'}
        </p>
        <p className="text-sm font-medium text-gray-400 mb-2">
          Supports .edi, .txt, .x12, and <span className="text-gray-100 font-bold">.zip (batch files)</span>
        </p>
        
        {fileName && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-accent-blue/10 rounded-full border border-accent-blue/30">
            <span className="text-sm text-accent-blue">📄 {fileName}</span>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-accent/10 border border-red-accent/30 rounded-lg text-red-accent text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* Sample Files */}
      <div className="w-full" style={{ marginTop: '32px', marginBottom: '24px' }}>
        <p className="text-base font-semibold text-gray-400 uppercase tracking-wider text-center" style={{ marginBottom: '24px' }}>Or try a sample file</p>
        <div className="flex flex-wrap justify-center" style={{ gap: '16px' }}>
          {[
            { name: 'sample_837p.edi', label: '837P — Claim', icon: '📋' },
            { name: 'sample_835.edi', label: '835 — Remit', icon: '💰' },
            { name: 'sample_834.edi', label: '834 — Enroll', icon: '👤' },
          ].map((sample) => (
            <button
              key={sample.name}
              onClick={() => loadSample(sample.name)}
              className="px-5 py-3 rounded-xl bg-[#0A0A0A] border border-gray-800 hover:border-gray-500 hover:bg-[#141414] transition-all duration-200 flex items-center group"
              style={{ gap: '12px' }}
            >
              <span className="text-lg opacity-80 group-hover:scale-110 transition-transform">{sample.icon}</span>
              <span className="text-sm font-bold text-gray-300 group-hover:text-white">{sample.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
