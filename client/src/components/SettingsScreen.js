import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Settings as SettingsIcon } from 'lucide-react';

const TELEGRAM_BOT_USERNAME = process.env.REACT_APP_TELEGRAM_BOT || 'InvoiceEaseBot';
const T = "#0F6E56";

export default function SettingsScreen({ user, setUser, authFetch }) {
  const [settingsForm, setSettingsForm] = useState({ 
    templateStyle: user?.templateStyle || 'modern',
    showWatermark: user?.showWatermark ?? true,
    logoUrl: user?.logoUrl || '',
    gstNumber: user?.gstNumber || '',
    state: user?.state || '',
    stateCode: user?.stateCode || '',
  });

  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [logoUploadPayload, setLogoUploadPayload] = useState(null);
  
  const [telegramStatus, setTelegramStatus] = useState(null);
  const [telegramLoading, setTelegramLoading] = useState(true);
  const [telegramError, setTelegramError] = useState('');
  const [telegramTestSending, setTelegramTestSending] = useState(false);
  const [telegramTestMessage, setTelegramTestMessage] = useState('');

  const isPro = user?.plan === 'pro' || user?.plan === 'business';
  const isFree = user?.plan === 'free';

  useEffect(() => {
    const fetchTelegramStatus = async () => {
      try {
        const res = await authFetch('/api/telegram/status');
        if (res.ok) {
          const data = await res.json();
          setTelegramStatus(data);
        } else {
          setTelegramError('Could not fetch Telegram integration status');
        }
      } catch (err) {
        setTelegramError('Failed to connect to backend for Telegram status');
      } finally {
        setTelegramLoading(false);
      }
    };
    fetchTelegramStatus();
  }, [authFetch]);

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
        body: JSON.stringify({ 
          logoUrl: nextLogoUrl,
          gstNumber: settingsForm.gstNumber,
          state: settingsForm.state,
          stateCode: settingsForm.stateCode
        }),
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
      setTimeout(() => setSettingsSaved(false), 3000);
    } catch (err) {
      setSettingsError(err.message);
    }
  };

  const handleSendTelegramTest = async () => {
    setTelegramTestSending(true);
    setTelegramTestMessage('');
    try {
      const response = await authFetch('/api/telegram/test-send', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to send test message');
      setTelegramTestMessage(`Test message sent to chat ${data.chatId}`);
    } catch (error) {
      setTelegramTestMessage(error.message);
    } finally {
      setTelegramTestSending(false);
    }
  };

  return (
    <div style={{ flex: 1, padding: 30, background: "#fff", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 30 }}>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700, color: "#111827" }}>Business Settings</div>
          <div style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>Manage your profile, invoice templates, and integrations</div>
        </div>
        {isFree && (
          <Link to="/pricing" style={{ background: T, color: "#fff", padding: "10px 16px", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600 }}>
            Upgrade to Pro
          </Link>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: 30 }}>
        
        {/* Main Settings Form */}
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 12, padding: 24 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
            <SettingsIcon size={18} /> Invoice Configuration
          </h3>
          
          {settingsError && <div style={{ padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, marginBottom: 16, fontSize: 13 }}>{settingsError}</div>}
          {settingsSaved && <div style={{ padding: 12, background: "#d1fae5", color: "#065f46", borderRadius: 8, marginBottom: 16, fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}><CheckCircle size={16} /> Settings saved successfully!</div>}
          
          <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Your GST Number</label>
              <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={settingsForm.gstNumber} onChange={(e) => setSettingsForm(f => ({ ...f, gstNumber: e.target.value }))} placeholder="Leave blank for Non-GST Invoices" />
              <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Adding a GST number upgrades your invoices to "Tax Invoices" with CGST/SGST breakdowns.</div>
            </div>

            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Business State</label>
                <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={settingsForm.state} onChange={(e) => setSettingsForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Gujarat" />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>State Code</label>
                <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={settingsForm.stateCode} onChange={(e) => setSettingsForm(f => ({ ...f, stateCode: e.target.value }))} placeholder="e.g. 24" />
              </div>
            </div>

            <div style={{ opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none', position: 'relative' }}>
              {!isPro && <div style={{ position: 'absolute', top: -10, right: 0, background: '#fef3c7', color: '#92400e', fontSize: 10, padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>PRO FEATURE</div>}
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default Template</label>
              <select style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', background: '#fff' }} value={settingsForm.templateStyle} onChange={(e) => setSettingsForm(f => ({ ...f, templateStyle: e.target.value }))}>
                <option value="modern">Modern</option>
                <option value="minimal">Minimal</option>
                <option value="classic">Classic</option>
                <option value="premium">Premium</option>
              </select>
            </div>

            <div style={{ opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none', display: 'flex', alignItems: 'center' }}>
              <input type="checkbox" id="watermark" checked={!settingsForm.showWatermark} onChange={(e) => setSettingsForm(f => ({ ...f, showWatermark: !e.target.checked }))} style={{ marginRight: 10, width: 16, height: 16 }} />
              <label htmlFor="watermark" style={{ fontSize: 13, color: '#374151', fontWeight: 500 }}>Remove InvoiceEase watermark</label>
            </div>

            <div style={{ opacity: isPro ? 1 : 0.5, pointerEvents: isPro ? 'auto' : 'none' }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Business Logo</label>
              <input type="file" accept="image/*" onChange={handleLogoUpload} style={{ display: 'block', marginBottom: 8, fontSize: 13 }} />
              {settingsForm.logoUrl && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12, padding: 12, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
                  <img src={settingsForm.logoUrl} alt="Logo preview" style={{ height: 40, objectFit: 'contain' }} />
                  <button type="button" onClick={removeLogo} style={{ padding: '6px 12px', background: '#fef2f2', color: '#b91c1c', border: 'none', borderRadius: 6, fontSize: 12, cursor: 'pointer', fontWeight: 500 }}>Remove</button>
                </div>
              )}
            </div>

            <div style={{ paddingTop: 20, borderTop: "1px solid #e5e7eb", marginTop: 10 }}>
              <button type="submit" style={{ background: T, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, width: "100%" }}>
                Save Configuration
              </button>
            </div>
          </form>
        </div>

        {/* Telegram Integration Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 12, padding: 24 }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "#0f172a", marginBottom: 8 }}>Telegram Integration</h3>
            <p style={{ fontSize: 13, color: "#64748b", marginBottom: 20 }}>Connect your Telegram bot to create invoices via chat automatically.</p>
            
            <a href={`https://t.me/${TELEGRAM_BOT_USERNAME}?start=${user?.whatsapp ? String(user.whatsapp).replace(/[^0-9]/g, '') : ''}`} target="_blank" rel="noreferrer" style={{ display: "block", textAlign: "center", background: "#0088cc", color: "#fff", padding: "10px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600, marginBottom: 20 }}>
              Open @{TELEGRAM_BOT_USERNAME}
            </a>

            {telegramLoading ? (
              <div style={{ fontSize: 13, color: "#64748b", textAlign: "center" }}>Loading status...</div>
            ) : telegramError ? (
              <div style={{ padding: 12, background: "#fef2f2", color: "#b91c1c", borderRadius: 8, fontSize: 13 }}>{telegramError}</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>Bot Status</span>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: "4px 8px", borderRadius: 12, background: telegramStatus?.configured ? "#dcfce7" : "#fef3c7", color: telegramStatus?.configured ? "#166534" : "#92400e" }}>
                    {telegramStatus?.configured ? 'Connected' : 'Not configured'}
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px", background: "#fff", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: 13, color: "#475569", fontWeight: 500 }}>Linked Account</span>
                  <span style={{ fontSize: 13, color: "#0f172a", fontWeight: 500 }}>{user?.telegram_chat_id || 'None'}</span>
                </div>
                
                <button 
                  onClick={handleSendTelegramTest} 
                  disabled={!telegramStatus?.configured || !user?.telegram_chat_id || telegramTestSending}
                  style={{ marginTop: 8, background: "#f1f5f9", color: "#334155", padding: "10px", borderRadius: 8, border: "1px solid #cbd5e1", cursor: (!telegramStatus?.configured || !user?.telegram_chat_id || telegramTestSending) ? "not-allowed" : "pointer", fontSize: 13, fontWeight: 600 }}
                >
                  {telegramTestSending ? 'Sending...' : 'Send Test Message'}
                </button>

                {telegramTestMessage && (
                  <div style={{ padding: 10, borderRadius: 6, fontSize: 12, background: telegramTestMessage.includes('sent') ? '#dcfce7' : '#fef2f2', color: telegramTestMessage.includes('sent') ? '#166534' : '#b91c1c' }}>
                    {telegramTestMessage}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Current Plan Card */}
          <div style={{ background: isPro ? "#1e293b" : "#fff", border: isPro ? "none" : "1px solid #e5e7eb", borderRadius: 12, padding: 24, color: isPro ? "#fff" : "#111827" }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: isPro ? "#94a3b8" : "#6b7280", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 }}>Current Plan</h3>
            <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 16 }}>{user?.plan === 'business' ? 'Business' : user?.plan === 'pro' ? 'Pro' : 'Free'} Plan</div>
            {isPro ? (
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#a7f3d0", fontWeight: 500 }}>
                <CheckCircle size={16} /> All premium features unlocked
              </div>
            ) : (
              <div>
                <ul style={{ paddingLeft: 20, margin: "0 0 20px 0", fontSize: 13, color: "#475569", display: "flex", flexDirection: "column", gap: 8 }}>
                  <li>Limited to 5 free invoices/month</li>
                  <li>Basic templates only</li>
                  <li>InvoiceEase watermark</li>
                </ul>
                <Link to="/pricing" style={{ display: "block", textAlign: "center", background: T, color: "#fff", padding: "10px", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 }}>
                  Upgrade Now
                </Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
