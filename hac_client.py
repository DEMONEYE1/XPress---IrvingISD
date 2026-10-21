"""HAC form login and read-only record retrieval. No credential persistence."""
from html.parser import HTMLParser
from html import escape
from urllib.parse import urljoin, urlsplit, urlencode
from urllib.request import Request, build_opener, HTTPCookieProcessor, HTTPRedirectHandler
from urllib.error import HTTPError, URLError
from http.cookiejar import CookieJar
import socket

BASE='https://homeaccess.irvingisd.net'
LOGIN=BASE+'/HomeAccess/Account/LogOn'
ROUTES={'classwork':('Classes/Classwork','Content/Student/Assignments.aspx'),
 'schedule':('Classes/Schedule','Content/Student/Classes.aspx'),
 'report-card':('Grades/ReportCard','Content/Student/ReportCards.aspx'),
 'transcript':('Grades/Transcript','Content/Student/Transcript.aspx'),
 'attendance':('Attendance/MonthView','Content/Attendance/MonthlyView.aspx')}

class HacError(Exception):
    def __init__(self,message,status=502):super().__init__(message);self.status=status
class Node:
    def __init__(self,tag='',attrs=None):self.tag=tag;self.attrs=dict(attrs or []);self.children=[]
    def all(self):
        yield self
        for child in self.children:
            if isinstance(child,Node):yield from child.all()
