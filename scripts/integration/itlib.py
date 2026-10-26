"""Shared helpers for the integration tests: forms are scraped from rendered HTML (including Next.js'
hidden action fields) and submitted as multipart POSTs — what a browser does without JavaScript. LOCAL ONLY."""
import os, re, subprocess, sys, time, uuid, urllib.request, urllib.error
from html.parser import HTMLParser

B = os.environ["B"]; DB = os.environ["DB"]
OWNER, STRANGER = os.environ["OWNER"], os.environ["STRANGER"]
COOKIES = {"owner": os.environ["OWNER_COOKIE"], "stranger": os.environ["STRANGER_COOKIE"]}
for _k in ("MOD", "VOTER", "UNVER"):
    if os.environ.get(_k + "_COOKIE"): COOKIES[_k.lower()] = os.environ[_k + "_COOKIE"]
failures = 0

def failed(): return failures

def ok(msg): print(f"  ok   {msg}")
def bad(msg):
    global failures; failures += 1; print(f"  FAIL {msg}")
def check(cond, msg): ok(msg) if cond else bad(msg)

def sql(q):
    r = subprocess.run(["psql", "-tA", "-d", DB, "-c", q], capture_output=True, text=True)
    return r.stdout.strip()

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *a, **k): return None
opener = urllib.request.build_opener(NoRedirect)

def http(method, path, who=None, data=None, headers=None):
    h = {"Origin": B, **(headers or {})}
    if who: h["Cookie"] = COOKIES[who]
    req = urllib.request.Request(B + path, data=data, method=method, headers=h)
    try:
        r = opener.open(req); return r.status, dict(r.headers), r.read().decode().replace("<!-- -->", "")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read().decode().replace("<!-- -->", "")

class FormParser(HTMLParser):
    def __init__(self):
        super().__init__(); self.forms = []; self.cur = None; self.sel = None; self.ta = None
    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "form": self.cur = {"fields": [], "action": a.get("action")}; self.forms.append(self.cur)
        elif self.cur is None: return
        elif tag == "input" and a.get("name"):
            t = a.get("type", "text")
            if t in ("checkbox", "radio") and "checked" not in a: return
            if t in ("submit", "button", "file"): return
            self.cur["fields"].append([a["name"], a.get("value", ""), t])
        elif tag == "select" and a.get("name"): self.sel = [a["name"], "", "select"]; self.cur["fields"].append(self.sel)
        elif tag == "option" and self.sel is not None and "selected" in a: self.sel[1] = a.get("value", "")
        elif tag == "textarea" and a.get("name"): self.ta = [a["name"], "", "textarea"]; self.cur["fields"].append(self.ta)
    def handle_data(self, d):
        if self.ta is not None: self.ta[1] += d
    def handle_endtag(self, tag):
        if tag == "form": self.cur = None
        if tag == "select": self.sel = None
        if tag == "textarea": self.ta = None

def forms(path, who):
    status, _, html = http("GET", path, who)
    p = FormParser(); p.feed(html); return status, p.forms, html

def find(forms_, *names):
    for f in forms_:
        have = {x[0] for x in f["fields"]}
        if all(n in have for n in names): return f
    return None

def submit(form, overrides, who, path):
    fields = {}
    order = []
    for n, v, _ in form["fields"]:
        if n not in fields: order.append(n)
        fields[n] = v
    fields.update(overrides)
    for n in overrides:
        if n not in order: order.append(n)
    boundary = "----buna" + uuid.uuid4().hex
    body = b""
    for n in order:
        body += (f'--{boundary}\r\nContent-Disposition: form-data; name="{n}"\r\n\r\n{fields[n]}\r\n').encode()
    body += f"--{boundary}--\r\n".encode()
    return http("POST", path, who, body, {"Content-Type": f"multipart/form-data; boundary={boundary}"})


def exact(forms_, names, **values):
    """First form whose non-$ field names equal `names` (and whose given field values match)."""
    for f in forms_:
        have = {n for n, _, _ in f["fields"] if not n.startswith("$")}
        if have == set(names) and all(field(f, k) == v for k, v in values.items()): return f
    return None

def field(form, name):
    for n, v, _ in form["fields"]:
        if n == name: return v
    return None

def finish():
    sys.exit(1 if failures else 0)
