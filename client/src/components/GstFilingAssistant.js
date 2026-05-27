import React, { useState, useEffect, useMemo } from 'react';
import { 
  ShieldCheck, FileText, Download, AlertTriangle, CheckCircle, 
  Calendar, Check, AlertCircle, RefreshCw, Info, Search, HelpCircle, ArrowRight
} from 'lucide-react';

const INDIAN_STATES = {
  "01": "Jammu & Kashmir",
  "02": "Himachal Pradesh",
  "03": "Punjab",
  "04": "Chandigarh",
  "05": "Uttarakhand",
  "06": "Haryana",
  "07": "Delhi",
  "08": "Rajasthan",
  "09": "Uttar Pradesh",
  "10": "Bihar",
  "11": "Sikkim",
  "12": "Arunachal Pradesh",
  "13": "Nagaland",
  "14": "Manipur",
  "15": "Mizoram",
  "16": "Tripura",
  "17": "Meghalaya",
  "18": "Assam",
  "19": "West Bengal",
  "20": "Jharkhand",
  "21": "Odisha",
  "22": "Chhattisgarh",
  "23": "Madhya Pradesh",
  "24": "Gujarat",
  "26": "Dadra and Nagar Haveli and Daman and Diu",
  "27": "Maharashtra",
  "29": "Karnataka",
  "30": "Goa",
  "31": "Lakshadweep",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "34": "Puducherry",
  "35": "Andaman and Nicobar Islands",
  "36": "Telangana",
  "37": "Andhra Pradesh",
  "38": "Ladakh"
};

const TIMELINE_STEPS = [
  {
    week: "Week 1",
    title: "Data Prep & Verification",
    steps: [
      { id: 1, text: "Verify sales invoice numbers & sequences (no gaps)" },
      { id: 2, text: "Check client GSTINs are valid and mapped" },
      { id: 3, text: "Verify place of supply (POS) and 2-digit state codes" },
      { id: 4, text: "Check HSN/SAC codes are present on all items sold" },
      { id: 5, text: "Classify purchase invoices ITC eligibility (Inputs/Capital Goods)" }
    ]
  },
  {
    week: "Week 2",
    title: "GSTR-1 Review & Export",
    steps: [
      { id: 6, text: "Verify B2B sales invoices report details" },
      { id: 7, text: "Consolidate B2C Small sales by state + tax rate (B2CS)" },
      { id: 8, text: "Export case-sensitive GSTR-1 B2B and B2CS CSV files" },
      { id: 9, text: "Upload CSVs to GSTR-1 offline tool and verify JSON" }
    ]
  },
  {
    week: "Week 3",
    title: "GSTR-3B & Filing Tracker",
    steps: [
      { id: 10, text: "Compare estimated ITC (Table 4) with GSTR-2B portal report" },
      { id: 11, text: "Confirm Table 3.1 outward liabilities match GSTR-1 numbers" },
      { id: 12, text: "File GSTR-3B on portal and pay net liability" },
      { id: 13, text: "Mark month as filed and save ARN proof in InvoiceEase" }
    ]
  }
];

