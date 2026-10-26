import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCheck, ChevronDown,
  CircleHelp, Clock3, Gift, House, Inbox, Leaf, Menu, Plus, Search,
  ShieldCheck, Sparkles, Tag, Trash2, WalletCards, X,
} from "lucide-react";

const EMPTY_REWARD = {
  merchant: "", title: "", value: "", expires_on: "", redemption_url: "",
  instructions: "", notes: "",
};
const STORAGE_KEY = "slowday.rewards.v1";
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

function readRewards() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch { return []; }
}

function writeRewards(rewards) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rewards));
}

async function api(url, options = {}) {
  const response = await fetch(`${API_BASE_URL}${url}`, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong. Try again.");
  return data;
}

function deadline(expiresOn) {
  if (!expiresOn) return { text: "No expiry date", days: null, tone: "quiet" };
  const [year, month, day] = expiresOn.split("-").map(Number);
  const date = new Date(year, month - 1, day, 12);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.round((date - today) / 86400000);
  const text = days < 0 ? `Expired ${Math.abs(days)} ${Math.abs(days) === 1 ? "day" : "days"} ago`
    : days === 0 ? "Expires today"
      : days === 1 ? "Expires tomorrow"
        : `Expires ${date.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  return { text, days, tone: days < 0 ? "expired" : days <= 7 ? "soon" : "normal" };
}

function formatDate(date) {
  return new Intl.DateTimeFormat(undefined, { weekday: "long", month: "long", day: "numeric" }).format(date);
}

function initials(name) {
  return (name || "R").trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function RewardCard({ reward, onEdit, onStatus, onDelete }) {
  const date = deadline(reward.expires_on);
  return (
    <article className={`reward-card ${date.tone === "expired" && reward.status === "active" ? "reward-card-expired" : ""}`}>
      <div className="reward-card-top">
        <div className="merchant-mark">{initials(reward.merchant || reward.title)}</div>
        <div className="merchant-copy"><span className="merchant-name">{reward.merchant || "Saved reward"}</span><span className="merchant-caption">Reward offer</span></div>
        <button className="icon-button card-menu" aria-label={`Delete ${reward.title}`} onClick={() => onDelete(reward)}><Trash2 size={16} /></button>
      </div>
      <div className="reward-card-content">
        <h3>{reward.title}</h3>
        {reward.value && <p className="reward-amount">{reward.value}</p>}
        {reward.instructions && <div className="reward-instructions"><span>REDEMPTION</span><p>{reward.instructions}</p></div>}
        {reward.notes && <p className="reward-personal-note">“{reward.notes}”</p>}
      </div>
      <div className="reward-card-meta">
        <span className={`deadline-pill ${reward.status === "redeemed" ? "redeemed" : date.tone}`}>
          {reward.status === "redeemed" ? <><Check size={13} /> Redeemed</> : <><CalendarDays size={13} /> {date.text}</>}
        </span>
        {reward.redemption_url && <a className="open-offer" href={reward.redemption_url} target="_blank" rel="noopener noreferrer" aria-label={`Open ${reward.title} offer`}><ArrowUpRight size={15} /></a>}
      </div>
      <div className="reward-card-actions">
        <button className="button button-complete" onClick={() => onStatus(reward)}>{reward.status === "active" ? <><CheckCheck size={15} /> Mark redeemed</> : <><Inbox size={15} /> Move to to-do</>}</button>
        <button className="text-button" onClick={() => onEdit(reward)}>Edit details</button>
      </div>
    </article>
  );
}

function RewardDialog({ open, model, initialReward, onClose, onSaved }) {
  const [mode, setMode] = useState("ai");
  const [source, setSource] = useState("");
  const [form, setForm] = useState(EMPTY_REWARD);
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [extracted, setExtracted] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("ai");
    setSource("");
    setForm(initialReward ? { ...EMPTY_REWARD, ...initialReward } : { ...EMPTY_REWARD });
    setEditingId(initialReward?.id ?? null);
    setBusy(false);
    setError("");
    setExtracted(false);
  }, [open, initialReward]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => { if (event.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, busy, onClose]);

  if (!open) return null;

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function extractOffer() {
    if (!source.trim()) { setError("Paste the offer text first."); return; }
    setBusy(true); setError("");
    try {
      const result = await api("/api/analyze", { method: "POST", body: JSON.stringify({ text: source }) });
      setForm((current) => ({ ...current, ...result.reward }));
      setExtracted(true);
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  }

  async function saveReward(event) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      onSaved(editingId ? "Reward details updated." : "Reward added to your shelf.", form, editingId);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally { setBusy(false); }
  }

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="reward-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <div className="dialog-header"><div><p className="eyebrow">A little less to remember</p><h2 id="dialog-title">{editingId ? "Edit your reward" : "Add a reward"}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close"><X size={19} /></button></div>
        {!editingId && <div className="dialog-tabs" role="tablist" aria-label="How to add your reward">
          <button className={mode === "ai" ? "selected" : ""} onClick={() => { setMode("ai"); setError(""); }} role="tab" aria-selected={mode === "ai"}><Sparkles size={15} /> Let AI read it</button>
          <button className={mode === "manual" ? "selected" : ""} onClick={() => { setMode("manual"); setError(""); }} role="tab" aria-selected={mode === "manual"}><Tag size={15} /> Enter it myself</button>
        </div>}
        {!editingId && mode === "ai" && <div className="ai-capture">
          {model?.model_ready ? <div className="model-tip"><Sparkles size={16} /><span><strong>Hosted AI is ready · {model.model}</strong><br />When you choose Extract, this offer text is sent to the site’s AI provider. Saved rewards stay in this browser.</span></div> : <div className="model-warning"><CircleHelp size={17} /><span><strong>Hosted AI is taking a nap</strong><br />AI extraction is temporarily unavailable. You can still enter and save the details manually.</span></div>}
          <label className="field-label" htmlFor="offer-source">Paste an email, text, or offer details</label>
          <textarea id="offer-source" className="offer-source" value={source} onChange={(event) => setSource(event.target.value)} placeholder={'“Your 1,200 points expire on November 30. Redeem at example.com/rewards…”'} />
          <div className="extract-row"><span>We’ll find the merchant, value, expiry and steps.</span><button className="button button-ai" type="button" onClick={extractOffer} disabled={!model?.model_ready || busy}>{busy ? <span className="spinner" /> : <Sparkles size={15} />}{busy ? "Reading offer…" : extracted ? "Read again" : "Extract details"}</button></div>
        </div>}
        <form className="reward-edit-form" onSubmit={saveReward}>
          <div className="form-section-label"><span>{mode === "ai" && !editingId ? "Review and edit" : "Reward details"}</span><span>Fields marked * are required</span></div>
          <div className="form-grid">
            <label className="field-label">Merchant<input name="merchant" value={form.merchant} onChange={updateField} placeholder="e.g. Green Market" /></label>
            <label className="field-label">Reward name *<input name="title" value={form.title} onChange={updateField} placeholder="e.g. $10 welcome credit" required /></label>
            <label className="field-label">Value<input name="value" value={form.value} onChange={updateField} placeholder="e.g. 1,200 points" /></label>
            <label className="field-label">Expiry date<input name="expires_on" type="date" value={form.expires_on} onChange={updateField} /></label>
            <label className="field-label span-two">How to redeem<input name="instructions" value={form.instructions} onChange={updateField} placeholder="Any steps or conditions to remember" /></label>
            <label className="field-label span-two">Redemption link<input name="redemption_url" type="url" value={form.redemption_url} onChange={updateField} placeholder="https://…" /></label>
            <label className="field-label span-two">Note to yourself<input name="notes" value={form.notes} onChange={updateField} placeholder="Optional reminder" /></label>
          </div>
          {error && <p className="dialog-error" role="alert">{error}</p>}
          <div className="dialog-actions"><button className="button button-cancel" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-save" type="submit" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Save to my shelf"}<ArrowRight size={15} /></button></div>
        </form>
      </section>
    </div>
  );
}

export default function App() {
  const [rewards, setRewards] = useState(readRewards);
  const [model, setModel] = useState(null);
  const [view, setView] = useState("overview");
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingReward, setEditingReward] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");

  const today = new Date();
  const active = rewards.filter((reward) => reward.status === "active");
  const redeemed = rewards.filter((reward) => reward.status === "redeemed");
  const expiring = active.filter((reward) => {
    const days = deadline(reward.expires_on).days;
    return days !== null && days >= 0 && days <= 7;
  });

  const shownRewards = useMemo(() => {
    let list = rewards;
    if (view === "overview") list = rewards.filter((reward) => reward.status === "active");
    if (view === "expiring") list = rewards.filter((reward) => {
      const days = deadline(reward.expires_on).days;
      return reward.status === "active" && days !== null && days >= 0 && days <= 7;
    });
    if (view === "redeemed") list = rewards.filter((reward) => reward.status === "redeemed");
    const search = query.trim().toLowerCase();
    if (search) list = list.filter((reward) => [reward.title, reward.merchant, reward.value, reward.instructions, reward.notes].join(" ").toLowerCase().includes(search));
    return [...list].sort((a, b) => {
      if (a.status !== b.status) return a.status === "active" ? -1 : 1;
      const first = deadline(a.expires_on).days ?? Infinity;
      const second = deadline(b.expires_on).days ?? Infinity;
      return first - second;
    });
  }, [rewards, view, query]);

  useEffect(() => {
    let alive = true;
    api("/api/health").then((health) => {
      if (!alive) return;
      setModel(health);
    }).catch(() => { if (alive) setModel({ model_ready: false, model: "AI temporarily unavailable" }); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(""), 3200);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    document.body.classList.toggle("dialog-open", dialogOpen);
    return () => document.body.classList.remove("dialog-open");
  }, [dialogOpen]);

  useEffect(() => {
    function focusSearch(event) {
      const target = event.target;
      if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(target.tagName) && !target.isContentEditable) {
        event.preventDefault();
        document.querySelector("#reward-search")?.focus();
      }
    }
    window.addEventListener("keydown", focusSearch);
    return () => window.removeEventListener("keydown", focusSearch);
  }, []);

  function saveReward(form, editingId) {
    const next = editingId
      ? rewards.map((reward) => reward.id === editingId ? { ...reward, ...form } : reward)
      : [{ ...form, id: (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`), status: "active", created_at: new Date().toISOString() }, ...rewards];
    writeRewards(next);
    setRewards(next);
  }

  function startAdd() { setEditingReward(null); setDialogOpen(true); setMobileNavOpen(false); }
  function startEdit(reward) { setEditingReward(reward); setDialogOpen(true); }

  function updateStatus(reward) {
    const nextStatus = reward.status === "active" ? "redeemed" : "active";
    const next = rewards.map((item) => item.id === reward.id ? { ...item, status: nextStatus } : item);
    writeRewards(next); setRewards(next);
    setToast(nextStatus === "redeemed" ? "Marked as redeemed. Nice one!" : "Moved back to your to-do list.");
  }

  function deleteReward(reward) {
    if (!window.confirm(`Delete “${reward.title}”?`)) return;
    const next = rewards.filter((item) => item.id !== reward.id);
    writeRewards(next); setRewards(next);
    setToast("Reward removed from your shelf.");
  }

  const activeNav = [
    { id: "overview", label: "Overview", icon: House, count: null },
    { id: "all", label: "All rewards", icon: WalletCards, count: rewards.length },
    { id: "expiring", label: "Expiring soon", icon: Clock3, count: expiring.length },
    { id: "redeemed", label: "Redeemed", icon: CheckCheck, count: redeemed.length },
  ];
  const pageTitles = { overview: "Your rewards, at your pace.", all: "Your saved rewards", expiring: "Coming up soon", redeemed: "Good things, redeemed." };
  const viewHeading = view === "overview" ? "On your shelf" : pageTitles[view];
  return (
    <div className="app-shell">
      {mobileNavOpen && <button className="mobile-scrim" aria-label="Close menu" onClick={() => setMobileNavOpen(false)} />}
      <aside className={`sidebar ${mobileNavOpen ? "sidebar-open" : ""}`}>
        <a className="brand" href="#overview" onClick={() => setView("overview")}><span className="brand-mark"><Leaf size={17} /></span><span>slowday<span className="brand-period">.</span></span></a>
        <div className="sidebar-label">YOUR SPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {activeNav.map(({ id, label, icon: Icon, count }) => <button key={id} className={`nav-item ${view === id ? "nav-active" : ""}`} onClick={() => { setView(id); setMobileNavOpen(false); }}><Icon size={17} strokeWidth={1.8} /><span>{label}</span>{count !== null && <span className="nav-count">{count}</span>}</button>)}
        </nav>
        <button className="sidebar-add" onClick={startAdd}><Plus size={16} /> Add a reward</button>
        <div className="sidebar-spacer" />
        <div className={`sidebar-ai ${model?.model_ready ? "ai-online" : "ai-offline"}`}>
          <div className="ai-orb"><Sparkles size={15} /></div>
          <div className="ai-copy"><strong>{model?.model_ready ? "Hosted AI is ready" : "AI is taking a nap"}</strong><span>{model?.model_ready ? model.model : "Manual entry still works"}</span></div>
          <span className="ai-state-dot" />
        </div>
        <div className="sidebar-foot"><ShieldCheck size={14} /> Rewards saved in this browser.</div>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <button className="icon-button mobile-menu" onClick={() => setMobileNavOpen(true)} aria-label="Open navigation"><Menu size={20} /></button>
          <div className="today-label"><span className="today-greeting">A little space for future you</span><span className="today-date">{formatDate(today)}</span></div>
          <div className="topbar-actions"><label className="search-box"><Search size={16} /><input id="reward-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a reward…" aria-label="Search rewards" /><kbd>/</kbd></label><button className="button button-primary" onClick={startAdd}><Plus size={16} /> <span>Add reward</span></button></div>
        </header>
        <main className="dashboard-main">
          {view === "overview" && <>
            <section className="welcome-panel">
              <div className="welcome-copy"><span className="welcome-kicker"><Sparkles size={13} /> YOUR PERSONAL REWARDS SHELF</span><h1>{pageTitles.overview}</h1><p>Coupons, points, little perks. Keep them here and let your brain take the afternoon off.</p><button className="welcome-cta" onClick={startAdd}>Save a reward <ArrowRight size={15} /></button></div>
              <div className="welcome-illustration" aria-hidden="true"><div className="welcome-sun" /><div className="welcome-cloud cloud-one" /><div className="welcome-cloud cloud-two" /><div className="welcome-branch" /><div className="welcome-sloth"><div className="welcome-sloth-face"><i /><i /><b /></div></div><span className="welcome-sticker">slow & steady</span></div>
            </section>
            <section className="stat-grid" aria-label="Reward summary">
              <div className="stat-card"><div className="stat-icon stat-green"><WalletCards size={17} /></div><div className="stat-content"><span>Saved for later</span><strong>{active.length}</strong><small>{active.length === 1 ? "one little thing" : "little things waiting"}</small></div><span className="stat-decoration">✳</span></div>
              <div className="stat-card"><div className="stat-icon stat-amber"><Clock3 size={17} /></div><div className="stat-content"><span>Expiring in 7 days</span><strong>{expiring.length}</strong><small>{expiring.length ? "A gentle nudge to use these" : "Nothing urgent on the horizon"}</small></div><span className="stat-decoration stat-sun">☼</span></div>
              <div className="stat-card"><div className="stat-icon stat-lilac"><CheckCheck size={17} /></div><div className="stat-content"><span>Already enjoyed</span><strong>{redeemed.length}</strong><small>Good things put to good use</small></div><span className="stat-decoration stat-check">✓</span></div>
            </section>
          </>}

          <section className="rewards-section">
            <div className="rewards-heading"><div><p className="eyebrow">{view === "overview" ? "YOUR COLLECTION" : "REWARDS"}</p><h2>{viewHeading}</h2><p className="section-description">{view === "overview" ? "Your active rewards, with the soonest expiry up front." : view === "expiring" ? "Offers that expire in the next seven days." : view === "redeemed" ? "A little record of rewards you’ve put to use." : "Every saved reward, sorted by when it expires."}</p></div><div className="view-tools"><span className="result-count">{shownRewards.length} {shownRewards.length === 1 ? "reward" : "rewards"}</span><div className="sort-button" aria-label="Rewards sorted by expiry date"><CalendarDays size={14} /> Expiry date <ChevronDown size={14} /></div></div></div>
          {shownRewards.length ? <div className="reward-grid">{shownRewards.map((reward) => <RewardCard key={reward.id} reward={reward} onEdit={startEdit} onStatus={updateStatus} onDelete={deleteReward} />)}</div> : <div className="empty-state"><div className="empty-state-icon"><Gift size={23} /></div><h3>{query ? "No rewards match that search" : view === "expiring" ? "Nothing expiring this week" : view === "redeemed" ? "Your redeemed rewards will live here" : "Your shelf is ready for something good"}</h3><p>{query ? "Try a different merchant or reward name." : view === "expiring" ? "You’re all caught up. Enjoy the breathing room." : view === "redeemed" ? "Mark a reward as redeemed once you’ve used it." : "Save an offer and let hosted AI pick out the details."}</p>{!query && view !== "redeemed" && <button className="button button-primary" onClick={startAdd}><Plus size={15} /> Add your first reward</button>}</div>}
          </section>

          {view === "overview" && <section className="calm-note"><div className="calm-note-icon"><Leaf size={16} /></div><div><strong>Slowday promise</strong><p>We’ll sort rewards by expiry and keep the fine print close. No alerts, noise, or account required.</p></div><span className="calm-note-spark">✳</span></section>}
          <footer className="page-footer"><span>Made for the things we keep meaning to do.</span><span><span className="footer-dot" /> Open source · Browser-saved rewards · Hosted AI</span></footer>
        </main>
      </div>
      <RewardDialog open={dialogOpen} model={model} initialReward={editingReward} onClose={() => setDialogOpen(false)} onSaved={(message, form, editingId) => { saveReward(form, editingId); setToast(message); }} />
      {toast && <div className="toast" role="status"><Check size={16} />{toast}<button onClick={() => setToast("")} aria-label="Dismiss message"><X size={15} /></button></div>}
    </div>
  );
}
