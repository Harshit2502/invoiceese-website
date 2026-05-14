import React, { useState, useEffect, useMemo } from "react";
import CreateInvoiceModal from "../components/CreateInvoiceModal";
import SettingsScreen from "../components/SettingsScreen";
import { useAuth } from "../context/AuthContext";
import { Link } from "react-router-dom";
import {
  LayoutDashboard, FileText, Upload, Package, BarChart2,
  TrendingUp, TrendingDown, Plus, Eye, ChevronRight,
  ChevronLeft, CheckCircle, AlertCircle, Database, Settings, LogOut, Trash2
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from "recharts";

const T = "#0F6E56";
const TL = "#E1F5EE";

function Sidebar({ screen, setScreen, user, logout }) {
  const nav = [
    { icon: LayoutDashboard, label: "Dashboard", s: 0 },
    { icon: FileText, label: "Invoices", s: 1 },
    { icon: Upload, label: "Upload Invoice", s: 2 },
    { icon: Package, label: "Products", s: null },
    { icon: BarChart2, label: "Analytics", s: 4 },
  ];
  return (
    <div className="dashboard-sidebar">
      <div className="sidebar-header" style={{ padding: "20px 20px 16px", borderBottom: "1px solid #e5e7eb" }}>
        <div style={{ fontWeight: 700, fontSize: 18, color: T }}>InvoiceEase</div>
        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>Business Manager</div>
      </div>
      <div className="sidebar-nav" style={{ padding: "12px 0", flex: 1 }}>
        {nav.map(({ icon: Icon, label, s }) => (
          <button key={label} onClick={() => s !== null && setScreen(s)}
            className={`sidebar-btn ${screen === s ? 'active' : ''}`}
            style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 20px", background: screen === s ? TL : "transparent", color: screen === s ? T : "#6b7280", border: "none", cursor: s !== null ? "pointer" : "not-allowed", fontSize: 14, textAlign: "left", borderLeft: screen === s ? `4px solid ${T}` : "4px solid transparent", opacity: s === null ? 0.45 : 1 }}>
            <Icon size={16} />
            <span style={{ fontWeight: screen === s ? 600 : 400 }}>{label}</span>
          </button>
        ))}
      </div>
      <div className="sidebar-footer" style={{ padding: "16px 20px", borderTop: "1px solid #e5e7eb", display: "flex", flexDirection: "column", gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: "#374151", fontWeight: 600 }}>{user?.businessName || 'My Business'}</div>
          <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{user?.plan === 'free' ? 'Free Plan' : 'Pro Plan'} · {user?.gstNumber ? 'GST Registered' : 'Unregistered'}</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setScreen(5)} style={{ flex: 1, padding: "6px", fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", justifyContent: "center" }}><Settings size={14}/></button>
          <button onClick={logout} style={{ flex: 1, padding: "6px", fontSize: 12, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", cursor: "pointer", display: "flex", justifyContent: "center", color: "#dc2626" }}><LogOut size={14}/></button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ setScreen, user, stats, monthData, recentInvoices }) {
  return (
    <div className="dashboard-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 30 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Good morning, {user?.email?.split('@')[0] || 'User'}</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Business overview</div>
        </div>
        <button onClick={() => setScreen(2)} style={{ background: T, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
          <Plus size={14} /> Upload Invoice
        </button>
      </div>

      <div className="stats-grid">
        {[
          { label: "Revenue", value: `₹${stats.revenue.toLocaleString()}`, delta: "+8.6%", up: true },
          { label: "Purchases", value: `₹${stats.purchases.toLocaleString()}`, delta: "+6.5%", up: false },
          { label: "Net Profit", value: `₹${(stats.revenue - stats.purchases).toLocaleString()}`, delta: "+11.9%", up: true },
          { label: "Stock Value", value: `₹${stats.stockValue.toLocaleString()}`, delta: "-2.1%", up: false },
        ].map(k => (
          <div key={k.label} style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{k.value}</div>
            <div style={{ fontSize: 12, color: k.up ? "#059669" : "#ef4444", marginTop: 6, display: "flex", alignItems: "center", gap: 4 }}>
              {k.up ? <TrendingUp size={12} /> : <TrendingDown size={12} />} {k.delta} vs Last
            </div>
          </div>
        ))}
      </div>

      <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Revenue vs Purchases</div>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={monthData} barSize={16} barGap={4}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
            <XAxis dataKey="m" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} width={40} />
            <Tooltip formatter={v => `₹${v.toLocaleString()}`} />
            <Bar dataKey="rev" name="Revenue" fill={T} radius={[4, 4, 0, 0]} />
            <Bar dataKey="cost" name="Purchases" fill="#9FE1CB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Recent transactions</div>
      <div className="table-responsive">
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", fontSize: 13, minWidth: "600px" }}>
        {recentInvoices.map((r, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", padding: "12px 20px", borderTop: i > 0 ? "1px solid #f3f4f6" : "none", background: "#fff", gap: 16 }}>
            <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 4, flexShrink: 0, background: r.type === "SALE" ? "#dbeafe" : "#fef3c7", color: r.type === "SALE" ? "#1e40af" : "#78350f" }}>{r.type}</span>
            <span style={{ flex: 1, color: "#374151", fontWeight: 500 }}>{r.party}</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>₹{Number(r.amount).toLocaleString()}</span>
            <span style={{ color: "#9ca3af", width: 80, textAlign: "right" }}>{r.date}</span>
            <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 500, flexShrink: 0, background: r.status === "Paid" || r.status === "Verified" ? "#d1fae5" : r.status === "Reviewing" ? "#fef9c3" : "#fef2f2", color: r.status === "Paid" || r.status === "Verified" ? "#065f46" : r.status === "Reviewing" ? "#92400e" : "#b45309" }}>{r.status}</span>
          </div>
        ))}
        {recentInvoices.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No transactions yet. Upload a purchase invoice or create a sales invoice.</div>
        )}
        </div>
      </div>
    </div>
  );
}

function InvoiceHub({ setScreen, invoices, purchases, setShowCreate, updateInvoiceStatus, statusUpdating, deleteInvoice }) {
  const [tab, setTab] = useState("purchase");
  
  const salesRows = invoices.map(inv => ({
    id: inv.id,
    no: inv.invoiceNumber,
    party: inv.clientName,
    date: new Date(inv.date || inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    amount: `₹${Number(inv.totalAmount || inv.amount).toLocaleString()}`,
    status: inv.status === 'paid' ? 'Paid' : 'Pending',
    url: inv.pdfUrl
  }));

  const purchaseRows = purchases.map(inv => ({
    no: inv.invoiceNumber,
    party: inv.supplierName,
    date: new Date(inv.invoiceDate || inv.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
    amount: `₹${Number(inv.total).toLocaleString()}`,
    status: inv.status,
    url: inv.pdfUrl
  }));

  const rows = tab === "purchase" ? purchaseRows : salesRows;

  return (
    <div className="dashboard-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Invoice Hub</div>
        {tab === "purchase" && (
          <button onClick={() => setScreen(2)} style={{ background: T, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Upload size={14} /> Upload Purchase Invoice
          </button>
        )}
        {tab === "sale" && (
          <button onClick={() => setShowCreate(true)} style={{ background: T, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} /> Create Sales Invoice
          </button>
        )}
      </div>
      <div style={{ display: "flex", background: "#f3f4f6", borderRadius: 10, padding: 4, marginBottom: 20, width: "fit-content" }}>
        {["purchase", "sale"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? "#111827" : "#6b7280", fontSize: 13, fontWeight: tab === t ? 600 : 500, boxShadow: tab === t ? "0 1px 3px rgba(0,0,0,0.1)" : "none" }}>
            {t === "purchase" ? "Purchase Invoices" : "Sales Invoices"}
          </button>
        ))}
      </div>
      <div className="table-responsive">
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", fontSize: 13, minWidth: "800px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 100px 120px 100px 70px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "10px 20px", gap: 12, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
          <span>Invoice no</span><span>{tab === "purchase" ? "Supplier" : "Customer"}</span><span>Date</span><span>Amount</span><span>Status</span><span style={{ textAlign: 'right' }}>Actions</span>
        </div>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr 100px 120px 100px 70px", padding: "14px 20px", gap: 12, borderTop: i > 0 ? "1px solid #f3f4f6" : "none", background: "#fff", alignItems: "center" }}>
            <span style={{ color: T, fontWeight: 600 }}>{r.no}</span>
            <span style={{ color: "#374151" }}>{r.party}</span>
            <span style={{ color: "#9ca3af" }}>{r.date}</span>
            <span style={{ fontWeight: 600, color: "#111827" }}>{r.amount}</span>
            <span>
              {tab === "sale" ? (
                <button 
                  onClick={() => updateInvoiceStatus(r.id, r.status === 'Paid' ? 'pending' : 'paid')}
                  disabled={statusUpdating === r.id}
                  title="Click to toggle status"
                  style={{ border: "none", cursor: statusUpdating === r.id ? "wait" : "pointer", fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 500, background: r.status === "Paid" ? "#d1fae5" : "#fef2f2", color: r.status === "Paid" ? "#065f46" : "#b45309" }}
                >
                  {statusUpdating === r.id ? '...' : r.status}
                </button>
              ) : (
                <span style={{ fontSize: 11, padding: "3px 10px", borderRadius: 12, fontWeight: 500, background: r.status === "Verified" ? "#d1fae5" : r.status === "Reviewing" ? "#fef9c3" : "#fef2f2", color: r.status === "Verified" ? "#065f46" : r.status === "Reviewing" ? "#92400e" : "#b45309" }}>{r.status}</span>
              )}
            </span>
            <span style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              {r.url ? (
                <a href={r.url} target="_blank" rel="noreferrer" style={{ color: "#9ca3af" }} title="View PDF"><Eye size={16} /></a>
              ) : (
                <Eye size={16} style={{ color: "#e5e7eb" }} />
              )}
              {tab === "sale" && (
                <button onClick={() => deleteInvoice(r.id)} style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", padding: 0 }} title="Delete Invoice">
                  <Trash2 size={16} />
                </button>
              )}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>No invoices found in this category.</div>
        )}
        </div>
      </div>
      {tab === "purchase" && (
        <div style={{ marginTop: 20, padding: "12px 16px", background: TL, borderRadius: 10, fontSize: 13, color: "#065f46", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <span>Upload PDF or photo of any wholesaler invoice — AI will extract all line items automatically and update your stock levels.</span>
        </div>
      )}
    </div>
  );
}

function UploadInvoice({ setScreen, authFetch, setExtractedData }) {
  const [dragOver, setDragOver] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const simulateUpload = async () => {
    if (uploading) return;
    setUploading(true);
    setError(null);
    
    // Simulate UI progress
    let p = 0;
    const t = setInterval(() => {
      p += 15;
      setProgress(Math.min(p, 90));
    }, 200);

    try {
      const res = await authFetch('/api/purchases/extract', { method: 'POST', body: JSON.stringify({}) });
      clearInterval(t);
      if (res.ok) {
        const json = await res.json();
        setProgress(100);
        setExtractedData(json.data);
        setTimeout(() => setScreen(3), 400);
      } else {
        throw new Error('Extraction failed');
      }
    } catch (err) {
      clearInterval(t);
      setError(err.message);
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className="dashboard-main">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Upload Purchase Invoice</div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 30 }}>Our AI reads and extracts all details — works on PDFs, photos, even blurry WhatsApp images</div>

      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); simulateUpload(); }}
        onClick={simulateUpload}
        style={{ border: `2px dashed ${dragOver ? T : "#d1d5db"}`, borderRadius: 16, padding: "50px 30px", textAlign: "center", background: dragOver ? TL : "#fafafa", cursor: "pointer", transition: "all 0.2s", marginBottom: 24 }}>
        <div style={{ width: 56, height: 56, background: TL, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
          <Upload size={24} color={T} />
        </div>
        {!uploading ? (
          <>
            <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 8 }}>Drop invoice here or click to browse</div>
            <div style={{ fontSize: 13, color: "#9ca3af", marginBottom: 20 }}>PDF, JPG, PNG, HEIC supported — max 20MB</div>
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {["PDF", "JPG", "PNG", "HEIC"].map(f => <span key={f} style={{ background: "#f3f4f6", border: "1px solid #e5e7eb", padding: "4px 12px", borderRadius: 6, fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{f}</span>)}
            </div>
            {error && <div style={{ color: '#dc2626', marginTop: 16, fontSize: 13 }}>{error}</div>}
          </>
        ) : (
          <div style={{ maxWidth: 320, margin: "0 auto" }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: T, marginBottom: 12 }}>Scanning with AI...</div>
            <div style={{ background: "#e5e7eb", borderRadius: 6, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, background: T, height: "100%", borderRadius: 6, transition: "width 0.2s ease-out" }} />
            </div>
            <div style={{ fontSize: 12, color: "#6b7280", marginTop: 8 }}>
              {progress < 40 ? "Reading invoice layout..." : progress < 80 ? "Extracting line items..." : "Matching with your products..."}
            </div>
          </div>
        )}
      </div>

      <div style={{ textAlign: "center" }}>
        <span style={{ fontSize: 13, color: "#9ca3af" }}>or</span>
        <button style={{ marginLeft: 8, fontSize: 13, color: T, background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>enter details manually</button>
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
        setTimeout(() => setScreen(4), 1000);
      } else {
        const data = await res.json();
        throw new Error(data.error || 'Failed to save');
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (!extractedData) return <div style={{ padding: 30 }}>No data extracted. Please go back and upload an invoice.</div>;

  return (
    <div className="dashboard-main">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>Review Extracted Data</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Verify before saving — all fields are editable</div>
        </div>
        <div style={{ background: "#d1fae5", color: "#065f46", fontSize: 12, padding: "6px 12px", borderRadius: 8, fontWeight: 600 }}>96% confidence</div>
      </div>

      <div className="settings-grid">
        {/* Extracted fields */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: "#f9fafb", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Supplier Details</div>
            <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 12, fontSize: 13 }}>
              {[
                { label: "Supplier", val: extractedData.supplier },
                { label: "Invoice no", val: extractedData.invoiceNo },
                { label: "Date", val: extractedData.date },
                { label: "GST no", val: extractedData.gst },
              ].map(f => (
                <div key={f.label} style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <span style={{ color: "#6b7280", fontSize: 12, width: 80, flexShrink: 0 }}>{f.label}</span>
                  <input defaultValue={f.val} style={{ flex: 1, border: "1px solid #e5e7eb", borderRadius: 6, padding: "8px 12px", fontSize: 13, color: "#111827", background: "#fff", minWidth: 0 }} />
                </div>
              ))}
            </div>
          </div>

          <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden", fontSize: 13 }}>
            <div style={{ background: "#f9fafb", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Line Items</div>
            {extractedData.items.map((item, i) => (
              <div key={i} style={{ padding: "12px 16px", borderTop: i > 0 ? "1px solid #f3f4f6" : "none" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{item.name}</span>
                  <span style={{ background: item.conf > 0.95 ? "#d1fae5" : "#fef9c3", color: item.conf > 0.95 ? "#065f46" : "#92400e", padding: "2px 8px", borderRadius: 6, fontSize: 11 }}>{Math.round(item.conf * 100)}%</span>
                </div>
                <div style={{ display: "flex", gap: 16, color: "#6b7280", fontSize: 12 }}>
                  <span>Qty: <strong style={{ color: "#374151" }}>{item.qty}</strong></span>
                  <span>@ ₹<strong style={{ color: "#374151" }}>{item.unit.toLocaleString()}</strong></span>
                  <span>= <strong style={{ color: T }}>₹{item.total.toLocaleString()}</strong></span>
                </div>
              </div>
            ))}
            <div style={{ padding: "12px 16px", borderTop: "2px solid #e5e7eb", background: "#f9fafb", fontWeight: 700, fontSize: 14, display: "flex", justifyContent: "space-between" }}>
              <span>Total payable</span>
              <span style={{ color: T }}>₹{extractedData.total.toLocaleString()}</span>
            </div>
          </div>

          {error && <div style={{ color: '#dc2626', fontSize: 13 }}>{error}</div>}

          <button onClick={confirm} disabled={loading || saved} style={{ background: saved ? "#059669" : T, color: "#fff", border: "none", padding: "14px", borderRadius: 10, cursor: (loading || saved) ? "not-allowed" : "pointer", fontSize: 14, fontWeight: 600, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "background 0.3s", opacity: loading && !saved ? 0.7 : 1 }}>
            <CheckCircle size={16} /> {saved ? "Saved! Loading analytics..." : loading ? "Saving..." : "Confirm & Save Invoice"}
          </button>
        </div>

        {/* Invoice preview (mocked image placeholder) */}
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#f9fafb", padding: "10px 16px", borderBottom: "1px solid #e5e7eb", fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>Original PDF Preview</div>
          <div style={{ padding: 20, height: "100%", background: "#f3f4f6", display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ color: '#9ca3af', textAlign: 'center' }}>
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
    return { name: p.name, remaining: p.stockQty, margin, bought: p.stockQty, sold: 0 }; // bought/sold simplistic mock
  });

  return (
    <div className="dashboard-main">
      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 6 }}>Business Analytics</div>
      <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 30 }}>Auto-generated from your sales & purchase invoices</div>

      <div className="stats-grid">
        {[
          { label: "Gross profit (Current)", value: `₹${(stats.revenue - stats.purchases).toLocaleString()}`, sub: "Derived from invoices" },
          { label: "Total products in inventory", value: products.length, sub: "Unique SKUs" },
          { label: "Avg Profit Margin", value: inventoryData.length > 0 ? `${Math.round(inventoryData.reduce((acc, p) => acc + p.margin, 0) / inventoryData.length)}%` : '0%', sub: "across all brands" },
        ].map(k => (
          <div key={k.label} style={{ background: TL, border: "1px solid #9FE1CB", borderRadius: 12, padding: "16px 20px" }}>
            <div style={{ fontSize: 11, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: T }}>{k.value}</div>
            <div style={{ fontSize: 12, color: "#1D9E75", marginTop: 4 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {inventoryData.length > 0 ? (
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 20, marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Profit margin by product</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={inventoryData} barSize={24} layout="vertical">
              <XAxis type="number" tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#374151" }} axisLine={false} tickLine={false} width={150} />
              <Tooltip formatter={v => `${v}%`} />
              <Bar dataKey="margin" name="Margin" fill={T} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ padding: 30, textAlign: "center", border: "1px solid #e5e7eb", borderRadius: 12, marginBottom: 24, color: '#6b7280' }}>
          Upload purchase invoices to generate profit margin analytics for your products.
        </div>
      )}

      <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Live Stock Levels</div>
      <div className="table-responsive">
        <div style={{ border: "1px solid #e5e7eb", borderRadius: 10, overflow: "hidden", fontSize: 13, minWidth: "500px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1.6fr 80px 80px", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", padding: "10px 20px", gap: 12, fontSize: 11, fontWeight: 600, color: "#6b7280", textTransform: "uppercase", letterSpacing: 0.5 }}>
            <span>Product</span><span style={{ textAlign: "right" }}>Stock</span><span style={{ textAlign: "right" }}>Margin</span>
          </div>
        {inventoryData.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "1.6fr 80px 80px", padding: "12px 20px", gap: 12, borderTop: i > 0 ? "1px solid #f3f4f6" : "none", background: "#fff", alignItems: "center" }}>
            <span style={{ color: "#374151", fontWeight: 500 }}>{r.name}</span>
            <span style={{ textAlign: "right" }}>
              <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 6, fontWeight: 600, background: r.remaining <= 6 ? "#fee2e2" : "#f3f4f6", color: r.remaining <= 6 ? "#dc2626" : "#374151" }}>{r.remaining}</span>
            </span>
            <span style={{ color: T, fontWeight: 700, textAlign: "right" }}>{r.margin}%</span>
          </div>
        ))}
        {inventoryData.length === 0 && (
          <div style={{ padding: 20, textAlign: "center", color: "#6b7280" }}>No products in inventory.</div>
        )}
        </div>
      </div>
      
      {inventoryData.some(p => p.remaining <= 6) && (
        <div style={{ marginTop: 20, padding: "14px 16px", background: "#fef9c3", borderRadius: 10, fontSize: 13, color: "#92400e", display: "flex", gap: 10, alignItems: "flex-start" }}>
          <AlertCircle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <span><strong>Low stock alert:</strong> Some products have critically low inventory levels. Time to reorder.</span>
        </div>
      )}
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
      const res = await authFetch(`/api/invoices/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
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
      if (res.ok) {
        setInvoices(prev => prev.filter(inv => inv.id !== id));
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
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#f9fafb' }}>Loading Business Manager...</div>;
  }

  return (
    <div className="dashboard-layout">
      <Sidebar screen={screen} setScreen={setScreen} user={user} logout={logout} />
      {screen === 0 && <Dashboard setScreen={setScreen} user={user} stats={stats} monthData={monthData} recentInvoices={recentInvoices} />}
      {screen === 1 && <InvoiceHub setScreen={setScreen} invoices={invoices} purchases={purchases} setShowCreate={setShowCreate} updateInvoiceStatus={updateInvoiceStatus} statusUpdating={statusUpdating} deleteInvoice={deleteInvoice} />}
      {screen === 2 && <UploadInvoice setScreen={setScreen} authFetch={authFetch} setExtractedData={setExtractedData} />}
      {screen === 3 && <ReviewExtraction setScreen={setScreen} extractedData={extractedData} authFetch={authFetch} fetchPurchases={fetchPurchases} fetchProducts={fetchProducts} />}
      {screen === 4 && <Analytics products={products} stats={stats} />}
      {screen === 5 && <SettingsScreen user={user} setUser={setUser} authFetch={authFetch} />}
      
      {showCreate && <CreateInvoiceModal onClose={() => setShowCreate(false)} onSuccess={() => { fetchInvoices(); fetchProducts(); }} user={user} />}
    </div>
  );
}