export default function GstFilingAssistant({ 
  invoices = [], 
  purchases = [], 
  authFetch, 
  user, 
  fetchPurchases, 
  fetchInvoices 
}) {
  const [activeTab, setActiveTab] = useState('overview'); // overview, dbprep, gstr1, gstr2b, gstr3b, filing
  const [selectedMonth, setSelectedMonth] = useState(''); // e.g. "2026-05"
  
  // Tax Period Date Range selection (Mockup-Style)
  const [fromDateInput, setFromDateInput] = useState('');
  const [toDateInput, setToDateInput] = useState('');
  const [filterRange, setFilterRange] = useState({ from: null, to: null });
  
  // Sub-Tab Navigation
  const [gstr1SubTab, setGstr1SubTab] = useState('B2B'); // B2B, B2CL, B2CS, CDNR, CDNUR, EXP, AT, ATADJ, EXEMP, HSN(B2B), HSN(B2C), DOCS
  const [gstr2bSubTab, setGstr2bSubTab] = useState('B2B'); // B2B, B2B-CDNR, IMPS, ISD, ITC-Eligible, ITC-Ineligible
  const [gstr3bSubTab, setGstr3bSubTab] = useState('t31'); // t31, t32, t4, t5, t6
  
  const [filingStatus, setFilingStatus] = useState([]);
  const [loadingFiling, setLoadingFiling] = useState(false);
  const [arnInput, setArnInput] = useState('');
  const [submittingArn, setSubmittingArn] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({});

  // Generate last 6 months for the selector
  const availableMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const label = d.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
      list.push({ value: `${year}-${month}`, label });
    }
    return list;
  }, []);

  // Set default month & tax period input values
  useEffect(() => {
    if (availableMonths.length > 0 && !selectedMonth) {
      setSelectedMonth(availableMonths[0].value);
    }
  }, [availableMonths, selectedMonth]);

  // Adjust dates whenever selectedMonth changes
  useEffect(() => {
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      const firstDay = `${year}-${month}-01`;
      const lastDayDate = new Date(Number(year), Number(month), 0);
      const lastDay = `${year}-${month}-${String(lastDayDate.getDate()).padStart(2, '0')}`;
      
      setFromDateInput(firstDay);
      setToDateInput(lastDay);
      setFilterRange({ from: new Date(firstDay), to: new Date(lastDay) });
    }
  }, [selectedMonth]);

  // Fetch filing status history
  const fetchFilingStatus = async () => {
    setLoadingFiling(true);
    try {
      const res = await authFetch('/api/gst/filing-status');
      if (res.ok) {
        const data = await res.json();
        setFilingStatus(data.statuses || []);
      }
    } catch (err) {
      console.error('Error fetching GSTR filing status:', err);
    } finally {
      setLoadingFiling(false);
    }
  };

  useEffect(() => {
    fetchFilingStatus();
  }, []);

  // Load checked steps from localStorage for current month
  useEffect(() => {
    if (selectedMonth && user?.id) {
      const saved = localStorage.getItem(`gst_steps_${user.id}_${selectedMonth}`);
      if (saved) {
        try {
          setCheckedSteps(JSON.parse(saved));
        } catch (e) {
          setCheckedSteps({});
        }
      } else {
        setCheckedSteps({});
      }
    }
  }, [selectedMonth, user?.id]);

  // Toggle step in checklist
  const handleToggleStep = (stepId) => {
    const nextSteps = { ...checkedSteps, [stepId]: !checkedSteps[stepId] };
    setCheckedSteps(nextSteps);
    if (selectedMonth && user?.id) {
      localStorage.setItem(`gst_steps_${user.id}_${selectedMonth}`, JSON.stringify(nextSteps));
    }
  };

  // Get count of completed steps
  const completedCount = useMemo(() => {
    return Object.values(checkedSteps).filter(Boolean).length;
  }, [checkedSteps]);

  const completionPercent = Math.round((completedCount / 13) * 100);

  // Trigger search range filter
  const handleSearchRange = (e) => {
    e.preventDefault();
    if (!fromDateInput || !toDateInput) {
      alert('Please select both From and To dates.');
      return;
    }
    const from = new Date(fromDateInput);
    const to = new Date(toDateInput);
    to.setHours(23, 59, 59, 999);
    setFilterRange({ from, to });
  };

  // Helper date parsing/display formatting
  const displayFormattedDate = (dStr) => {
    if (!dStr) return '';
    const d = new Date(dStr);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
  };

  // Live filter transactions by date range
  const filteredSales = useMemo(() => {
    if (!filterRange.from || !filterRange.to) return [];
    return invoices.filter(inv => {
      const dateVal = inv.date || inv.createdAt;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) && d >= filterRange.from && d <= filterRange.to && inv.docType === 'sales_invoice';
    });
  }, [invoices, filterRange]);

  const filteredPurchases = useMemo(() => {
    if (!filterRange.from || !filterRange.to) return [];
    return purchases.filter(pur => {
      const dateVal = pur.invoiceDate || pur.createdAt;
      if (!dateVal) return false;
      const d = new Date(dateVal);
      return !isNaN(d.getTime()) && d >= filterRange.from && d <= filterRange.to;
    });
  }, [purchases, filterRange]);

  // Parse state name from Place of Supply string
  const getStateName = (pos) => {
    if (!pos) return 'Other Territory';
    const cleanPos = pos.split('-')[0].trim();
    return INDIAN_STATES[cleanPos] || pos.split('-')[1] || pos;
  };

  const getStateCode = (pos) => {
    if (!pos) return '';
    return pos.split('-')[0].trim();
  };

  // GSTR-1 Data Segregation
  const gstr1Data = useMemo(() => {
    const b2b = [];
    const b2cl = [];
    const b2cs = [];
    const exemp = [];
    const hsnB2b = {};
    const hsnB2c = {};
    const docs = [];
    
    const userStateCode = String(user?.stateCode || '').trim();

    filteredSales.forEach(inv => {
      const gst = String(inv.clientGst || '').trim();
      const hasGst = gst.length === 15;
      const posStateCode = getStateCode(inv.placeOfSupply) || inv.clientStateCode || '';
      const stateName = getStateName(inv.placeOfSupply) || inv.clientState || '';
      const formattedPos = posStateCode ? `${posStateCode}-${stateName}` : '';
      const isInterstate = posStateCode && userStateCode && posStateCode !== userStateCode;
      const totalVal = Number(inv.totalAmount || inv.amount || 0);
      const taxRate = Number(inv.gstRate || 0);

      // Exempt / Nil rated (0% GST)
      if (taxRate === 0) {
        exemp.push({
          invoiceNo: inv.invoiceNumber,
          date: inv.date || inv.createdAt,
          client: inv.clientName || 'Client',
          total: totalVal,
          pos: formattedPos
        });
      }

      // Main categorization
      if (hasGst) {
        // B2B
        b2b.push({
          gstin: gst,
          name: inv.clientName || 'Client',
          invoiceNo: inv.invoiceNumber,
          date: inv.date || inv.createdAt,
          total: totalVal,
          pos: formattedPos,
          reverseCharge: inv.reverseCharge ? 'Y' : 'N',
          taxableValue: Number(inv.amount || 0),
          rate: taxRate,
          igst: Number(inv.igst || 0),
          cgst: Number(inv.cgst || 0),
          sgst: Number(inv.sgst || 0)
        });
      } else if (isInterstate && totalVal > 250000) {
        // B2CL (Interstate, unregistered, value > 2.5L)
        b2cl.push({
          invoiceNo: inv.invoiceNumber,
          date: inv.date || inv.createdAt,
          total: totalVal,
          pos: formattedPos,
          rate: taxRate,
          taxableValue: Number(inv.amount || 0),
          igst: Number(inv.gstAmount || 0)
        });
      } else {
        // B2CS
        b2cs.push({
          pos: formattedPos || '27-Maharashtra',
          rate: taxRate,
          taxableValue: Number(inv.amount || 0),
          gstAmount: Number(inv.gstAmount || 0),
          total: totalVal
        });
      }

      // HSN items grouping
      const items = Array.isArray(inv.items) ? inv.items : [];
      items.forEach(item => {
        const hsn = String(item.hsnCode || item.hsn || '9983').trim();
        const qty = Number(item.quantity || 1);
        const taxable = Number(item.amount || item.price * qty || 0);
        const hsnRate = Number(item.gstRate || taxRate);
        const gstVal = Number(item.gstAmount || (taxable * hsnRate) / 100);

        const group = hasGst ? hsnB2b : hsnB2c;
        const key = `${hsn}_${hsnRate}`;
        if (!group[key]) {
          group[key] = {
            hsn,
            description: item.description || 'Services',
            uqc: 'OTH-OTHERS',
            qty: 0,
            totalValue: 0,
            taxableValue: 0,
            rate: hsnRate,
            igst: 0,
            cgst: 0,
            sgst: 0
          };
        }
        group[key].qty += qty;
        group[key].totalValue += taxable + gstVal;
        group[key].taxableValue += taxable;
        if (isInterstate) {
          group[key].igst += gstVal;
        } else {
          group[key].cgst += gstVal / 2;
          group[key].sgst += gstVal / 2;
        }
      });

      // Docs issued summary
      docs.push({
        docNo: inv.invoiceNumber,
        date: inv.date || inv.createdAt,
        status: 'Active'
      });
    });

    // Group B2CS by Pos + Rate
    const b2csGroups = {};
    b2cs.forEach(item => {
      const key = `${item.pos}_${item.rate}`;
      if (!b2csGroups[key]) {
        b2csGroups[key] = {
          type: 'OE',
          pos: item.pos,
          rate: item.rate,
          taxableValue: 0,
          cessAmount: 0,
          eCommerceGst: ''
        };
      }
      b2csGroups[key].taxableValue += item.taxableValue;
    });

    return {
      b2b,
      b2cl,
      b2cs: Object.values(b2csGroups),
      exemp,
      hsnB2b: Object.values(hsnB2b),
      hsnB2c: Object.values(hsnB2c),
      docs
    };
  }, [filteredSales, user?.stateCode]);

  // GSTR-2B Data Segregation (Purchases)
  const gstr2bData = useMemo(() => {
    const b2b = [];
    const itcEligible = [];
    const itcIneligible = [];

    const userStateCode = String(user?.stateCode || '').trim();

    filteredPurchases.forEach(pur => {
      const gst = String(pur.supplierGst || '').trim();
      const hasGst = gst.length === 15;
      const totalVal = Number(pur.total || 0);
      const taxVal = Number(pur.gstAmount || 0);
      
      const supplierStateCode = gst.substring(0, 2);
      const isInterstate = supplierStateCode && userStateCode && supplierStateCode !== userStateCode;

      let itemIgst = 0;
      let itemCgst = 0;
      let itemSgst = 0;

      if (isInterstate) {
        itemIgst = taxVal;
      } else {
        itemCgst = taxVal / 2;
        itemSgst = taxVal / 2;
      }

      const formattedRecord = {
        gstin: gst,
        supplierName: pur.supplierName || 'Supplier',
        invoiceNo: pur.invoiceNumber,
        date: pur.invoiceDate || pur.createdAt,
        total: totalVal,
        taxableValue: totalVal - taxVal,
        igst: itemIgst,
        cgst: itemCgst,
        sgst: itemSgst,
        itcEligibility: pur.itcEligibility || 'inputs'
      };

      if (hasGst) {
        b2b.push(formattedRecord);
      }

      if (pur.itcEligibility === 'ineligible') {
        itcIneligible.push(formattedRecord);
      } else {
        itcEligible.push(formattedRecord);
      }
    });

    return {
      b2b,
      itcEligible,
      itcIneligible
    };
  }, [filteredPurchases, user?.stateCode]);

  // DB Prep Audit Warnings
  const auditWarnings = useMemo(() => {
    const warnings = [];
    
    // Check sales invoices
    filteredSales.forEach(inv => {
      if (!inv.placeOfSupply && !inv.clientStateCode) {
        warnings.push({
          id: `pos-${inv.id}`,
          type: 'POS',
          message: `Sales Invoice #${inv.invoiceNumber} is missing Place of Supply state code.`,
          fix: 'Please add client state/pincode to correct tax destinations.',
          docId: inv.id
        });
      }
      
      const hasGst = inv.clientGst && String(inv.clientGst).trim().length > 0;
      const isIndicatedB2B = inv.clientName && (
        inv.clientName.toLowerCase().includes('ltd') || 
        inv.clientName.toLowerCase().includes('pvt') || 
        inv.clientName.toLowerCase().includes('llp') || 
        inv.clientName.toLowerCase().includes('corp') ||
        inv.clientName.toLowerCase().includes('designs') ||
        inv.clientName.toLowerCase().includes('enterprise') ||
        inv.clientName.toLowerCase().includes('solutions')
      );
      if (isIndicatedB2B && !hasGst) {
        warnings.push({
          id: `gst-${inv.id}`,
          type: 'GST',
          message: `Invoice #${inv.invoiceNumber} is issued to '${inv.clientName}', which looks like a company but has no GSTIN.`,
          fix: 'Verify if this should be filed under B2B (needs client GSTIN) or B2C (no action required).',
          docId: inv.id
        });
      }
      
      const items = Array.isArray(inv.items) ? inv.items : [];
      items.forEach(item => {
        if (!item.hsnCode && !item.hsn) {
          warnings.push({
            id: `hsn-${inv.id}-${item.productId || item.description}`,
            type: 'HSN',
            message: `Product '${item.description}' in Invoice #${inv.invoiceNumber} is missing an HSN/SAC code.`,
            fix: 'Add HSN/SAC code on product detail/invoice item to prevent GSTR-1 schema errors.',
            docId: inv.id
          });
        }
      });
    });

    // Check purchases
    filteredPurchases.forEach(pur => {
      if (!pur.itcEligibility) {
        warnings.push({
          id: `itc-${pur.id}`,
          type: 'ITC',
          message: `Purchase Invoice #${pur.invoiceNumber} from '${pur.supplierName}' is missing ITC Eligibility categorization.`,
          fix: 'Select whether this is Inputs, Capital Goods, Input Services, or Blocked (Ineligible) credit.',
          docId: pur.id
        });
      }
    });

    return warnings;
  }, [filteredSales, filteredPurchases]);

  // GSTR-3B Calculations
  const gstr3bCalculations = useMemo(() => {
    // Table 3.1
    let t31Taxable = 0;
    let t31Igst = 0;
    let t31Cgst = 0;
    let t31Sgst = 0;

    filteredSales.forEach(inv => {
      t31Taxable += Number(inv.amount || 0);
      t31Igst += Number(inv.igst || 0);
      t31Cgst += Number(inv.cgst || 0);
      t31Sgst += Number(inv.sgst || 0);
    });

    // Table 3.2 (Interstate unregistered supplies)
    let t32Taxable = 0;
    let t32Igst = 0;
    const userStateCode = String(user?.stateCode || '').trim();

    filteredSales.forEach(inv => {
      const gst = String(inv.clientGst || '').trim();
      const hasGst = gst.length === 15;
      const posStateCode = getStateCode(inv.placeOfSupply) || inv.clientStateCode || '';
      const isInterstate = posStateCode && userStateCode && posStateCode !== userStateCode;

      if (!hasGst && isInterstate) {
        t32Taxable += Number(inv.amount || 0);
        t32Igst += Number(inv.igst || inv.gstAmount || 0);
      }
    });

    // Table 4 ITC sums
    const itc = {
      inputs: { igst: 0, cgst: 0, sgst: 0 },
      capital_goods: { igst: 0, cgst: 0, sgst: 0 },
      input_services: { igst: 0, cgst: 0, sgst: 0 },
      ineligible: { igst: 0, cgst: 0, sgst: 0 }
    };

    filteredPurchases.forEach(pur => {
      const eligibility = pur.itcEligibility || 'inputs';
      const totalTax = Number(pur.gstAmount || 0);
      
      let itemIgst = 0;
      let itemCgst = 0;
      let itemSgst = 0;

      const supplierGst = String(pur.supplierGst || '').trim();
      const supplierStateCode = supplierGst.length >= 2 ? supplierGst.substring(0, 2) : '';

      if (supplierStateCode && userStateCode && supplierStateCode !== userStateCode) {
        itemIgst = totalTax;
      } else {
        itemCgst = totalTax / 2;
        itemSgst = totalTax / 2;
      }

      if (itc[eligibility]) {
        itc[eligibility].igst += itemIgst;
        itc[eligibility].cgst += itemCgst;
        itc[eligibility].sgst += itemSgst;
      }
    });

    return {
      t31: { taxable: t31Taxable, igst: t31Igst, cgst: t31Cgst, sgst: t31Sgst },
      t32: { taxable: t32Taxable, igst: t32Igst },
      itc
    };
  }, [filteredSales, filteredPurchases, user?.stateCode]);

  // Current selected month status
  const currentMonthFiling = useMemo(() => {
    return filingStatus.find(s => s.filingMonth === selectedMonth) || null;
  }, [filingStatus, selectedMonth]);

  // Save Filing status
  const handleSaveFiling = async (e) => {
    e.preventDefault();
    if (!arnInput.trim()) {
      alert('Please enter a valid Acknowledgement Reference Number (ARN)');
      return;
    }
    setSubmittingArn(true);
    try {
      const res = await authFetch('/api/gst/filing-status', {
        method: 'POST',
        body: JSON.stringify({
          filingMonth: selectedMonth,
          arn: arnInput,
          status: 'filed'
        })
      });
      if (res.ok) {
        alert('Month successfully marked as FILED!');
        fetchFilingStatus();
        setArnInput('');
        handleToggleStep(13);
      } else {
        const data = await res.json();
        alert('Failed: ' + data.error);
      }
    } catch (err) {
      console.error(err);
      alert('Network error saving filing tracker');
    } finally {
      setSubmittingArn(false);
    }
  };

  const handleResetFiling = async () => {
    if (!window.confirm('Reset filing status? This will delete the saved ARN.')) return;
    try {
      const res = await authFetch('/api/gst/filing-status', {
        method: 'POST',
        body: JSON.stringify({
          filingMonth: selectedMonth,
          arn: '',
          status: 'pending'
        })
      });
      if (res.ok) {
        fetchFilingStatus();
        const nextSteps = { ...checkedSteps, [13]: false };
        setCheckedSteps(nextSteps);
        if (selectedMonth && user?.id) {
          localStorage.setItem(`gst_steps_${user.id}_${selectedMonth}`, JSON.stringify(nextSteps));
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  // CSV Exporters
  const handleExportB2B = () => {
    const headers = [
      "GSTIN/UIN of Recipient",
      "Receiver Name",
      "Invoice Number",
      "Invoice Date",
      "Invoice Value",
      "Place Of Supply",
      "Reverse Charge",
      "Applicable % of Tax Rate",
      "Invoice Type",
      "E-Commerce GSTIN",
      "Rate",
      "Taxable Value",
      "Cess Amount"
    ];

    const formatDateForGstr = (dStr) => {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return '';
      const day = String(d.getDate()).padStart(2, '0');
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${day}-${months[d.getMonth()]}-${d.getFullYear()}`;
    };

    const rows = gstr1Data.b2b.map(item => [
      item.gstin,
      item.name,
      item.invoiceNo,
      formatDateForGstr(item.date),
      item.total.toFixed(2),
      item.pos,
      item.reverseCharge,
      "",
      "Regular",
      "",
      item.rate,
      item.taxableValue.toFixed(2),
      "0.00"
    ]);

    downloadCSV(`GSTR1_B2B_${selectedMonth}.csv`, headers, rows);
  };

  const handleExportB2CS = () => {
    const headers = [
      "Type",
      "Place Of Supply",
      "Rate",
      "Taxable Value",
      "Cess Amount",
      "E-Commerce GSTIN"
    ];

    const rows = gstr1Data.b2cs.map(item => [
      "OE",
      item.pos,
      item.rate,
      item.taxableValue.toFixed(2),
      "0.00",
      ""
    ]);

    downloadCSV(`GSTR1_B2CS_${selectedMonth}.csv`, headers, rows);
  };

  const downloadCSV = (filename, headers, rows) => {
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => {
        if (val === null || val === undefined) return '';
        const strVal = String(val);
        if (strVal.includes(',') || strVal.includes('"') || strVal.includes('\n')) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      }).join(','))
    ].join('\r\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Styled Subtab renderer helper
  const renderSubTabs = (tabsList, currentVal, setter) => {
    return (
      <div style={{ borderBottom: '1px solid #e5e7eb', display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 20 }}>
        {tabsList.map(tab => {
          const isActive = currentVal === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setter(tab.value)}
              style={isActive ? {
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderBottom: '1px solid #fff',
                color: '#1f2937',
                fontWeight: 600,
                fontSize: 13,
                padding: '10px 18px',
                borderRadius: '6px 6px 0 0',
                marginBottom: -1,
                cursor: 'pointer',
                outline: 'none'
              } : {
                background: 'transparent',
                border: 'none',
                color: '#00b584',
                padding: '10px 18px',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
                outline: 'none'
              }}
            >
              {tab.label} {tab.count !== undefined && `(${tab.count})`}
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="screen active" style={{ paddingBottom: 60 }}>
      
      {/* Portal GSTR1 Alert Update Banner */}
      <div style={{ display: 'flex', gap: 16, border: '1px solid #fca5a5', background: '#fff', borderRadius: 8, padding: '16px 20px', marginBottom: 24, alignItems: 'flex-start' }}>
        <div style={{ background: '#fee2e2', borderRadius: '50%', padding: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <AlertCircle size={20} style={{ color: '#ef4444' }} />
        </div>
        <div>
          <h4 style={{ margin: 0, color: '#111827', fontSize: 14, fontWeight: 700 }}>GSTR1 Update!</h4>
          <p style={{ margin: '4px 0 0', color: '#4b5563', fontSize: 13, lineHeight: 1.4 }}>
            Please update your GST Offline Tool to the latest version to support the new GSTR-1 format.
          </p>
        </div>
      </div>

      {/* Header Panel */}
      <div className="section-header" style={{ flexWrap: 'wrap', gap: 15, marginBottom: 20 }}>
        <div>
          <div className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShieldCheck size={22} style={{ color: '#00b584' }} />
            GST Filing Assistant
          </div>
          <div className="section-sub">Government portal reporting layouts, warnings checklist, and filing status validation.</div>
        </div>
        
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink2)' }}>Filing Month:</span>
          <select 
            value={selectedMonth} 
            onChange={(e) => setSelectedMonth(e.target.value)}
            style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '8px 16px', fontSize: 14, fontWeight: 600, color: 'var(--ink)', background: '#fff', cursor: 'pointer', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.02)' }}
          >
            {availableMonths.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tax Period Search Widget (Mockup Style) */}
      <div className="card" style={{ padding: 24, marginBottom: 24, border: '1px solid var(--border)', background: '#fff' }}>
        <h4 style={{ margin: '0 0 16px', color: '#374151', fontSize: 14, fontWeight: 700 }}>Tax Period</h4>
        <form onSubmit={handleSearchRange} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 16 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>From Date *</label>
            <input 
              type="date" 
              value={fromDateInput} 
              onChange={(e) => setFromDateInput(e.target.value)} 
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 14px', fontSize: 13, outline: 'none', background: '#fff', color: '#1f2937' }} 
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 200, flex: 1 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#4b5563' }}>To Date *</label>
            <input 
              type="date" 
              value={toDateInput} 
              onChange={(e) => setToDateInput(e.target.value)} 
              style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '10px 14px', fontSize: 13, outline: 'none', background: '#fff', color: '#1f2937' }} 
            />
          </div>
          <button 
            type="submit" 
            style={{ 
              background: '#00b584', 
              color: '#fff', 
              border: 'none', 
              borderRadius: 6, 
              padding: '10px 24px', 
              fontSize: 14, 
              fontWeight: 600, 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center', 
              gap: 8, 
              height: 41, 
              boxShadow: '0 2px 4px rgba(0,181,132,0.15)',
              transition: 'background 0.2s'
            }}
          >
            <Search size={16} /> Search
          </button>
        </form>
        {filterRange.from && filterRange.to && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: '#6b7280', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Calendar size={14} /> Active reporting period: <strong style={{ color: '#374151' }}>{displayFormattedDate(filterRange.from)}</strong> to <strong style={{ color: '#374151' }}>{displayFormattedDate(filterRange.to)}</strong>
          </div>
        )}
      </div>

      {/* Main Tab Options */}
      <div className="tabs-nav" style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: 24, gap: 20, flexWrap: 'wrap' }}>
        {[
          { id: 'overview', label: 'Overview & Guide' },
          { id: 'dbprep', label: `Database Audit (${auditWarnings.length})` },
          { id: 'gstr1', label: 'GSTR-1 (Sales)' },
          { id: 'gstr2b', label: 'GSTR-2B (Purchases / ITC)' },
          { id: 'gstr3b', label: 'GSTR-3B (Filing Summary)' },
          { id: 'filing', label: 'Filing Tracker' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #00b584' : '2px solid transparent',
              color: activeTab === tab.id ? '#00b584' : 'var(--ink3)',
              fontWeight: 600,
              fontSize: 14,
              padding: '10px 4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              outline: 'none'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* -------------------- 1. OVERVIEW & TIMELINE GUIDE -------------------- */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 24, background: 'linear-gradient(to right, #0F6E56, #00b584)', color: '#fff', border: 'none' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Filing Process Progress</h3>
              <p style={{ margin: '4px 0 0', opacity: 0.8, fontSize: 13 }}>Follow the weekly checkpoints to ensure complete compliance.</p>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
                <div style={{ flex: 1, background: 'rgba(255,255,255,0.2)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: `${completionPercent}%`, height: '100%', background: '#fff', borderRadius: 4, transition: 'width 0.4s ease' }}></div>
                </div>
                <span style={{ fontWeight: 700, fontSize: 14 }}>{completionPercent}%</span>
              </div>
            </div>
            <div style={{ textAlign: 'right', paddingLeft: 30 }}>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{completedCount}/13</div>
              <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', opacity: 0.8 }}>Steps Checked</div>
            </div>
          </div>

          <div className="timeline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {TIMELINE_STEPS.map((w, wIdx) => (
              <div key={w.week} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', minHeight: 320, background: '#fff' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', background: 'rgba(0,181,132,0.1)', color: '#00b584', padding: '3px 8px', borderRadius: 4 }}>{w.week}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink)' }}>{w.title}</span>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
                  {w.steps.map(step => {
                    const isChecked = !!checkedSteps[step.id];
                    return (
                      <label 
                        key={step.id} 
                        style={{ 
                          display: 'flex', 
                          gap: 10, 
                          fontSize: 12.5, 
                          color: isChecked ? 'var(--ink3)' : 'var(--ink)', 
                          cursor: 'pointer', 
                          textDecoration: isChecked ? 'line-through' : 'none',
                          alignItems: 'flex-start',
                          padding: '4px 0'
                        }}
                      >
                        <input 
                          type="checkbox" 
                          checked={isChecked} 
                          onChange={() => handleToggleStep(step.id)} 
                          style={{ accentColor: '#00b584', width: 15, height: 15, marginTop: 1.5, flexShrink: 0 }}
                        />
                        <span>
                          <strong style={{ marginRight: 4, color: isChecked ? 'var(--ink3)' : '#00b584' }}>Step {step.id}:</strong>
                          {step.text}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* -------------------- 2. DATABASE PREPARATION & AUDIT -------------------- */}
      {activeTab === 'dbprep' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="card" style={{ padding: 16, background: '#f9fafb', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <Info size={16} style={{ color: '#00b584' }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>Why run an audit?</span>
            </div>
            <p style={{ margin: '6px 0 0', fontSize: 12, color: 'var(--ink2)', lineHeight: 1.5 }}>
              The GST portal offline validator performs strict schema checks. Blank state codes, missing HSN codes on sold products, or unclassified purchases will cause the portal to reject your exported sheets. Check all errors below before exporting GSTR-1.
            </p>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#fff', border: '1px solid var(--border)' }}>
            <div style={{ background: '#fdfdfd', padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink)' }}>Validation Warnings ({auditWarnings.length})</span>
              <span style={{ fontSize: 11, fontWeight: 600, background: auditWarnings.length === 0 ? 'rgba(0,181,132,0.1)' : '#fee2e2', color: auditWarnings.length === 0 ? '#00b584' : '#b91c1c', padding: '3px 8px', borderRadius: 4 }}>
                {auditWarnings.length === 0 ? 'All Cleared' : 'Needs Correction'}
              </span>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {auditWarnings.map((warn, i) => (
                <div 
                  key={warn.id} 
                  style={{ 
                    padding: '16px 20px', 
                    borderBottom: i === auditWarnings.length - 1 ? 'none' : '1px solid var(--border2)', 
                    display: 'flex', 
                    gap: 12, 
                    alignItems: 'flex-start' 
                  }}
                >
                  <AlertTriangle size={18} style={{ color: '#d97706', flexShrink: 0, marginTop: 2 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{warn.message}</div>
                    <div style={{ fontSize: 12, color: 'var(--ink2)', marginTop: 4 }}>💡 <strong>Resolution:</strong> {warn.fix}</div>
                  </div>
                  <div style={{ fontSize: 11, background: '#f3f4f6', color: '#4b5563', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>
                    {warn.type}
                  </div>
                </div>
              ))}
              
              {auditWarnings.length === 0 && (
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)' }}>
                  <CheckCircle size={40} style={{ color: '#00b584', margin: '0 auto 12px', display: 'block' }} />
                  <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>No warnings found for this reporting period!</p>
                  <p style={{ margin: '4px 0 0', fontSize: 12 }}>All invoices and purchases have required tax codes, GSTINs, and eligibility classifications.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* -------------------- 3. GSTR-1 SALES REPORT -------------------- */}
      {activeTab === 'gstr1' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 15 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>GSTR-1 - Outward Supplies Report</h3>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink3)' }}>Consolidated CSV formats matching the portal offline tool schemas.</p>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button 
                onClick={handleExportB2B} 
                disabled={gstr1Data.b2b.length === 0}
                className="btn btn-ghost" 
                style={{ gap: 6, display: 'flex', alignItems: 'center', background: 'var(--border2)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, borderRadius: 8, fontWeight: 600, cursor: gstr1Data.b2b.length === 0 ? 'not-allowed' : 'pointer', opacity: gstr1Data.b2b.length === 0 ? 0.5 : 1 }}
              >
                <Download size={14} /> Export B2B CSV
              </button>
              <button 
                onClick={handleExportB2CS} 
                disabled={gstr1Data.b2cs.length === 0}
                className="btn btn-ghost" 
                style={{ gap: 6, display: 'flex', alignItems: 'center', background: 'var(--border2)', border: '1px solid var(--border)', padding: '8px 12px', fontSize: 12, borderRadius: 8, fontWeight: 600, cursor: gstr1Data.b2cs.length === 0 ? 'not-allowed' : 'pointer', opacity: gstr1Data.b2cs.length === 0 ? 0.5 : 1 }}
              >
                <Download size={14} /> Export B2CS CSV
              </button>
            </div>
          </div>

          {/* Rendering the GSTR-1 Subtabs list */}
          {renderSubTabs([
            { value: 'B2B', label: 'B2B', count: gstr1Data.b2b.length },
            { value: 'B2CL', label: 'B2CL', count: gstr1Data.b2cl.length },
            { value: 'B2CS', label: 'B2CS', count: gstr1Data.b2cs.length },
            { value: 'CDNR', label: 'CDNR', count: 0 },
            { value: 'CDNUR', label: 'CDNUR', count: 0 },
            { value: 'EXP', label: 'EXP', count: 0 },
            { value: 'AT', label: 'AT', count: 0 },
            { value: 'ATADJ', label: 'ATADJ', count: 0 },
            { value: 'EXEMP', label: 'EXEMP', count: gstr1Data.exemp.length },
            { value: 'HSN(B2B)', label: 'HSN(B2B)', count: gstr1Data.hsnB2b.length },
            { value: 'HSN(B2C)', label: 'HSN(B2C)', count: gstr1Data.hsnB2c.length },
            { value: 'DOCS', label: 'DOCS', count: gstr1Data.docs.length }
          ], gstr1SubTab, setGstr1SubTab)}

          {/* Subtab Contents */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#fff', border: '1px solid var(--border)' }}>
            
            {/* B2B Table */}
            {gstr1SubTab === 'B2B' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>GSTIN / UIN</th>
                      <th>Receiver Name</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Tax Split</th>
                      <th style={{ textAlign: 'right' }}>Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.b2b.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{item.gstin}</td>
                        <td>{item.name}</td>
                        <td style={{ fontFamily: 'monospace' }}>{item.invoiceNo}</td>
                        <td>{displayFormattedDate(item.date)}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'center' }}>{item.rate}%</td>
                        <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>
                          {item.igst > 0 && `IGST: ₹${item.igst}`}
                          {item.cgst > 0 && `CGST: ₹${item.cgst} + SGST: ₹${item.sgst}`}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#00b584' }}>₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {gstr1Data.b2b.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No B2B invoices found in this reporting range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* B2CL Table */}
            {gstr1SubTab === 'B2CL' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Place of Supply</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'right' }}>IGST Amount</th>
                      <th style={{ textAlign: 'right' }}>Invoice Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.b2cl.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 500 }}>{item.invoiceNo}</td>
                        <td>{displayFormattedDate(item.date)}</td>
                        <td>{item.pos}</td>
                        <td style={{ textAlign: 'center' }}>{item.rate}%</td>
                        <td style={{ textAlign: 'right' }}>₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₹{item.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {gstr1Data.b2cl.length === 0 && (
                      <tr>
                        <td colSpan="7" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No B2C Large invoices found (interstate sales to unregistered users &gt; ₹2.5 Lakhs).
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* B2CS Table */}
            {gstr1SubTab === 'B2CS' && (
              <div>
                <div style={{ padding: '12px 20px', background: '#fffbeb', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Info size={14} style={{ color: '#d97706', flexShrink: 0 }} />
                  <span style={{ fontSize: 11.5, color: '#92400e', lineHeight: 1.4 }}>
                    ⚠️ Invoices are grouped by **Place of Supply + GST Rate** and consolidated into single sums.
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Type</th>
                        <th>Place Of Supply (State)</th>
                        <th style={{ textAlign: 'center' }}>Rate</th>
                        <th style={{ textAlign: 'right' }}>Consolidated Taxable Value</th>
                        <th style={{ textAlign: 'right' }}>Cess Amount</th>
                        <th>E-Commerce GSTIN</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1Data.b2cs.map((item, idx) => (
                        <tr key={idx}>
                          <td style={{ fontWeight: 600 }}>{item.type}</td>
                          <td>{item.pos}</td>
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>{item.rate}%</td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                          <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                          <td style={{ color: 'var(--ink3)', fontStyle: 'italic' }}>None</td>
                        </tr>
                      ))}
                      {gstr1Data.b2cs.length === 0 && (
                        <tr>
                          <td colSpan="6" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                            No B2C Small invoices found in this reporting range.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* EXEMP Table */}
            {gstr1SubTab === 'EXEMP' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Client Name</th>
                      <th>Place of Supply</th>
                      <th style={{ textAlign: 'right' }}>Exempted Taxable Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.exemp.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontFamily: 'monospace' }}>{item.invoiceNo}</td>
                        <td>{displayFormattedDate(item.date)}</td>
                        <td>{item.client}</td>
                        <td>{item.pos}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{item.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {gstr1Data.exemp.length === 0 && (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No zero-rated or tax-exempt sales found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* HSN B2B */}
            {gstr1SubTab === 'HSN(B2B)' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>HSN / SAC</th>
                      <th>Description</th>
                      <th>Unit (UQC)</th>
                      <th style={{ textAlign: 'center' }}>Total Qty</th>
                      <th style={{ textAlign: 'right' }}>Total Value</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Tax Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.hsnB2b.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.hsn}</td>
                        <td>{item.description}</td>
                        <td>{item.uqc}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'center' }}>{item.rate}%</td>
                        <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>
                          {item.igst > 0 && `IGST: ₹${item.igst.toFixed(2)}`}
                          {item.cgst > 0 && `CGST: ₹${item.cgst.toFixed(2)} + SGST: ₹${item.sgst.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                    {gstr1Data.hsnB2b.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No B2B HSN data summaries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* HSN B2C */}
            {gstr1SubTab === 'HSN(B2C)' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>HSN / SAC</th>
                      <th>Description</th>
                      <th>Unit (UQC)</th>
                      <th style={{ textAlign: 'center' }}>Total Qty</th>
                      <th style={{ textAlign: 'right' }}>Total Value</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'center' }}>Rate</th>
                      <th style={{ textAlign: 'right' }}>Tax Split</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr1Data.hsnB2c.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600 }}>{item.hsn}</td>
                        <td>{item.description}</td>
                        <td>{item.uqc}</td>
                        <td style={{ textAlign: 'center' }}>{item.qty}</td>
                        <td style={{ textAlign: 'right' }}>₹{item.totalValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{item.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'center' }}>{item.rate}%</td>
                        <td style={{ textAlign: 'right', fontSize: 11, color: 'var(--ink3)' }}>
                          {item.igst > 0 && `IGST: ₹${item.igst.toFixed(2)}`}
                          {item.cgst > 0 && `CGST: ₹${item.cgst.toFixed(2)} + SGST: ₹${item.sgst.toFixed(2)}`}
                        </td>
                      </tr>
                    ))}
                    {gstr1Data.hsnB2c.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No B2C HSN data summaries found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* DOCS Table */}
            {gstr1SubTab === 'DOCS' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, padding: 20, background: '#f9fafb', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', fontWeight: 600 }}>Total Invoices Issued</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--ink)', marginTop: 4 }}>{gstr1Data.docs.length}</div>
                  </div>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', fontWeight: 600 }}>Cancelled Invoices</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', marginTop: 4 }}>0</div>
                  </div>
                  <div style={{ background: '#fff', padding: 12, borderRadius: 6, border: '1px solid var(--border2)' }}>
                    <div style={{ fontSize: 11, color: 'var(--ink3)', textTransform: 'uppercase', fontWeight: 600 }}>Net Reported Documents</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#00b584', marginTop: 4 }}>{gstr1Data.docs.length}</div>
                  </div>
                </div>
                
                <div style={{ overflowX: 'auto' }}>
                  <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Document No (Series range)</th>
                        <th>Issue Date</th>
                        <th>Nature of Document</th>
                        <th>Action Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gstr1Data.docs.map((doc, idx) => (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{doc.docNo}</td>
                          <td>{displayFormattedDate(doc.date)}</td>
                          <td>Outward Invoice</td>
                          <td><span style={{ fontSize: 11, background: 'rgba(0,181,132,0.1)', color: '#00b584', padding: '3px 8px', borderRadius: 4, fontWeight: 600 }}>{doc.status}</span></td>
                        </tr>
                      ))}
                      {gstr1Data.docs.length === 0 && (
                        <tr>
                          <td colSpan="4" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                            No documents issued.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Empty/Mock portal subtabs */}
            {['CDNR', 'CDNUR', 'EXP', 'AT', 'ATADJ'].includes(gstr1SubTab) && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)' }}>
                <FileText size={40} style={{ color: 'var(--ink3)', margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>No items found in {gstr1SubTab} section</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>No relevant data triggers were active in the selected tax period range.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* -------------------- 4. GSTR-2B REPORT (AUTO-DRAFTED ITC) -------------------- */}
      {activeTab === 'gstr2b' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>GSTR-2B - Auto-Drafted Input Tax Credit Statement</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink3)' }}>Cross-referenced details of purchase invoices matching GSTR-1 filings of your suppliers.</p>
          </div>

          {/* GSTR-2B Subtabs */}
          {renderSubTabs([
            { value: 'B2B', label: 'B2B Purchases', count: gstr2bData.b2b.length },
            { value: 'B2B-CDNR', label: 'Credit/Debit Notes', count: 0 },
            { value: 'IMPS', label: 'Import Services', count: 0 },
            { value: 'ISD', label: 'ISD Credit', count: 0 },
            { value: 'ITC-Eligible', label: 'ITC Eligible Credit', count: gstr2bData.itcEligible.length },
            { value: 'ITC-Ineligible', label: 'ITC Ineligible Credit', count: gstr2bData.itcIneligible.length }
          ], gstr2bSubTab, setGstr2bSubTab)}

          {/* Subtab tables */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#fff', border: '1px solid var(--border)' }}>
            
            {/* B2B Purchases */}
            {gstr2bSubTab === 'B2B' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Supplier GSTIN</th>
                      <th>Supplier Name</th>
                      <th>Invoice Number</th>
                      <th>Invoice Date</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'right' }}>IGST</th>
                      <th style={{ textAlign: 'right' }}>CGST</th>
                      <th style={{ textAlign: 'right' }}>SGST</th>
                      <th>ITC Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr2bData.b2b.map((pur, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 600, fontSize: 12 }}>{pur.gstin}</td>
                        <td>{pur.supplierName}</td>
                        <td style={{ fontFamily: 'monospace' }}>{pur.invoiceNo}</td>
                        <td>{displayFormattedDate(pur.date)}</td>
                        <td style={{ textAlign: 'right' }}>₹{pur.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₹{pur.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#701a75' }}>₹{pur.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#701a75' }}>₹{pur.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td>
                          <span style={{ 
                            fontSize: 11, 
                            background: pur.itcEligibility === 'ineligible' ? '#fee2e2' : 'rgba(0,181,132,0.1)', 
                            color: pur.itcEligibility === 'ineligible' ? '#b91c1c' : '#00b584', 
                            padding: '3px 8px', 
                            borderRadius: 4, 
                            fontWeight: 600 
                          }}>
                            {pur.itcEligibility === 'ineligible' ? 'Ineligible' : 'Eligible'}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {gstr2bData.b2b.length === 0 && (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No GSTR-2B B2B purchase records found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ITC Eligible credit */}
            {gstr2bSubTab === 'ITC-Eligible' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>ITC Categorization</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'right' }}>IGST Available</th>
                      <th style={{ textAlign: 'right' }}>CGST Available</th>
                      <th style={{ textAlign: 'right' }}>SGST Available</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr2bData.itcEligible.map((pur, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{pur.supplierName}</td>
                        <td style={{ fontFamily: 'monospace' }}>{pur.invoiceNo}</td>
                        <td>{displayFormattedDate(pur.date)}</td>
                        <td style={{ textTransform: 'capitalize', fontWeight: 600, color: '#00b584' }}>
                          {pur.itcEligibility.replace('_', ' ')}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{pur.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#1e3a8a' }}>₹{pur.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#701a75' }}>₹{pur.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#701a75' }}>₹{pur.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {gstr2bData.itcEligible.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No eligible purchase credits found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ITC Ineligible credit */}
            {gstr2bSubTab === 'ITC-Ineligible' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Supplier Name</th>
                      <th>Invoice No</th>
                      <th>Date</th>
                      <th>Blocked Reason</th>
                      <th style={{ textAlign: 'right' }}>Taxable Value</th>
                      <th style={{ textAlign: 'right' }}>IGST Blocked</th>
                      <th style={{ textAlign: 'right' }}>CGST Blocked</th>
                      <th style={{ textAlign: 'right' }}>SGST Blocked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gstr2bData.itcIneligible.map((pur, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 500 }}>{pur.supplierName}</td>
                        <td style={{ fontFamily: 'monospace' }}>{pur.invoiceNo}</td>
                        <td>{displayFormattedDate(pur.date)}</td>
                        <td style={{ color: '#ef4444', fontWeight: 600 }}>Section 17(5)</td>
                        <td style={{ textAlign: 'right' }}>₹{pur.taxableValue.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{pur.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{pur.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{pur.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    {gstr2bData.itcIneligible.length === 0 && (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                          No blocked/ineligible purchase credits found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Empty placeholders */}
            {['B2B-CDNR', 'IMPS', 'ISD'].includes(gstr2bSubTab) && (
              <div style={{ padding: 40, textAlign: 'center', color: 'var(--ink3)' }}>
                <HelpCircle size={40} style={{ color: 'var(--ink3)', margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>No filings reported in {gstr2bSubTab}</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>None of your GST suppliers declared items in this category during the selected period.</p>
              </div>
            )}

          </div>
        </div>
      )}

      {/* -------------------- 5. GSTR-3B FILING SUMMARY -------------------- */}
      {activeTab === 'gstr3b' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>GSTR-3B - Monthly Consolidated Summary Report</h3>
            <p style={{ margin: '2px 0 0', fontSize: 12, color: 'var(--ink3)' }}>Consolidated values showing outward tax liabilities and net eligible input tax credits.</p>
          </div>

          {/* GSTR-3B Subtabs */}
          {renderSubTabs([
            { value: 't31', label: 'Table 3.1 Outward Taxable' },
            { value: 't32', label: 'Table 3.2 Interstate B2C' },
            { value: 't4', label: 'Table 4 Eligible ITC' },
            { value: 't5', label: 'Table 5 Exempt Inward' },
            { value: 't6', label: 'Table 6 Payments Ledger' }
          ], gstr3bSubTab, setGstr3bSubTab)}

          {/* Subtab details */}
          <div className="card" style={{ padding: 0, overflow: 'hidden', background: '#fff', border: '1px solid var(--border)' }}>
            
            {/* Table 3.1 */}
            {gstr3bSubTab === 't31' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Nature of Outward Supplies</th>
                      <th style={{ textAlign: 'right' }}>Total Taxable Value</th>
                      <th style={{ textAlign: 'right' }}>IGST Liability</th>
                      <th style={{ textAlign: 'right' }}>CGST Liability</th>
                      <th style={{ textAlign: 'right' }}>SGST Liability</th>
                      <th style={{ textAlign: 'right' }}>Cess</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td style={{ fontWeight: 600 }}>(a) Outward taxable supplies (other than zero rated, nil rated and exempted)</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{gstr3bCalculations.t31.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#1e3a8a', fontWeight: 500 }}>₹{gstr3bCalculations.t31.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#701a75', fontWeight: 500 }}>₹{gstr3bCalculations.t31.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#701a75', fontWeight: 500 }}>₹{gstr3bCalculations.t31.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                    <tr>
                      <td>(b) Outward taxable supplies (zero rated)</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                    <tr>
                      <td>(c) Other outward supplies (nil rated, exempted)</td>
                      <td style={{ textAlign: 'right' }}>₹{gstr1Data.exemp.reduce((sum, e) => sum + e.total, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 3.2 */}
            {gstr3bSubTab === 't32' && (
              <div>
                <div style={{ padding: '12px 20px', background: '#f9fafb', borderBottom: '1px solid var(--border)', fontSize: 12, color: 'var(--ink2)' }}>
                  Inter-State supplies made to unregistered persons (out of Table 3.1(a) above).
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Place of Supply (State Code)</th>
                        <th style={{ textAlign: 'right' }}>Total Taxable Value</th>
                        <th style={{ textAlign: 'right' }}>IGST Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td style={{ fontWeight: 600 }}>All Interstate Unregistered (Total Consolidated)</td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>₹{gstr3bCalculations.t32.taxable.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#1e3a8a', fontWeight: 600 }}>₹{gstr3bCalculations.t32.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      </tr>
                      {gstr3bCalculations.t32.taxable === 0 && (
                        <tr>
                          <td colSpan="3" style={{ textAlign: 'center', padding: 32, color: 'var(--ink3)', fontStyle: 'italic' }}>
                            No interstate unregistered supplies recorded.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Table 4 Eligible ITC */}
            {gstr3bSubTab === 't4' && (
              <div style={{ overflowX: 'auto' }}>
                <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>ITC Category (Purchases Classification)</th>
                      <th style={{ textAlign: 'right' }}>Integrated Tax (IGST)</th>
                      <th style={{ textAlign: 'right' }}>Central Tax (CGST)</th>
                      <th style={{ textAlign: 'right' }}>State/UT Tax (SGST)</th>
                      <th style={{ textAlign: 'right' }}>Cess</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>(A) 1. Import of Goods</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right' }}>--</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                    <tr>
                      <td>(A) 3. Inward supplies liable to reverse charge</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right' }}>₹0.00</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                    <tr>
                      <td style={{ fontWeight: 600 }}>(A) 5. All other ITC (Inputs, Services, Assets)</td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#1e3a8a' }}>
                        ₹{(gstr3bCalculations.itc.inputs.igst + gstr3bCalculations.itc.capital_goods.igst + gstr3bCalculations.itc.input_services.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#701a75' }}>
                        ₹{(gstr3bCalculations.itc.inputs.cgst + gstr3bCalculations.itc.capital_goods.cgst + gstr3bCalculations.itc.input_services.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#701a75' }}>
                        ₹{(gstr3bCalculations.itc.inputs.sgst + gstr3bCalculations.itc.capital_goods.sgst + gstr3bCalculations.itc.input_services.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                    <tr style={{ background: '#fef2f2' }}>
                      <td style={{ color: '#ef4444' }}>(D) Ineligible ITC / Blocked Credit (Section 17(5))</td>
                      <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{gstr3bCalculations.itc.ineligible.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{gstr3bCalculations.itc.ineligible.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: '#991b1b' }}>₹{gstr3bCalculations.itc.ineligible.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                      <td style={{ textAlign: 'right', color: 'var(--ink3)' }}>₹0.00</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Table 5 */}
            {gstr3bSubTab === 't5' && (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--ink3)' }}>
                <HelpCircle size={40} style={{ color: 'var(--ink3)', margin: '0 auto 12px', display: 'block', opacity: 0.5 }} />
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: 'var(--ink)' }}>Table 5 - Exempt, nil-rated and non-GST inward supplies</p>
                <p style={{ margin: '4px 0 0', fontSize: 12 }}>No exempted inward purchases recorded in this reporting range.</p>
              </div>
            )}

            {/* Table 6 Payments Ledger */}
            {gstr3bSubTab === 't6' && (
              <div>
                <div style={{ padding: '12px 20px', background: '#f0fdf4', borderBottom: '1px solid var(--border)', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <CheckCircle size={14} style={{ color: '#16a34a' }} />
                  <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                    Auto-offset calculations. Values show tax to pay after utilizing available Input Tax Credit.
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="inv-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Tax Head</th>
                        <th style={{ textAlign: 'right' }}>Tax Payable (Liability)</th>
                        <th style={{ textAlign: 'right' }}>Paid through ITC</th>
                        <th style={{ textAlign: 'right' }}>Net Cash Payable</th>
                        <th style={{ textAlign: 'right' }}>Interest / Fees</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Integrated Tax (IGST)</td>
                        <td style={{ textAlign: 'right' }}>₹{gstr3bCalculations.t31.igst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>
                          ₹{Math.min(gstr3bCalculations.t31.igst, gstr3bCalculations.itc.inputs.igst + gstr3bCalculations.itc.capital_goods.igst + gstr3bCalculations.itc.input_services.igst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Math.max(0, gstr3bCalculations.t31.igst - (gstr3bCalculations.itc.inputs.igst + gstr3bCalculations.itc.capital_goods.igst + gstr3bCalculations.itc.input_services.igst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹0.00</td>
                      </tr>
                      <tr>
                        <td>Central Tax (CGST)</td>
                        <td style={{ textAlign: 'right' }}>₹{gstr3bCalculations.t31.cgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>
                          ₹{Math.min(gstr3bCalculations.t31.cgst, gstr3bCalculations.itc.inputs.cgst + gstr3bCalculations.itc.capital_goods.cgst + gstr3bCalculations.itc.input_services.cgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Math.max(0, gstr3bCalculations.t31.cgst - (gstr3bCalculations.itc.inputs.cgst + gstr3bCalculations.itc.capital_goods.cgst + gstr3bCalculations.itc.input_services.cgst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹0.00</td>
                      </tr>
                      <tr>
                        <td>State/UT Tax (SGST)</td>
                        <td style={{ textAlign: 'right' }}>₹{gstr3bCalculations.t31.sgst.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</td>
                        <td style={{ textAlign: 'right', color: '#16a34a' }}>
                          ₹{Math.min(gstr3bCalculations.t31.sgst, gstr3bCalculations.itc.inputs.sgst + gstr3bCalculations.itc.capital_goods.sgst + gstr3bCalculations.itc.input_services.sgst).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ₹{Math.max(0, gstr3bCalculations.t31.sgst - (gstr3bCalculations.itc.inputs.sgst + gstr3bCalculations.itc.capital_goods.sgst + gstr3bCalculations.itc.input_services.sgst)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                        <td style={{ textAlign: 'right' }}>₹0.00</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {/* -------------------- 6. FILING STATUS TRACKER -------------------- */}
      {activeTab === 'filing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div className="timeline-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
            {availableMonths.slice(0, 4).map(m => {
              const isSelected = selectedMonth === m.value;
              const monthRecord = filingStatus.find(s => s.filingMonth === m.value);
              const isFiled = monthRecord && monthRecord.status === 'filed';
              
              return (
                <div 
                  key={m.value} 
                  className="card" 
                  style={{ 
                    padding: 24, 
                    border: isSelected ? '2px solid #00b584' : '1px solid var(--border)',
                    boxShadow: isSelected ? '0 4px 12px rgba(0,181,132,0.1)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 16,
                    position: 'relative',
                    background: '#fff'
                  }}
                >
                  {isSelected && (
                    <span style={{ position: 'absolute', top: -10, right: 20, background: '#00b584', color: '#fff', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 10, textTransform: 'uppercase' }}>
                      Selected Month
                    </span>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <Calendar size={18} style={{ color: 'var(--ink3)' }} />
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--ink)' }}>{m.label}</span>
                    </div>
                    <span 
                      style={{ 
                        fontSize: 11, 
                        fontWeight: 700, 
                        textTransform: 'uppercase', 
                        padding: '4px 8px', 
                        borderRadius: 6,
                        background: isFiled ? 'rgba(0,181,132,0.1)' : '#fee2e2',
                        color: isFiled ? '#00b584' : '#b91c1c',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                    >
                      {isFiled ? <Check size={11} /> : <AlertCircle size={11} />}
                      {isFiled ? 'Filed' : 'Pending'}
                    </span>
                  </div>

                  {isFiled ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, background: '#f9fafb', padding: 16, borderRadius: 8, border: '1px solid #e5e7eb' }}>
                      <div style={{ fontSize: 12, color: 'var(--ink2)' }}>
                        <strong>Proof of Filing (ARN):</strong>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', fontFamily: 'monospace', letterSpacing: 0.5, marginTop: 4, background: '#fff', padding: '6px 10px', borderRadius: 4, border: '1px solid var(--border)' }}>
                          {monthRecord.arn}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--ink3)' }}>
                        Filed on: {new Date(monthRecord.filedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <button 
                        onClick={handleResetFiling} 
                        className="btn btn-ghost" 
                        style={{ border: '1px solid #fee2e2', background: '#fff', color: '#ef4444', fontSize: 12, padding: '6px 10px', marginTop: 4, justifyContent: 'center' }}
                      >
                        Reset Status
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={handleSaveFiling} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 12, color: 'var(--ink2)', fontWeight: 600 }}>Acknowledgement Reference Number (ARN)</label>
                        <input 
                          placeholder="e.g. AA270526000123A" 
                          value={isSelected ? arnInput : ''}
                          onChange={(e) => isSelected && setArnInput(e.target.value.toUpperCase())}
                          disabled={!isSelected}
                          style={{ 
                            border: '1px solid var(--border)', 
                            borderRadius: 8, 
                            padding: '10px 12px', 
                            fontSize: 13, 
                            color: 'var(--ink)', 
                            background: isSelected ? '#fff' : '#f9fafb', 
                            cursor: isSelected ? 'text' : 'not-allowed',
                            outline: 'none',
                            textTransform: 'uppercase',
                            fontFamily: 'monospace'
                          }} 
                        />
                      </div>
                      <button 
                        type="submit" 
                        disabled={submittingArn || !isSelected}
                        className="btn btn-primary"
                        style={{ justifyContent: 'center', padding: '10px 12px', fontSize: 13, cursor: isSelected ? 'pointer' : 'not-allowed', opacity: isSelected ? 1 : 0.6 }}
                      >
                        {submittingArn ? 'Saving...' : 'Mark as Filed'}
                      </button>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

    </div>
  );
}
