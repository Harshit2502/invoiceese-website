import React, { useState, useEffect, useMemo, useRef } from "react";
import CreateInvoiceModal from "../components/CreateInvoiceModal";
import SettingsScreen from "../components/SettingsScreen";
import GstFilingAssistant from "../components/GstFilingAssistant";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, Upload, Package, BarChart2,
  TrendingUp, TrendingDown, Plus, Eye, ChevronRight,
  ChevronLeft, CheckCircle, AlertCircle, Database, Settings, LogOut, Trash2, Search, Menu, X, Download,
  Bell, Calendar, MessageSquare, ExternalLink, RefreshCw, Send, ShieldCheck
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";
import "./LedgerDashboard.css";

const T = "#0F6E56";
const TL = "#E1F5EE";

const safeFormatDate = (dateVal) => {
  if (!dateVal) return 'N/A';
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return 'N/A';
  try {
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  } catch (e) {
    return 'N/A';
  }
};

const safeGetTime = (dateVal) => {
  if (!dateVal) return 0;
  const d = new Date(dateVal);
  return isNaN(d.getTime()) ? 0 : d.getTime();
};

const standardizeDateForInput = (dateStr) => {
  if (!dateStr) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) {
    return d.toISOString().split('T')[0];
  }
  const parts = String(dateStr).match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (parts) {
    const day = parts[1].padStart(2, '0');
    const month = parts[2].padStart(2, '0');
    const year = parts[3];
    return `${year}-${month}-${day}`;
  }
  return '';
};

