#!/usr/bin/env python3
"""Local Pilot server with optional Copilot relay and OSC output."""
import argparse
import http.client
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import signal
import socket
import struct
import subprocess
import tempfile
import threading
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, unquote, urlsplit

ROOT = Path(__file__).resolve().parent
VIEWER = {
    '/copilot/', '/copilot/index.php', '/copilot/viewer.css', '/copilot/viewer.js',
    '/copilot/copilot-logo.png', '/copilot/pilot-show-cards.css',
    '/diagnostics/report.js', '/i18n-catalog.js',
}
HOST = 'localhost:8092'
LOCAL_ACTIONS = {'health', 'join', 'read', 'command', 'set_role', 'add_top', 'update_top', 'delete_top'}
PRIVATE_NETWORKS = tuple(map(ipaddress.ip_network, (
    '127.0.0.0/8', '10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16', '169.254.0.0/16'
)))


def private_address(value):
    address = ipaddress.IPv4Address(value)
    if not any(address in network for network in PRIVATE_NETWORKS):
        raise ValueError('Une adresse IPv4 privée ou de boucle locale est requise.')
    return address


def osc_string(text):
    raw = text.encode('ascii') + b'\0'
    return raw + b'\0' * (-len(raw) % 4)


def osc_packet(address, args):
    if not isinstance(address, str) or not re.fullmatch(r'/[A-Za-z0-9_.:/+-]{1,119}', address):
        raise ValueError('Adresse OSC invalide.')
    if not isinstance(args, list) or len(args) > 8:
        raise ValueError('Maximum de huit arguments OSC.')
    tags, data = ',', []
    for arg in args:
        if isinstance(arg, bool):
            tags += 'T' if arg else 'F'
        elif isinstance(arg, int):
            tags += 'i'
            data.append(struct.pack('>i', arg))
        elif isinstance(arg, float):
            if not float('-inf') < arg < float('inf'):
                raise ValueError('Argument OSC non fini.')
            tags += 'f'
            data.append(struct.pack('>f', arg))
        elif isinstance(arg, str) and '\0' not in arg and len(arg) <= 120:
            tags += 's'
            data.append(osc_string(arg))
        else:
            raise ValueError('Argument OSC invalide.')
    return osc_string(address) + osc_string(tags) + b''.join(data)


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def log_message(self, format, *args):
        pass

    def reply(self, status, body):
        data = json.dumps(body, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def permitted_host(self):
        return self.headers.get('Host') in self.server.hosts

    def static_request(self, head=False):
        if not self.permitted_host():
            self.send_error(403)
            return
        path = unquote(urlsplit(self.path).path)
        if self.server.is_host and path == '/pilot-local/info' and not head:
            self.reply(200, {'viewer': self.server.viewer, 'key': self.server.key, 'instance': self.server.instance})
            return
        if path in {'/copilot/', '/copilot/index.php'} and self.server.backend and not head:
            self.proxy('/copilot/index.php')
            return
        if not self.server.is_host and path not in VIEWER:
            self.send_error(404)
            return
        if (any(part.startswith('.') for part in path.split('/') if part)
                or path.lower().endswith(('.php', '.py', 'error_log'))
                or (path not in {'/'} and not Path(self.translate_path(path)).is_file())):
            self.send_error(404)
            return
        if head:
            super().do_HEAD()
        else:
            super().do_GET()

    def do_GET(self):
        self.static_request()

    def do_HEAD(self):
        self.static_request(head=True)

    def do_POST(self):
        host = self.headers.get('Host')
        if not self.permitted_host() or self.headers.get('Origin') not in (None, f'http://{host}'):
            self.reply(403, {'error': 'Origine refusée.'})
            return
        url = urlsplit(self.path)
        try:
            size = int(self.headers.get('Content-Length', ''))
        except ValueError:
            self.reply(400, {'error': 'Longueur invalide.'})
            return
        if not 0 <= size <= 450000:
            self.reply(413, {'error': 'Requête trop volumineuse.'})
            return
        if not self.headers.get('Content-Type', '').startswith('application/json'):
            self.reply(415, {'error': 'JSON requis.'})
            return
        if url.path == '/copilot/api.php':
            action = parse_qs(url.query).get('action', [''])[0]
            if not self.server.is_host and action not in LOCAL_ACTIONS:
                self.reply(403, {'error': 'Commande réservée au poste Pilot.'})
                return
            if not self.server.backend:
                self.reply(503, {'error': 'Lancez Pilot avec une adresse réseau pour activer Copilot local.'})
                return
            self.proxy(self.path, self.rfile.read(size))
        elif url.path == '/pilot-local/osc' and self.server.is_host:
            if not secrets.compare_digest(self.headers.get('X-Pilot-Key', ''), self.server.key):
                self.reply(403, {'error': 'Clé locale invalide.'})
                return
            try:
                request = json.loads(self.rfile.read(size))
                ip = private_address(request['ip'])
                port = request['port']
                if type(port) is not int or not 1 <= port <= 65535:
                    raise ValueError('Port UDP invalide.')
                messages = request['messages']
                if not isinstance(messages, list) or not 1 <= len(messages) <= 8:
                    raise ValueError('Maximum de huit messages OSC.')
                packets = [osc_packet(message['address'], message.get('args', [])) for message in messages]
                with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as output:
                    for packet in packets:
                        output.sendto(packet, (str(ip), port))
            except (ValueError, KeyError, TypeError, OverflowError, struct.error, OSError) as error:
                self.reply(400, {'error': str(error)})
                return
            self.reply(200, {'ok': True})
        else:
            self.send_error(404)

    def proxy(self, path, body=None):
        connection = http.client.HTTPConnection('127.0.0.1', self.server.backend, timeout=8)
        headers = {name: self.headers[name] for name in ('Host', 'Origin', 'Authorization', 'Content-Type')
                   if name in self.headers}
        try:
            connection.request('GET' if body is None else 'POST', path, body, headers)
            response = connection.getresponse()
            data = response.read()
            self.send_response(response.status)
            for name in ('Content-Type', 'Content-Security-Policy', 'Cache-Control', 'Referrer-Policy', 'X-Content-Type-Options', 'X-Pilot-Relay-Cause'):
                if response.getheader(name):
                    self.send_header(name, response.getheader(name))
            self.send_header('Content-Length', str(len(data)))
            self.end_headers()
            self.wfile.write(data)
        except (OSError, http.client.HTTPException):
            self.reply(503, {'error': 'Relais Copilot local indisponible.'})
        finally:
            connection.close()

    def list_directory(self, path):
        self.send_error(404)


def make_server(address, hosts, backend=None, viewer=None, is_host=False):
    server = ThreadingHTTPServer((address, 8092), Handler)
    server.is_host, server.hosts = is_host, hosts
    server.backend, server.viewer, server.key = backend, viewer, secrets.token_hex(24)
    server.instance = secrets.token_hex(12)
    return server


def launch_backend(storage):
    php = shutil.which('php')
    if not php or subprocess.run(
        [php, '-r', 'exit(PHP_VERSION_ID >= 80100 && extension_loaded("pdo_sqlite") ? 0 : 1);'],
        check=False
    ).returncode:
        raise SystemExit('Copilot local nécessite PHP 8.1+ avec PDO SQLite, installé avant le spectacle.')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1', 0))
        port = probe.getsockname()[1]
    env = dict(os.environ, S2A_COPILOT_LOCAL='1', S2A_COPILOT_STORAGE=storage)
    child = subprocess.Popen([php, '-S', f'127.0.0.1:{port}', '-t', str(ROOT)],
                             env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        for _ in range(30):
            if child.poll() is not None:
                break
            try:
                with socket.create_connection(('127.0.0.1', port), timeout=.1):
                    return child, port
            except OSError:
                time.sleep(.1)
        raise SystemExit('Impossible de démarrer le relais PHP local.')
    except BaseException:
        if child.poll() is None:
            child.terminate()
            child.wait()
        raise


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lan', metavar='IP', help='Adresse IPv4 privée de ce poste pour Copilot.')
    args = parser.parse_args()
    try:
        lan = str(private_address(args.lan)) if args.lan else None
    except ValueError as error:
        parser.error(str(error))
    if lan and ipaddress.ip_address(lan).is_loopback:
        parser.error('--lan doit utiliser une adresse du réseau local.')
    with tempfile.TemporaryDirectory(prefix='pilot-copilot-') as storage:
        child, port = launch_backend(storage) if lan else (None, None)
        try:
            viewer = f'http://{lan}:8092/copilot/index.php' if lan else None
            with make_server('127.0.0.1', {HOST, '127.0.0.1:8092'}, port, viewer, True) as host:
                if lan:
                    with make_server(lan, {f'{lan}:8092'}, port) as remote:
                        threading.Thread(target=remote.serve_forever, daemon=True).start()
                        print(f'Copilot local : {viewer}', flush=True)
                        host.serve_forever()
                else:
                    host.serve_forever()
        finally:
            if child:
                child.terminate()
                child.wait()


def stop(signum, frame):
    raise KeyboardInterrupt


if __name__ == '__main__':
    signal.signal(signal.SIGTERM, stop)
    try:
        main()
    except KeyboardInterrupt:
        pass
