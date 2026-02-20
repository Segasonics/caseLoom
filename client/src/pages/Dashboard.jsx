import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCases, createCase } from "../api.js";
import CaseList from "../components/CaseList.jsx";
import CaseForm from "../components/CaseForm.jsx";

export default function Dashboard() {
  const [cases, setCases] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");

  useEffect(() => {
    refreshCases();
  }, []);

  async function refreshCases() {
    const data = await fetchCases();
    setCases(data);
  }

  async function handleSelect(id) {
    setSelectedId(id);
    navigate(`/cases/${id}`);
  }

  async function handleCreateCase(payload) {
    const created = await createCase(payload);
    await refreshCases();
    await handleSelect(created._id);
    navigate(`/cases/${created._id}`);
  }

  const stats = useMemo(() => {
    const openCount = cases.filter((item) => item.status !== "closed").length;
    const closedCount = cases.filter((item) => item.status === "closed").length;
    return { open: openCount, closed: closedCount, total: cases.length };
  }, [cases]);

  const filteredCases = useMemo(() => {
    const query = search.trim().toLowerCase();
    return cases.filter((item) => {
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "open" && item.status !== "closed") ||
        (statusFilter === "closed" && item.status === "closed");
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.patientAlias.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [cases, search, statusFilter]);

  return (
    <div className="dashboard-shell">
      <section className="card dashboard-hero">
        <div>
          <h2>Today’s Workspace</h2>
          <p className="subtext">Start a new case or open an existing thread.</p>
        </div>
        <div className="hero-actions">
          <button className="primary" onClick={() => navigate("/cases")}>
            Open Case Thread
          </button>
          <span className="section-pill">{stats.open} active</span>
        </div>
      </section>

      <section className="overview-grid">
        <div className="stat-card">
          <div className="stat-label">Active Cases</div>
          <div className="stat-value">{stats.open}</div>
          <div className="stat-meta">Open and in progress</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Closed Cases</div>
          <div className="stat-value">{stats.closed}</div>
          <div className="stat-meta">Resolved or archived</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Cases</div>
          <div className="stat-value">{stats.total}</div>
          <div className="stat-meta">All time</div>
        </div>
      </section>

      <div className="dashboard-grid">
        <section className="card">
          <div className="section-header">
            <h3>Start a Case</h3>
            <span className="section-pill">New</span>
          </div>
          <CaseForm onCreate={handleCreateCase} />
        </section>

        <section className="card">
          <div className="section-header">
            <h3>Active Cases</h3>
            <span className="section-pill">{filteredCases.length}</span>
          </div>
          <div className="case-list-toolbar">
            <input
              className="input-ghost"
              placeholder="Search cases"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div className="filter-group">
              <button
                className={statusFilter === "open" ? "filter-pill active" : "filter-pill"}
                onClick={() => setStatusFilter("open")}
              >
                Open
              </button>
              <button
                className={statusFilter === "closed" ? "filter-pill active" : "filter-pill"}
                onClick={() => setStatusFilter("closed")}
              >
                Closed
              </button>
              <button
                className={statusFilter === "all" ? "filter-pill active" : "filter-pill"}
                onClick={() => setStatusFilter("all")}
              >
                All
              </button>
            </div>
          </div>
          <CaseList
            items={filteredCases}
            selectedId={selectedId}
            onSelect={handleSelect}
            emptyMessage="No cases match this filter."
          />
        </section>
      </div>
    </div>
  );
}
