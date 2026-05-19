import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function CreateInvoiceModal({ onClose, onSuccess, user }) {
  const { authFetch } = useAuth();
  const navigate = useNavigate();
  
  const hasGst = user?.gstNumber && user?.gstNumber.trim() !== '';
  const isPro = user?.plan === 'pro' || user?.plan === 'business';

  const [createForm, setCreateForm] = useState({
    docType: 'sales_invoice',
    clientName: '',
    clientGst: '',
    clientAddress: '',
    clientMobile: '',
    clientState: '',
    clientStateCode: '',
    reverseCharge: false,
    transportMode: '',
    vehicleNumber: '',
    dateOfSupply: '',
    placeOfSupply: '',
    items: [{ description: '', hsn: '', uom: 'PCS.', quantity: 1, unitPrice: '', discount: '', discountType: '₹' }],
    gstRate: hasGst ? 18 : 0,
    notes: '',
    templateStyle: isPro ? (user?.templateStyle || 'modern') : 'modern',
  });
  
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const handleCreateChange = e => {
    const { name, value } = e.target;
    setCreateForm(prev => ({ ...prev, [name]: value }));
  };

  const handleItemChange = (index, field, value) => {
    setCreateForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = {
        ...nextItems[index],
        [field]: value,
      };
      return { ...prev, items: nextItems };
    });
  };

  const addItemRow = () => {
    setCreateForm((prev) => ({
      ...prev,
      items: [...prev.items, { description: '', hsn: '', uom: 'PCS.', quantity: 1, unitPrice: '', discount: '', discountType: '₹' }],
    }));
  };

  const removeItemRow = (index) => {
    setCreateForm((prev) => {
      if (prev.items.length === 1) return prev;
      return {
        ...prev,
        items: prev.items.filter((_, i) => i !== index),
      };
    });
  };

  const itemsSubtotal = Number(
    (createForm.items || []).reduce((sum, item) => {
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      const discountVal = Number(item.discount) || 0;
      
      let lineTotal = quantity * unitPrice;
      if (item.discountType === '%') {
        lineTotal -= lineTotal * (discountVal / 100);
      } else {
        lineTotal -= discountVal;
      }
      return sum + Math.max(0, lineTotal);
    }, 0).toFixed(2)
  );

  const previewGstAmount = Number(((itemsSubtotal * (Number(createForm.gstRate) || 0)) / 100).toFixed(2));
  const previewTotal = Number((itemsSubtotal + previewGstAmount).toFixed(2));

  const handleCreate = async e => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await authFetch('/api/invoices', {
        method: 'POST',
        body: JSON.stringify({
            ...createForm,
            gstRate: hasGst ? createForm.gstRate : 0,
            items: (createForm.items || []).map((item) => ({
              description: String(item.description || '').trim(),
              hsn: hasGst ? String(item.hsn || '').trim() : '',
              uom: String(item.uom || 'PCS.').trim(),
              quantity: Number(item.quantity) || 0,
              unitPrice: Number(item.unitPrice) || 0,
              discount: Number(item.discount) || 0,
              discountType: item.discountType || '₹'
            })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      onSuccess(); // Triggers refetch of invoices & products in parent
      onClose();
    } catch (err) {
      if (err.message && err.message.includes('limit reached')) {
        navigate('/pricing');
      } else {
        setCreateError(err.message);
      }
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div className="modal-card" style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 700, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 10 }}>
          <h2 style={{ margin: 0, fontSize: 18, color: '#111827' }}>
            {createForm.docType === 'sales_invoice' ? 'Create Sales Invoice' :
             createForm.docType === 'credit_note' ? 'Create Credit Note' :
             createForm.docType === 'debit_note' ? 'Create Debit Note' :
             createForm.docType === 'provisional_invoice' ? 'Create Provisional Invoice' :
             createForm.docType === 'delivery_challan' ? 'Create Delivery Challan' : 'Create Document'}
          </h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: '#6b7280' }}>&times;</button>
        </div>
        
        <div style={{ padding: 24 }}>
          {createError && <div style={{ padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 8, marginBottom: 20, fontSize: 14 }}>{createError}</div>}
          
          <form onSubmit={handleCreate}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Document Type *</label>
                <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', background: '#fff' }} name="docType" value={createForm.docType} onChange={handleCreateChange}>
                  <option value="sales_invoice">Sales Invoice</option>
                  <option value="provisional_invoice">Provisional Invoice</option>
                  <option value="delivery_challan">Delivery Challan</option>
                  <option value="credit_note">Credit Note (Returns)</option>
                  <option value="debit_note">Debit Note</option>
                </select>
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Party Name *</label>
                <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientName" value={createForm.clientName} onChange={handleCreateChange} placeholder="Acme Corporation" required />
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Client Address</label>
                <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientAddress" value={createForm.clientAddress || ''} onChange={handleCreateChange} placeholder="123 Street, City" />
              </div>
              <div style={{ flex: '1 1 200px' }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Client Mobile</label>
                <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientMobile" value={createForm.clientMobile || ''} onChange={handleCreateChange} placeholder="9876543210" />
              </div>
            </div>

            {hasGst && (
              <>
                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 150px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Client GSTIN</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientGst" value={createForm.clientGst || ''} onChange={handleCreateChange} placeholder="22AAAAA0000A1Z5" />
                  </div>
                  <div style={{ flex: '2 1 120px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Client State</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientState" value={createForm.clientState || ''} onChange={handleCreateChange} placeholder="Gujarat" />
                  </div>
                  <div style={{ flex: '1 1 80px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>State Code</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="clientStateCode" value={createForm.clientStateCode || ''} onChange={handleCreateChange} placeholder="24" />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Transport Mode</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="transportMode" value={createForm.transportMode || ''} onChange={handleCreateChange} placeholder="Road" />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Vehicle Number</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="vehicleNumber" value={createForm.vehicleNumber || ''} onChange={handleCreateChange} placeholder="GJ-05-XX-0000" />
                  </div>
                  <div style={{ flex: '1 1 120px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Date of Supply</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} type="date" name="dateOfSupply" value={createForm.dateOfSupply || ''} onChange={handleCreateChange} />
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                  <div style={{ flex: '2 1 200px' }}>
                    <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Place of Supply</label>
                    <input style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }} name="placeOfSupply" value={createForm.placeOfSupply || ''} onChange={handleCreateChange} placeholder="Gujarat" />
                  </div>
                  <div style={{ flex: '1 1 150px', display: 'flex', alignItems: 'center', paddingTop: 20 }}>
                    <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, color: '#374151' }}>
                      <input type="checkbox" checked={createForm.reverseCharge || false} onChange={e => setCreateForm(f => ({ ...f, reverseCharge: e.target.checked }))} style={{ marginRight: 8 }} />
                      Reverse Charge (Y/N)
                    </label>
                  </div>
                </div>
              </>
            )}

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', marginBottom: 12, fontSize: 13, fontWeight: 600, color: '#374151' }}>Invoice Items *</label>
              {(createForm.items || []).map((item, index) => (
                <div key={index} style={{ display: 'flex', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <input
                    style={{ flex: '1 1 200px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                    placeholder="Item description"
                    value={item.description}
                    onChange={(e) => handleItemChange(index, 'description', e.target.value)}
                    required
                  />
                  {hasGst && (
                    <input
                      style={{ flex: '1 1 80px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                      placeholder="HSN"
                      value={item.hsn || ''}
                      onChange={(e) => handleItemChange(index, 'hsn', e.target.value)}
                    />
                  )}
                  <input
                    style={{ flex: '1 1 70px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                    placeholder="UOM"
                    value={item.uom}
                    onChange={(e) => handleItemChange(index, 'uom', e.target.value)}
                  />
                  <input
                    style={{ flex: '1 1 80px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                    type="number" min="1"
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                    required
                  />
                  <input
                    style={{ flex: '1 1 100px', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box' }}
                    type="number" min="0" step="0.01"
                    placeholder="Price"
                    value={item.unitPrice}
                    onChange={(e) => handleItemChange(index, 'unitPrice', e.target.value)}
                    required
                  />
                  <div style={{ flex: '1 1 120px', display: 'flex' }}>
                    <input
                      style={{ flex: 1, width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRight: 'none', borderRadius: '6px 0 0 6px', boxSizing: 'border-box' }}
                      type="number" min="0" step="0.01"
                      placeholder="Disc"
                      value={item.discount}
                      onChange={(e) => handleItemChange(index, 'discount', e.target.value)}
                    />
                    <select 
                      style={{ padding: '8px 4px', border: '1px solid #d1d5db', borderRadius: '0 6px 6px 0', background: '#f9fafb', width: '50px' }}
                      value={item.discountType}
                      onChange={(e) => handleItemChange(index, 'discountType', e.target.value)}
                    >
                      <option value="₹">₹</option>
                      <option value="%">%</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    style={{ padding: '8px 12px', background: '#f3f4f6', color: '#ef4444', border: '1px solid #e5e7eb', borderRadius: 6, cursor: (createForm.items || []).length === 1 ? 'not-allowed' : 'pointer', opacity: (createForm.items || []).length === 1 ? 0.5 : 1 }}
                    onClick={() => removeItemRow(index)}
                    disabled={(createForm.items || []).length === 1}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" onClick={addItemRow} style={{ padding: '6px 12px', background: '#eef2ff', color: '#4f46e5', border: '1px solid #c7d2fe', borderRadius: 6, cursor: 'pointer', fontSize: 13, fontWeight: 500, marginTop: 4 }}>+ Add Line Item</button>
            </div>

            <div style={{ display: 'flex', gap: 20, marginBottom: 24, flexWrap: 'wrap' }}>
              {hasGst && (
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>GST Rate (%)</label>
                  <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', background: '#fff' }} name="gstRate" value={createForm.gstRate} onChange={handleCreateChange}>
                    <option value={0}>0% (Exempt)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard)</option>
                    <option value={28}>28%</option>
                  </select>
                </div>
              )}
              {isPro && (
                <div style={{ flex: '1 1 200px' }}>
                  <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: '#374151' }}>Template Style</label>
                  <select style={{ width: '100%', padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 6, boxSizing: 'border-box', background: '#fff' }} name="templateStyle" value={createForm.templateStyle} onChange={handleCreateChange}>
                    <option value="modern">Modern (Tabular)</option>
                    <option value="standard">Standard (Simple)</option>
                  </select>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                <span style={{ color: '#6b7280' }}>Subtotal:</span>
                <span style={{ fontWeight: 600 }}>₹{itemsSubtotal.toFixed(2)}</span>
              </div>
              {hasGst && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
                  <span style={{ color: '#6b7280' }}>GST ({createForm.gstRate}%):</span>
                  <span style={{ fontWeight: 600 }}>₹{previewGstAmount.toFixed(2)}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid #d1d5db', fontSize: 16 }}>
                <span style={{ fontWeight: 700, color: '#111827' }}>Total Amount:</span>
                <span style={{ fontWeight: 700, color: '#0F6E56' }}>₹{previewTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, borderTop: '1px solid #e5e7eb', paddingTop: 20 }}>
              <button type="button" onClick={onClose} style={{ padding: '10px 16px', background: '#fff', border: '1px solid #d1d5db', borderRadius: 8, cursor: 'pointer', fontWeight: 600, color: '#374151' }}>Cancel</button>
              <button type="submit" disabled={creating} style={{ padding: '10px 20px', background: '#0F6E56', border: 'none', borderRadius: 8, cursor: creating ? 'not-allowed' : 'pointer', fontWeight: 600, color: '#fff', opacity: creating ? 0.7 : 1 }}>
                {creating ? 'Creating...' : 'Create Sales Invoice'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
