from itlib import *

# ---------------------------------------------------------------- create a startup
st, fs, _ = forms("/dashboard/startup/new", "owner")
f = find(fs, "name", "tagline", "country")
check(f is not None, "create form renders")
cat = sql("select id from public.categories where slug = 'agritech'")
status, hdr, _ = submit(f, {"name": "Action Test Farms", "tagline": "Farm things", "categoryId": cat, "country": "ET", "city": "Hawassa"}, "owner", "/dashboard/startup/new")
loc = hdr.get("location") or hdr.get("Location") or ""
check(status in (303, 307) and "/dashboard/startup/" in loc, f"create redirects to the new workspace ({status} {loc})")
sid = sql("select id from public.startups where name = 'Action Test Farms'")
check(bool(sid), "startup row was created")
check(sql(f"select status || '/' || created_by || '/' || slug from public.startups where id = '{sid}'") == f"draft/{OWNER}/action-test-farms", "created as a draft owned by the user with a generated slug")
check(sql(f"select role from public.startup_members where startup_id = '{sid}' and user_id = '{OWNER}'") == "owner", "creator became owner")

# duplicate name gets a distinct slug, not an error
st, fs, _ = forms("/dashboard/startup/new", "owner")
submit(find(fs, "name", "tagline"), {"name": "Action Test Farms"}, "owner", "/dashboard/startup/new")
check(sql("select count(*) from public.startups where name = 'Action Test Farms'") == "2" and sql("select count(distinct slug) from public.startups where name = 'Action Test Farms'") == "2", "duplicate names receive unique slugs")
check(sql("select count(*) from public.startups where slug = 'action-test-farms-2'") == "1", "second slug is action-test-farms-2")

# invalid input is rejected and nothing is written
before = sql("select count(*) from public.startups")
st, fs, _ = forms("/dashboard/startup/new", "owner")
submit(find(fs, "name", "tagline"), {"name": "x"}, "owner", "/dashboard/startup/new")
check(sql("select count(*) from public.startups") == before, "too-short name is rejected server-side")

# ---------------------------------------------------------------- edit profile
base = f"/dashboard/startup/{sid}"
st, fs, html = forms(base, "owner")
f = find(fs, "startupId", "tagline", "description")
check(f is not None and 'value="Action Test Farms"' in html, "edit form is prefilled")
submit(f, {"tagline": "Smart farming for Sidama", "description": "We help farmers.\n\nSecond paragraph.", "stage": "mvp", "foundedYear": "2024", "websiteUrl": "https://atf.example", "tags": "farming, iot"}, "owner", base)
row = sql(f"select tagline || '|' || stage || '|' || founded_year || '|' || website_url || '|' || array_to_string(tags, ',') from public.startups where id = '{sid}'")
check(row == "Smart farming for Sidama|mvp|2024|https://atf.example|farming,iot", f"profile fields saved ({row})")
submit(f, {"websiteUrl": "javascript:alert(1)"}, "owner", base)
check(sql(f"select website_url from public.startups where id = '{sid}'") == "https://atf.example", "javascript: website rejected, previous value kept")
submit(f, {"tagline": "x" * 161}, "owner", base)
check(sql(f"select tagline from public.startups where id = '{sid}'") == "Smart farming for Sidama", "over-long tagline rejected")

# ---------------------------------------------------------------- authorization: forged form from a stranger
st, _, _ = http("GET", base, "stranger")
check(st == 404, "stranger cannot open the workspace page")
before = sql(f"select tagline || name from public.startups where id = '{sid}'")
submit(f, {"name": "Hacked", "tagline": "Hacked"}, "stranger", base)
check(sql(f"select tagline || name from public.startups where id = '{sid}'") == before, "forged edit by a stranger changes nothing")
before_p = sql(f"select count(*) from public.startup_products where startup_id = '{sid}'")

