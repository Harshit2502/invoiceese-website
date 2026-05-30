import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertCircle, Settings as SettingsIcon } from 'lucide-react';

const T = "#0F6E56";

export default function SettingsScreen({ user, setUser, authFetch }) {
  const [settingsForm, setSettingsForm] = useState({ 
    templateStyle: user?.templateStyle || 'modern',
    showWatermark: user?.showWatermark ?? true,
    logoUrl: user?.logoUrl || '',
    gstNumber: user?.gstNumber || '',
    state: user?.state || '',
    stateCode: user?.stateCode || '',
    defaultDueDays: user?.defaultDueDays || 30,
    defaultRemindOnDays: user?.defaultRemindOnDays || [1, 3, 7, 14],
    defaultReminderChannels: user?.defaultReminderChannels || ['email'],
  });

  const [settingsError, setSettingsError] = useState('');
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [logoUploadPayload, setLogoUploadPayload] = useState(null);
  


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

      const parseRemindOnDays = (val) => {
        if (Array.isArray(val)) return val;
        return String(val)
          .split(',')
          .map(n => parseInt(n.trim(), 10))
          .filter(Number.isFinite);
      };

      const profileRes = await authFetch('/api/users/profile', {
        method: 'PATCH',
        body: JSON.stringify({ 
          logoUrl: nextLogoUrl,
          gstNumber: settingsForm.gstNumber,
          state: settingsForm.state,
          stateCode: settingsForm.stateCode,
          defaultDueDays: Number(settingsForm.defaultDueDays),
          defaultRemindOnDays: parseRemindOnDays(settingsForm.defaultRemindOnDays),
          defaultReminderChannels: settingsForm.defaultReminderChannels
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

  const isPro = user?.plan === 'pro' || user?.plan === 'business';
  const isFree = user?.plan === 'free';

  return (
    <div className="dashboard-main">
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

      <div className="settings-grid">
        
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

            <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
              <div style={{ flex: "1 1 120px" }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Business State</label>
                <input style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={settingsForm.state} onChange={(e) => setSettingsForm(f => ({ ...f, state: e.target.value }))} placeholder="e.g. Gujarat" />
              </div>
              <div style={{ flex: "1 1 120px" }}>
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

            {/* Payment Reminder Defaults Section */}
            <div style={{ paddingTop: 20, borderTop: "1px solid #e5e7eb", marginTop: 10 }}>
              <h4 style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 12 }}>Payment Reminder Defaults</h4>
              
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default Due Date (days from creation)</label>
                <input type="number" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={settingsForm.defaultDueDays} onChange={(e) => setSettingsForm(f => ({ ...f, defaultDueDays: e.target.value }))} placeholder="e.g. 30" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default Reminder Schedule (days after due date, comma-separated)</label>
                <input type="text" style={{ width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} value={Array.isArray(settingsForm.defaultRemindOnDays) ? settingsForm.defaultRemindOnDays.join(', ') : settingsForm.defaultRemindOnDays} onChange={(e) => setSettingsForm(f => ({ ...f, defaultRemindOnDays: e.target.value }))} placeholder="e.g. 1, 3, 7, 14" />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Default Notification Channels</label>
                <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settingsForm.defaultReminderChannels.includes('email')} onChange={(e) => {
                      const checked = e.target.checked;
                      setSettingsForm(f => {
                        const channels = checked 
                          ? [...f.defaultReminderChannels, 'email']
                          : f.defaultReminderChannels.filter(c => c !== 'email');
                        return { ...f, defaultReminderChannels: channels };
                      });
                    }} style={{ marginRight: 6 }} />
                    Email
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', fontSize: 13, color: '#374151', cursor: 'pointer' }}>
                    <input type="checkbox" checked={settingsForm.defaultReminderChannels.includes('whatsapp')} onChange={(e) => {
                      const checked = e.target.checked;
                      setSettingsForm(f => {
                        const channels = checked 
                          ? [...f.defaultReminderChannels, 'whatsapp']
                          : f.defaultReminderChannels.filter(c => c !== 'whatsapp');
                        return { ...f, defaultReminderChannels: channels };
                      });
                    }} style={{ marginRight: 6 }} />
                    WhatsApp
                  </label>
                </div>
              </div>
            </div>

            <div style={{ paddingTop: 20, borderTop: "1px solid #e5e7eb", marginTop: 10 }}>
              <button type="submit" style={{ background: T, color: "#fff", padding: "12px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 14, fontWeight: 600, width: "100%" }}>
                Save Configuration
              </button>
            </div>
          </form>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
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