class Document(HTMLParser):
    VOID={'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}
    def __init__(self,html):
        super().__init__(convert_charrefs=True);self.root=Node();self.stack=[self.root];self.feed(html)
    def handle_starttag(self,tag,attrs):
        n=Node(tag,attrs);self.stack[-1].children.append(n)
        if tag not in self.VOID:self.stack.append(n)
    def handle_endtag(self,tag):
        for i in range(len(self.stack)-1,0,-1):
            if self.stack[i].tag==tag:del self.stack[i:];break
    def handle_data(self,data):self.stack[-1].children.append(data)
    def nodes(self):return self.root.all()

def permitted(url):
    u=urlsplit(url)
    return u.scheme=='https' and u.hostname=='homeaccess.irvingisd.net' and u.port in (None,443) and not u.username and not u.password and u.path.lower().startswith('/homeaccess/')
class HacRedirects(HTTPRedirectHandler):
    def redirect_request(self,req,fp,code,msg,headers,newurl):
        if not permitted(newurl):raise HacError('HAC requested an unsupported external sign-in. Use official HAC; Xpress cannot complete this flow.',409)
        return super().redirect_request(req,fp,code,msg,headers,newurl)

def password_page(doc):return any(n.tag=='input' and n.attrs.get('type','').lower()=='password' for n in doc.nodes())
def logged_in(doc):return not password_page(doc) and any(n.tag=='a' and '/account/logoff' in n.attrs.get('href','').lower() for n in doc.nodes())

# Only the known academic tables reach the browser. Scripts, forms, identity
# banners, remote resources, hidden fields, and arbitrary attributes are omitted.
TAGS={'div','span','a','table','thead','tbody','tfoot','tr','td','th','select','option','p','br','strong','b','label'}
ATTRS={'id','class','value','selected','colspan','rowspan','aria-label'}
def safe_html(node):
    if isinstance(node,str):return escape(node)
    if node.tag in {'script','style','iframe','img','input','link','object','embed','svg'}:return ''
    body=''.join(safe_html(c) for c in node.children)
    if node.tag not in TAGS:return body
    attrs=[]
    for key,value in node.attrs.items():
        if key in ATTRS:attrs.append(f' {key}="{escape((value or "")[:2000],quote=True)}"')
        elif key=='href' and node.tag=='a' and (value or '').lower().startswith('mailto:'):
            attrs.append(f' href="{escape(value[:300],quote=True)}"')
    return '<'+node.tag+''.join(attrs)+'>'+body+('' if node.tag=='br' else '</'+node.tag+'>')

def academic_html(doc,kind):
    nodes=list(doc.nodes())
    if kind=='classwork':
        chosen=[n for n in nodes if 'AssignmentClass' in n.attrs.get('class','').split() or n.attrs.get('id') in ['plnMain_ddlReportCardRuns','plnMain_ddlClasses']]
        if not any('AssignmentClass' in n.attrs.get('class','').split() for n in chosen):raise HacError('HAC did not return classwork tables. The account may have no current classes, or the layout has changed.',422)
    elif kind=='transcript':
        chosen=[n for n in nodes if (n.tag=='table' and ('rpTranscriptGroup_dgCourses_' in n.attrs.get('id','') or n.attrs.get('id','').endswith('tblCumGPAInfo'))) or 'lblYearValue_' in n.attrs.get('id','')]
        if not any('rpTranscriptGroup_dgCourses_' in n.attrs.get('id','') for n in chosen):raise HacError('HAC has no recognized transcript tables for this account.',422)
    else:
        ident={'schedule':'plnMain_dgSchedule2','report-card':'plnMain_dgReportCard','attendance':'plnMain_cldAttendance'}[kind]
        chosen=[n for n in nodes if n.attrs.get('id')==ident]
        if not chosen:raise HacError('HAC did not return the expected '+kind+' record.',422)
    return '<!doctype html><html><body>'+''.join(safe_html(n) for n in chosen)+'</body></html>'

class HacClient:
    def __init__(self):
        self.cookies=CookieJar();self.opener=build_opener(HTTPCookieProcessor(self.cookies),HacRedirects())
    def fetch(self,url,data=None):
        if not permitted(url):raise HacError('Unsupported HAC address.',400)
        headers={'User-Agent':'Mozilla/5.0 GradeXpress/3.0','Accept':'text/html','Cache-Control':'no-cache'}
        if data is not None:headers.update({'Content-Type':'application/x-www-form-urlencoded','Origin':BASE,'Referer':LOGIN})
        try:
            with self.opener.open(Request(url,data=data,headers=headers),timeout=20) as response:
                if not permitted(response.url):raise HacError('Unexpected HAC response address.')
                body=response.read(4_000_001)
                if len(body)>4_000_000:raise HacError('HAC returned a record too large to display.')
                return Document(body.decode(response.headers.get_content_charset() or 'utf-8',errors='replace'))
        except HTTPError as e:
            if e.code in (401,403):raise HacError('HAC rejected or expired this sign-in. Sign in again.',401) from None
            raise HacError('HAC is temporarily unavailable. Try again later.') from None
        except (URLError,TimeoutError,socket.timeout):raise HacError('Could not reach HAC. Check your connection and try again.') from None
    def login(self,username,password):
        doc=self.fetch(LOGIN)
        forms=[n for n in doc.nodes() if n.tag=='form' and any(x.attrs.get('name')=='LogOnDetails.Password' for x in n.all())]
        if len(forms)!=1:raise HacError('HAC sign-in has changed or requires a different authentication method.',409)
        form=forms[0];action=urljoin(LOGIN,form.attrs.get('action') or LOGIN)
        if action!=LOGIN or form.attrs.get('method','').lower()!='post':raise HacError('HAC returned an unsupported sign-in form.',409)
        fields={n.attrs['name']:n.attrs.get('value','') for n in form.all() if n.tag=='input' and n.attrs.get('type','').lower()=='hidden' and n.attrs.get('name')}
        if '__RequestVerificationToken' not in fields:raise HacError('HAC sign-in verification token is missing.',409)
        fields['LogOnDetails.UserName']=username;fields['LogOnDetails.Password']=password
        result=self.fetch(action,urlencode(fields).encode())
        # Credentials are used only for this one upstream POST, never retained on
        # the client object, in the application session, or in a database.
        fields.clear()
        if not logged_in(result):
            self.cookies.clear()
            raise HacError('HAC did not accept the sign-in. Check your credentials or complete any required account steps on official HAC. No automatic retries were made.',401)
    def record(self,kind):
        wrapper,frame=ROUTES[kind];doc=self.fetch(BASE+'/HomeAccess/'+wrapper)
        if password_page(doc):raise HacError('Your HAC session expired. Sign in again.',401)
        source=next((n.attrs.get('src') for n in doc.nodes() if n.tag=='iframe' and n.attrs.get('id')=='sg-legacy-iframe'),None)
        url=urljoin(BASE+'/HomeAccess/'+wrapper,source or '/HomeAccess/'+frame)
        if not permitted(url) or urlsplit(url).path.lower()!='/homeaccess/'+frame.lower():raise HacError('HAC returned an unexpected record frame.',409)
        record=self.fetch(url)
        if password_page(record):raise HacError('Your HAC session expired. Sign in again.',401)
        return academic_html(record,kind)
    def close(self):self.cookies.clear()
