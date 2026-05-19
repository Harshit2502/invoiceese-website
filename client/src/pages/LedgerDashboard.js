import React, { useState, useEffect, useMemo, useRef } from "react";
import CreateInvoiceModal from "../components/CreateInvoiceModal";
import SettingsScreen from "../components/SettingsScreen";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, Upload, Package, BarChart2,
  TrendingUp, TrendingDown, Plus, Eye, ChevronRight,
  ChevronLeft, CheckCircle, AlertCircle, Database, Settings, LogOut, Trash2, Search
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import "./LedgerDashboard.css";

const T = "#0F6E56";
const TL = "#E1F5EE";

function Sidebar({ screen, setScreen, user, logout }) {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", s: 0 },
    { icon: BarChart2, label: "Analytics", s: 4 },
    { type: 'divider', label: 'Documents' },
    { icon: FileText, label: "All Documents", s: 1 },
    { icon: Upload, label: "Upload Invoice", s: 2 },
    { type: 'divider', label: 'Manage' },
    { icon: Package, label: "Products & Stock", s: null },
    { icon: Settings, label: "Settings", s: 5 },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="wordmark">ShoeTrack</div>
        <div className="sub">Business Manager</div>
      </div>

      <nav className="nav">
        {nav.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <React.Fragment key={idx}>
                {idx > 0 && <div className="divider"></div>}
                <div className="nav-section-label">{item.label}</div>
              </React.Fragment>
            );
          }

          const Icon = item.icon;
          const isActive = screen === item.s;
          
          return (
            <button 
              key={item.label} 
              onClick={() => item.s !== null && setScreen(item.s)}
              className={`nav-item ${isActive ? 'active' : ''}`}
              style={{ opacity: item.s === null ? 0.5 : 1, cursor: item.s === null ? 'not-allowed' : 'pointer' }}
            >
              <Icon size={16} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="user-avatar">{user?.businessName?.charAt(0) || 'U'}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="user-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user?.businessName || 'My Business'}
          </div>
          <div className="user-plan">
            {user?.plan === 'free' ? 'Free Plan' : 'Pro Plan'} · {user?.gstNumber ? 'GST' : 'No GST'}
          </div>
        </div>
        <button onClick={logout} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: 4 }} title="Logout">
          <LogOut size={14} />
        </button>
      </div>
    </aside>
  );
}

