'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Lead } from '@/types';
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
  const [scoreRange, setScoreRange] = useState<[number, number]>([0, 400]);
  const [loading, setLoading] = useState(true);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    init();
  }, []);

  const init = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/');
      return;
    }
    setUser(session.user);
    await loadData(session.user.id);
  };

  const loadData = async (userId: string) => {
    setLoading(true);

    const [leadsRes, accessRes, ledgerRes] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .order('intelligence_score', { ascending: false })
        .limit(100),
      supabase
        .from('lead_access')
        .select('lead_id')
        .eq('user_id', userId),
      supabase
        .from('credit_ledger')
        .select('amount')
        .eq('user_id', userId),
    ]);

    setLeads(leadsRes.data || []);
    setEntitledSet(
      new Set((accessRes.data || []).map((r: any) => r.lead_id))
    );
    setCredits(
      (ledgerRes.data || []).reduce(
        (s: number, r: any) => s + r.amount,
        0
      )
    );

    setLoading(false);
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (
        searchQuery &&
        !l.company.toLowerCase().includes(searchQuery.toLowerCase())
      )
        return false;

      if (
        l.intelligence_score < scoreRange[0] ||
        l.intelligence_score > scoreRange[1]
      )
        return false;

      return true;
    });
  }, [leads, searchQuery, scoreRange]);

  // ✅ FIXED VARIABLE NAME
  const unentitled = useMemo(
    () =>
      filteredLeads.filter((l) => !entitledSet.has(l.id)),
    [filteredLeads, entitledSet]
  );

  const handleUnlock = async () => {
    if (!selectedIds.size || !user) return;

    setUnlocking(true);

    try {
      const { error } = await supabase.rpc(
        'unlock_leads_secure',
        { p_lead_ids: Array.from(selectedIds) }
      );

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
          <h2 className="text-2xl font-bold mb-2">
            Your Intelligence Platform is Ready
          </h2>
          <p className="text-gray-600">
            Run DATABASE_SETUP.sql in Supabase to load sample data
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Top Nav */}
      <nav className="glass-panel sticky top-0 z-50 px-6 py-4">
        <div className="flex items-center justify-between">
          <span className="text-xl font-bold">
            VerifiedMeasure
          </span>

          <div className="flex items-center gap-4">
            <DarkModeToggle />
            <div className="px-4 py-2 rounded-lg bg-primary-50 font-semibold">
              {credits} Credits
            </div>
            <button
              onClick={() => {
                supabase.auth.signOut();
                router.push('/');
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Leads Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredLeads.map((lead) => {
            const entitled = entitledSet.has(lead.id);
            const selected = selectedIds.has(lead.id);

            return (
              <div key={lead.id} className="glass-panel p-6">
                <h3 className="font-bold text-lg mb-2">
                  {lead.company}
                </h3>

                <div className="space-y-2 text-sm mb-4">
                  {lead.email && (
                    <div>
                      Email:{' '}
                      {entitled
                        ? lead.email
                        : maskEmail(lead.email)}
                    </div>
                  )}
                  {lead.phone && (
                    <div>
                      Phone:{' '}
                      {entitled
                        ? lead.phone
                        : maskPhone(lead.phone)}
                    </div>
                  )}
                </div>

                {!entitled && (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => {
                      const n = new Set(selectedIds);
                      selected
                        ? n.delete(lead.id)
                        : n.add(lead.id);
                      setSelectedIds(n);
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}
