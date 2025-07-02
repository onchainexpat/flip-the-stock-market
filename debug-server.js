const { createServer } = require('http');

const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <html>
      <head><title>Debug Server</title></head>
      <body>
        <h1>Debug Server Working</h1>
        <p>Server is running on port 3001</p>
        <p>Request URL: ${req.url}</p>
        <p>If you can see this, networking is working.</p>
      </body>
    </html>
  `);
});

server.listen(3002, '0.0.0.0', () => {
  console.log('Debug server running on http://localhost:3002');
});
