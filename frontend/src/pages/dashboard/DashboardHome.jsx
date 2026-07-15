import React from 'react';
import DashboardLayout from '../../components/common/DashboardLayout';

export default function DashboardHome() {
  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">DashboardOverview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Real-time statistics and quick shop metrics.</p>
      </div>

      {/* Simple Analytics Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-8">
        {[
          { title: 'Total Revenue', value: '$12,450', change: '+12% from last week', icon: '💰' },
          { title: 'Active Products', value: '342 Items', change: '12 low in stock', icon: '📦' },
          { title: 'Sales Completed', value: '89 Orders', change: '+4% today', icon: '📈' },
        ].map((card, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.title}</p>
              <h3 className="text-2xl font-bold text-slate-900 mt-2">{card.value}</h3>
              <p className="text-xs text-slate-400 mt-1">{card.change}</p>
            </div>
            <div className="w-12 h-12 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center text-xl">
              {card.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Dynamic Placeholder for Table/Charts */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs text-center py-12">
        <p className="text-slate-400 text-sm">Recent Activity Logs & Transactions will be rendered here.</p>
      </div>
    </div>
  );
}
