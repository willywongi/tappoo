var connect = require('connect'),
	http = require('http'),
	app;

connect.static.mime.define({'application/x-web-app-manifest+json': ['webapp']});

app = connect()
	.use(connect.static('www'))
;

http.createServer(app).listen(8080, function() {
  console.log('Running on http://localhost:8080');
});
