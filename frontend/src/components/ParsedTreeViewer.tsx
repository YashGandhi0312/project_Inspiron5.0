import { useState } from 'react';

interface Loop {
  loop_id: string;
  name: string;
  segments: Segment[];
  children: Loop[];
}

interface Segment {
  segment_id: string;
  elements: { index: number; value: string; description: string }[];
  raw: string;
  line_number: number;
}

interface ParsedTreeViewerProps {
  loops: Loop[];
  transactionType: string;
}

function SegmentRow({ segment }: { segment: Segment }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 transition-colors group"
      >
        <span className="text-xs text-slate-500 w-6">{segment.line_number}</span>
        <span className="font-mono text-sm font-bold text-medium-blue">{segment.segment_id}</span>
        <span className="text-xs text-slate-500 flex-1 truncate font-mono">{segment.raw}</span>
        <span className="text-xs text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity">
          {expanded ? '▼' : '▶'} {segment.elements.length} elements
        </span>
      </button>
      
      {expanded && (
        <div className="ml-12 mb-2 animate-fade-in">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="text-left py-1 px-2 w-12">#</th>
                <th className="text-left py-1 px-2">Value</th>
              </tr>
            </thead>
            <tbody>
              {segment.elements.map((elem) => (
                <tr key={elem.index} className="border-t border-slate-700/30 hover:bg-white/5">
                  <td className="py-1 px-2 text-slate-500 font-mono">
                    {segment.segment_id}{String(elem.index).padStart(2, '0')}
                  </td>
                  <td className="py-1 px-2 text-slate-300 font-mono">
                    {elem.value || <span className="text-slate-600 italic">empty</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function LoopNode({ loop, depth = 0 }: { loop: Loop; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);

  const colorClasses = [
    'border-accent-blue',
    'border-teal',
    'border-orange',
    'border-green',
    'border-medium-blue',
  ];
  const borderColor = colorClasses[depth % colorClasses.length];

  return (
    <div className={`tree-node ${borderColor} my-2`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 py-1.5 px-2 rounded-md hover:bg-white/5 transition-colors w-full text-left"
      >
        <span className="text-sm">{expanded ? '📂' : '📁'}</span>
        <span className="text-sm font-semibold text-slate-200">{loop.loop_id}</span>
        <span className="text-xs text-slate-500">— {loop.name}</span>
        <span className="ml-auto text-xs text-slate-600">
          {loop.segments.length} seg{loop.segments.length !== 1 ? 's' : ''}
          {loop.children.length > 0 && ` · ${loop.children.length} sub`}
        </span>
      </button>

      {expanded && (
        <div className="animate-fade-in">
          {loop.segments.map((seg, i) => (
            <SegmentRow key={`${seg.segment_id}-${i}`} segment={seg} />
          ))}
          {loop.children.map((child, i) => (
            <LoopNode key={`${child.loop_id}-${i}`} loop={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ParsedTreeViewer({ loops, transactionType }: ParsedTreeViewerProps) {
  const [viewMode, setViewMode] = useState<'tree' | 'raw'>('tree');
  const totalSegments = loops.reduce((acc, l) => acc + l.segments.length, 0);

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-100 flex items-center gap-2">
          🌳 Parsed Structure
          <span className="badge badge-info">{transactionType}</span>
        </h3>
        <div className="flex gap-1 bg-surface rounded-lg p-1">
          <button
            onClick={() => setViewMode('tree')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'tree' ? 'bg-accent-blue text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Tree
          </button>
          <button
            onClick={() => setViewMode('raw')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              viewMode === 'raw' ? 'bg-accent-blue text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            Raw
          </button>
        </div>
      </div>

      <div className="text-xs text-slate-500 mb-3">
        {loops.length} loops · {totalSegments} segments
      </div>

      {viewMode === 'tree' ? (
        <div className="max-h-[500px] overflow-y-auto pr-2">
          {loops.map((loop, i) => (
            <LoopNode key={`${loop.loop_id}-${i}`} loop={loop} />
          ))}
        </div>
      ) : (
        <pre className="max-h-[500px] overflow-y-auto p-4 bg-surface rounded-lg text-xs font-mono text-slate-300 whitespace-pre-wrap">
          {loops.flatMap(l => l.segments).map(s => s.raw).join('\n')}
        </pre>
      )}
    </div>
  );
}