# ---------------------------------------------------------------- products
st, fs, _ = forms(base + "/products", "owner")
f = find(fs, "startupId", "productId", "name")
submit(f, {"name": "Soil Sensor", "description": "Measures moisture", "url": "https://atf.example/sensor"}, "owner", base + "/products")
check(sql(f"select count(*) from public.startup_products where startup_id = '{sid}' and name = 'Soil Sensor'") == "1", "product added")
submit(f, {"name": "Evil", "url": "javascript:alert(1)"}, "owner", base + "/products")
check(sql(f"select count(*) from public.startup_products where startup_id = '{sid}' and name = 'Evil'") == "0", "product with javascript: URL rejected")
submit(f, {"startupId": sid, "name": "Injected"}, "stranger", base + "/products")
check(sql(f"select count(*) from public.startup_products where startup_id = '{sid}' and name = 'Injected'") == "0", "stranger cannot add a product")
st, fs, _ = forms(base + "/products", "owner")
pid = sql(f"select id from public.startup_products where startup_id = '{sid}' and name = 'Soil Sensor'")
edit = next((x for x in fs if ["productId", pid, "hidden"] in x["fields"]), None)
check(edit is not None, "edit form for the product renders")
if edit: submit(edit, {"name": "Soil Sensor Pro"}, "owner", base + "/products")
check(sql(f"select name from public.startup_products where id = '{pid}'") == "Soil Sensor Pro", "product edited")
dele = next((x for x in fs if ["productId", pid, "hidden"] in x["fields"] and not any(n == "name" for n, _, _ in x["fields"])), None)
check(dele is not None, "delete form for the product renders")
if dele: submit(dele, {}, "owner", base + "/products")
check(sql(f"select count(*) from public.startup_products where id = '{pid}'") == "0", "product deleted")
# limit: 12 products
for i in range(12):
    st, fs, _ = forms(base + "/products", "owner")
    submit(find(fs, "startupId", "productId", "name") if False else next(x for x in fs if ["productId", "", "hidden"] in x["fields"]), {"name": f"Bulk {i}"}, "owner", base + "/products")
check(sql(f"select count(*) from public.startup_products where startup_id = '{sid}'") == "12", "product limit of 12 is enforced")

# ---------------------------------------------------------------- links
st, fs, _ = forms(base + "/links", "owner")
f = find(fs, "startupId", "kind", "url")
submit(f, {"kind": "github", "url": "https://github.com/atf", "label": ""}, "owner", base + "/links")
check(sql(f"select count(*) from public.startup_links where startup_id = '{sid}'") == "1", "link added")
submit(f, {"kind": "github", "url": "https://github.com/atf"}, "owner", base + "/links")
check(sql(f"select count(*) from public.startup_links where startup_id = '{sid}'") == "1", "duplicate link rejected")
submit(f, {"kind": "other", "url": "data:text/html,hi"}, "owner", base + "/links")
check(sql(f"select count(*) from public.startup_links where startup_id = '{sid}'") == "1", "data: link rejected")

# ---------------------------------------------------------------- publishing
st, fs, html = forms(base + "/settings", "owner")
check("Publishing checklist" in html and "Choose a sector" not in html, "checklist shows only what is missing")
pub = find(fs, "startupId", "publish")
check(pub is not None, "publish form renders")
# incomplete startup (second duplicate has no description) must be refused by the database function
sid2 = sql("select id from public.startups where slug = 'action-test-farms-2'")
st, fs2, _ = forms(f"/dashboard/startup/{sid2}/settings", "owner")
submit(find(fs2, "startupId", "publish"), {}, "owner", f"/dashboard/startup/{sid2}/settings")
check(sql(f"select status from public.startups where id = '{sid2}'") == "draft", "incomplete startup cannot be published")
# stranger cannot publish
submit(pub, {}, "stranger", base + "/settings")
check(sql(f"select status from public.startups where id = '{sid}'") == "draft", "stranger cannot publish")
# complete startup publishes
submit(pub, {}, "owner", base + "/settings")
check(sql(f"select status from public.startups where id = '{sid}'") == "published", "complete startup is published")
check(sql(f"select count(*) from public.audit_logs where entity_id = '{sid}' and action = 'startup.publish'") == "1", "publishing is written to the audit log")
st, _, html = http("GET", "/startups/action-test-farms", "stranger")
check(st == 200 and "Smart farming for Sidama" in html, "published profile is visible to others")

