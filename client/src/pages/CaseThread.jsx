import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  loadCases,
  loadCaseDetail,
  clearSelected,
  addTimelineEvent,
  addDecisionPoint,
  addTask,
  toggleTask,
  removeTask,
  closeCase,
  reopenCase,
  removeCase
} from "../store/casesSlice.js";
import { generateCaseSummary, generateDecisionDraft } from "../api.js";
import CaseList from "../components/CaseList.jsx";
import CaseDetail from "../components/CaseDetail.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import AIAssistPanel from "../components/AIAssistPanel.jsx";

export default function CaseThread() {
  const { id } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items: cases, selected } = useSelector((state) => state.cases);
  const [selectedId, setSelectedId] = useState(id || null);
  const [showDelete, setShowDelete] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("open");
  const [summary, setSummary] = useState("");
  const [summaryUpdatedAt, setSummaryUpdatedAt] = useState(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState("");
  const [draftRationale, setDraftRationale] = useState("");
  const [draftNextStep, setDraftNextStep] = useState("");
  const [draftDecisionType, setDraftDecisionType] = useState("lab_followup");
  const [decisionPrefill, setDecisionPrefill] = useState({
    key: 0,
    rationale: "",
    nextStep: "",
  });

  useEffect(() => {
    dispatch(loadCases());
  }, [dispatch]);

  useEffect(() => {
    if (!id) {
      dispatch(clearSelected());
      setSelectedId(null);
      setSummary("");
      setSummaryUpdatedAt(null);
      setSummaryError("");
      setDraftError("");
      setDraftRationale("");
      setDraftNextStep("");
      return;
    }
    setSelectedId(id);
    dispatch(loadCaseDetail(id));
  }, [id]);

  useEffect(() => {
    if (!selected?.case) return;
    setSummary(selected.case.aiSummary || "");
    setSummaryUpdatedAt(selected.case.aiSummaryUpdatedAt || null);
  }, [selected]);

  function handleSelect(caseId) {
    setSelectedId(caseId);
    navigate(`/cases/${caseId}`);
  }

  async function handleAddTimeline(payload) {
    setError("");
    await dispatch(addTimelineEvent({ caseId: id, payload }));
  }

  async function handleAddDecisionPoint(payload) {
    setError("");
    await dispatch(addDecisionPoint({ caseId: id, payload }));
  }

  async function refreshCaseDetail() {
    if (!id) return;
    await dispatch(loadCaseDetail(id));
  }

  async function handleAddTask(payload) {
    setError("");
    await dispatch(addTask({ caseId: id, payload }));
  }

  async function handleToggleTask(taskId, nextStatus) {
    setError("");
    await dispatch(toggleTask({ caseId: id, taskId, status: nextStatus }));
  }

  async function handleDeleteTask(taskId) {
    setError("");
    await dispatch(removeTask({ caseId: id, taskId }));
  }

  async function handleCloseCase() {
    if (!id) return;
    setError("");
    await dispatch(closeCase(id));
  }

  async function handleReopenCase() {
    if (!id) return;
    setError("");
    await dispatch(reopenCase(id));
  }

  async function handleDeleteCase() {
    if (!id) return;
    setShowDelete(true);
  }

  async function confirmDelete() {
    if (!id) return;
    setError("");
    await dispatch(removeCase(id));
    await dispatch(loadCases());
    navigate("/cases");
    setShowDelete(false);
  }

  async function handleGenerateSummary() {
    if (!id) return;
    setSummaryError("");
    setSummaryLoading(true);
    const res = await generateCaseSummary(id);
    if (res.error) {
      setSummaryError(res.error);
    } else {
      setSummary(res.aiSummary || "");
      setSummaryUpdatedAt(res.aiSummaryUpdatedAt || null);
      if (selected) {
        dispatch(loadCaseDetail(id));
      }
    }
    setSummaryLoading(false);
  }

  async function handleDraftDecision() {
    if (!id) return;
    setDraftError("");
    setDraftLoading(true);
    const res = await generateDecisionDraft(id, draftDecisionType);
    if (res.error) {
      setDraftError(res.error);
    } else {
      setDraftRationale(res.rationaleDraft || "");
      setDraftNextStep(res.nextStepDraft || "");
    }
    setDraftLoading(false);
  }

  function handleUseDraft() {
    setDecisionPrefill((prev) => ({
      key: prev.key + 1,
      rationale: draftRationale,
      nextStep: draftNextStep,
    }));
  }

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
    <div className="case-thread-layout">
      <section className="panel">
        <div className="card top-card cases-card">
          <div className="section-header">
            <h2>Active Cases</h2>
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
                className={
                  statusFilter === "open" ? "filter-pill active" : "filter-pill"
                }
                onClick={() => setStatusFilter("open")}
              >
                Open
              </button>
              <button
                className={
                  statusFilter === "closed"
                    ? "filter-pill active"
                    : "filter-pill"
                }
                onClick={() => setStatusFilter("closed")}
              >
                Closed
              </button>
              <button
                className={
                  statusFilter === "all" ? "filter-pill active" : "filter-pill"
                }
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
        </div>
      </section>

      <section className="panel">
        <div className="card top-card ai-card">
          <div className="section-header">
            <h2>AI Assist</h2>
            <span className="section-pill">Beta</span>
          </div>
          <AIAssistPanel
            hasCase={Boolean(selected?.case)}
            summary={summary}
            summaryUpdatedAt={summaryUpdatedAt}
            summaryLoading={summaryLoading}
            summaryError={summaryError}
            onGenerateSummary={handleGenerateSummary}
            decisionType={draftDecisionType}
            onDecisionTypeChange={setDraftDecisionType}
            draftLoading={draftLoading}
            draftError={draftError}
            draftRationale={draftRationale}
            draftNextStep={draftNextStep}
            onDraft={handleDraftDecision}
            onUseDraft={handleUseDraft}
          />
        </div>
      </section>

      <section className="panel case-thread-full">
        <div className="card thread-card">
          <div className="section-header">
            <h2>Case Thread</h2>
            <span className="section-pill">Live</span>
          </div>
          <CaseDetail
            data={selected}
            onAddTimeline={handleAddTimeline}
            onAddDecisionPoint={handleAddDecisionPoint}
            onAddTask={handleAddTask}
            onToggleTask={handleToggleTask}
            onDeleteTask={handleDeleteTask}
            onCloseCase={handleCloseCase}
            onReopenCase={handleReopenCase}
            onDeleteCase={handleDeleteCase}
            onRefresh={refreshCaseDetail}
            decisionPrefill={decisionPrefill}
          />
          {error ? <div className="form-error">{error}</div> : null}
        </div>
      </section>

      <ConfirmModal
        open={showDelete}
        title="Delete case?"
        message="This will permanently remove the case and its related data. This action cannot be undone."
        confirmLabel="Delete case"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => setShowDelete(false)}
      />
    </div>
  );
}