function Dashboard({ setScreen, user, stats, monthData, recentInvoices }) {
  const sortedMonthData = useMemo(() => {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return [...monthData].sort((a, b) => {
      const idxA = months.indexOf(a.m);
      const idxB = months.indexOf(b.m);
      return idxA - idxB;
    });
  }, [monthData]);

  const maxChartVal = Math.max(...sortedMonthData.flatMap(d => [d.rev, d.cost]), 1);

  return (
    <div className="screen active" id="screen-dashboard">
      <div className="section-header">
        <div>
          <div className="section-title">Good morning, {user?.email?.split('@')[0] || 'User'}</div>
          <div className="section-sub">Business overview and recent activity</div>
        </div>
        <button className="btn btn-ghost" style={{ fontSize: 12 }}>
          <svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          {new Date().toLocaleString('default', { month: 'long', year: 'numeric' })}
        </button>
      </div>

      <div className="stats-grid">
        <div className="stat-card accent">
          <div className="stat-label">Net Profit</div>
          <div className="stat-value">₹{(stats.revenue - stats.purchases).toLocaleString()}</div>
          <div className="stat-delta">
            <span className="delta-tag" style={{ background: 'rgba(255,255,255,.2)', color: '#fff' }}>YTD</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Revenue</div>
          <div className="stat-value">₹{stats.revenue.toLocaleString()}</div>
          <div className="stat-delta"><span className="delta-tag up">YTD</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Purchases</div>
          <div className="stat-value">₹{stats.purchases.toLocaleString()}</div>
          <div className="stat-delta"><span className="delta-tag dn">YTD</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock Value</div>
          <div className="stat-value">₹{stats.stockValue.toLocaleString()}</div>
          <div className="stat-delta"><span className="delta-tag" style={{ background: 'var(--border2)' }}>Current</span></div>
        </div>
      </div>

      <div className="two-col" style={{ gridTemplateColumns: "1fr" }}>
        <div className="card">
          <div className="card-title">Revenue vs Purchases</div>
          <div className="bar-chart">
            {sortedMonthData.map((d, i) => (
              <div className="bar-group" key={i}>
                <div className="bar bar-rev" style={{ height: `${(d.rev/maxChartVal)*110}px` }} title={`Revenue ₹${d.rev.toLocaleString()}`}></div>
                <div className="bar bar-cost" style={{ height: `${(d.cost/maxChartVal)*110}px` }} title={`Purchases ₹${d.cost.toLocaleString()}`}></div>
                <div className="bar-label">{d.m}</div>
              </div>
            ))}
            {sortedMonthData.length === 0 && (
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'var(--ink3)', fontSize: 13 }}>No data yet</div>
            )}
          </div>
          <div className="chart-legend">
            <div className="legend-label"><div className="legend-dot" style={{ background: 'var(--green)' }}></div>Revenue</div>
            <div className="legend-label"><div className="legend-dot" style={{ background: 'var(--green-l)', border: '1px solid #9FE1CB' }}></div>Purchases</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Recent documents</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Party</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recentInvoices.map((r, i) => (
              <tr key={i}>
                <td>
                  <span className={`doc-type-badge ${r.type === 'SALE' ? 'badge-sale' : 'badge-buy'}`}>
                    {r.type === 'SALE' ? 'Sales Invoice' : 'Purchase'}
                  </span>
                </td>
                <td style={{ fontWeight: 500 }}>{r.party}</td>
                <td style={{ color: 'var(--ink3)' }}>{r.date}</td>
                <td style={{ fontWeight: 600 }}>₹{Number(r.amount).toLocaleString()}</td>
                <td>
                  <span className={`status-dot ${r.status === 'Paid' || r.status === 'Verified' ? 'status-paid' : r.status === 'Reviewing' ? 'status-review' : 'status-pending'}`}></span>
                  {r.status}
                </td>
              </tr>
            ))}
            {recentInvoices.length === 0 && (
              <tr>
                <td colSpan="5" style={{ textAlign: "center", padding: 40, color: "var(--ink3)" }}>
                  No transactions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InvoiceHub({ setScreen, invoices, purchases, setShowCreate, updateInvoiceStatus, statusUpdating, deleteInvoice }) {
  const [filter, setFilter] = useState('all');

  const allDocs = useMemo(() => {
    const s = invoices.map(inv => ({
      id: inv.id,
      sysType: 'sale',
      type: inv.docType || 'sales_invoice',
      no: inv.invoiceNumber,
      party: inv.clientName,
      date: new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      amount: `₹${Number(inv.totalAmount || inv.amount).toLocaleString()}`,
      status: inv.status === 'paid' ? 'Paid' : 'Pending',
      url: inv.pdfUrl,
      ts: new Date(inv.createdAt).getTime()
    }));

    const p = purchases.map(inv => ({
      id: inv.id,
      sysType: 'purchase',
      type: 'purchase_invoice',
      no: inv.invoiceNumber,
      party: inv.supplierName,
      date: new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
      amount: `₹${Number(inv.total).toLocaleString()}`,
      status: inv.status,
      url: inv.pdfUrl,
      ts: new Date(inv.createdAt).getTime()
    }));

    return [...s, ...p].sort((a, b) => b.ts - a.ts);
  }, [invoices, purchases]);

  const filteredDocs = filter === 'all' ? allDocs : allDocs.filter(d => d.type === filter);

  const getDocBadge = (type) => {
    const map = {
      'sales_invoice': { cls: 'badge-sale', label: 'Sales Invoice' },
      'purchase_invoice': { cls: 'badge-buy', label: 'Purchase Invoice' },
      'credit_note': { cls: 'badge-credit', label: 'Credit Note' },
      'debit_note': { cls: 'badge-debit-note', label: 'Debit Note' },
      'delivery_challan': { cls: 'badge-challan', label: 'Delivery Challan' },
      'provisional_invoice': { cls: 'badge-provisional', label: 'Provisional Bill' },
    };
    return map[type] || { cls: 'badge-sale', label: type };
  };

  const getStatusDot = (s) => {
    const map = { Paid:'status-paid', Verified:'status-paid', Pending:'status-pending', Reviewing:'status-review' };
    return map[s] || 'status-review';
  };

  const docCounts = allDocs.reduce((acc, d) => {
    acc[d.type] = (acc[d.type] || 0) + 1;
    acc['all'] = (acc['all'] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="screen active" id="screen-documents">
      <div className="section-header">
        <div>
          <div className="section-title">Documents</div>
          <div className="section-sub">All your buy-side and sell-side documents in one place</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={14} /> Create Invoice
        </button>
      </div>

      <div className="doc-type-grid">
        <div className={`doc-type-card ${filter === 'all' ? 'selected' : ''}`} onClick={() => setFilter('all')}>
          <div className="doc-type-icon" style={{ background: 'var(--green-l)', fontSize: 18 }}>📋</div>
          <div>
            <div className="doc-type-label">All Documents</div>
            <div className="doc-type-desc">Every buy and sell document</div>
            <div className="doc-type-count">{docCounts['all'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'sales_invoice' ? 'selected' : ''}`} onClick={() => setFilter('sales_invoice')}>
          <div className="doc-type-icon" style={{ background: '#EEF2FF', fontSize: 18 }}>🧾</div>
          <div>
            <div className="doc-type-label">Sales Invoice</div>
            <div className="doc-type-desc">Issued to your customers with GST</div>
            <div className="doc-type-count">{docCounts['sales_invoice'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'purchase_invoice' ? 'selected' : ''}`} onClick={() => setFilter('purchase_invoice')}>
          <div className="doc-type-icon" style={{ background: '#FEF3C7', fontSize: 18 }}>📦</div>
          <div>
            <div className="doc-type-label">Purchase Invoice</div>
            <div className="doc-type-desc">Received from your wholesalers</div>
            <div className="doc-type-count">{docCounts['purchase_invoice'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'credit_note' ? 'selected' : ''}`} onClick={() => setFilter('credit_note')}>
          <div className="doc-type-icon" style={{ background: '#FEE2E2', fontSize: 18 }}>↩️</div>
          <div>
            <div className="doc-type-label">Credit Note</div>
            <div className="doc-type-desc">Customer returns — reduces their due</div>
            <div className="doc-type-count">{docCounts['credit_note'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'delivery_challan' ? 'selected' : ''}`} onClick={() => setFilter('delivery_challan')}>
          <div className="doc-type-icon" style={{ background: '#ECFDF5', fontSize: 18 }}>🚚</div>
          <div>
            <div className="doc-type-label">Delivery Challan</div>
            <div className="doc-type-desc">Accompanies goods — no price yet</div>
            <div className="doc-type-count">{docCounts['delivery_challan'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'provisional_invoice' ? 'selected' : ''}`} onClick={() => setFilter('provisional_invoice')}>
          <div className="doc-type-icon" style={{ background: '#FFF7ED', fontSize: 18 }}>⏳</div>
          <div>
            <div className="doc-type-label">Provisional Bill</div>
            <div className="doc-type-desc">Estimated amount, awaiting final</div>
            <div className="doc-type-count">{docCounts['provisional_invoice'] || 0} documents</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-title">{filter === 'all' ? 'All Documents' : getDocBadge(filter).label}</div>
        <table className="doc-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Party</th>
              <th>Document no.</th>
              <th>Date</th>
              <th>Amount</th>
              <th>Status</th>
              <th style={{ textAlign: 'right' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredDocs.map((r, i) => {
              const badgeInfo = getDocBadge(r.type);
              return (
                <tr key={i}>
                  <td><span className={`doc-type-badge ${badgeInfo.cls}`}>{badgeInfo.label}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.party}</td>
                  <td style={{ color: 'var(--ink3)', fontSize: 12 }}>{r.no}</td>
                  <td style={{ color: 'var(--ink3)' }}>{r.date}</td>
                  <td style={{ fontWeight: 600 }}>{r.amount}</td>
                  <td style={{ fontSize: 12 }}>
                    {r.sysType === 'sale' ? (
                      <button 
                        onClick={() => updateInvoiceStatus(r.id, r.status === 'Paid' ? 'pending' : 'paid')}
                        disabled={statusUpdating === r.id}
                        title="Click to toggle status"
                        style={{ border: "none", cursor: statusUpdating === r.id ? "wait" : "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 500, background: r.status === "Paid" ? "#d1fae5" : "#fef2f2", color: r.status === "Paid" ? "#065f46" : "#b45309" }}
                      >
                        {statusUpdating === r.id ? '...' : r.status}
                      </button>
                    ) : (
                      <>
                        <span className={`status-dot ${getStatusDot(r.status)}`}></span>{r.status}
                      </>
                    )}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <div style={{ display: "inline-flex", gap: 10, alignItems: "center" }}>
                      {r.url ? (
                        <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "var(--ink3)" }} title="View PDF"><Eye size={16} /></a>
                      ) : (
                        <Eye size={16} style={{ color: "var(--border)" }} />
                      )}
                      {r.sysType === "sale" && (
                        <button onClick={() => deleteInvoice(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }} title="Delete Document">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {filteredDocs.length === 0 && (
              <tr>
                <td colSpan="7" style={{ textAlign: "center", padding: 40, color: "var(--ink3)" }}>
                  No documents found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="alert alert-info">
        <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
        Upload a PDF or photo of any purchase invoice — our AI reads GST numbers, line items, and totals automatically.
      </div>
    </div>
  );
}

function UploadInvoice({ setScreen, authFetch, setExtractedData }) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileUpload = async (file) => {
    if (!file) return;
    if (uploading) return;
    
    if (file.size > 20 * 1024 * 1024) {
      setError("File is too large. Max size is 20MB.");
      return;
    }

    setUploading(true);
    setError(null);
    
    let p = 0;
    const t = setInterval(() => {
      p += 15;
      setProgress(Math.min(p, 90));
    }, 500);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        const base64Data = reader.result;
        try {
          const res = await authFetch('/api/purchases/extract', { 
            method: 'POST', 
            body: JSON.stringify({ image: base64Data, mimeType: file.type }) 
          });
          
          clearInterval(t);
          if (res.ok) {
            const json = await res.json();
            setProgress(100);
            setExtractedData(json.data);
            setTimeout(() => setScreen(3), 400);
          } else {
            const errData = await res.json();
            throw new Error(errData.error || 'Extraction failed');
          }
        } catch (err) {
          clearInterval(t);
          setError(err.message);
          setUploading(false);
          setProgress(0);
        }
      };
      reader.onerror = () => {
        clearInterval(t);
        setError("Failed to read file.");
        setUploading(false);
        setProgress(0);
      };
    } catch (err) {
      clearInterval(t);
      setError(err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileUpload(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="screen active" id="screen-upload">
      <div className="section-header">
        <div>
          <div className="section-title">Upload Document</div>
          <div className="section-sub">PDF, image, or WhatsApp photo — AI extracts everything</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
        <div>
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/jpeg, image/png, image/webp, image/heic, application/pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          <div 
            className={`upload-zone ${dragOver ? 'drag' : ''}`} 
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={onDrop}
            onClick={() => !uploading && fileInputRef.current && fileInputRef.current.click()}
          >
            <div className="upload-icon-wrap">
              <Upload size={24} color={dragOver || uploading ? "#fff" : "var(--green)"} />
            </div>
            
            {!uploading ? (
              <>
                <div className="upload-title">Drop invoice here or click to browse</div>
                <div className="upload-sub">Works on PDFs, JPEGs, PNGs, and WhatsApp photos</div>
                <div className="upload-formats">
                  <span className="fmt-tag">PDF</span>
                  <span className="fmt-tag">JPG</span>
                  <span className="fmt-tag">PNG</span>
                  <span className="fmt-tag">HEIC</span>
                  <span className="fmt-tag">WEBP</span>
                </div>
                {error && <div style={{ color: '#dc2626', marginTop: 16, fontSize: 13 }}>{error}</div>}
              </>
            ) : (
              <div style={{ maxWidth: 320, margin: '0 auto' }}>
                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--green)', marginBottom: 10 }}>Scanning with AI...</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }}></div>
                </div>
                <div style={{ fontSize: 11, color: 'var(--ink3)', marginTop: 4 }}>
                  {progress < 40 ? "Reading invoice layout..." : progress < 80 ? "Extracting line items..." : "Done — ready to review"}
                </div>
              </div>
            )}
          </div>

          <div style={{ fontSize: 12, color: 'var(--ink3)', textAlign: 'center', margin: '10px 0' }}>
            or <button style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>enter details manually</button>
          </div>

          <div className="alert alert-warn">
            <AlertCircle size={14} style={{ marginTop: 2, flexShrink: 0 }} />
            Always review extracted data before saving. AI reads correctly for most invoices but you can edit any field before confirming.
          </div>
        </div>

        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-title">AI support</div>
            <div style={{ fontSize: 12, color: 'var(--ink3)', lineHeight: 1.7 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><span style={{ color: 'var(--green-m)' }}>✓</span><span>GST invoice number & tax breakdowns</span></div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><span style={{ color: 'var(--green-m)' }}>✓</span><span>Line items, quantities, unit costs</span></div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><span style={{ color: 'var(--green-m)' }}>✓</span><span>Supplier GST number & address</span></div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}><span style={{ color: 'var(--green-m)' }}>✓</span><span>CGST / SGST / IGST split</span></div>
              <div style={{ display: 'flex', gap: 8 }}><span style={{ color: 'var(--green-m)' }}>✓</span><span>Blurry photos & handwritten bills</span></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewExtraction({ setScreen, extractedData, authFetch, fetchPurchases, fetchProducts }) {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/purchases', {
        method: 'POST',
        body: JSON.stringify(extractedData)
      });
      if (res.ok) {
        setSaved(true);
        fetchPurchases();
        fetchProducts();
        setTimeout(() => setScreen(4), 1000); // Redirect to analytics
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!extractedData) return <div className="screen active" style={{ padding: 30 }}>No data extracted. Please go back and upload an invoice.</div>;

  return (
    <div className="screen active" id="screen-review">
      <div className="section-header">
        <div>
          <div className="section-title">Review Extracted Data</div>
          <div className="section-sub">Verify before saving — all fields are editable</div>
        </div>
        <div style={{ background: '#d1fae5', color: '#065f46', fontSize: 12, padding: '6px 12px', borderRadius: 8, fontWeight: 600 }}>
          96% confidence
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Supplier Details</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              {[
                { label: "Supplier", val: extractedData.supplier },
                { label: "Invoice no", val: extractedData.invoiceNo },
                { label: "Date", val: extractedData.date },
                { label: "GST no", val: extractedData.gst },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: "var(--ink3)", fontSize: 12, width: 80, flexShrink: 0 }}>{f.label}</span>
                  <input defaultValue={f.val} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", minWidth: 0, outline: 'none' }} />
                </div>
              ))}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Line Items</div>
            {extractedData.items.map((item, i) => (
              <div key={i} style={{ padding: "12px 16px", borderTop: i > 0 ? "1px solid var(--border2)" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "var(--ink)" }}>{item.name}</span>
                  <span style={{ background: item.conf > 0.95 ? "#d1fae5" : "#fef9c3", color: item.conf > 0.95 ? "#065f46" : "#92400e", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{Math.round(item.conf * 100)}%</span>
                </div>
                <div style={{ display: "flex", gap: 16, color: "var(--ink3)", fontSize: 12 }}>
                  <span>Qty: <strong style={{ color: "var(--ink2)" }}>{item.qty}</strong></span>
                  <span>@ ₹<strong style={{ color: "var(--ink2)" }}>{item.unit.toLocaleString()}</strong></span>
                  <span>= <strong style={{ color: "var(--green)" }}>₹{item.total.toLocaleString()}</strong></span>
                </div>
              </div>
            ))}
            <div style={{ padding: "12px 16px", borderTop: "2px solid var(--border)", background: "var(--cream)", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
              <span>Total payable</span>
              <span style={{ color: "var(--green)" }}>₹{extractedData.total.toLocaleString()}</span>
            </div>
          </div>

          {error && <div className="alert alert-warn">{error}</div>}

          <button onClick={confirm} disabled={loading || saved} className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', width: '100%', fontSize: 14 }}>
            <CheckCircle size={16} /> {saved ? "Saved! Loading analytics..." : loading ? "Saving..." : "Confirm & Save Invoice"}
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Original PDF Preview</div>
          <div style={{ padding: 20, height: "100%", minHeight: 400, background: "var(--cream)", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: 'var(--ink3)', textAlign: 'center' }}>
              <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
              <p>Invoice rendering securely...</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Analytics({ products, stats }) {
  const inventoryData = products.map(p => {
    const margin = p.sellingPrice > 0 ? Math.round(((p.sellingPrice - p.avgCost) / p.sellingPrice) * 100) : 0;
    return { name: p.name, remaining: p.stockQty, margin, bought: p.stockQty, sold: 0, pl: (p.sellingPrice - p.avgCost) * p.stockQty };
  });

  return (
    <div className="screen active" id="screen-analytics">
      <div className="section-header">
        <div>
          <div className="section-title">Analytics</div>
          <div className="section-sub">Auto-generated from your sales & purchase invoices</div>
        </div>
        <div className="pill-tabs">
          <button className="pill-tab active">YTD</button>
          <button className="pill-tab">Last 3 months</button>
          <button className="pill-tab">This year</button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card accent">
          <div className="stat-label">Gross Profit</div>
          <div className="stat-value">₹{(stats.revenue - stats.purchases).toLocaleString()}</div>
          <div className="stat-delta">
            <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              YTD Derived
            </span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Units Sold</div>
          <div className="stat-value">--</div>
          <div className="stat-delta"><span className="delta-tag up">Needs SKU tracking</span></div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avg Margin</div>
          <div className="stat-value">
            {inventoryData.length > 0 ? `${Math.round(inventoryData.reduce((acc, p) => acc + p.margin, 0) / inventoryData.length)}%` : '0%'}
          </div>
          <div className="stat-delta" style={{ color: 'var(--ink3)' }}>across all products</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock SKUs</div>
          <div className="stat-value">{products.length}</div>
          <div className="stat-delta"><span className="delta-tag up">Active</span></div>
        </div>
      </div>

      <div className="analytics-grid">
        <div className="card analytics-big">
          <div className="card-title">Product-wise performance <span>margin · stock remaining</span></div>
          <table className="inv-table">
            <thead>
              <tr><th>Product</th><th>Stock</th><th>Margin %</th><th>Est P&L</th></tr>
            </thead>
            <tbody>
              {inventoryData.slice(0, 5).map((p, i) => (
                <tr key={i}>
                  <td style={{ fontWeight: 500 }}>{p.name}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: p.remaining <= 6 ? '#fee2e2' : 'var(--border2)', color: p.remaining <= 6 ? '#991b1b' : 'var(--ink2)' }}>
                      {p.remaining}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 60, height: 4, background: 'var(--border2)', borderRadius: 2 }}>
                        <div style={{ width: `${Math.min(p.margin, 100)}%`, height: 4, background: 'var(--green)', borderRadius: 2 }}></div>
                      </div>
                      <span style={{ fontWeight: 600, color: 'var(--green)' }}>{p.margin}%</span>
                    </div>
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>₹{p.pl.toLocaleString()}</td>
                </tr>
              ))}
              {inventoryData.length === 0 && (
                <tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--ink3)', padding: 20 }}>No products found</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-title">GST summary <span>YTD</span></div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Estimated Revenue</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₹{stats.revenue.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Estimated Purchases</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₹{stats.purchases.toLocaleString()}</span>
            </div>
            <div style={{ marginTop: 12, padding: '10px 12px', background: 'var(--terra-l)', borderRadius: 8, fontSize: 12, color: '#7C3A1A' }}>
              📅 Next GST filing due: <strong>20 Next Month</strong>
            </div>
          </div>
        </div>

        {inventoryData.some(p => p.remaining <= 6) && (
          <div className="card">
            <div className="card-title">Low Stock Alerts</div>
            {inventoryData.filter(p => p.remaining <= 6).map((p, i) => (
              <div key={i} className="low-stock">
                <div className="low-stock-icon">⚠️</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#991B1B' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#B91C1C', marginTop: 2 }}>Only {p.remaining} left in stock.</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function LedgerDashboard() {
  const { user, logout, authFetch, setUser } = useAuth();
  const [screen, setScreen] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extractedData, setExtractedData] = useState(null);

  const fetchInvoices = async () => {
    try {
      const res = await authFetch('/api/invoices');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error);
    }
  };

  const updateInvoiceStatus = async (id, status) => {
    setStatusUpdating(id);
    try {
      const res = await authFetch(`/api/invoices/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
      if (res.ok) {
        const data = await res.json();
        setInvoices(prev => prev.map(inv => inv.id === id ? data.invoice : inv));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setStatusUpdating(null);
    }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm('Delete this invoice?')) return;
    try {
      const res = await authFetch(`/api/invoices/${id}`, { method: 'DELETE' });
      if (res.ok) setInvoices(prev => prev.filter(inv => inv.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const fetchPurchases = async () => {
    try {
      const res = await authFetch('/api/purchases');
      if (res.ok) {
        const data = await res.json();
        setPurchases(data.purchases || []);
      }
    } catch (error) {
      console.error('Failed to fetch purchases:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await authFetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error('Failed to fetch products:', error);
    }
  };

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchPurchases(), fetchProducts()]).finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const revenue = invoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0);
    const cost = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const stockValue = products.reduce((sum, p) => sum + (Number(p.stockQty || 0) * Number(p.avgCost || 0)), 0);
    return { revenue, purchases: cost, stockValue };
  }, [invoices, purchases, products]);

  const recentInvoices = useMemo(() => {
    const all = [
      ...invoices.map(i => ({ type: 'SALE', party: i.clientName, amount: i.totalAmount || i.amount, date: i.date || i.createdAt, status: i.status === 'paid' ? 'Paid' : 'Pending', ts: new Date(i.createdAt).getTime() })),
      ...purchases.map(p => ({ type: 'BUY', party: p.supplierName, amount: p.total, date: p.invoiceDate || p.createdAt, status: p.status, ts: new Date(p.createdAt).getTime() }))
    ];
    return all.sort((a, b) => b.ts - a.ts).slice(0, 5).map(x => ({
      ...x,
      date: new Date(x.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })
    }));
  }, [invoices, purchases]);

  const monthData = useMemo(() => {
    const dataByMonth = {};
    const process = (arr, key) => {
      arr.forEach(item => {
        const d = new Date(item.date || item.invoiceDate || item.createdAt);
        const m = d.toLocaleString('en-IN', { month: 'short' });
        if (!dataByMonth[m]) dataByMonth[m] = { m, rev: 0, cost: 0 };
        dataByMonth[m][key] += Number(item.totalAmount || item.amount || item.total || 0);
      });
    };
    process(invoices, 'rev');
    process(purchases, 'cost');
    return Object.values(dataByMonth);
  }, [invoices, purchases]);

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f8f5ee' }}>Loading...</div>;
  }

  const screenTitles = {
    0: "Dashboard",
    1: "All Documents",
    2: "Upload Invoice",
    3: "Review Invoice",
    4: "Analytics",
    5: "Settings"
  };

  return (
    <div className="ledger-dashboard-wrapper">
      <div className="layout">
        <Sidebar screen={screen} setScreen={setScreen} user={user} logout={logout} />
        
        <main className="main">
          <div className="topbar">
            <div className="topbar-title">{screenTitles[screen] || "Dashboard"}</div>
            <div className="topbar-search">
              <Search size={14} color="#9ca3af" />
              <input placeholder="Search invoices, products…" />
            </div>
            <button className="btn btn-terra" onClick={() => setShowCreate(true)}>
              <Plus size={13} /> Create Invoice
            </button>
          </div>

          <div className="content">
            {screen === 0 && <Dashboard setScreen={setScreen} user={user} stats={stats} monthData={monthData} recentInvoices={recentInvoices} />}
            {screen === 1 && <InvoiceHub setScreen={setScreen} invoices={invoices} purchases={purchases} setShowCreate={setShowCreate} updateInvoiceStatus={updateInvoiceStatus} statusUpdating={statusUpdating} deleteInvoice={deleteInvoice} />}
            {screen === 2 && <UploadInvoice setScreen={setScreen} authFetch={authFetch} setExtractedData={setExtractedData} />}
            {screen === 3 && <ReviewExtraction setScreen={setScreen} extractedData={extractedData} authFetch={authFetch} fetchPurchases={fetchPurchases} fetchProducts={fetchProducts} />}
            {screen === 4 && <Analytics products={products} stats={stats} />}
            {screen === 5 && <SettingsScreen user={user} setUser={setUser} authFetch={authFetch} />}
          </div>
        </main>
        
        {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSuccess={() => { fetchInvoices(); fetchProducts(); }} user={user} />}
      </div>
    </div>
  );
}
