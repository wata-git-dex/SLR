"""Serve a read-only, loopback-only design review made from the current source.

No authentication changes are made to index.html. The generated review uses its
existing baked snapshot. CSP blocks every API call; POST is unsupported. Only
public UI assets are served, never Worker code, Git files or arbitrary files.
"""
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import mimetypes
import re
from urllib.parse import urlsplit, unquote

APP = Path(__file__).resolve().parents[1]
PORT = 8766


def build_review():
    html = (APP / 'index.html').read_text()
    startup = 'showCheckingGate();refresh(true);'
    assert html.count(startup) == 1, 'Startup changed; review needs updating.'
    html = html.replace(startup, """
CURRENT_MEMBER='Cyrus'; CARD_VIEW='row';
STRAINS=process(RAW_STRAINS,RAW_BATCHES,RAW_SESSIONS);
applyMemberUi(); hideCodeGate(); buildChips(); render(); syncCardViewButton();
document.getElementById('landing').style.display='none';
document.body.classList.add('lab-open');
document.getElementById('updated').textContent='Saved snapshot';
""")
    for filename in ['achievements.js', 'my-lab-preview.js']:
        js = (APP / filename).read_text()
        html = html.replace(f'<script src="{filename}"></script>', '<script>' + js + '</script>')
    css = (APP / 'my-lab-preview.css').read_text() + '\n' + (APP / 'design-review/weather.css').read_text()
    html = html.replace('<link rel="stylesheet" href="my-lab-preview.css">', '<style>' + css + '</style>')
    html = html.replace('</body>', '<script>' + (APP / 'design-review/controls.js').read_text() + '</script></body>')
    html = html.replace('<title>Stoned Lab Rats</title>', '<title>SLR — Design review</title>')
    return html.encode()


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        host = self.headers.get('Host', '').split(':')[0]
        if host not in ('127.0.0.1', 'localhost'):
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        if path == '/':
            data, kind = build_review(), 'text/html; charset=utf-8'
        else:
            relative = path.lstrip('/')
            file = (APP / relative).resolve()
            allowed = (relative.startswith(('assets/badges/', 'assets/navigation/', 'images/', 'guides/'))
                       or re.fullmatch(r'[a-z0-9-]+\.png', relative))
            if not allowed or not file.is_relative_to(APP) or not file.is_file():
                self.send_error(404)
                return
            data, kind = file.read_bytes(), mimetypes.guess_type(file)[0] or 'application/octet-stream'
        self.send_response(200)
        self.send_header('Content-Type', kind)
        self.send_header('Content-Length', str(len(data)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors 'none'; object-src 'none'")
        self.end_headers()
        self.wfile.write(data)


if __name__ == '__main__':
    print(f'SLR design review: http://127.0.0.1:{PORT}/', flush=True)
    ThreadingHTTPServer(('127.0.0.1', PORT), Handler).serve_forever()
