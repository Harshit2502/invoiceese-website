import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './Dashboard.css';

function StatCard({ label, value, sub }) {
  return (
    <div className="stat-card">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub && <div className="stat-sub">{sub}</div>}
    </div>
  );
}

function formatAmount(n) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
  return `₹${n}`;
}

export default function Dashboard() {
  const { user, authFetch } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ clientName: '', service: '', amount: '', gstRate: 18, notes: '' });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const loadInvoices = useCallback(async () => {
    try {
      const res = await authFetch('/api/invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
      setStats(data.stats || {});
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  const handleCreateChange = e => setCreateForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async e => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await authFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify(createForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvoices(prev => [data.invoice, ...prev]);
      setStats(prev => ({
        ...prev,
        total: (prev.total || 0) + 1,
        totalAmount: (prev.totalAmount || 0) + data.invoice.totalAmount,
        pending: (prev.pending || 0) + data.invoice.totalAmount,
        pendingCount: (prev.pendingCount || 0) + 1,
      }));
      setShowCreate(false);
      setCreateForm({ clientName: '', service: '', amount: '', gstRate: 18, notes: '' });
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const updateStatus = async (id, status) => {
    setStatusUpdating(id);
    try {
      const res = await authFetch(`/api/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (res.ok) setInvoices(prev => prev.map(inv => inv.id === id ? data.invoice : inv));
    } catch (e) {
      console.error(e);
    } finally {
      setStatusUpdating(null);
    }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    const res = await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (res.ok) setInvoices(prev => prev.filter(inv => inv.id !== id));
  };

  const statusColors = { paid: 'badge-paid', unpaid: 'badge-unpaid', overdue: 'badge-overdue' };
  const isFree = user?.plan === 'free';
  const remaining = 5 - (user?.invoicesThisMonth || 0);

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-body">

        {/* Upgrade banner */}
        {isFree && (
          <div className="upgrade-banner">
            <div>
              <strong>You're on the Free plan</strong>
              <span>{remaining} invoice{remaining !== 1 ? 's' : ''} remaining this month · Upgrade for unlimited invoices</span>
            </div>
            <Link to="/pricing" className="btn btn-accent btn-sm">Upgrade to Pro</Link>
          </div>
        )}

        <div className="container">
          <div className="dash-header">
            <div>
              <h1>Welcome back, {user?.businessName?.split(' ')[0] || 'there'}! 👋</h1>
              <p>Here's what's happening with your invoices</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Invoice</button>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <StatCard label="Total Invoices" value={stats.total || 0} sub={`+${invoices.filter(i => i.date?.startsWith('2026-03')).length} this month`} />
            <StatCard label="Total Amount" value={formatAmount(stats.totalAmount || 0)} />
            <StatCard label="Paid" value={formatAmount(stats.paid || 0)} sub={stats.total ? `${Math.round((stats.paid / stats.totalAmount) * 100) || 0}% collection rate` : ''} />
            <StatCard label="Pending" value={formatAmount(stats.pending || 0)} sub={`${stats.pendingCount || 0} invoice${stats.pendingCount !== 1 ? 's' : ''}`} />
          </div>

          {/* Create invoice modal */}
          {showCreate && (
            <div className="modal-overlay" onClick={() => setShowCreate(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Create New Invoice</h2>
                  <button className="modal-close" onClick={() => setShowCreate(false)}>×</button>
                </div>
                {createError && <div className="alert alert-error">{createError}</div>}
                <form onSubmit={handleCreate}>
                  <div className="form-group">
                    <label className="form-label">Client Name <span className="required">*</span></label>
                    <input className="form-input" name="clientName" value={createForm.clientName} onChange={handleCreateChange} placeholder="Acme Corporation" required />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Service Description <span className="required">*</span></label>
                    <input className="form-input" name="service" value={createForm.service} onChange={handleCreateChange} placeholder="Website Design, SEO Services..." required />
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Amount (₹) <span className="required">*</span></label>
                      <input className="form-input" name="amount" type="number" value={createForm.amount} onChange={handleCreateChange} placeholder="50000" required min="1" />
                    </div>
                    <div className="form-group">
                      <label className="form-label">GST Rate (%)</label>
                      <select className="form-select" name="gstRate" value={createForm.gstRate} onChange={handleCreateChange}>
                        <option value={0}>0% (Exempt)</option>
                        <option value={5}>5%</option>
                        <option value={12}>12%</option>
                        <option value={18}>18% (Standard)</option>
                        <option value={28}>28%</option>
                      </select>
                    </div>
                  </div>
                  {createForm.amount && createForm.gstRate > 0 && (
                    <div className="gst-preview">
                      Base: ₹{Number(createForm.amount).toLocaleString('en-IN')} +
                      GST ({createForm.gstRate}%): ₹{(createForm.amount * createForm.gstRate / 100).toLocaleString('en-IN')} =&nbsp;
                      <strong>Total: ₹{(Number(createForm.amount) * (1 + createForm.gstRate / 100)).toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea className="form-textarea" name="notes" value={createForm.notes} onChange={handleCreateChange} placeholder="Payment terms, special instructions..." />
                  </div>
                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={creating}>
                      {creating ? <span className="spinner" /> : 'Create Invoice'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Invoice table */}
          <div className="invoice-panel">
            <div className="panel-header">
              <h2>Recent Invoices</h2>
              <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
                📱 Create via WhatsApp
              </a>
            </div>

            {loading ? (
              <div className="loading-state"><div className="spinner" /></div>
            ) : invoices.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">📄</div>
                <h3>No invoices yet</h3>
                <p>Create your first invoice to get started</p>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>Create Invoice</button>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="invoice-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Client</th>
                      <th>Date</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoices.map(inv => (
                      <tr key={inv.id}>
                        <td className="inv-num">{inv.invoiceNumber}</td>
                        <td>{inv.clientName}<br /><span className="inv-service">{inv.service}</span></td>
                        <td>{new Date(inv.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                        <td className="inv-amount">
                          ₹{(inv.totalAmount || inv.amount).toLocaleString('en-IN')}
                          {inv.gstRate > 0 && <span className="inv-gst">incl. {inv.gstRate}% GST</span>}
                        </td>
                        <td>
                          <select
                            className={`status-select status-${inv.status}`}
                            value={inv.status}
                            onChange={e => updateStatus(inv.id, e.target.value)}
                            disabled={statusUpdating === inv.id}
                          >
                            <option value="unpaid">Unpaid</option>
                            <option value="paid">Paid</option>
                            <option value="overdue">Overdue</option>
                          </select>
                        </td>
                        <td className="inv-actions">
                          <button className="btn btn-sm action-btn" onClick={() => deleteInvoice(inv.id)}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
