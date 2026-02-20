import React, { useEffect, useState } from "react";
import { fetchCases } from "../api.js";
import toast from "react-hot-toast";
import AppointmentForm from "../components/AppointmentForm.jsx";
import AppointmentList from "../components/AppointmentList.jsx";
import RescheduleModal from "../components/RescheduleModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import CancelModal from "../components/CancelModal.jsx";
import { useDispatch, useSelector } from "react-redux";
import {
  loadAppointments,
  addAppointment,
  updateAppointmentStatus,
  removeAppointment
} from "../store/appointmentsSlice.js";

export default function BookAppointment() {
  const dispatch = useDispatch();
  const { items: appointments } = useSelector((state) => state.appointments);
  const [cases, setCases] = useState([]);
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);

  useEffect(() => {
    dispatch(loadAppointments());
    fetchCases().then(setCases);
  }, []);

  async function handleAdd(payload) {
    await dispatch(
      addAppointment({
        ...payload,
        caseId: selectedCaseId || undefined
      })
    );
  }

  async function handleRescheduleSave(newDateTime, reason) {
    if (!selectedAppointment) return;
    const payload = {
      ...selectedAppointment,
      scheduledFor: newDateTime,
      rescheduleReason: reason || ""
    };
    await dispatch(updateAppointmentStatus({ appointmentId: selectedAppointment._id, payload }));
    setRescheduleOpen(false);
    setSelectedAppointment(null);
  }

  function handleRescheduleClick(appointment) {
    setSelectedAppointment(appointment);
    setRescheduleOpen(true);
  }

  function handleDeleteClick(appointment) {
    setDeleteTarget(appointment);
    setDeleteOpen(true);
  }

  function handleCancelClick(appointment) {
    setCancelTarget(appointment);
    setCancelOpen(true);
  }

  async function handleStatusUpdate(appointment, nextStatus) {
    const payload = {
      ...appointment,
      status: nextStatus,
      statusReason: ""
    };
    await dispatch(updateAppointmentStatus({ appointmentId: appointment._id, payload }));
    toast.success(`Marked as ${nextStatus.replace("_", " ")}.`);
  }

  async function confirmCancel(reason) {
    if (!cancelTarget) return;
    const payload = {
      ...cancelTarget,
      status: "cancelled",
      statusReason: reason
    };
    await dispatch(updateAppointmentStatus({ appointmentId: cancelTarget._id, payload }));
    setCancelOpen(false);
    setCancelTarget(null);
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    await dispatch(removeAppointment(deleteTarget._id));
    toast.success("Appointment deleted.");
    setDeleteOpen(false);
    setDeleteTarget(null);
  }

  return (
    <section className="panel book-appointments">
      <div className="card book-panel">
        <h2>Book Appointment</h2>
        <label className="form-field">
          Link to Case (optional)
          <select value={selectedCaseId} onChange={(e) => setSelectedCaseId(e.target.value)}>
            <option value="">Not linked</option>
            {cases.map((item) => (
              <option key={item._id} value={item._id}>
                {item.title} · {item.patientAlias}
              </option>
            ))}
          </select>
        </label>
        <AppointmentForm onAdd={handleAdd} />
      </div>

      <div className="card book-panel book-list-panel">
        <AppointmentList
          title="All Appointments"
          items={appointments}
          onReschedule={handleRescheduleClick}
          onDelete={handleDeleteClick}
          onCancel={handleCancelClick}
          onComplete={(item) => handleStatusUpdate(item, "completed")}
          onNoShow={(item) => handleStatusUpdate(item, "no_show")}
        />
      </div>
      <RescheduleModal
        open={rescheduleOpen}
        appointment={selectedAppointment}
        onConfirm={handleRescheduleSave}
        onCancel={() => {
          setRescheduleOpen(false);
          setSelectedAppointment(null);
        }}
      />
      <ConfirmModal
        open={deleteOpen}
        title="Delete appointment?"
        message="This will permanently remove the appointment."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={confirmDelete}
        onCancel={() => {
          setDeleteOpen(false);
          setDeleteTarget(null);
        }}
      />
      <CancelModal
        open={cancelOpen}
        appointment={cancelTarget}
        onConfirm={confirmCancel}
        onCancel={() => {
          setCancelOpen(false);
          setCancelTarget(null);
        }}
      />
    </section>
  );
}
