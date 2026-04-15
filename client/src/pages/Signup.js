import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './AuthPages.css';

const initialForm = {
  email: '', whatsapp: '', password: '',
  businessName: '', gstNumber: '', panNumber: '',
  address: '', city: '', pincode: '',
  bankName: '', accountNumber: '', ifscCode: '', upiId: '',
};

function SignupField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  placeholder,
  required,
  helper,
  autoComplete,
  inputMode,
}) {
  return (
    <div className="form-group">
      <label className="form-label">{label} {required && <span className="required">*</span>}</label>
      <input
        className="form-input"
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      {helper && <p className="form-helper">{helper}</p>}
    </div>
  );
}

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((f) => ({ ...f, [name]: value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setLoading(true);
    try {
      await signup(form);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page signup-page">
      <Navbar />
      <div className="auth-container signup-container">
        <div className="auth-header" style={{ textAlign: 'center', marginBottom: 32 }}>
          <h1>Create Your Account</h1>
          <p>Start generating professional invoices in minutes</p>
        </div>

        <form className="signup-form card" onSubmit={handleSubmit}>
          {error && <div className="alert alert-error">{error}</div>}

          {/* Account Info */}
          <div className="form-section">
            <h3 className="section-label">Account Information</h3>
            <SignupField
              label="Email"
              name="email"
              type="email"
              value={form.email}
              onChange={handleChange}
              placeholder="you@example.com"
              autoComplete="email"
              required
            />
            <SignupField
              label="WhatsApp Number"
              name="whatsapp"
              type="tel"
              value={form.whatsapp}
              onChange={handleChange}
              placeholder="+91 98765 43210"
              autoComplete="tel"
              inputMode="tel"
              required
              helper="We'll send your invoices to this number"
            />
            <SignupField
              label="Password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              placeholder="Minimum 8 characters"
              autoComplete="new-password"
              required
            />
          </div>

          {/* Business Details */}
          <div className="form-section">
            <h3 className="section-label">Business Details</h3>
            <SignupField
              label="Business / Your Name"
              name="businessName"
              value={form.businessName}
              onChange={handleChange}
              placeholder="Acme Consulting"
              autoComplete="organization"
              required
              helper="This will appear on all your invoices"
            />
            <div className="form-row">
              <SignupField
                label="GST Number"
                name="gstNumber"
                value={form.gstNumber}
                onChange={handleChange}
                placeholder="27XXXXX1234X1Z5"
              />
              <SignupField
                label="PAN Number"
                name="panNumber"
                value={form.panNumber}
                onChange={handleChange}
                placeholder="ABCDE1234F"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Business Address</label>
              <textarea
                className="form-textarea"
                name="address"
                value={form.address}
                onChange={handleChange}
                placeholder="123 Business Street, Area"
                autoComplete="street-address"
              />
            </div>
            <div className="form-row">
              <SignupField
                label="City"
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="Mumbai"
                autoComplete="address-level2"
              />
              <SignupField
                label="Pincode"
                name="pincode"
                value={form.pincode}
                onChange={handleChange}
                placeholder="400001"
                autoComplete="postal-code"
                inputMode="numeric"
              />
            </div>
          </div>

          {/* Bank Details */}
          <div className="form-section">
            <h3 className="section-label">Bank Details <span className="optional-tag">(Optional)</span></h3>
            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              <strong>💡 Pro tip:</strong> Add bank details now to include them on all invoices automatically.
            </div>
            <SignupField
              label="Bank Name"
              name="bankName"
              value={form.bankName}
              onChange={handleChange}
              placeholder="HDFC Bank"
              autoComplete="organization"
            />
            <div className="form-row">
              <SignupField
                label="Account Number"
                name="accountNumber"
                value={form.accountNumber}
                onChange={handleChange}
                placeholder="1234567890"
                inputMode="numeric"
              />
              <SignupField
                label="IFSC Code"
                name="ifscCode"
                value={form.ifscCode}
                onChange={handleChange}
                placeholder="HDFC0001234"
              />
            </div>
            <SignupField
              label="UPI ID"
              name="upiId"
              value={form.upiId}
              onChange={handleChange}
              placeholder="yourname@paytm"
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
            {loading ? <span className="spinner" /> : 'Create Account & Start Free Trial'}
          </button>

          <p className="auth-switch" style={{ marginTop: 20 }}>
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
