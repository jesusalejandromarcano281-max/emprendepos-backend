const axios = require('axios');
async function test() {
  try {
    const loginRes = await axios.post('http://localhost:3001/api/auth/login', { email: 'admin@admin.com', password: 'admin123' });
    const token = loginRes.data.token;
    console.log('Login OK');
    
    // Create product
    const prodRes = await axios.post('http://localhost:3001/api/products', { nombre: 'Test Prod', descripcion: '', precio: 100, stock: 50, stock_minimo: 5, categoria: 'General' }, { headers: { Authorization: 'Bearer ' + token }});
    const prodId = prodRes.data.id;
    console.log('Product created:', prodId);

    // Create sale
    const saleRes = await axios.post('http://localhost:3001/api/sales', {
      client_id: null,
      items: [{ product_id: prodId, cantidad: 1, precio_unitario: 100 }]
    }, { headers: { Authorization: 'Bearer ' + token }});
    console.log('Sale OK:', saleRes.data);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}
test();
