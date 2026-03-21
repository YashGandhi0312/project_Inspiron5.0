interface RemittanceSummaryProps {
  summary: {
    total_charged: number;
    total_paid: number;
    total_adjusted: number;
    total_denied: number;
    claims: any[];
    adjustments: any[];
  };
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

export default function RemittanceSummary({ summary }: RemittanceSummaryProps) {
  const paidPercent = summary.total_charged > 0
    ? ((summary.total_paid / summary.total_charged) * 100).toFixed(1)
    : '0';

  return (
    <div className="glass-card p-4 animate-fade-in">
      <h3 className="text-lg font-bold text-slate-100 mb-4 flex items-center gap-2">
        💰 835 Remittance Summary
      </h3>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="bg-dark-blue/20 border border-dark-blue/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Charged</div>
          <div className="text-xl font-bold text-slate-100">{formatCurrency(summary.total_charged)}</div>
        </div>
        <div className="bg-green/20 border border-green/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Paid</div>
          <div className="text-xl font-bold text-green">{formatCurrency(summary.total_paid)}</div>
          <div className="text-xs text-slate-500 mt-1">{paidPercent}% of charged</div>
        </div>
        <div className="bg-orange/20 border border-orange/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Adjusted</div>
          <div className="text-xl font-bold text-orange">{formatCurrency(summary.total_adjusted)}</div>
        </div>
        <div className="bg-red-accent/20 border border-red-accent/30 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Denied</div>
          <div className="text-xl font-bold text-red-accent">{formatCurrency(summary.total_denied)}</div>
        </div>
      </div>

      {/* Claims Table */}
      <h4 className="text-sm font-semibold text-slate-300 mb-3">Claim Details</h4>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Claim ID</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Status</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium">Charged</th>
              <th className="text-right py-2 px-3 text-slate-400 font-medium">Paid</th>
              <th className="text-left py-2 px-3 text-slate-400 font-medium">Adjustments</th>
            </tr>
          </thead>
          <tbody>
            {summary.claims.map((claim, i) => (
              <tr key={i} className="border-b border-slate-800 hover:bg-white/5 transition-colors">
                <td className="py-2.5 px-3 font-mono text-accent-blue">{claim.claim_id}</td>
                <td className="py-2.5 px-3">
                  <span className={`badge ${
                    claim.status === '4' ? 'badge-error' :
                    claim.status === '1' ? 'badge-success' : 'badge-info'
                  }`}>
                    {claim.status_label}
                  </span>
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-slate-300">
                  {formatCurrency(claim.charged)}
                </td>
                <td className="py-2.5 px-3 text-right font-mono text-green">
                  {formatCurrency(claim.paid)}
                </td>
                <td className="py-2.5 px-3">
                  {claim.adjustments?.map((adj: any, j: number) => (
                    <div key={j} className="text-xs text-slate-400 mb-1">
                      <span className="font-mono text-orange">{adj.group_code}-{adj.reason_code}</span>
                      <span className="ml-1">{adj.reason_description}</span>
                      <span className="ml-1 text-red-accent">({formatCurrency(adj.amount)})</span>
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