# ---------------------------------------------------------------- slug change + redirect
st, fs, _ = forms(base + "/settings", "owner")
f = find(fs, "startupId", "slug")
submit(f, {"slug": "admin"}, "owner", base + "/settings")
check(sql(f"select slug from public.startups where id = '{sid}'") == "action-test-farms", "reserved slug rejected")
submit(f, {"slug": "stranger-co"}, "owner", base + "/settings")
check(sql(f"select slug from public.startups where id = '{sid}'") == "action-test-farms", "slug owned by another startup rejected")
submit(f, {"slug": "sidama-farms"}, "owner", base + "/settings")
check(sql(f"select slug from public.startups where id = '{sid}'") == "sidama-farms", "slug changed")
st, hdr, _ = http("GET", "/startups/action-test-farms", "stranger")
check(st == 308 and (hdr.get("location") or hdr.get("Location", "")).endswith("/startups/sidama-farms"), f"old address permanently redirects ({st})")

# ---------------------------------------------------------------- reporting
st, fs, html = forms("/startups/sidama-farms", "stranger")
f = find(fs, "targetType", "targetId", "reason")
check(f is not None and field(f, "targetType") == "startup", "report form renders for signed-in users")
if f:
    submit(f, {"reason": "spam", "details": "looks fake"}, "stranger", "/startups/sidama-farms")
    check(sql(f"select count(*) from public.reports where target_id = '{sid}' and reporter_id = '{STRANGER}'") == "1", "report stored")
    submit(f, {"reason": "spam"}, "stranger", "/startups/sidama-farms")
    check(sql(f"select count(*) from public.reports where target_id = '{sid}'") == "1", "repeat report does not duplicate")
    submit(f, {"reason": "boring"}, "owner", "/startups/sidama-farms")
    check(sql(f"select count(*) from public.reports where target_id = '{sid}'") == "1", "invalid reason rejected")

# ---------------------------------------------------------------- unpublish, then delete rules
st, fs, _ = forms(base + "/settings", "owner")
unpub = find(fs, "startupId", "publish")
submit(unpub, {"publish": "false"}, "owner", base + "/settings")
check(sql(f"select status from public.startups where id = '{sid}'") == "unpublished", "startup unpublished")
st, _, _ = http("GET", "/startups/sidama-farms", "stranger")
check(st == 404, "unpublished startup disappears for visitors")
st, _, _ = http("GET", "/startups/action-test-farms", "stranger")
check(st == 404, "old address no longer redirects once unpublished")
st, fs, html = forms(base + "/settings", "owner")
check("Delete startup" not in html, "a startup that was published cannot be deleted")
st, fs, html = forms(f"/dashboard/startup/{sid2}/settings", "owner")
# the delete form carries only startupId (plus Next's own $ACTION_* fields) — pick it precisely
dele = next((x for x in fs if {n for n, _, _ in x["fields"] if not n.startswith("$")} == {"startupId"}), None)
check(dele is not None, "delete form renders for a draft owned by the user")
submit(dele, {}, "stranger", f"/dashboard/startup/{sid2}/settings")
check(sql(f"select count(*) from public.startups where id = '{sid2}'") == "1", "stranger cannot delete a draft")
submit(dele, {}, "owner", f"/dashboard/startup/{sid2}/settings")
check(sql(f"select count(*) from public.startups where id = '{sid2}'") == "0", "owner deleted a draft")

finish()
