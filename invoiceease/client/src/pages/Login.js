import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Navbar from '../components/Navbar';
import './AuthPages.css';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <Navbar />
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <div className="auth-logo">IE</div>
            <h1>Welcome back</h1>
            <p>Log in to continue generating invoices</p>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="alert alert-info" style={{ fontSize: 13 }}>
            <strong>Demo credentials:</strong> harshit@example.com / password123
          </div>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Email or WhatsApp Number</label>
              <input
                className="form-input"
                type="text"
                name="email"
                value={form.email}
                onChange={handleChange}
                placeholder="you@example.com or +91 98765 43210"
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <div className="password-wrapper">
                <input
                  className="form-input"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  required
                />
                <button type="button" className="toggle-pw" onClick={() => setShowPassword(v => !v)}>
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className="form-meta">
              <label className="remember-label">
                <input type="checkbox" /> Remember me
              </label>
              <a href="#forgot" className="forgot-link">Forgot password?</a>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Log In'}
            </button>
          </form>

          <div className="divider"><span>or</span></div>

          <button className="btn btn-whatsapp btn-block" onClick={() => alert('WhatsApp login coming soon!')}>
            <span>📱</span> Log in with WhatsApp
          </button>

          <p className="auth-switch">
            Don't have an account? <Link to="/signup">Sign up for free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