function Sidebar({ screen, setScreen, user, logout, isSidebarOpen, setIsSidebarOpen }) {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", s: 0 },
    { icon: BarChart2, label: "Analytics", s: 4 },
    { type: 'divider', label: 'Documents' },
    { icon: FileText, label: "All Documents", s: 1 },
    { icon: Upload, label: "Upload Invoice", s: 2 },
    { type: 'divider', label: 'Manage' },
    { icon: Package, label: "Products & Stock", s: 6 },
    { icon: ShieldCheck, label: "GST Filing Assistant", s: 7 },
    { icon: Settings, label: "Settings", s: 5 },
  ];

  return (
    <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
      <button className="sidebar-close-btn" onClick={() => setIsSidebarOpen(false)}>
        <X size={20} />
      </button>
      <div className="sidebar-logo">
        <div className="wordmark">InvoiceEase</div>
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

function BottomNav({ screen, setScreen, setShowCreate }) {
  const nav = [
    { icon: LayoutDashboard, label: "Home", s: 0 },
    { icon: FileText, label: "Docs", s: 1 },
    { icon: Upload, label: "Upload", s: 2 },
    { icon: BarChart2, label: "Stats", s: 4 },
    { icon: Package, label: "Stocks", s: 6 },
  ];

  return (
    <nav className="bottom-nav">
      {nav.map((item) => {
        const Icon = item.icon;
        const isActive = screen === item.s;
        return (
          <button 
            key={item.label} 
            onClick={() => item.action === 'create' ? setShowCreate(true) : setScreen(item.s)}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function Dashboard({ setScreen, user, stats, monthData, recentInvoices, invoices, handleSendBulkReminders, sendingBulk }) {
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

      {/* Outstanding Summary Widget */}
      {(() => {
        const todayStr = new Date().toISOString().split('T')[0];
        const overdueInvoices = invoices.filter(inv => 
          inv.docType === 'sales_invoice' && 
          inv.paymentStatus !== 'paid' && 
          inv.status !== 'paid' &&
          inv.dueDate && 
          inv.dueDate < todayStr
        );
        const totalOverdueAmount = overdueInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0);
        const overdueCount = overdueInvoices.length;
        const oldestUnpaid = overdueInvoices.reduce((oldest, inv) => {
          if (!oldest) return inv;
          return inv.dueDate < oldest.dueDate ? inv : oldest;
        }, null);

        return overdueCount > 0 ? (
          <div className="card" style={{ marginBottom: 22, background: '#FFFDF5', border: '1px solid #FAC775', borderRadius: 12, padding: '20px 24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 14 }}>
              <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <div style={{ fontSize: 24, background: '#FEF3C7', padding: 10, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🔔</div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#B45309', textTransform: 'uppercase', letterSpacing: 0.5 }}>Outstanding Payments</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: '#78350F', marginTop: 4, display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span>₹{totalOverdueAmount.toLocaleString()}</span>
                    <span style={{ fontSize: 13, fontWeight: 500, color: '#D97706' }}>({overdueCount} overdue invoices)</span>
                  </div>
                  {oldestUnpaid && (
                    <div style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>
                      Oldest unpaid: <strong>#{oldestUnpaid.invoiceNumber}</strong> (due {safeFormatDate(oldestUnpaid.dueDate)})
                    </div>
                  )}
                </div>
              </div>
              <div>
                <button 
                  className="btn" 
                  onClick={handleSendBulkReminders} 
                  disabled={sendingBulk}
                  style={{ background: '#D97706', color: '#fff', fontWeight: 600, padding: '9px 18px', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 6, boxShadow: '0 4px 10px rgba(217,119,6,0.15)' }}
                >
                  <Bell size={14} /> {sendingBulk ? 'Sending...' : 'Send Bulk Reminders'}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="card" style={{ marginBottom: 22, background: '#F0FDF4', border: '1px solid #86EFAC', borderRadius: 12, padding: '16px 24px' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ fontSize: 20, background: '#DCFCE7', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✅</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#166534', textTransform: 'uppercase', letterSpacing: 0.5 }}>Outstanding Payments</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#14532D', marginTop: 2 }}>All outbound invoices are fully paid!</div>
              </div>
            </div>
          </div>
        );
      })()}

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

function InvoiceHub({ setScreen, invoices, purchases, setShowCreate, updateInvoiceStatus, statusUpdating, deleteInvoice, handleExportCSV, handleViewDocDetails }) {
  const [filter, setFilter] = useState('all');

  const allDocs = useMemo(() => {
    const s = invoices.map(inv => {
      const isQuoteOrProforma = ['quotation', 'proforma'].includes(inv.docType);
      return {
        id: inv.id,
        sysType: 'sale',
        type: inv.docType || 'sales_invoice',
        no: inv.invoiceNumber,
        party: inv.clientName,
        date: safeFormatDate(inv.date || inv.createdAt),
        amount: `₹${Number(inv.totalAmount || inv.amount).toLocaleString()}`,
        status: isQuoteOrProforma ? (inv.quoteStatus || 'draft') : (inv.status === 'paid' ? 'Paid' : 'Pending'),
        convertedInvoiceId: inv.convertedInvoiceId,
        dueDate: inv.dueDate,
        clientEmail: inv.clientEmail,
        clientMobile: inv.clientMobile,
        url: inv.pdfUrl,
        ts: safeGetTime(inv.createdAt || inv.date)
      };
    });

    const p = purchases.map(inv => ({
      id: inv.id,
      sysType: 'purchase',
      type: 'purchase_invoice',
      no: inv.invoiceNumber,
      party: inv.supplierName,
      date: safeFormatDate(inv.invoiceDate || inv.createdAt),
      amount: `₹${Number(inv.total).toLocaleString()}`,
      status: inv.status,
      url: inv.pdfUrl,
      ts: safeGetTime(inv.createdAt || inv.invoiceDate),
      itcEligibility: inv.itcEligibility || 'inputs'
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
      'quotation': { cls: 'badge-quotation', label: 'Quotation' },
      'proforma': { cls: 'badge-proforma', label: 'Proforma Invoice' },
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
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => handleExportCSV('sales')} style={{ gap: 6, display: 'flex', alignItems: 'center', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '8px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
            <Download size={14} /> Export Sales (Excel)
          </button>
          <button className="btn btn-ghost" onClick={() => handleExportCSV('purchases')} style={{ gap: 6, display: 'flex', alignItems: 'center', background: '#fef3c7', color: '#d97706', border: '1px solid #fde68a', padding: '8px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
            <Download size={14} /> Export Purchases (Excel)
          </button>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            <Plus size={14} /> Create Invoice
          </button>
        </div>
      </div>

      <div className="doc-type-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
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
        <div className={`doc-type-card ${filter === 'quotation' ? 'selected' : ''}`} onClick={() => setFilter('quotation')}>
          <div className="doc-type-icon" style={{ background: '#E0F2FE', fontSize: 18 }}>📄</div>
          <div>
            <div className="doc-type-label">Quotation</div>
            <div className="doc-type-desc">Pre-tax customer estimates</div>
            <div className="doc-type-count">{docCounts['quotation'] || 0} documents</div>
          </div>
        </div>
        <div className={`doc-type-card ${filter === 'proforma' ? 'selected' : ''}`} onClick={() => setFilter('proforma')}>
          <div className="doc-type-icon" style={{ background: '#F3E8FF', fontSize: 18 }}>📑</div>
          <div>
            <div className="doc-type-label">Proforma Invoice</div>
            <div className="doc-type-desc">Draft invoice with tax estimation</div>
            <div className="doc-type-count">{docCounts['proforma'] || 0} documents</div>
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
                <tr key={i} onClick={() => handleViewDocDetails(r)} style={{ cursor: 'pointer' }}>
                  <td><span className={`doc-type-badge ${badgeInfo.cls}`}>{badgeInfo.label}</span></td>
                  <td style={{ fontWeight: 500 }}>{r.party}</td>
                  <td style={{ color: 'var(--ink3)', fontSize: 12 }}>{r.no}</td>
                  <td style={{ color: 'var(--ink3)' }}>{r.date}</td>
                  <td style={{ fontWeight: 600 }}>{r.amount}</td>
                  <td style={{ fontSize: 12 }}>
                    {['quotation', 'proforma'].includes(r.type) ? (
                      (() => {
                        const statusMap = {
                          draft: { label: 'Draft', bg: '#f3f4f6', color: '#374151' },
                          sent: { label: 'Sent', bg: '#dbeafe', color: '#1e40af' },
                          accepted: { label: 'Accepted', bg: '#d1fae5', color: '#065f46' },
                          rejected: { label: 'Rejected', bg: '#fee2e2', color: '#991b1b' },
                          converted: { label: 'Converted', bg: '#f3e8ff', color: '#6b21a8' },
                        };
                        const config = statusMap[String(r.status).toLowerCase()] || { label: r.status, bg: '#f3f4f6', color: '#374151' };
                        const convertedInv = invoices.find(inv => inv.id === r.convertedInvoiceId);
                        return (
                          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                            <span 
                              style={{ padding: "3px 10px", borderRadius: 12, fontWeight: 600, background: config.bg, color: config.color, display: 'inline-block' }}
                            >
                              {config.label}
                            </span>
                            {String(r.status).toLowerCase() === 'converted' && convertedInv && (
                              <span 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const targetDoc = allDocs.find(d => d.id === convertedInv.id);
                                  if (targetDoc) handleViewDocDetails(targetDoc);
                                }}
                                style={{ color: '#6b21a8', textDecoration: 'underline', cursor: 'pointer', fontSize: 11, fontWeight: 500 }}
                                title="Click to view converted invoice"
                              >
                                #{convertedInv.invoiceNumber}
                              </span>
                            )}
                          </div>
                        );
                      })()
                    ) : r.sysType === 'sale' ? (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          updateInvoiceStatus(r.id, r.status === 'Paid' ? 'pending' : 'paid');
                        }}
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
                        <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: "var(--ink3)" }} title="View PDF"><Eye size={16} /></a>
                      ) : (
                        <Eye size={16} style={{ color: "var(--border)" }} />
                      )}
                      {r.sysType === "sale" && (
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteInvoice(r.id);
                          }} 
                          style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }} 
                          title="Delete Document"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
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

function UploadInvoice({ setScreen, authFetch, setExtractedData, setExtractedImage }) {
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
            setExtractedImage(base64Data);
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
            or <button 
              onClick={() => {
                setExtractedData({
                  docType: 'purchase_invoice',
                  supplier: '',
                  invoiceNo: '',
                  date: new Date().toISOString().split('T')[0],
                  gst: '',
                  items: [],
                  subtotal: 0,
                  gstAmt: 0,
                  total: 0,
                  itcEligibility: 'inputs'
                });
                setExtractedImage(null);
                setScreen(3);
              }}
              style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 12, textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}
            >
              enter details manually
            </button>
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

function ReviewExtraction({ setScreen, extractedData, extractedImage, authFetch, fetchInvoices, fetchPurchases, fetchProducts }) {
  const [form, setForm] = useState({
    docType: extractedData?.docType || 'purchase_invoice',
    supplier: extractedData?.supplier || '',
    invoiceNo: extractedData?.invoiceNo || '',
    date: standardizeDateForInput(extractedData?.date) || new Date().toISOString().split('T')[0],
    gst: extractedData?.gst || '',
    items: extractedData?.items || [],
    subtotal: extractedData?.subtotal || 0,
    gstAmt: extractedData?.gstAmt || 0,
    total: extractedData?.total || 0,
    itcEligibility: extractedData?.itcEligibility || 'inputs'
  });

  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleItemChange = (index, field, value) => {
    const nextItems = [...form.items];
    nextItems[index] = {
      ...nextItems[index],
      [field]: value,
      total: field === 'qty' || field === 'unit' 
        ? Number(value) * Number(nextItems[index][field === 'qty' ? 'unit' : 'qty'] || 0)
        : nextItems[index].total
    };
    
    const sub = nextItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.unit || 0)), 0);
    const tax = Math.round(sub * 0.18 * 100) / 100;
    
    setForm(prev => {
      const targetTax = prev.gstAmt === (extractedData?.gstAmt || 0) ? tax : prev.gstAmt;
      return {
        ...prev,
        items: nextItems,
        subtotal: sub,
        gstAmt: targetTax,
        total: sub + targetTax
      };
    });
  };

  const addItem = () => {
    setForm(prev => {
      const nextItems = [...prev.items, { name: '', qty: 1, unit: 0, total: 0, conf: 1 }];
      return { ...prev, items: nextItems };
    });
  };

  const removeItem = (index) => {
    setForm(prev => {
      const nextItems = prev.items.filter((_, i) => i !== index);
      const sub = nextItems.reduce((sum, item) => sum + (Number(item.qty || 0) * Number(item.unit || 0)), 0);
      const tax = Math.round(sub * 0.18 * 100) / 100;
      const targetTax = prev.gstAmt === (extractedData?.gstAmt || 0) ? tax : prev.gstAmt;
      return {
        ...prev,
        items: nextItems,
        subtotal: sub,
        gstAmt: targetTax,
        total: sub + targetTax
      };
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => {
      const updated = { ...prev, [name]: value };
      if (name === 'subtotal' || name === 'gstAmt') {
        updated.total = Number(updated.subtotal || 0) + Number(updated.gstAmt || 0);
      }
      return updated;
    });
  };

  const confirm = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/purchases', {
        method: 'POST',
        body: JSON.stringify(form)
      });
      if (res.ok) {
        setSaved(true);
        if (typeof fetchInvoices === 'function') fetchInvoices();
        if (typeof fetchPurchases === 'function') fetchPurchases();
        if (typeof fetchProducts === 'function') fetchProducts();
        setTimeout(() => setScreen(1), 1000); // Redirect to Invoice Hub
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

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.2fr', gap: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Document Classification</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>Save As</span>
                <select name="docType" value={form.docType} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }}>
                  <option value="purchase_invoice">Purchase Invoice (Inbound Stock)</option>
                  <option value="sales_invoice">Sales Invoice (Outbound Stock)</option>
                  <option value="credit_note">Credit Note (Outbound Stock Return)</option>
                  <option value="debit_note">Debit Note (Outbound Stock Deduction)</option>
                  <option value="delivery_challan">Delivery Challan (Outbound)</option>
                  <option value="provisional_invoice">Provisional Invoice (Outbound)</option>
                </select>
              </div>
              {form.docType === 'purchase_invoice' && (
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', borderTop: '1px solid var(--border2)', paddingTop: 12 }}>
                  <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>ITC Type</span>
                  <select name="itcEligibility" value={form.itcEligibility} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }}>
                    <option value="inputs">Inputs (Goods/Stock)</option>
                    <option value="capital_goods">Capital Goods</option>
                    <option value="input_services">Input Services</option>
                    <option value="ineligible">Ineligible / Blocked Credit</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Party & Header Details</div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>Party Name</span>
                <input name="supplier" value={form.supplier} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }} required />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>Document No</span>
                <input name="invoiceNo" value={form.invoiceNo} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>Date</span>
                <input name="date" type="date" value={form.date} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }} />
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <span style={{ color: "var(--ink3)", fontSize: 12, width: 90, flexShrink: 0 }}>GSTIN</span>
                <input name="gst" value={form.gst} onChange={handleChange} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "var(--ink)", background: "#fff", outline: 'none' }} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Line Items</span>
              <button type="button" onClick={addItem} style={{ background: 'var(--green)', color: '#fff', border: 'none', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>+ Add Item</button>
            </div>
            <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {form.items.map((item, i) => (
                <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: '#f9fafb', padding: 8, borderRadius: 6, border: '1px solid #f3f4f6' }}>
                  <input 
                    placeholder="Description" 
                    value={item.name} 
                    onChange={e => handleItemChange(i, 'name', e.target.value)} 
                    style={{ flex: 2, border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", fontSize: 12, background: "#fff", minWidth: 0 }}
                  />
                  <input 
                    type="number" 
                    placeholder="Qty" 
                    value={item.qty} 
                    onChange={e => handleItemChange(i, 'qty', Number(e.target.value))} 
                    style={{ width: 60, border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", fontSize: 12, background: "#fff", textAlign: 'center' }}
                  />
                  <input 
                    type="number" 
                    placeholder="Price" 
                    value={item.unit} 
                    onChange={e => handleItemChange(i, 'unit', Number(e.target.value))} 
                    style={{ width: 80, border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px", fontSize: 12, background: "#fff" }}
                  />
                  <div style={{ width: 80, fontWeight: 600, fontSize: 12, color: 'var(--ink)', textAlign: 'right' }}>
                    ₹{((item.qty || 0) * (item.unit || 0)).toLocaleString()}
                  </div>
                  <button type="button" onClick={() => removeItem(i)} style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: 16, cursor: 'pointer', padding: '0 4px' }}>&times;</button>
                </div>
              ))}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', padding: 16, background: '#f9fafb', fontSize: 13, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--ink3)' }}>Subtotal:</span>
                <input type="number" name="subtotal" value={form.subtotal} onChange={handleChange} style={{ width: 100, border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", fontSize: 12, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--ink3)' }}>GST / Taxes:</span>
                <input type="number" name="gstAmt" value={form.gstAmt} onChange={handleChange} style={{ width: 100, border: "1px solid var(--border)", borderRadius: 4, padding: "4px 8px", fontSize: 12, textAlign: 'right' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border2)', paddingTop: 8, fontWeight: 700 }}>
                <span>Grand Total:</span>
                <span style={{ color: 'var(--green-m)' }}>₹{form.total.toLocaleString()}</span>
              </div>
            </div>
          </div>

          {error && <div className="alert alert-warn">{error}</div>}

          <button onClick={confirm} disabled={loading || saved} className="btn btn-primary" style={{ justifyContent: 'center', padding: '14px', width: '100%', fontSize: 14 }}>
            <CheckCircle size={16} /> {saved ? "Saved! Opening Invoice Hub..." : loading ? "Saving..." : "Confirm & Save Document"}
          </button>
        </div>

        <div className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'var(--cream)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontSize: 11, fontWeight: 600, color: 'var(--ink3)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Uploaded Document View</div>
          <div style={{ padding: 12, flex: 1, background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 500, overflowY: 'auto' }}>
            {extractedImage ? (
              <img src={extractedImage} alt="Uploaded receipt preview" style={{ maxWidth: '100%', maxHeight: '75vh', objectFit: 'contain', borderRadius: 6, boxShadow: '0 4px 8px rgba(0,0,0,0.15)' }} />
            ) : (
              <div style={{ color: 'var(--ink3)', textAlign: 'center' }}>
                <FileText size={48} style={{ margin: '0 auto 12px', opacity: 0.5 }} />
                <p>No document preview available.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Analytics({ products, invoices, purchases, handleExportCSV }) {
  const [timeRange, setTimeRange] = useState('YTD'); // 'YTD', '3_months', '1_month'

  const filteredData = useMemo(() => {
    const now = new Date();
    let cutoff = null;
    if (timeRange === '3_months') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
    } else if (timeRange === '1_month') {
      cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 30);
    } else {
      // YTD: From January 1st of current year (2026)
      cutoff = new Date(now.getFullYear(), 0, 1);
    }

    const filteredInvs = invoices.filter(inv => {
      const dateVal = inv.date || inv.createdAt;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) && d >= cutoff;
    });

    const filteredPurchases = purchases.filter(p => {
      const dateVal = p.invoiceDate || p.createdAt;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) && d >= cutoff;
    });

    const revenue = filteredInvs.reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0);
    const cost = filteredPurchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const grossProfit = revenue - cost;

    return { revenue, purchases: cost, grossProfit };
  }, [invoices, purchases, timeRange]);

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
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <button className="btn btn-ghost" onClick={() => handleExportCSV('stocks')} style={{ gap: 6, display: 'flex', alignItems: 'center', background: 'var(--border2)', color: 'var(--ink2)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
            <Download size={14} /> Export Stocks (Excel)
          </button>
          <div className="pill-tabs">
            <button 
              className={`pill-tab ${timeRange === 'YTD' ? 'active' : ''}`}
              onClick={() => setTimeRange('YTD')}
            >
              YTD
            </button>
            <button 
              className={`pill-tab ${timeRange === '3_months' ? 'active' : ''}`}
              onClick={() => setTimeRange('3_months')}
            >
              Last 3 months
            </button>
            <button 
              className={`pill-tab ${timeRange === '1_month' ? 'active' : ''}`}
              onClick={() => setTimeRange('1_month')}
            >
              1 month
            </button>
          </div>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card accent">
          <div className="stat-label">Gross Profit</div>
          <div className="stat-value">₹{filteredData.grossProfit.toLocaleString()}</div>
          <div className="stat-delta">
            <span style={{ background: 'rgba(255,255,255,.2)', color: '#fff', padding: '2px 7px', borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
              {timeRange === 'YTD' ? 'YTD Derived' : timeRange === '3_months' ? '90 Days Derived' : '30 Days Derived'}
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
          <div className="card-title">GST summary <span>{timeRange === 'YTD' ? 'YTD' : timeRange === '3_months' ? 'Last 3 Months' : 'Last 1 Month'}</span></div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Estimated Revenue</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₹{filteredData.revenue.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border2)' }}>
              <span style={{ fontSize: 13, color: 'var(--ink2)' }}>Estimated Purchases</span>
              <span style={{ fontSize: 13, fontWeight: 600 }}>₹{filteredData.purchases.toLocaleString()}</span>
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

function ProductsStockManager({ products, authFetch, fetchProducts, handleExportCSV }) {
  const [search, setSearch] = useState('');
  const [showLowStockOnly, setShowLowStockOnly] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalForm, setModalForm] = useState({
    name: '',
    sku: '',
    stockQty: 0,
    avgCost: 0,
    sellingPrice: 0,
    hsnCode: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = 
        String(p.name || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.sku || '').toLowerCase().includes(search.toLowerCase()) ||
        String(p.hsnCode || '').toLowerCase().includes(search.toLowerCase());
      
      const matchesLowStock = !showLowStockOnly || (Number(p.stockQty) <= 6);
      return matchesSearch && matchesLowStock;
    });
  }, [products, search, showLowStockOnly]);

  const stats = useMemo(() => {
    let totalValue = 0;
    let lowStockCount = 0;
    let totalProfitPotential = 0;

    products.forEach(p => {
      const qty = Number(p.stockQty) || 0;
      const cost = Number(p.avgCost) || 0;
      const sell = Number(p.sellingPrice) || 0;

      totalValue += qty * cost;
      if (qty <= 6) lowStockCount++;
      totalProfitPotential += qty * Math.max(0, sell - cost);
    });

    return {
      totalValue,
      lowStockCount,
      totalProfitPotential,
      totalSKUs: products.length
    };
  }, [products]);

  const openAddModal = () => {
    setEditingProduct(null);
    setModalForm({
      name: '',
      sku: '',
      stockQty: 0,
      avgCost: 0,
      sellingPrice: 0,
      hsnCode: ''
    });
    setError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setModalForm({
      name: product.name || '',
      sku: product.sku || '',
      stockQty: product.stockQty || 0,
      avgCost: product.avgCost || 0,
      sellingPrice: product.sellingPrice || 0,
      hsnCode: product.hsnCode || ''
    });
    setError(null);
    setIsModalOpen(true);
  };

  const handleModalSubmit = async (e) => {
    e.preventDefault();
    if (!modalForm.name.trim()) {
      setError("Product Name is required");
      return;
    }
    setLoading(true);
    setError(null);

    const isEdit = !!editingProduct;
    const url = isEdit ? `/api/products/${editingProduct.id}` : `/api/products`;
    const method = isEdit ? 'PUT' : 'POST';

    try {
      const res = await authFetch(url, {
        method,
        body: JSON.stringify({
          name: modalForm.name.trim(),
          sku: modalForm.sku.trim(),
          stockQty: Number(modalForm.stockQty) || 0,
          avgCost: Number(modalForm.avgCost) || 0,
          sellingPrice: Number(modalForm.sellingPrice) || 0,
          hsnCode: modalForm.hsnCode.trim() || null
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchProducts();
      } else {
        const errData = await res.json();
        setError(errData.error || 'Failed to save product');
      }
    } catch (err) {
      setError(err.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (productId) => {
    if (!window.confirm("Are you sure you want to delete this product from stock?")) return;
    try {
      const res = await authFetch(`/api/products/${productId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchProducts();
      } else {
        const errData = await res.json();
        alert(errData.error || 'Failed to delete product');
      }
    } catch (err) {
      console.error(err);
      alert('Network error');
    }
  };

  return (
    <div className="screen active" id="screen-products-stock">
      <div className="section-header">
        <div>
          <div className="section-title">Products & Stock Manager</div>
          <div className="section-sub">Manage inventory item profiles, HSN codes, cost valuation, and prices</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-ghost" onClick={() => handleExportCSV('stocks')} style={{ gap: 6, display: 'flex', alignItems: 'center', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', padding: '8px 12px', fontSize: 13, borderRadius: 8, fontWeight: 600 }}>
            <Download size={14} /> Export Stocks
          </button>
          <button className="btn btn-primary" onClick={openAddModal}>
            <Plus size={14} /> Add Product
          </button>
        </div>
      </div>

      <div className="stats-grid" style={{ marginBottom: 20 }}>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--green)' }}>
          <div className="stat-label">Stock Valuation</div>
          <div className="stat-value">₹{stats.totalValue.toLocaleString()}</div>
          <div className="stat-delta">Asset value at cost price</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #3b82f6' }}>
          <div className="stat-label">Active SKUs</div>
          <div className="stat-value">{stats.totalSKUs}</div>
          <div className="stat-delta">Total catalog items</div>
        </div>
        <div className="stat-card" style={{ borderLeft: stats.lowStockCount > 0 ? '4px solid #ef4444' : '4px solid var(--green)' }}>
          <div className="stat-label">Low / Out of Stock</div>
          <div className="stat-value" style={{ color: stats.lowStockCount > 0 ? '#ef4444' : 'inherit' }}>{stats.lowStockCount}</div>
          <div className="stat-delta">Items with &le; 6 units left</div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid #eab308' }}>
          <div className="stat-label">Margin Profit Potential</div>
          <div className="stat-value">₹{stats.totalProfitPotential.toLocaleString()}</div>
          <div className="stat-delta">Expected profit on sell-out</div>
        </div>
      </div>

      <div className="card" style={{ padding: 16, marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 260 }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input 
                placeholder="Search by product name, SKU, or HSN Code..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', paddingLeft: 34, borderRadius: 8, fontSize: 13, outline: 'none' }}
              />
              <Search size={14} color="#9ca3af" style={{ position: 'absolute', left: 12, top: 12 }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--ink2)' }}>
              <input 
                type="checkbox" 
                checked={showLowStockOnly}
                onChange={e => setShowLowStockOnly(e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }}
              />
              Show Low Stock Only (&le; 6)
            </label>
          </div>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <table className="inv-table">
          <thead>
            <tr>
              <th>Product Name</th>
              <th>SKU</th>
              <th>HSN Code</th>
              <th>Stock Status</th>
              <th style={{ textAlign: 'right' }}>Stock Qty</th>
              <th style={{ textAlign: 'right' }}>Avg Cost</th>
              <th style={{ textAlign: 'right' }}>Selling Price</th>
              <th style={{ textAlign: 'right' }}>Margin %</th>
              <th style={{ textAlign: 'center', width: 100 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p) => {
              const qty = Number(p.stockQty) || 0;
              const cost = Number(p.avgCost) || 0;
              const sell = Number(p.sellingPrice) || 0;
              const margin = sell > 0 ? Math.round(((sell - cost) / sell) * 100) : 0;

              let statusBadge = { bg: '#d1fae5', color: '#065f46', label: 'In Stock' };
              if (qty === 0) {
                statusBadge = { bg: '#fee2e2', color: '#991b1b', label: 'Out of Stock' };
              } else if (qty <= 6) {
                statusBadge = { bg: '#fef3c7', color: '#d97706', label: 'Low Stock' };
              }

              return (
                <tr key={p.id}>
                  <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{p.name}</td>
                  <td><code style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{p.sku || '—'}</code></td>
                  <td>{p.hsnCode || '—'}</td>
                  <td>
                    <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 4, fontWeight: 600, background: statusBadge.bg, color: statusBadge.color }}>
                      {statusBadge.label}
                    </span>
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: qty <= 6 ? 700 : 'normal', color: qty <= 6 ? '#b91c1c' : 'inherit' }}>
                    {qty.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>₹{cost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>₹{sell.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                  <td style={{ textAlign: 'right' }}>
                    <span style={{ fontWeight: 600, color: margin >= 20 ? 'var(--green)' : margin > 0 ? 'var(--ink)' : '#ef4444' }}>
                      {margin}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                      <button 
                        onClick={() => openEditModal(p)} 
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: 'var(--green-m)', fontSize: 12, fontWeight: 600 }}
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(p.id)} 
                        style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#ef4444', fontSize: 12, fontWeight: 600 }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredProducts.length === 0 && (
              <tr>
                <td colSpan="9" style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink3)' }}>
                  No stock items match search filters. Click "Add Product" to register new inventory stock.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000, padding: 16 }}>
          <div className="card" style={{ maxWidth: 460, width: '100%', padding: 24, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16 }}>
              {editingProduct ? 'Edit Product Stock' : 'Add New Product Stock'}
            </h3>
            
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fee2e2', color: '#991b1b', padding: '10px 12px', borderRadius: 6, fontSize: 12, marginBottom: 16 }}>
                {error}
              </div>
            )}

            <form onSubmit={handleModalSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>Product Name *</label>
                <input 
                  type="text" 
                  value={modalForm.name} 
                  onChange={e => setModalForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Acme Widgets A"
                  style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>SKU / Part Number</label>
                  <input 
                    type="text" 
                    value={modalForm.sku} 
                    onChange={e => setModalForm(prev => ({ ...prev, sku: e.target.value }))}
                    placeholder="e.g. ACM-WID-A"
                    style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>HSN Code</label>
                  <input 
                    type="text" 
                    value={modalForm.hsnCode} 
                    onChange={e => setModalForm(prev => ({ ...prev, hsnCode: e.target.value }))}
                    placeholder="e.g. 8471"
                    style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>Stock Qty</label>
                  <input 
                    type="number" 
                    value={modalForm.stockQty} 
                    onChange={e => setModalForm(prev => ({ ...prev, stockQty: Number(e.target.value) }))}
                    style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                    min="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>Avg Cost (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={modalForm.avgCost} 
                    onChange={e => setModalForm(prev => ({ ...prev, avgCost: Number(e.target.value) }))}
                    style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                    min="0"
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--ink2)', marginBottom: 4 }}>Sell Price (₹)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    value={modalForm.sellingPrice} 
                    onChange={e => setModalForm(prev => ({ ...prev, sellingPrice: Number(e.target.value) }))}
                    style={{ width: '100%', border: '1px solid var(--border)', padding: '8px 12px', borderRadius: 6, fontSize: 13 }}
                    min="0"
                  />
                </div>
              </div>

              {modalForm.sellingPrice > 0 && (
                <div style={{ background: '#f9fafb', padding: 8, borderRadius: 6, fontSize: 12, color: 'var(--ink2)', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Calculated Margin:</span>
                  <strong style={{ color: modalForm.sellingPrice >= modalForm.avgCost ? 'var(--green)' : '#ef4444' }}>
                    {Math.round(((modalForm.sellingPrice - modalForm.avgCost) / modalForm.sellingPrice) * 100)}%
                  </strong>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-ghost"
                  style={{ border: '1px solid var(--border)', padding: '8px 16px' }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  style={{ padding: '8px 16px' }}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LedgerDashboard() {
  const { user, logout, authFetch, setUser } = useAuth();
  const [screen, setScreen] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [viewingDoc, setViewingDoc] = useState(null);

  const [invoices, setInvoices] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [extractedData, setExtractedData] = useState(null);
  const [extractedImage, setExtractedImage] = useState(null);

  const handleSendBulkReminders = async () => {
    if (!window.confirm('Send payment reminders to all overdue clients?')) return;
    setSendingBulk(true);
    try {
      const res = await authFetch('/api/invoices/reminders/bulk', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        alert('Bulk payment reminders sent successfully!');
      } else {
        alert('Failed to send bulk reminders: ' + (data.error || 'Unknown error'));
      }
    } catch (err) {
      console.error(err);
      alert('Error sending bulk reminders');
    } finally {
      setSendingBulk(false);
    }
  };

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
    if (!window.confirm('Delete this document?')) return;
    const isPurchase = purchases.some(p => p.id === id);
    const url = isPurchase ? `/api/purchases/${id}` : `/api/invoices/${id}`;
    try {
      const res = await authFetch(url, { method: 'DELETE' });
      if (res.ok) {
        if (isPurchase) {
          setPurchases(prev => prev.filter(p => p.id !== id));
        } else {
          setInvoices(prev => prev.filter(inv => inv.id !== id));
        }
        fetchProducts();
      }
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

  const handleExportCSV = (type) => {
    let headers = [];
    let rows = [];
    
    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      str = str.replace(/"/g, '""');
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str}"`;
      }
      return str;
    };

    if (type === 'sales') {
      headers = ["Invoice Number", "Document Type", "Client Name", "Client GSTIN", "Date", "Subtotal", "GST Amount", "Total Amount", "Status"];
      rows = invoices.map(inv => [
        escapeCSV(inv.invoiceNumber),
        escapeCSV(inv.docType),
        escapeCSV(inv.clientName),
        escapeCSV(inv.clientGst),
        escapeCSV(inv.date),
        inv.amount || 0,
        inv.gstAmount || 0,
        inv.totalAmount || 0,
        escapeCSV(inv.status)
      ]);
    } else if (type === 'purchases') {
      headers = ["Invoice Number", "Supplier Name", "Supplier GSTIN", "Date", "Subtotal", "GST Amount", "Total Amount", "Status"];
      rows = purchases.map(pur => [
        escapeCSV(pur.invoiceNumber),
        escapeCSV(pur.supplierName),
        escapeCSV(pur.supplierGst),
        escapeCSV(pur.invoiceDate),
        pur.subtotal || 0,
        pur.gstAmount || 0,
        pur.total || 0,
        escapeCSV(pur.status)
      ]);
    } else if (type === 'stocks') {
      headers = ["Product Name", "SKU", "Stock Quantity", "Average Cost", "Selling Price", "Total Stock Value"];
      rows = products.map(prod => [
        escapeCSV(prod.name),
        escapeCSV(prod.sku),
        prod.stockQty || 0,
        prod.avgCost || 0,
        prod.sellingPrice || 0,
        (prod.stockQty || 0) * (prod.avgCost || 0)
      ]);
    }

    const csvRows = [headers, ...rows];
    const csvContent = "\uFEFF" + csvRows.map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${type}_report_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const stats = useMemo(() => {
    const revenue = invoices
      .filter(inv => inv.docType === 'sales_invoice')
      .reduce((sum, inv) => sum + Number(inv.totalAmount || inv.amount || 0), 0);
    const cost = purchases.reduce((sum, p) => sum + Number(p.total || 0), 0);
    const stockValue = products.reduce((sum, p) => sum + (Number(p.stockQty || 0) * Number(p.avgCost || 0)), 0);
    return { revenue, purchases: cost, stockValue };
  }, [invoices, purchases, products]);

  const recentInvoices = useMemo(() => {
    const all = [
      ...invoices.map(i => ({ type: 'SALE', party: i.clientName, amount: i.totalAmount || i.amount, date: i.date || i.createdAt, status: i.status === 'paid' ? 'Paid' : 'Pending', ts: safeGetTime(i.createdAt || i.date) })),
      ...purchases.map(p => ({ type: 'BUY', party: p.supplierName, amount: p.total, date: p.invoiceDate || p.createdAt, status: p.status, ts: safeGetTime(p.createdAt || p.invoiceDate) }))
    ];
    return all.sort((a, b) => b.ts - a.ts).slice(0, 5).map(x => ({
      ...x,
      date: safeFormatDate(x.date)
    }));
  }, [invoices, purchases]);

  const monthData = useMemo(() => {
    const dataByMonth = {};
    const process = (arr, key, isSales) => {
      arr.forEach(item => {
        if (isSales && item.docType !== 'sales_invoice') return;
        const d = new Date(item.date || item.invoiceDate || item.createdAt);
        let m = 'Unknown';
        if (!isNaN(d.getTime())) {
          m = d.toLocaleString('en-IN', { month: 'short' });
        }
        if (!dataByMonth[m]) dataByMonth[m] = { m, rev: 0, cost: 0 };
        dataByMonth[m][key] += Number(item.totalAmount || item.amount || item.total || 0);
      });
    };
    process(invoices, 'rev', true);
    process(purchases, 'cost', false);
    if (dataByMonth['Unknown'] && dataByMonth['Unknown'].rev === 0 && dataByMonth['Unknown'].cost === 0) {
      delete dataByMonth['Unknown'];
    }
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
    5: "Settings",
    6: "Products & Stock"
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
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginLeft: 'auto' }}>
              <button className="btn btn-terra" id="btn-create-mobile" onClick={() => setShowCreate(true)}>
                <Plus size={13} /> Create Invoice
              </button>
              <button onClick={() => setScreen(5)} className="btn btn-ghost" style={{ padding: '8px', border: 'none', background: 'var(--border2)' }} title="Account Settings">
                <Settings size={18} />
              </button>
            </div>
          </div>

          <div className="content">
            {screen === 0 && (
              <Dashboard 
                setScreen={setScreen} 
                user={user} 
                stats={stats} 
                monthData={monthData} 
                recentInvoices={recentInvoices} 
                invoices={invoices}
                handleSendBulkReminders={handleSendBulkReminders}
                sendingBulk={sendingBulk}
              />
            )}
            {screen === 1 && (
              <InvoiceHub 
                setScreen={setScreen} 
                invoices={invoices} 
                purchases={purchases} 
                setShowCreate={setShowCreate} 
                updateInvoiceStatus={updateInvoiceStatus} 
                statusUpdating={statusUpdating} 
                deleteInvoice={deleteInvoice} 
                handleExportCSV={handleExportCSV} 
                handleViewDocDetails={setViewingDoc}
              />
            )}
            {screen === 2 && <UploadInvoice setScreen={setScreen} authFetch={authFetch} setExtractedData={setExtractedData} setExtractedImage={setExtractedImage} />}
            {screen === 3 && <ReviewExtraction setScreen={setScreen} extractedData={extractedData} extractedImage={extractedImage} authFetch={authFetch} fetchInvoices={fetchInvoices} fetchPurchases={fetchPurchases} fetchProducts={fetchProducts} />}
            {screen === 4 && <Analytics products={products} invoices={invoices} purchases={purchases} handleExportCSV={handleExportCSV} />}
            {screen === 5 && <SettingsScreen user={user} setUser={setUser} authFetch={authFetch} />}
            {screen === 6 && <ProductsStockManager products={products} authFetch={authFetch} fetchProducts={fetchProducts} handleExportCSV={handleExportCSV} />}
            {screen === 7 && (
              <GstFilingAssistant 
                invoices={invoices} 
                purchases={purchases} 
                authFetch={authFetch} 
                user={user} 
                fetchPurchases={fetchPurchases} 
                fetchInvoices={fetchInvoices} 
              />
            )}
          </div>
        </main>
        
        <BottomNav screen={screen} setScreen={setScreen} setShowCreate={setShowCreate} />
        {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSuccess={() => { fetchInvoices(); fetchProducts(); }} user={user} />}
        {viewingDoc && (
          <DocumentDetailModal 
            onClose={() => setViewingDoc(null)} 
            doc={viewingDoc} 
            user={user} 
            authFetch={authFetch} 
            refreshInvoices={fetchInvoices} 
            refreshPurchases={fetchPurchases}
            invoices={invoices}
          />
        )}
      </div>
    </div>
  );
}

function DocumentDetailModal({ onClose, doc, user, authFetch, refreshInvoices, refreshPurchases, invoices }) {
  const isQuoteOrProforma = ['quotation', 'proforma'].includes(doc.type);
  const isSaleInvoice = doc.sysType === 'sale' && !isQuoteOrProforma;

  const [activeTab, setActiveTab] = useState('details'); // 'details' or 'reminders'
  const [loading, setLoading] = useState(false);
  const [reminderConfig, setReminderConfig] = useState(null);
  const [reminderLogs, setReminderLogs] = useState([]);
  
  // Local state for reminder settings
  const [remindersEnabled, setRemindersEnabled] = useState(true);
  const [channels, setChannels] = useState(['email']);
  const [remindDaysStr, setRemindDaysStr] = useState('1,3,7,14');
  const [dueDate, setDueDate] = useState('');
  const [savingReminder, setSavingReminder] = useState(false);
  
  // Quotation status/sending state
  const [quoteStatus, setQuoteStatus] = useState(doc.status || 'draft');
  const [clientEmail, setClientEmail] = useState(doc.clientEmail || '');
  const [clientMobile, setClientMobile] = useState(doc.clientMobile || '');
  const [sendingQuote, setSendingQuote] = useState(false);
  const [convertingQuote, setConvertingQuote] = useState(false);
  const [itcEligibilityVal, setItcEligibilityVal] = useState(doc.itcEligibility || 'inputs');
  const [updatingItc, setUpdatingItc] = useState(false);

  useEffect(() => {
    if (isSaleInvoice) {
      // Fetch reminder configuration
      const fetchReminder = async () => {
        setLoading(true);
        try {
          const res = await authFetch(`/api/invoices/${doc.id}/reminder`);
          if (res.ok) {
            const data = await res.json();
            setReminderConfig(data.config);
            setReminderLogs(data.logs || []);
            
            // Sync local state
            setChannels(data.config?.channels || []);
            setRemindersEnabled((data.config?.channels || []).length > 0);
            setRemindDaysStr((data.config?.remindOnDays || []).join(','));
          }
        } catch (err) {
          console.error(err);
        } finally {
          setLoading(false);
        }
      };
      fetchReminder();
    }
    
    // Set default fields from doc details
    if (doc.dueDate) {
      setDueDate(standardizeDateForInput(doc.dueDate));
    } else {
      setDueDate('');
    }
    setQuoteStatus(doc.status || 'draft');
    setClientEmail(doc.clientEmail || '');
    setClientMobile(doc.clientMobile || '');
    setItcEligibilityVal(doc.itcEligibility || 'inputs');
  }, [doc, isSaleInvoice, authFetch]);

  // Handle due date update
  const handleSaveDueDate = async () => {
    try {
      const res = await authFetch(`/api/invoices/${doc.id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ dueDate })
      });
      if (res.ok) {
        alert('Due date updated successfully!');
        refreshInvoices();
      } else {
        const data = await res.json();
        alert('Failed to update due date: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating due date');
    }
  };

  // Handle reminder config save
  const handleSaveReminders = async (e) => {
    e.preventDefault();
    setSavingReminder(true);
    const parsedDays = remindDaysStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    const activeChannels = remindersEnabled ? channels : [];
    
    try {
      const res = await authFetch(`/api/invoices/${doc.id}/reminder`, {
        method: 'POST',
        body: JSON.stringify({
          remindOnDays: parsedDays,
          channels: activeChannels
        })
      });
      if (res.ok) {
        alert('Reminder settings saved successfully!');
        refreshInvoices();
      } else {
        const data = await res.json();
        alert('Failed to save reminder settings: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error saving reminder settings');
    } finally {
      setSavingReminder(false);
    }
  };

  // Handle quotation status change
  const handleUpdateQuoteStatus = async (newStatus) => {
    try {
      const res = await authFetch(`/api/quotations/${doc.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ quoteStatus: newStatus })
      });
      if (res.ok) {
        setQuoteStatus(newStatus);
        alert(`Status updated to ${newStatus}`);
        refreshInvoices();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Handle quotation sending
  const handleSendQuote = async () => {
    setSendingQuote(true);
    try {
      const res = await authFetch(`/api/quotations/${doc.id}/send`, {
        method: 'POST',
        body: JSON.stringify({ email: clientEmail, whatsapp: clientMobile })
      });
      const data = await res.json();
      if (res.ok) {
        alert('Quotation dispatched successfully!');
        setQuoteStatus('sent');
        refreshInvoices();
      } else {
        alert('Failed to send quotation: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error sending quotation');
    } finally {
      setSendingQuote(false);
    }
  };

  // Handle convert quotation to invoice
  const handleConvertQuote = async () => {
    if (!window.confirm('Are you sure you want to convert this quotation into a Sales Invoice? This will generate a new invoice number sequence and copy all items.')) return;
    setConvertingQuote(true);
    try {
      const res = await authFetch(`/api/quotations/${doc.id}/convert`, {
        method: 'POST'
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Quotation successfully converted to Invoice #${data.invoiceNumber}!`);
        refreshInvoices();
        onClose();
      } else {
        alert('Conversion failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error converting quotation');
    } finally {
      setConvertingQuote(false);
    }
  };

  // Save purchase ITC eligibility
  const saveItcEligibility = async () => {
    setUpdatingItc(true);
    try {
      const res = await authFetch(`/api/purchases/${doc.id}/itc`, {
        method: 'PATCH',
        body: JSON.stringify({ itcEligibility: itcEligibilityVal })
      });
      if (res.ok) {
        alert('ITC eligibility updated successfully!');
        if (typeof refreshPurchases === 'function') refreshPurchases();
        doc.itcEligibility = itcEligibilityVal;
      } else {
        const data = await res.json();
        alert('Failed to update ITC: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Error updating ITC eligibility');
    } finally {
      setUpdatingItc(false);
    }
  };

  // Render scheduled reminders timeline
  const renderFutureReminders = () => {
    if (!dueDate || !remindDaysStr) return null;
    const parsedDays = remindDaysStr.split(',').map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    const invDueDate = new Date(dueDate);
    
    return parsedDays.map(days => {
      const remindDate = new Date(invDueDate);
      remindDate.setDate(remindDate.getDate() + days);
      const isPast = remindDate < new Date();
      return {
        days,
        date: remindDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        isPast
      };
    }).sort((a,b) => a.days - b.days);
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 750, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, color: '#111827', display: 'flex', alignItems: 'center', gap: 10 }}>
              <span>{isQuoteOrProforma ? (doc.type === 'quotation' ? 'Quotation' : 'Proforma Invoice') : (doc.sysType === 'purchase' ? 'Purchase Invoice' : 'Sales Invoice')} Details</span>
              <span style={{ fontSize: 12, padding: '2px 8px', borderRadius: 10, background: '#f3f4f6', color: '#4b5563' }}>#{doc.no}</span>
            </h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap' }}>
          {/* Left panel: Info */}
          <div style={{ flex: '1 1 320px', padding: 24, borderRight: '1px solid #e5e7eb' }}>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>{doc.sysType === 'purchase' ? 'Supplier Details' : 'Client Details'}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#111827' }}>{doc.party}</div>
              <div style={{ fontSize: 13, color: '#4b5563', marginTop: 4 }}>Date: {doc.date}</div>
              {doc.dueDate && <div style={{ fontSize: 13, color: '#4b5563', marginTop: 2 }}>Due Date: {safeFormatDate(doc.dueDate)}</div>}
            </div>

            <div style={{ marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase' }}>Amount</span>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#0F6E56', marginTop: 4 }}>{doc.amount}</div>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
              {doc.url ? (
                <a href={doc.url} target="_blank" rel="noreferrer" className="btn btn-ghost" style={{ flex: 1, justifyContent: 'center', textDecoration: 'none', gap: 6, fontSize: 13, display: 'inline-flex', alignItems: 'center' }}>
                  <Eye size={14} /> View PDF
                </a>
              ) : (
                <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>PDF not generated</span>
              )}
            </div>

            {/* Purchase ITC eligibility selector */}
            {doc.sysType === 'purchase' && (
              <div style={{ marginBottom: 20, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8 }}>ITC Eligibility</div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <select 
                    value={itcEligibilityVal} 
                    onChange={(e) => setItcEligibilityVal(e.target.value)} 
                    disabled={updatingItc}
                    style={{ flex: 1, border: "1px solid #d1d5db", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#111827", background: "#fff", outline: 'none' }}
                  >
                    <option value="inputs">Inputs (Goods/Stock)</option>
                    <option value="capital_goods">Capital Goods</option>
                    <option value="input_services">Input Services</option>
                    <option value="ineligible">Ineligible (Section 17(5))</option>
                  </select>
                  {itcEligibilityVal !== (doc.itcEligibility || 'inputs') && (
                    <button 
                      onClick={saveItcEligibility} 
                      disabled={updatingItc}
                      className="btn btn-primary"
                      style={{ fontSize: 12, padding: '8px 12px', minWidth: 60, justifyContent: 'center' }}
                    >
                      {updatingItc ? '...' : 'Save'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Quotation Convert CTA */}
            {isQuoteOrProforma && quoteStatus.toLowerCase() === 'accepted' && (
              <div style={{ marginTop: 20 }}>
                <button 
                  onClick={handleConvertQuote}
                  disabled={convertingQuote}
                  className="btn"
                  style={{ background: '#7c3aed', color: '#fff', width: '100%', justifyContent: 'center', fontWeight: 600, padding: '12px 20px', border: 'none', borderRadius: 8, cursor: 'pointer', boxShadow: '0 4px 12px rgba(124,58,237,0.25)' }}
                >
                  {convertingQuote ? 'Converting...' : '⚡ Convert to Sales Invoice'}
                </button>
              </div>
            )}
          </div>

          {/* Right panel: Controls */}
          <div style={{ flex: '1 1 350px', padding: 24 }}>
            {isSaleInvoice ? (
              // INVOICE REMINDERS AND DUE DATE TAB
              <div>
                <div className="pill-tabs" style={{ marginBottom: 20 }}>
                  <button className={`pill-tab ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>Due Date</button>
                  <button className={`pill-tab ${activeTab === 'reminders' ? 'active' : ''}`} onClick={() => setActiveTab('reminders')}>Payment Reminders</button>
                </div>

                {activeTab === 'details' && (
                  <div>
                    <div style={{ marginBottom: 20 }}>
                      <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Due Date</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <input 
                          type="date" 
                          value={dueDate} 
                          onChange={(e) => setDueDate(e.target.value)} 
                          style={{ flex: 1, padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, outline: 'none' }}
                        />
                        <button onClick={handleSaveDueDate} className="btn btn-primary" style={{ padding: '8px 14px' }}>Save</button>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'reminders' && (
                  <div>
                    {loading ? (
                      <div style={{ color: 'var(--ink3)', fontSize: 13 }}>Loading reminder config...</div>
                    ) : (
                      <form onSubmit={handleSaveReminders}>
                        <div style={{ marginBottom: 16 }}>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151' }}>
                            <input 
                              type="checkbox" 
                              checked={remindersEnabled} 
                              onChange={(e) => setRemindersEnabled(e.target.checked)} 
                              style={{ marginRight: 8 }}
                            />
                            Enable Automatic Reminders
                          </label>
                        </div>

                        {remindersEnabled && (
                          <>
                            <div style={{ marginBottom: 16 }}>
                              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Channels</label>
                              <div style={{ display: 'flex', gap: 16 }}>
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={channels.includes('email')} 
                                    onChange={(e) => {
                                      if (e.target.checked) setChannels([...channels, 'email']);
                                      else setChannels(channels.filter(c => c !== 'email'));
                                    }}
                                    style={{ marginRight: 6 }}
                                  />
                                  Email
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#4b5563', cursor: 'pointer' }}>
                                  <input 
                                    type="checkbox" 
                                    checked={channels.includes('whatsapp')} 
                                    onChange={(e) => {
                                      if (e.target.checked) setChannels([...channels, 'whatsapp']);
                                      else setChannels(channels.filter(c => c !== 'whatsapp'));
                                    }}
                                    style={{ marginRight: 6 }}
                                  />
                                  WhatsApp
                                </label>
                              </div>
                            </div>

                            <div style={{ marginBottom: 16 }}>
                              <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Reminder Schedule (Days after due date)</label>
                              <input 
                                type="text" 
                                value={remindDaysStr} 
                                onChange={(e) => setRemindDaysStr(e.target.value)} 
                                placeholder="1,3,7,14" 
                                style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
                              />
                              <small style={{ color: '#6b7280', display: 'block', marginTop: 4 }}>Comma-separated numbers (e.g. 1,3,7 means remind 1, 3, and 7 days after due date)</small>
                            </div>
                          </>
                        )}

                        <button type="submit" disabled={savingReminder} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', marginBottom: 20 }}>
                          {savingReminder ? 'Saving...' : 'Save Reminder Settings'}
                        </button>

                        {/* Reminders Timeline */}
                        <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 16 }}>
                          <h4 style={{ margin: '0 0 10px 0', fontSize: 13, color: '#374151', fontWeight: 600 }}>Reminder Timeline</h4>
                          
                          {/* Future triggers */}
                          {remindersEnabled && renderFutureReminders() && (
                            <div style={{ marginBottom: 16 }}>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Scheduled triggers</div>
                              {renderFutureReminders().map((item, idx) => (
                                <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #f3f4f6', fontSize: 12, color: item.isPast ? '#9ca3af' : '#374151' }}>
                                  <span>remind on day {item.days}</span>
                                  <span>{item.date} {item.isPast && '(passed)'}</span>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Past Logs */}
                          {reminderLogs.length > 0 ? (
                            <div>
                              <div style={{ fontSize: 10, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', marginBottom: 6 }}>Sent logs</div>
                              {reminderLogs.map((log, idx) => (
                                <div key={idx} style={{ padding: '6px 0', fontSize: 12, borderBottom: '1px solid #f3f4f6' }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                                    <span style={{ color: log.status === 'success' ? '#059669' : '#dc2626', textTransform: 'capitalize' }}>
                                      ● {log.channel} {log.status}
                                    </span>
                                    <span style={{ color: '#6b7280' }}>{new Date(log.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</span>
                                  </div>
                                  <div style={{ color: '#6b7280', fontSize: 11, marginTop: 2 }}>Sent to: {log.sentTo}</div>
                                  {log.errorMessage && <div style={{ color: '#dc2626', fontSize: 11, marginTop: 2 }}>Error: {log.errorMessage}</div>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>No reminders sent yet.</div>
                          )}
                        </div>
                      </form>
                    )}
                  </div>
                )}
              </div>
            ) : isQuoteOrProforma ? (
              // QUOTATION/PROFORMA ACTIONS
              <div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 13, fontWeight: 600, color: '#374151' }}>Status</label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {['draft', 'sent', 'accepted', 'rejected'].map(st => {
                      const isActive = quoteStatus.toLowerCase() === st;
                      const activeStyles = {
                        draft: { bg: '#f3f4f6', color: '#374151', border: '1px solid #d1d5db' },
                        sent: { bg: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' },
                        accepted: { bg: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' },
                        rejected: { bg: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' },
                      }[st];
                      
                      return (
                        <button 
                          key={st}
                          type="button"
                          onClick={() => handleUpdateQuoteStatus(st)}
                          className="btn"
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            borderRadius: 16,
                            background: isActive ? activeStyles.bg : '#fff',
                            color: isActive ? activeStyles.color : '#4b5563',
                            border: isActive ? activeStyles.border : '1px solid #d1d5db',
                            fontWeight: 600,
                            cursor: 'pointer'
                          }}
                        >
                          {st.charAt(0).toUpperCase() + st.slice(1)}
                        </button>
                      );
                    })}
                    {quoteStatus.toLowerCase() === 'converted' && (
                      <span style={{ padding: '6px 12px', borderRadius: 16, background: '#f3e8ff', color: '#6b21a8', border: '1px solid #d8b4fe', fontWeight: 600, fontSize: 12 }}>Converted</span>
                    )}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
                  <h4 style={{ margin: '0 0 12px 0', fontSize: 13, color: '#374151', fontWeight: 600 }}>Send document to client</h4>
                  
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#4b5563' }}>Client Email</label>
                    <input 
                      type="email" 
                      value={clientEmail} 
                      onChange={(e) => setClientEmail(e.target.value)} 
                      placeholder="client@example.com" 
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: '#4b5563' }}>Client Mobile (WhatsApp)</label>
                    <input 
                      type="text" 
                      value={clientMobile} 
                      onChange={(e) => setClientMobile(e.target.value)} 
                      placeholder="9876543210" 
                      style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: 13, outline: 'none' }}
                    />
                  </div>

                  <button 
                    onClick={handleSendQuote} 
                    disabled={sendingQuote} 
                    className="btn btn-primary" 
                    style={{ width: '100%', justifyContent: 'center', padding: '10px 16px', display: 'flex', gap: 6, fontSize: 13 }}
                  >
                    <Send size={14} /> {sendingQuote ? 'Sending...' : 'Send Document'}
                  </button>
                </div>
              </div>
            ) : (
              // PURCHASE INVOICE DETAILS
              <div>
                <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>Buy-side documents do not support payment reminders.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
