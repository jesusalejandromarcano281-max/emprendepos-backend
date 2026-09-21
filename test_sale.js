const fs = require('fs');
async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }) });
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    const prodRes = await fetch('http://localhost:3001/api/products', { headers: { Authorization: 'Bearer ' + token }});
    const prods = await prodRes.json();
    const prodId = prods[0].id;
    
    console.log('Product:', prods[0]);

    const payload = {
      client_id: null,
      items: [{ product_id: prodId, cantidad: 1, precio_unitario: prods[0].precio }],
      descuento: 0,
      notas: 'Prueba'
    };
    
    console.log('Sending payload:', payload);

    const saleRes = await fetch('http://localhost:3001/api/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify(payload)
    });
    
    console.log('Sale Status:', saleRes.status);
    const saleData = await saleRes.json();
    console.log('Sale Data:', saleData);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
