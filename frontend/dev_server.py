import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler

class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    directory = sys.argv[2] if len(sys.argv) > 2 else "frontend"
    server_address = ("0.0.0.0", port)
    httpd = HTTPServer(server_address, lambda *args, **kwargs: NoCacheHandler(*args, directory=directory, **kwargs))
    print(f"Serving {directory} on http://0.0.0.0:{port} with NO-CACHE headers...")
    httpd.serve_forever()
