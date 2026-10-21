# Irving ISD Xpress — one website, no addons

This version runs a Python web server that serves both Xpress and its HAC sign-in
connection. Students use a normal browser. There is no extension to install.

## Start locally

1. Install Python 3.10 or newer on the computer hosting the website.
2. Extract this ZIP.
3. From the extracted folder, run `python server.py`.
4. Open http://127.0.0.1:4183/grades.html.
5. Enter your HAC username and password in Xpress's sign-in form.

Python is a server requirement, not a student browser addon. When deployed, students
only need the website address. Opening index.html as a file or using a static file
server does not provide the sign-in API.

## How sign-in works

Xpress retrieves the official HAC login form and its verification token, forwards
your entered credentials to HAC over HTTPS, and keeps the resulting HAC cookies
in server memory. The password is not saved or logged by Xpress. Only recognized
academic tables are returned to the browser; upstream scripts, identity banners,
hidden inputs, cookies, and remote resources are excluded.

After sign-in, Xpress displays courses and assignments, then reads the default
schedule, attendance month, report card, and transcript. Refresh fetches changes.
This version uses the account's default student and reporting period. Additional
verification, CAPTCHA, account-recovery steps, student switching, and period/month
selection are not automated; use official HAC for those workflows.

Temporary sessions expire after 15 minutes without website requests and always
expire after one hour. A visible page periodically checks its session. Signing out
or stopping the server clears its imported records and HAC cookies. Passwords,
upstream cookies, and academic records are not stored in localStorage or a database.
Personal planner tasks and theme choices still use browser-local storage.

## Verification status

The public HAC form and its field names were inspected. On October 21, 2026, the
project owner completed a real sign-in in this website and confirmed that grades
appeared. This is user-confirmed live authentication and classwork retrieval.
Automated tests use synthetic upstream responses and exercise sign-in, session
isolation, sanitization, logout, expiry, all five academic views, and the browser
dashboard. Live schedule, attendance, transcript, and report-card values have not
been independently inspected. The browser tool's security policy blocked inspection
of the signed-in local tab.

## Deploying

This is a server application, not a static site ZIP. Use a host that runs a persistent
Python service and place it behind HTTPS. Set XPRESS_ORIGIN to the exact public
origin, for example https://your-domain.example, and use a trusted reverse proxy
that preserves the Host header. Plain HTTP is accepted only on loopback locally.
The service keeps sessions in process memory; run one process, or add an appropriate
shared session design before scaling. Restarting the service signs everyone out.

Use production process supervision, TLS, appropriate upstream-access authorization,
and a privacy review before accepting other students' credentials. This local
prototype has not been subjected to production security review or load testing.
Do not enable request-body logging at a reverse proxy or hosting provider.

This independent resource is not operated or endorsed by Irving ISD. Scholarship
entries retain their original source-review dates and historical status. GPA and
what-if figures are estimates, not official district calculations. Push reminders
and biometrics are not implemented in this version.
