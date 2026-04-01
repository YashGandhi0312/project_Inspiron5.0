import { useCallback, useState } from 'react';

interface FileUploadProps {
  onFileProcessed: (data: any) => void;
  onRawContent: (content: string) => void;
  onLoading: (loading: boolean) => void;
}

const sampleFiles = [
  {
    name: 'sample_837p.edi',
    label: '837P claim',
    description: 'Professional claim structure with payer and provider loops.',
    accent: 'Claims',
  },
  {
    name: 'sample_835.edi',
    label: '835 remittance',
    description: 'Payment and adjustment details for remit analysis.',
    accent: 'Payments',
  },
  {
    name: 'sample_834.edi',
    label: '834 enrollment',
    description: 'Member additions, changes, and terminations.',
    accent: 'Members',
  },
];

export default function FileUpload({ onFileProcessed, onRawContent, onLoading }: FileUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  const processFile = useCallback(
    async (file: File) => {
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
    },
    [onFileProcessed, onRawContent, onLoading],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile],
  );

  const loadSample = useCallback(
    async (sampleName: string) => {
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
    },
    [processFile, onLoading],
  );

  return (
    <section className="glass-card panel-card animate-fade-in">
      <div
        className={`drop-zone ${isDragOver ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragOver(true);
        }}
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

        <div className="upload-icon">
          <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.6}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 7v10m0 0l-4-4m4 4l4-4"
            />
          </svg>
        </div>

        <h2 className="upload-title">Drop an EDI file to start the review</h2>
        <p className="mx-auto max-w-2xl text-base leading-7 text-slate-300">
          Supports <span className="text-white">.edi</span>, <span className="text-white">.txt</span>, <span className="text-white">.x12</span>, and batch <span className="text-white">.zip</span> uploads.
        </p>

        {fileName && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">
            <span className="text-accent">Selected</span>
            <span>{fileName}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-100">
          {error}
        </div>
      )}

      <div className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="eyebrow">Sample files</p>
            <h3 className="mt-3 text-xl font-semibold text-white">Try the workflow without uploading your own data</h3>
          </div>
          <p className="hidden text-sm text-slate-400 md:block">One click loads a transaction and opens the results panel.</p>
        </div>

        <div className="sample-grid">
          {sampleFiles.map((sample) => (
            <button key={sample.name} onClick={() => loadSample(sample.name)} className="sample-button">
              <span className="eyebrow">{sample.accent}</span>
              <strong>{sample.label}</strong>
              <p>{sample.description}</p>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
