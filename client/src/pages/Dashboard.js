import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './Dashboard.css';

const WHATSAPP_LINK_NUMBER = (process.env.REACT_APP_WHATSAPP_NUMBER || '917666522600').replace(/[^0-9]/g, '');
const WHATSAPP_START_TEXT = encodeURIComponent('new invoice');

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
  const value = Number(n) || 0;
  if (value >= 100000) return `₹${(value / 100000).toFixed(1)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(0)}K`;
  return `₹${value}`;
}

function getInvoiceValue(invoice) {
  return Number(invoice?.totalAmount || invoice?.amount) || 0;
}

function deriveStatsFromInvoices(invoices) {
  const safeInvoices = Array.isArray(invoices) ? invoices : [];
  return {
    total: safeInvoices.length,
    totalAmount: safeInvoices.reduce((sum, invoice) => sum + getInvoiceValue(invoice), 0),
    paid: safeInvoices
      .filter((invoice) => invoice.status === 'paid')
      .reduce((sum, invoice) => sum + getInvoiceValue(invoice), 0),
    pending: safeInvoices
      .filter((invoice) => invoice.status !== 'paid')
      .reduce((sum, invoice) => sum + getInvoiceValue(invoice), 0),
    pendingCount: safeInvoices.filter((invoice) => invoice.status !== 'paid').length,
  };
}

function countInvoicesThisMonth(invoices) {
  const now = new Date();
  return (Array.isArray(invoices) ? invoices : []).filter((invoice) => {
    if (!invoice?.date) return false;
    const invoiceDate = new Date(invoice.date);
    return invoiceDate.getFullYear() === now.getFullYear() && invoiceDate.getMonth() === now.getMonth();
  }).length;
}

