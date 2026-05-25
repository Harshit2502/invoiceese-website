const http = require('http');

function request(url, method, data, token) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const body = data ? JSON.stringify(data) : '';
    const headers = {};
    if (body) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method: method,
      headers: headers
    }, (res) => {
      let raw = '';
      res.on('data', chunk => raw += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(raw) });
        } catch(e) {
          resolve({ status: res.statusCode, body: raw });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

async function main() {
  try {
    console.log('🔑 Logging in as harshit@example.com...');
    const loginRes = await request('http://localhost:5000/api/auth/login', 'POST', {
      email: 'harshit@example.com',
      password: 'password123'
    });
    
    if (loginRes.status !== 200) {
      console.error('❌ Login failed:', loginRes.body);
      return;
    }
    const token = loginRes.body.token;
    console.log('✅ Logged in successfully.');

    // 1. Create a Product
    console.log('\n📦 Testing POST /api/products (Creating product with HSN code)...');
    const newProduct = {
      name: 'Super Testing Widget',
      sku: 'WID-12345',
      stockQty: 50,
      avgCost: 120.50,
      sellingPrice: 180.00,
      hsnCode: '84713010'
    };
    const createRes = await request('http://localhost:5000/api/products', 'POST', newProduct, token);
    console.log('Create Response status:', createRes.status);
    console.log('Created product body:', JSON.stringify(createRes.body, null, 2));

    if (createRes.status !== 201) {
      console.error('❌ Product creation failed');
      return;
    }

    const createdId = createRes.body.product.id;

    // 2. Fetch all products and verify HSN code
    console.log('\n📋 Testing GET /api/products (Fetching products list)...');
    const getRes = await request('http://localhost:5000/api/products', 'GET', null, token);
    console.log('Get Response status:', getRes.status);
    const foundProduct = getRes.body.products.find(p => p.id === createdId);
    if (foundProduct) {
      console.log('✅ Created product found in list:', JSON.stringify(foundProduct, null, 2));
      if (foundProduct.hsnCode === '84713010') {
        console.log('✅ HSN Code verified successfully.');
      } else {
        console.error('❌ HSN Code mismatch:', foundProduct.hsnCode);
      }
    } else {
      console.error('❌ Created product not found in list');
      return;
    }

    // 3. Update the product
    console.log('\n⚙️ Testing PUT /api/products/:id (Updating name, price, stock quantity, and HSN code)...');
    const updatedProduct = {
      name: 'Super Testing Widget (Modified)',
      sku: 'WID-12345-REV',
      stockQty: 75,
      avgCost: 125.00,
      sellingPrice: 199.99,
      hsnCode: '85285900'
    };
    const updateRes = await request(`http://localhost:5000/api/products/${createdId}`, 'PUT', updatedProduct, token);
    console.log('Update Response status:', updateRes.status);
    console.log('Updated product body:', JSON.stringify(updateRes.body, null, 2));
    
    if (updateRes.status === 200 && updateRes.body.product.name === updatedProduct.name && updateRes.body.product.hsnCode === '85285900') {
      console.log('✅ Product update verified successfully.');
    } else {
      console.error('❌ Product update failed');
      return;
    }

    // 4. Delete the product
    console.log('\n🗑️ Testing DELETE /api/products/:id (Deleting product)...');
    const deleteRes = await request(`http://localhost:5000/api/products/${createdId}`, 'DELETE', null, token);
    console.log('Delete Response status:', deleteRes.status);
    console.log('Delete body:', deleteRes.body);

    if (deleteRes.status === 200) {
      console.log('✅ Product deletion verified successfully.');
    } else {
      console.error('❌ Product deletion failed');
      return;
    }

    // 5. Fetch again to confirm it is gone
    console.log('\n📋 Fetching products list again to confirm deletion...');
    const getRes2 = await request('http://localhost:5000/api/products', 'GET', null, token);
    const foundProduct2 = getRes2.body.products.find(p => p.id === createdId);
    if (!foundProduct2) {
      console.log('✅ Confirmed: product is no longer in inventory list.');
    } else {
      console.error('❌ Product is still present in inventory!');
    }

  } catch (err) {
    console.error(err);
  }
}

main();
