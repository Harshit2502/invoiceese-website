# InvoiceEase — Full Stack React + Node.js Project

A complete WhatsApp-based GST invoice generator for Indian freelancers.  
Built with **React** (frontend) + **Express/Node.js** (backend).

---

## 🗂 Project Structure

```
invoiceease/
├── package.json              ← Root scripts (run both servers together)
│
├── client/                   ← React Frontend (Create React App)
│   ├── public/index.html
│   └── src/
│       ├── index.js          ← React entry point
│       ├── index.css         ← Global design system (CSS variables, utilities)
│       ├── App.js            ← React Router setup + protected routes
│       ├── context/
│       │   └── AuthContext.js  ← Global auth state (login, signup, logout, authFetch)
│       ├── components/
│       │   ├── Navbar.js / .css
│       │   └── Footer.js / .css
│       └── pages/
│           ├── Landing.js / .css   ← Home page
│           ├── Login.js            ← Login form + JWT
│           ├── Signup.js           ← Multi-section signup form
│           ├── AuthPages.css       ← Shared auth styles
│           ├── Dashboard.js / .css ← Invoice management dashboard
│           ├── Pricing.js / .css   ← Plans + comparison table + FAQ
│           ├── FAQ.js / .css       ← Searchable FAQ with categories
│           ├── Terms.js            ← Terms of Service
│           ├── Privacy.js          ← Privacy Policy
│           └── LegalPages.css      ← Shared legal styles
│
└── server/                   ← Express Backend
    ├── index.js              ← Express app, middleware, routes
    ├── db.js                 ← In-memory store (seeded with demo user + invoices)
    ├── .env                  ← Environment variables
    ├── middleware/
    │   └── auth.js           ← JWT verification middleware
    └── routes/
        ├── auth.js           ← POST /signup, POST /login, GET /me
        ├── invoices.js       ← GET/POST invoices, PATCH status, DELETE
        └── users.js          ← GET/PATCH profile
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm 9+

### Install dependencies
```bash
# From the invoiceease/ root folder:
npm run install:all
```
This installs root, client, and server dependencies in one command.

### Run in development (both servers simultaneously)
```bash
npm run dev
```
- **React frontend** → http://localhost:3000
- **Express backend** → http://localhost:5000

### Run individually
```bash
# Backend only
npm run dev:server

# Frontend only
npm run dev:client
```

---

## 🔑 Demo Login

```
Email:    harshit@example.com
Password: password123
```

The demo account comes pre-loaded with 5 sample invoices.

---

## 📡 API Endpoints

All `/api/invoices` and `/api/users` routes require:
```
Authorization: Bearer <jwt_token>
```

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/signup` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Invoices
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/invoices` | List all invoices + stats |
| POST | `/api/invoices` | Create new invoice |
| PATCH | `/api/invoices/:id/status` | Update payment status |
| DELETE | `/api/invoices/:id` | Delete invoice |

### Users
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users/profile` | Get user profile |
| PATCH | `/api/users/profile` | Update business details |

### Create Invoice Payload
```json
{
  "clientName": "Acme Corp",
  "service": "Website Design",
  "amount": 50000,
  "gstRate": 18,
  "notes": "Net 30 payment terms"
}
```

---

## 🎨 Pages

| Route | Page | Auth Required |
|-------|------|---------------|
| `/` | Landing page | No |
| `/signup` | Registration | No (redirects to /dashboard if logged in) |
| `/login` | Login | No (redirects to /dashboard if logged in) |
| `/dashboard` | Invoice management | ✅ Yes |
| `/pricing` | Pricing plans | No |
| `/faq` | FAQ (searchable) | No |
| `/terms` | Terms of Service | No |
| `/privacy` | Privacy Policy | No |

---

## 🔧 Environment Variables

`server/.env`:
```env
PORT=5000
JWT_SECRET=your_secret_key_here
CLIENT_URL=http://localhost:3000
NODE_ENV=development
```

---

## 🔮 Production Checklist

### Replace in-memory DB with a real database
```bash
# Recommended: MongoDB with Mongoose
npm install mongoose
# or PostgreSQL with Prisma
npm install prisma @prisma/client
```

### Add to server/index.js
```js
// Rate limiting
npm install express-rate-limit
// Input validation
npm install express-validator
// Helmet for security headers
npm install helmet
```

### Frontend build
```bash
npm run build
# Outputs to client/build/ — deploy to Netlify, Vercel, or serve via Express
```

### Real integrations to add
- **Razorpay** → payment processing
- **Twilio / Gupshup** → actual WhatsApp Business API
- **PDFKit or puppeteer** → real PDF invoice generation
- **Nodemailer** → email notifications
- **Cloudinary or S3** → logo/file uploads

---

## 🧑‍💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| Styling | Plain CSS with CSS variables (no framework) |
| State | React Context API + useState/useEffect |
| Backend | Node.js + Express 4 |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Database | In-memory (replace with MongoDB/PostgreSQL) |
| Dev tooling | concurrently, nodemon, Create React App |

---

Made with ❤️ for Indian freelancers.
