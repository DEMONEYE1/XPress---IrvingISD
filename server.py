"""Single-origin Xpress website/API. Python standard library; memory-only HAC sessions."""
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from http.cookies import SimpleCookie
from urllib.parse import urlsplit
from pathlib import Path
from datetime import datetime,timezone
from collections import deque
import argparse,json,secrets,threading,time,os
from hac_client import HacClient,HacError,ROUTES

ROOT=Path(__file__).resolve().parent
IDLE=15*60;MAX_AGE=60*60;MAX_SESSIONS=250
sessions={};attempts={};lock=threading.RLock()
CLIENT_FACTORY=HacClient
def stamp():return datetime.now(timezone.utc).isoformat()
class Session:
    def __init__(self):
        self.id=secrets.token_urlsafe(32);self.csrf=secrets.token_urlsafe(32);self.created=self.touched=time.monotonic();self.client=None;self.documents={};self.errors={};self.mutex=threading.RLock()
    def clear(self):
        if self.client:self.client.close()
        self.client=None;self.documents={};self.errors={}
    def payload(self):return {'authenticated':self.client is not None,'csrf':self.csrf,'documents':self.documents,'recordErrors':self.errors,'idleMinutes':15}
def purge():
    now=time.monotonic()
    with lock:
        for key,s in list(sessions.items()):
            if now-s.touched>IDLE or now-s.created>MAX_AGE:
                # An in-flight request owns its session lock; invalidate it on the
                # next cleanup pass instead of deleting its cookie jar mid-request.
                if s.mutex.acquire(blocking=False):
                    try:s.clear();sessions.pop(key,None)
                    finally:s.mutex.release()
        for key,q in list(attempts.items()):
            while q and now-q[0]>300:q.popleft()
            if not q:attempts.pop(key,None)
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT/'dist'),**kwargs)
    def log_message(self,*args):pass
    def end_headers(self):
        self.send_header('X-Content-Type-Options','nosniff');self.send_header('Referrer-Policy','no-referrer');self.send_header('X-Frame-Options','DENY')
        self.send_header('Content-Security-Policy',"default-src 'self'; script-src 'self'; connect-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'")
        super().end_headers()
    def valid_host(self):return self.headers.get('Host','')==urlsplit(self.server.origin).netloc
    def json(self,status,data,cookie=None):
        encoded=json.dumps(data,ensure_ascii=False).encode();self.send_response(status);self.send_header('Content-Type','application/json; charset=utf-8');self.send_header('Cache-Control','no-store');self.send_header('Content-Length',str(len(encoded)))
        if cookie:self.send_header('Set-Cookie','xpress_session='+cookie+'; Path=/; HttpOnly; SameSite=Strict'+('; Secure' if self.server.origin.startswith('https:') else ''))
        self.end_headers();self.wfile.write(encoded)
    def get_session(self,create=False):
        purge();cookies=SimpleCookie()
        try:cookies.load(self.headers.get('Cookie',''))
        except Exception:pass
        ident=cookies.get('xpress_session');ident=ident.value if ident else None
        with lock:
            s=sessions.get(ident)
            if s:s.touched=time.monotonic();return s,False
            if not create:return None,False
            if len(sessions)>=MAX_SESSIONS:raise HacError('The server is busy. Try again shortly.',503)
            s=Session();sessions[s.id]=s;return s,True
    def do_GET(self):
        if not self.valid_host():return self.json(421,{'error':'Unrecognized website host.'})
        route=urlsplit(self.path).path
        if route.startswith('/api/'):
            try:
                if route!='/api/session':return self.json(404,{'error':'Unknown API route.'})
                s,new=self.get_session(True)
                with s.mutex:return self.json(200,s.payload(),s.id if new else None)
            except HacError as e:return self.json(e.status,{'error':str(e)})
        if route=='/':self.path='/index.html'
        if any(part.startswith('.') for part in route.split('/') if part):return self.send_error(404)
        return super().do_GET()
    def list_directory(self,path):return self.send_error(404)
    def do_POST(self):
        if not self.valid_host():return self.json(421,{'error':'Unrecognized website host.'})
        if self.headers.get('Origin')!=self.server.origin:return self.json(403,{'error':'This request must come from Xpress.'})
        if self.headers.get('Content-Type','').split(';')[0]!='application/json':return self.json(415,{'error':'JSON required.'})
        try:
            size=int(self.headers.get('Content-Length','0'))
            if not 0<size<=8192:return self.json(413,{'error':'Request too large or empty.'})
            s,_=self.get_session()
            if not s:return self.json(401,{'error':'Your Xpress session expired. Reload the page.'})
            if not secrets.compare_digest(self.headers.get('X-Xpress-CSRF',''),s.csrf):return self.json(403,{'error':'Reload Xpress before trying again.'})
            body=json.loads(self.rfile.read(size))
            if not isinstance(body,dict):return self.json(400,{'error':'Invalid request.'})
            route=urlsplit(self.path).path
            with s.mutex:
                if route=='/api/login':
                    username=body.get('username');password=body.get('password')
                    if not isinstance(username,str) or not 1<=len(username.strip())<=256 or not isinstance(password,str) or not 1<=len(password)<=1024:raise HacError('Enter your HAC username and password.',400)
                    with lock:
                        q=attempts.setdefault(self.client_address[0],deque());now=time.monotonic()
                        if len(q)>=5:raise HacError('Too many sign-in attempts. Wait five minutes before trying again.',429)
                        q.append(now)
                    s.clear();client=CLIENT_FACTORY()
                    try:client.login(username.strip(),password)
                    except Exception:client.close();raise
                    finally:body.clear();password=None;username=None
                    s.client=client
                    # Rotate browser session and CSRF after authenticating.
                    with lock:
                        sessions.pop(s.id,None);s.id=secrets.token_urlsafe(32);s.csrf=secrets.token_urlsafe(32);s.created=s.touched=time.monotonic();sessions[s.id]=s
                    try:self.load_record(s,'classwork')
                    except HacError as e:
                        if e.status==401:raise
                    return self.json(200,s.payload(),s.id)
                if route=='/api/logout':s.clear();s.csrf=secrets.token_urlsafe(32);return self.json(200,s.payload())
                if route.startswith('/api/record/'):
                    kind=route.removeprefix('/api/record/')
                    if kind not in ROUTES:raise HacError('Unknown school record.',404)
                    if not s.client:raise HacError('Sign in to HAC first.',401)
                    self.load_record(s,kind);return self.json(200,s.payload())
                return self.json(404,{'error':'Unknown API route.'})
        except (ValueError,UnicodeError):return self.json(400,{'error':'Invalid request.'})
        except HacError as e:
            if e.status==401 and 's' in locals() and s:s.clear()
            return self.json(e.status,{'error':str(e)})
        except Exception:return self.json(500,{'error':'The request could not be completed. No credentials were logged. Try again later.'})
    def load_record(self,s,kind):
        try:s.documents[kind]={'html':s.client.record(kind),'importedAt':stamp()};s.errors.pop(kind,None)
        except HacError as e:
            s.documents.pop(kind,None);s.errors[kind]=str(e)
            if e.status==401:s.clear()
            raise
def make_server(host,port,origin):
    u=urlsplit(origin)
    if u.scheme not in ('http','https') or not u.netloc or u.path or u.query or u.fragment:raise ValueError('XPRESS_ORIGIN must be an origin without a path.')
    if u.scheme=='http' and (u.hostname not in ['127.0.0.1','localhost'] or host not in ['127.0.0.1','localhost']):raise ValueError('Public access requires HTTPS through a trusted TLS reverse proxy. Local HTTP must bind to loopback.')
    server=ThreadingHTTPServer((host,port),Handler);server.origin=origin;server.daemon_threads=True;return server
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--port',type=int,default=4183);parser.add_argument('--host',default='127.0.0.1');args=parser.parse_args()
    origin=os.getenv('XPRESS_ORIGIN',f'http://127.0.0.1:{args.port}').rstrip('/')
    server=make_server(args.host,args.port,origin)
    print('Xpress website: '+origin+'/grades.html',flush=True)
    def cleaner():
        while True:time.sleep(30);purge()
    threading.Thread(target=cleaner,daemon=True).start()
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:
        server.server_close()
        for s in list(sessions.values()):s.clear()
