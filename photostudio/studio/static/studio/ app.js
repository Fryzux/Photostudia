function qs(sel, root=document){ return root.querySelector(sel); }
function qsa(sel, root=document){ return [...root.querySelectorAll(sel)]; }

function getRole(){ return localStorage.getItem("role") || "client"; }
function setRole(r){ localStorage.setItem("role", r); }
function getToken(){ return localStorage.getItem("token") || ""; }
function setToken(t){ localStorage.setItem("token", t); }

async function apiFetch(url, { method="GET", body=null } = {}) {
  const headers = { "Accept":"application/json" };
  const token = getToken();
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
  const ct = res.headers.get("content-type") || "";
  const data = ct.includes("application/json") ? await res.json() : null;

  if (!res.ok) throw new Error((data && (data.detail || data.error)) || `HTTP ${res.status}`);
  return data;
}

function ensureAuth(){
  if (!getToken()) location.href = "/auth/";
}
