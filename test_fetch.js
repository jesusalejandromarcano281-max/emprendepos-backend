async function test() {
  try {
    const loginRes = await fetch('http://localhost:3001/api/auth/login', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ email: 'admin@admin.com', password: 'admin123' }) });
    const loginData = await loginRes.json();
    const token = loginData.token;
    
    const prodRes = await fetch('http://localhost:3001/api/products', { method: 'POST', headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token}, body: JSON.stringify({ nombre: 'Test Prod', descripcion: '', precio: 100, stock: 50, stock_minimo: 5, categoria: 'General' }) });
    const prodData = await prodRes.json();
    const prodId = prodData.id;

    const saleRes = await fetch('http://localhost:3001/api/sales', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + token},
      body: JSON.stringify({
        client_id: null,
        items: [{ product_id: prodId, cantidad: 1, precio_unitario: 100 }]
      })
    });
    const saleData = await saleRes.json();
    console.log('Sale Response:', saleRes.status, saleData);
  } catch (e) {
    console.error('Error:', e);
  }
}
test();
