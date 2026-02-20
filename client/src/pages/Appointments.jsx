import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  loadAppointments,
  updateAppointmentStatus,
  removeAppointment
} from "../store/appointmentsSlice.js";
import toast from "react-hot-toast";
import AppointmentList from "../components/AppointmentList.jsx";
import RescheduleModal from "../components/RescheduleModal.jsx";
import ConfirmModal from "../components/ConfirmModal.jsx";
import CancelModal from "../components/CancelModal.jsx";

export default function Appointments() {
  const dispatch = useDispatch();
  const { items: appointments } = useSelector((state) => state.appointments);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [selectedAppointment, setSelectedAppointment] = useState(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [viewMode, setViewMode] = useState("week");
  const [activeDate, setActiveDate] = useState(new Date());

  useEffect(() => {
    dispatch(loadAppointments());
  }, []);

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

  const { today, upcoming, past } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const todayList = [];
    const upcomingList = [];
    const pastList = [];

    appointments.forEach((item) => {
      const date = new Date(item.scheduledFor);
      if (date >= start && date < end) {
        todayList.push(item);
      } else if (date >= end) {
        upcomingList.push(item);
      } else {
        pastList.push(item);
      }
    });

    return { today: todayList, upcoming: upcomingList, past: pastList };
  }, [appointments]);

  function startOfWeek(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(d.setDate(diff));
  }

  function addDays(date, days) {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  const weekStart = startOfWeek(activeDate);
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));

  function startOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  function endOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0);
  }

  function monthGridDays(date) {
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const startDay = start.getDay();
    const gridStart = addDays(start, -((startDay + 6) % 7));
    const days = [];
    let cursor = gridStart;
    while (cursor <= end || days.length % 7 !== 0) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
      if (days.length >= 42) break;
    }
    return days;
  }

  const monthDays = monthGridDays(activeDate);

  function appointmentsForDay(day) {
    return appointments.filter((item) => {
      const date = new Date(item.scheduledFor);
      return (
        date.getFullYear() === day.getFullYear() &&
        date.getMonth() === day.getMonth() &&
        date.getDate() === day.getDate()
      );
    });
  }

  return (
    <section className="panel">
      <div className="card">
        <div className="appointments-header">
          <h2>Appointments</h2>
          <div className="view-toggle">
            <button
              className={viewMode === "day" ? "filter-pill active" : "filter-pill"}
              onClick={() => setViewMode("day")}
            >
              Day
            </button>
            <button
              className={viewMode === "week" ? "filter-pill active" : "filter-pill"}
              onClick={() => setViewMode("week")}
            >
              Week
            </button>
            <button
              className={viewMode === "month" ? "filter-pill active" : "filter-pill"}
              onClick={() => setViewMode("month")}
            >
              Month
            </button>
            <button
              className={viewMode === "list" ? "filter-pill active" : "filter-pill"}
              onClick={() => setViewMode("list")}
            >
              List
            </button>
          </div>
        </div>

        {viewMode === "list" ? (
          <div className="appointment-grid">
            <AppointmentList
              title="Today"
              items={today}
              onReschedule={handleRescheduleClick}
              onDelete={handleDeleteClick}
              onCancel={handleCancelClick}
              onComplete={(item) => handleStatusUpdate(item, "completed")}
              onNoShow={(item) => handleStatusUpdate(item, "no_show")}
            />
            <AppointmentList
              title="Upcoming"
              items={upcoming}
              onReschedule={handleRescheduleClick}
              onDelete={handleDeleteClick}
              onCancel={handleCancelClick}
              onComplete={(item) => handleStatusUpdate(item, "completed")}
              onNoShow={(item) => handleStatusUpdate(item, "no_show")}
            />
            <AppointmentList
              title="Past"
              items={past}
              onReschedule={handleRescheduleClick}
              onDelete={handleDeleteClick}
              onCancel={handleCancelClick}
              onComplete={(item) => handleStatusUpdate(item, "completed")}
              onNoShow={(item) => handleStatusUpdate(item, "no_show")}
            />
          </div>
        ) : (
          <div className="calendar">
            <div className="calendar-toolbar">
              <button
                className="ghost-dark"
                onClick={() =>
                  setActiveDate(
                    viewMode === "day"
                      ? addDays(activeDate, -1)
                      : viewMode === "week"
                        ? addDays(activeDate, -7)
                        : new Date(activeDate.getFullYear(), activeDate.getMonth() - 1, 1)
                  )
                }
              >
                Prev
              </button>
              <div className="calendar-title">
                {viewMode === "day"
                  ? activeDate.toDateString()
                  : viewMode === "week"
                    ? `${weekStart.toDateString()} - ${addDays(weekStart, 6).toDateString()}`
                    : activeDate.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
              </div>
              <button
                className="ghost-dark"
                onClick={() =>
                  setActiveDate(
                    viewMode === "day"
                      ? addDays(activeDate, 1)
                      : viewMode === "week"
                        ? addDays(activeDate, 7)
                        : new Date(activeDate.getFullYear(), activeDate.getMonth() + 1, 1)
                  )
                }
              >
                Next
              </button>
            </div>
            <div
              className={
                viewMode === "day"
                  ? "calendar-day"
                  : viewMode === "week"
                    ? "calendar-week"
                    : "calendar-month"
              }
            >
              {(viewMode === "day"
                ? [activeDate]
                : viewMode === "week"
                  ? weekDays
                  : monthDays
              ).map((day) => {
                const isCurrentMonth =
                  day.getMonth() === activeDate.getMonth() &&
                  day.getFullYear() === activeDate.getFullYear();
                return (
                  <div
                    key={day.toISOString()}
                    className={`calendar-cell ${isCurrentMonth ? "" : "calendar-muted"}`}
                  >
                    <div className="calendar-day-label">
                      {day.toLocaleDateString(undefined, {
                        weekday: viewMode === "month" ? undefined : "short",
                        month: viewMode === "month" ? undefined : "short",
                        day: "numeric"
                      })}
                    </div>
                    <div className="calendar-events">
                      {appointmentsForDay(day).length === 0 ? (
                        <div className="calendar-empty">No appointments</div>
                      ) : (
                        appointmentsForDay(day).map((item) => (
                          <div key={item._id} className="calendar-event">
                            <div className="calendar-event-title">{item.title}</div>
                            <div className="calendar-event-meta">
                              {new Date(item.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" · "}
                              {item.patientAlias || "Unassigned"}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
      <CancelModal
        open={cancelOpen}
        appointment={cancelTarget}
        onConfirm={confirmCancel}
        onCancel={() => {
          setCancelOpen(false);
          setCancelTarget(null);
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
    </section>
  );
}