export default function Dashboard() {
  const { user, authFetch, setUser } = useAuth();
  const [invoices, setInvoices] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createForm, setCreateForm] = useState({
    clientName: '',
    items: [{ description: '', quantity: 1, unitPrice: '' }],
    gstRate: 18,
    notes: '',
    templateStyle: 'modern',
  });
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [logoUploadPayload, setLogoUploadPayload] = useState(null);
  const [whatsAppStatus, setWhatsAppStatus] = useState(null);
  const [whatsAppLoading, setWhatsAppLoading] = useState(true);
  const [whatsAppError, setWhatsAppError] = useState('');
  const [whatsAppTestSending, setWhatsAppTestSending] = useState(false);
  const [whatsAppTestMessage, setWhatsAppTestMessage] = useState('');
  const [settingsForm, setSettingsForm] = useState({ 
    templateStyle: user?.templateStyle || 'modern', 
    showWatermark: user?.showWatermark !== false,
    logoUrl: user?.logoUrl || '',
  });

  const loadInvoices = useCallback(async () => {
    try {
      const res = await authFetch('/api/invoices');
      const data = await res.json();
      const nextInvoices = data.invoices || [];
      setInvoices(nextInvoices);
      setStats(deriveStatsFromInvoices(nextInvoices));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { loadInvoices(); }, [loadInvoices]);

  useEffect(() => {
    const loadWhatsAppStatus = async () => {
      try {
        setWhatsAppLoading(true);
        setWhatsAppError('');
        const response = await fetch('/api/whatsapp/status');
        const data = await response.json();
        setWhatsAppStatus(data);
      } catch (error) {
        setWhatsAppError('Could not load WhatsApp integration status');
      } finally {
        setWhatsAppLoading(false);
      }
    };

    loadWhatsAppStatus();
  }, []);

  useEffect(() => {
    setSettingsForm({
      templateStyle: user?.templateStyle || 'modern',
      showWatermark: user?.showWatermark !== false,
      logoUrl: user?.logoUrl || '',
    });
  }, [user]);

  const handleCreateChange = e => setCreateForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleItemChange = (index, field, value) => {
    setCreateForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };
      return { ...prev, items: nextItems };
    });
  };

  const addItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', quantity: 1, unitPrice: '' }],
    }));
  };

  const removeItemRow = (index) => {
    setCreateForm((prev) => {
      if (prev.items.length === 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
    });
  };

  const itemsSubtotal = Number(
    (createForm.items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      return sum + (quantity * unitPrice);
    }, 0).toFixed(2)
  );

  const previewGstAmount = Number(((itemsSubtotal * (Number(createForm.gstRate) || 0)) / 100).toFixed(2));
  const previewTotal = Number((itemsSubtotal + previewGstAmount).toFixed(2));

  const handleCreate = async e => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await authFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
          ...createForm,
          items: (createForm.items || []).map((item) => ({
            description: String(item.description || '').trim(),
            quantity: Number(item.quantity) || 0,
            unitPrice: Number(item.unitPrice) || 0,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setInvoices(prev => {
        const nextInvoices = [data.invoice, ...prev];
        setStats(deriveStatsFromInvoices(nextInvoices));
        return nextInvoices;
      });
      setShowCreate(false);
      setCreateForm({
        clientName: '',
        items: [{ description: '', quantity: 1, unitPrice: '' }],
        gstRate: 18,
        notes: '',
        templateStyle: isPro ? (user?.templateStyle || 'modern') : 'modern',
      });
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
      if (res.ok) {
        setInvoices(prev => {
          const nextInvoices = prev.map(inv => inv.id === id ? data.invoice : inv);
          setStats(deriveStatsFromInvoices(nextInvoices));
          return nextInvoices;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatusUpdating(null);
    }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    const res = await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
    if (res.ok) {
      setInvoices(prev => {
        const nextInvoices = prev.filter(inv => inv.id !== id);
        setStats(deriveStatsFromInvoices(nextInvoices));
        return nextInvoices;
      });
    }
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setSettingsError('Please upload a valid image file');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setSettingsForm((prev) => ({ ...prev, logoUrl: dataUrl }));
      setLogoUploadPayload({ dataUrl, fileName: file.name || 'logo.png' });
      setSettingsError('');
    };
    reader.onerror = () => setSettingsError('Could not read the selected logo file');
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSettingsForm((prev) => ({ ...prev, logoUrl: '' }));
    setLogoUploadPayload(null);
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsError('');
    setSettingsSaved(false);
    try {
      let nextLogoUrl = settingsForm.logoUrl;

      if (logoUploadPayload?.dataUrl) {
        const uploadRes = await authFetch('/api/users/upload-logo', {
          method: 'POST',
          body: JSON.stringify(logoUploadPayload),
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) throw new Error(uploadData.error || 'Logo upload failed');
        nextLogoUrl = uploadData.logoUrl || nextLogoUrl;
      }

      const profileRes = await authFetch('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({ logoUrl: nextLogoUrl }),
      });
      const profileData = await profileRes.json();
      if (!profileRes.ok) throw new Error(profileData.error);

      const res = await authFetch('/api/users/settings', {
        method: 'POST',
        body: JSON.stringify({
          templateStyle: settingsForm.templateStyle,
          showWatermark: settingsForm.showWatermark,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setUser(data.user || profileData.user);
      setSettingsForm((prev) => ({ ...prev, logoUrl: nextLogoUrl }));
      setLogoUploadPayload(null);
      setSettingsSaved(true);
      setTimeout(() => setSettingsSaved(false), 2000);
    } catch (err) {
      setSettingsError(err.message);
    }
  };

  const handleSendWhatsAppTest = async () => {
    setWhatsAppTestSending(true);
    setWhatsAppTestMessage('');
    try {
      const response = await authFetch('/api/whatsapp/test-send', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test message');
      setWhatsAppTestMessage(`Test message sent to ${data.to}`);
    } catch (error) {
      setWhatsAppTestMessage(error.message);
    } finally {
      setWhatsAppTestSending(false);
    }
  };

  const statusColors = { paid: 'badge-paid', unpaid: 'badge-unpaid', overdue: 'badge-overdue' };
  const isFree = user?.plan === 'free';
  const isPro = user?.plan === 'pro' || user?.plan === 'business';

  return (
    <div className="dashboard-page">
      <Navbar />
      <div className="dashboard-body">

        {/* Upgrade banner */}
        {isFree && (
          <div className="upgrade-banner">
            <div>
              <strong>You're on the Free plan</strong>
              <span>Upgrade to Pro for 3 premium templates, no watermark, custom logo, and payment tracking</span>
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
            <div style={{ display: 'flex', gap: '12px' }}>
              {isPro && (
                <button className="btn btn-secondary" onClick={() => setShowSettings(true)}>⚙️ Settings</button>
              )}
              <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ New Invoice</button>
            </div>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <StatCard label="Total Invoices" value={stats.total || 0} sub={`+${countInvoicesThisMonth(invoices)} this month`} />
            <StatCard label="Total Amount" value={formatAmount(stats.totalAmount || 0)} />
            <StatCard label="Paid" value={formatAmount(stats.paid || 0)} sub={Number(stats.totalAmount) > 0 ? `${Math.round(((Number(stats.paid) || 0) / Number(stats.totalAmount)) * 100) || 0}% collection rate` : ''} />
            <StatCard label="Pending" value={formatAmount(stats.pending || 0)} sub={`${stats.pendingCount || 0} invoice${stats.pendingCount !== 1 ? 's' : ''}`} />
          </div>

          <div className="whatsapp-panel">
            <div className="whatsapp-panel-header">
              <div>
                <h2>WhatsApp Integration</h2>
                <p>Connect Meta Cloud API and test message delivery from the dashboard.</p>
              </div>
              <a href={`https://wa.me/${WHATSAPP_LINK_NUMBER}?text=${WHATSAPP_START_TEXT}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
                Open Chat
              </a>
            </div>

            {whatsAppLoading ? (
              <div className="whatsapp-status-row">Loading WhatsApp status...</div>
            ) : whatsAppError ? (
              <div className="alert alert-error">{whatsAppError}</div>
            ) : (
              <>
                <div className="whatsapp-status-grid">
                  <div className="whatsapp-status-card">
                    <span className={`status-dot ${whatsAppStatus?.configured ? 'dot-paid' : 'dot-overdue'}`} />
                    <div>
                      <strong>{whatsAppStatus?.configured ? 'Connected' : 'Not configured'}</strong>
                      <p>{whatsAppStatus?.configured ? 'Token and Phone Number ID detected' : 'Add token and phone number ID in server env'}</p>
                    </div>
                  </div>
                  <div className="whatsapp-status-card">
                    <strong>Saved user number</strong>
                    <p>{user?.whatsapp || 'No WhatsApp number saved in profile'}</p>
                  </div>
                  <div className="whatsapp-status-card">
                    <strong>Public chat number</strong>
                    <p>{whatsAppStatus?.publicNumber || WHATSAPP_LINK_NUMBER || 'Not set'}</p>
                  </div>
                  <div className="whatsapp-status-card">
                    <strong>Webhook endpoint</strong>
                    <p>{whatsAppStatus?.webhookPath || '/api/whatsapp/webhook'}</p>
                  </div>
                </div>

                <div className="whatsapp-actions-row">
                  <button className="btn btn-primary btn-sm" type="button" onClick={handleSendWhatsAppTest} disabled={!whatsAppStatus?.configured || !user?.whatsapp || whatsAppTestSending}>
                    {whatsAppTestSending ? 'Sending...' : 'Send Test Message'}
                  </button>
                  <Link to="/pricing" className="btn btn-secondary btn-sm">View Plan Benefits</Link>
                </div>

                {whatsAppTestMessage && (
                  <div className={`alert ${whatsAppTestMessage.startsWith('Test message sent') ? 'alert-success' : 'alert-error'}`}>
                    {whatsAppTestMessage}
                  </div>
                )}
              </>
            )}
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
                    <label className="form-label">Invoice Items <span className="required">*</span></label>
                    {(createForm.items || []).map((item, index) => (
                      <div key={index} className="form-row" style={{ marginBottom: 10 }}>
                        <input
                          className="form-input"
                          placeholder="Item description"
                          value={item.description}
                          onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                          required
                        />
                        <input
                          className="form-input"
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          required
                        />
                        <input
                          className="form-input"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="Unit price"
                          value={item.unitPrice}
                          onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                          required
                        />
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => removeItemRow(index)}
                          disabled={(createForm.items || []).length === 1}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button type="button" className="btn btn-secondary btn-sm" onClick={addItemRow}>+ Add Item</button>
                  </div>
                  <div className="form-row">
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
                  {itemsSubtotal > 0 && (
                    <div className="gst-preview">
                      Subtotal: ₹{itemsSubtotal.toLocaleString('en-IN')} +
                      GST ({createForm.gstRate}%): ₹{previewGstAmount.toLocaleString('en-IN')} =&nbsp;
                      <strong>Total: ₹{previewTotal.toLocaleString('en-IN')}</strong>
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Notes (Optional)</label>
                    <textarea className="form-textarea" name="notes" value={createForm.notes} onChange={handleCreateChange} placeholder="Payment terms, special instructions..." />
                  </div>
                  {isPro && (
                    <div className="form-group">
                      <label className="form-label">Invoice Template</label>
                      <select className="form-select" name="templateStyle" value={createForm.templateStyle} onChange={handleCreateChange}>
                        <option value="modern">Modern (Default)</option>
                        <option value="minimal">Minimal</option>
                        <option value="classic">Classic</option>
                        <option value="premium">Premium</option>
                      </select>
                    </div>
                  )}
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

          {/* Settings modal (Pro+ only) */}
          {showSettings && isPro && (
            <div className="modal-overlay" onClick={() => setShowSettings(false)}>
              <div className="modal-card" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                  <h2>Invoice Settings</h2>
                  <button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
                </div>
                {settingsError && <div className="alert alert-error">{settingsError}</div>}
                {settingsSaved && <div className="alert alert-success">Settings saved successfully!</div>}
                <form onSubmit={handleSaveSettings}>
                  <div className="form-group">
                    <label className="form-label">Default Template</label>
                    <select className="form-select" value={settingsForm.templateStyle} onChange={(e) => setSettingsForm(f => ({ ...f, templateStyle: e.target.value }))}>
                      <option value="modern">Modern</option>
                      <option value="minimal">Minimal</option>
                      <option value="classic">Classic</option>
                      <option value="premium">Premium</option>
                    </select>
                    <p className="form-helper">Choose which template to use for new invoices by default</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      <input
                        type="checkbox"
                        checked={!settingsForm.showWatermark}
                        onChange={(e) => setSettingsForm(f => ({ ...f, showWatermark: !e.target.checked }))}
                      />
                      {' '}Remove InvoiceEase watermark
                    </label>
                    <p className="form-helper">Pro benefit: Hide the watermark on your invoices for a more professional look</p>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Business Logo</label>
                    <input className="form-input" type="file" accept="image/*" onChange={handleLogoUpload} />
                    <p className="form-helper">Upload a PNG, JPG, or SVG logo to include on your invoices.</p>
                    {settingsForm.logoUrl && (
                      <div className="logo-preview-block">
                        <img src={settingsForm.logoUrl} alt="Business logo preview" className="logo-preview-image" />
                        <button type="button" className="btn btn-secondary btn-sm" onClick={removeLogo}>Remove Logo</button>
                      </div>
                    )}
                  </div>

                  <div className="modal-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowSettings(false)}>Cancel</button>
                    <button type="submit" className="btn btn-primary">Save Settings</button>
                  </div>
                </form> 
              </div>
            </div>
          )}

          {/* Invoice table */}
          <div className="invoice-panel">
            <div className="panel-header">
              <h2>Recent Invoices</h2>
              <a href={`https://wa.me/${WHATSAPP_LINK_NUMBER}?text=${WHATSAPP_START_TEXT}`} target="_blank" rel="noreferrer" className="btn btn-whatsapp btn-sm">
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
                          ₹{(Number(inv.totalAmount || inv.amount) || 0).toLocaleString('en-IN')}
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
                          {inv.pdfUrl ? (
                            <a className="btn btn-sm action-btn" href={inv.pdfUrl} target="_blank" rel="noreferrer">PDF</a>
                          ) : (
                            <span className="text-muted">No PDF</span>
                          )}
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
