import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="logo">
          <div className="logo-icon">IE</div>
          InvoiceEase
        </Link>

        <nav className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <Link to="/pricing" className={isActive('/pricing') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Pricing</Link>
          <Link to="/faq" className={isActive('/faq') ? 'active' : ''} onClick={() => setMenuOpen(false)}>FAQ</Link>
          {user ? (
            <>
              <Link to="/dashboard" className={`btn btn-primary ${isActive('/dashboard') ? 'active' : ''}`} onClick={() => setMenuOpen(false)}>Dashboard</Link>
              <button className="btn btn-secondary btn-sm" onClick={handleLogout}>Log out</button>
            </>
          ) : (
            <>
              <Link to="/login" className={isActive('/login') ? 'active' : ''} onClick={() => setMenuOpen(false)}>Log in</Link>
              <Link to="/signup" className="btn btn-primary" onClick={() => setMenuOpen(false)}>Start Free</Link>
            </>
          )}
        </nav>

        <button className="hamburger" onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </div>
    </header>
  );
}
