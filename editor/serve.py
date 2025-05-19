#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

# Default port
PORT = 8000

# Change to the parent directory to serve both editor and lib
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class MyHandler(http.server.SimpleHTTPRequestHandler):
    # Override to add CORS headers
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        http.server.SimpleHTTPRequestHandler.end_headers(self)
    
    def do_GET(self):
        # If the root path is requested, redirect to the editor
        if self.path == '/':
            self.path = '/editor/'
        return http.server.SimpleHTTPRequestHandler.do_GET(self)

if __name__ == '__main__':
    # Use command line argument for port if provided
    if len(sys.argv) > 1:
        try:
            PORT = int(sys.argv[1])
        except ValueError:
            print(f"Invalid port: {sys.argv[1]}, using default port {PORT}")
    
    # Start the server
    with socketserver.TCPServer(("", PORT), MyHandler) as httpd:
        print(f"Serving at http://localhost:{PORT}/")
        print(f"Press Ctrl+C to stop the server")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.") 