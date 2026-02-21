'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lead, DashboardMetrics } from '@/types';
import { maskEmail, maskPhone, formatCurrency } from '@/lib/format';
import DarkModeToggle from '@/components/ui/DarkModeToggle';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [entitledSet, setEntitledSet] = useState<Set<string>>(new Set());
  const [credits, setCredits] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [scoreRange, setScoreRange] = useState([0, 400]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => { init(); }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { router.push('/'); return; }
    setUser(session.user);
    await loadData(session.user.id);
  };

  const loadData = async (userId: string) => {
    setLoading(true);
    const [leadsRes, accessRes, ledgerRes] = await Promise.all([
      supabase.from('leads').select('*').order('intelligence_score', { ascending: false }).limit(100),
      supabase.from('lead_access').select('lead_id').eq('user_id', userId),
      supabase.from('credit_ledger').select('amount').eq('user_id', userId),
    ]);
    setLeads(leadsRes.data || []);
    setEntitledSet(new Set((accessRes.data || []).map((r: any) => r.lead_id)));
    setCredits((ledgerRes.data || []).reduce((s: number, r: any) => s + r.amount, 0));
    setLoading(false);
  };

  const filteredLeads = useMemo(() => leads.filter(l => {
    if (searchQuery && !l.company.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (l.intelligence_score < scoreRange[0] || l.intelligence_score > scoreRange[1]) return false;
    return true;
  }), [leads, searchQuery, scoreRange]);

  const unen titled = useMemo(() => filteredLeads.filter(l => !entitledSet.has(l.id)), [filteredLeads, entitledSet]);

  const handleUnlock = async () => {
    if (!selectedIds.size || !user) return;
    setUnlocking(true);
    try {
      const { error } = await supabase.rpc('unlock_leads_secure', { p_lead_ids: Array.from(selectedIds) });
      if (error) throw error;
      alert(`Unlocked ${selectedIds.size} leads`);
      await loadData(user.id);
      setSelectedIds(new Set());
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUnlocking(false);
    }
  };

  if (!leads.length && !loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-6">
            <svg className="w-10 h-10 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold mb-2">Your Intelligence Platform is Ready</h2>
          <p className="text-gray-600">Run DATABASE_SETUP.sql in Supabase to load sample data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <nav className="glass-panel sticky top-0 z-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <span className="text-xl font-bold">VerifiedMeasure</span>
            </div>
            <div className="relative w-64">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search companies..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white/50 dark:bg-gray-800/50 focus:ring-2 focus:ring-primary-500 outline-none"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <div className="px-4 py-2 rounded-lg bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold">
              {credits} Credits
            </div>
            <button onClick={() => { supabase.auth.signOut(); router.push('/'); }} className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100">
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-panel p-6">
            <div className="text-sm text-gray-600 mb-2">Total Companies</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{leads.length}</div>
          </div>
          <div className="glass-panel p-6">
            <div className="text-sm text-gray-600 mb-2">Avg Intelligence</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">
              {leads.length ? Math.round(leads.reduce((s, l) => s + l.intelligence_score, 0) / leads.length) : 0}
            </div>
          </div>
          <div className="glass-panel p-6">
            <div className="text-sm text-gray-600 mb-2">Unlocked</div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{entitledSet.size}</div>
          </div>
        </div>

        {/* Filters */}
        <div className="glass-panel p-4 flex items-center gap-4">
          <div className="flex-1">
            <label className="text-sm text-gray-600 mb-2 block">Intelligence Score Range</label>
            <div className="flex items-center gap-4">
              <input type="number" value={scoreRange[0]} onChange={e => setScoreRange([+e.target.value, scoreRange[1]])} className="w-24 px-3 py-2 rounded-lg border border-gray-300" />
              <span>to</span>
              <input type="number" value={scoreRange[1]} onChange={e => setScoreRange([scoreRange[0], +e.target.value])} className="w-24 px-3 py-2 rounded-lg border border-gray-300" />
            </div>
          </div>
          {unentitled.length > 0 && (
            <button
              onClick={() => setSelectedIds(new Set(unentitled.map(l => l.id)))}
              className="px-4 py-2 bg-primary-100 text-primary-700 rounded-lg font-medium">
              Select All Locked ({unentitled.length})
            </button>
          )}
        </div>

        {/* Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map(lead => {
            const entitled = entitledSet.has(lead.id);
            const selected = selectedIds.has(lead.id);
            return (
              <div key={lead.id} className="glass-panel p-6 hover:shadow-xl transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-bold text-lg mb-1">{lead.company}</h3>
                    {lead.stage && <span className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded-full">{lead.stage}</span>}
                  </div>
                  {!entitled && (
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => {
                        const n = new Set(selectedIds);
                        selected ? n.delete(lead.id) : n.add(lead.id);
                        setSelectedIds(n);
                      }}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                  )}
                </div>

                <div className="space-y-2 text-sm mb-4">
                  {lead.email && <div>Email: {entitled ? lead.email : maskEmail(lead.email)}</div>}
                  {lead.phone && <div>Phone: {entitled ? lead.phone : maskPhone(lead.phone)}</div>}
                  {lead.arr_estimate && <div>ARR: {formatCurrency(lead.arr_estimate)}</div>}
                  {lead.employees && <div>Employees: {lead.employees}</div>}
                </div>

                {lead.tech_stack && (
                  <div className="flex flex-wrap gap-1 mb-4">
                    {lead.tech_stack.slice(0, 3).map(t => (
                      <span key={t} className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">{t}</span>
                    ))}
                    {lead.tech_stack.length > 3 && <span className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-800 rounded">+{lead.tech_stack.length - 3}</span>}
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600" style={{ width: `${(lead.intelligence_score / 400) * 100}%` }} />
                  </div>
                  <span className="text-sm font-semibold">{lead.intelligence_score}</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Selection Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 glass-panel border-t p-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="font-semibold">{selectedIds.size} selected</span>
              <button onClick={() => setSelectedIds(new Set())} className="text-sm text-gray-600">Clear</button>
            </div>
            <button
              onClick={handleUnlock}
              disabled={unlocking || selectedIds.size > credits}
              className="btn-primary disabled:opacity-50">
              {unlocking ? 'Unlocking...' : `Unlock ${selectedIds.size} (${selectedIds.size} credits)`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
