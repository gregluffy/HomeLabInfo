const http = require('http');
const req = http.request({
  hostname: 'localhost',
  port: 5030,
  path: '/api/Agents/1',
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  console.log('StatusCode:', res.statusCode);
});
req.write(JSON.stringify({ positionX: 55, positionY: 55 }));
req.end();
