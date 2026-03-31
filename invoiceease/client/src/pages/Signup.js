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

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

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

  const Field = ({ label, name, type = 'text', placeholder, required, helper }) => (
    <div className="form-group">
      <label className="form-label">{label} {required && <span className="required">*</span>}</label>
      <input
        className="form-input"
        type={type}
        name={name}
        value={form[name]}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
      />
      {helper && <p className="form-helper">{helper}</p>}
    </div>
  );

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
            <Field label="Email" name="email" type="email" placeholder="you@example.com" required />
            <Field label="WhatsApp Number" name="whatsapp" type="tel" placeholder="+91 98765 43210" required helper="We'll send your invoices to this number" />
            <Field label="Password" name="password" type="password" placeholder="Minimum 8 characters" required />
          </div>

          {/* Business Details */}
          <div className="form-section">
            <h3 className="section-label">Business Details</h3>
            <Field label="Business / Your Name" name="businessName" placeholder="Acme Consulting" required helper="This will appear on all your invoices" />
            <div className="form-row">
              <Field label="GST Number" name="gstNumber" placeholder="27XXXXX1234X1Z5" />
              <Field label="PAN Number" name="panNumber" placeholder="ABCDE1234F" />
            </div>
            <div className="form-group">
              <label className="form-label">Business Address</label>
              <textarea className="form-textarea" name="address" value={form.address} onChange={handleChange} placeholder="123 Business Street, Area" />
            </div>
            <div className="form-row">
              <Field label="City" name="city" placeholder="Mumbai" />
              <Field label="Pincode" name="pincode" placeholder="400001" />
            </div>
          </div>

          {/* Bank Details */}
          <div className="form-section">
            <h3 className="section-label">Bank Details <span className="optional-tag">(Optional)</span></h3>
            <div className="alert alert-info" style={{ marginBottom: 20 }}>
              <strong>💡 Pro tip:</strong> Add bank details now to include them on all invoices automatically.
            </div>
            <Field label="Bank Name" name="bankName" placeholder="HDFC Bank" />
            <div className="form-row">
              <Field label="Account Number" name="accountNumber" placeholder="1234567890" />
              <Field label="IFSC Code" name="ifscCode" placeholder="HDFC0001234" />
            </div>
            <Field label="UPI ID" name="upiId" placeholder="yourname@paytm" />
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
