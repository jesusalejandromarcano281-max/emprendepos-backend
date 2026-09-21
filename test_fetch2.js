async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }) });
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    // Get first client
    const clientsRes = await fetch('http://localhost:3001/api/clients', { headers: { Authorization: 'Bearer ' + token }});
    const clients = await clientsRes.json();
    const clientId = clients[0].id;

    // Get first product
    const prodRes = await fetch('http://localhost:3001/api/products', { headers: { Authorization: 'Bearer ' + token }});
    const prods = await prodRes.json();
    const prodId = prods[0].id;

    const saleRes = await fetch('http://localhost:3001/api/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify({
        client_id: clientId,
        items: [{ product_id: prodId, cantidad: 1, precio_unitario: 100 }],
        descuento: 0,
        notas: 'Test'
      })
    });
    const saleData = await saleRes.json();
    console.log('Sale Response:', saleRes.status, saleData);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
