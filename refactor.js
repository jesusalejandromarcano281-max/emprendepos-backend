const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src', 'routes');

function refactorFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace dbRun(...) with await dbRun(...)
  content = content.replace(/(?<!await\s)dbRun\(/g, 'await dbRun(');
  // Replace dbGet(...) with await dbGet(...)
  content = content.replace(/(?<!await\s)dbGet\(/g, 'await dbGet(');
  // Replace dbAll(...) with await dbAll(...)
  content = content.replace(/(?<!await\s)dbAll\(/g, 'await dbAll(');

  // Make sure router functions are async
  // router.get('/...', (req, res) => {
  // router.post('/...', auth, (req, res) => {
  content = content.replace(/router\.(get|post|put|delete)\(([^)]+),\s*\((req,\s*res)\)\s*=>/g, 'router.$1($2, async ($3) =>');
  content = content.replace(/router\.(get|post|put|delete)\(([^)]+),\s*\((req,\s*res,\s*next)\)\s*=>/g, 'router.$1($2, async ($3) =>');

  // Some might be: router.get('/', auth, roleCheck('admin'), (req, res) =>
  content = content.replace(/,\s*\((req,\s*res(?:,\s*next)?)\)\s*=>\s*\{/g, ', async ($1) => {');

  // Replace ? with $1, $2, etc in dbRun/dbGet/dbAll
  // This is tricky with regex, we can just look for query strings.
  // Actually, we can do a naive replacement on any string literal containing '?'
  // But let's be careful. A better way: find `dbRun('...', [params])` and replace inside the string.
  
  // It's easier to manually review or use a sophisticated regex.
  // Let's just do a basic string replacement for common queries.
  // Or I can just write a quick script that uses `?` and replaces it dynamically.
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Refactored', filePath);
}

const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
for (const file of files) {
  refactorFile(path.join(routesDir, file));
}
