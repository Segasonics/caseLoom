import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { Loader2 } from "lucide-react";
import { countryCodes } from "../data/countryCodes.js";

export default function AppointmentForm({ onAdd }) {
  const defaultOption = `${countryCodes[0].code}|${countryCodes[0].label}`;
  const [title, setTitle] = useState("");
  const [patientAlias, setPatientAlias] = useState("");
  const [countryOption, setCountryOption] = useState(defaultOption);
  const [localPhone, setLocalPhone] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const scheduledRef = useRef(null);
  const [notes, setNotes] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [countryOpen, setCountryOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const countryRef = useRef(null);

  const selectedCountry = useMemo(
    () =>
      countryCodes.find((item) => `${item.code}|${item.label}` === countryOption) ||
      countryCodes[0],
    [countryOption]
  );

  useEffect(() => {
    function handleClickOutside(event) {
      if (!countryRef.current) return;
      if (!countryRef.current.contains(event.target)) {
        setCountryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function normalizePhone(value) {
    const cleaned = value.replace(/[\s-]/g, "");
    if (!cleaned) return "";
    if (cleaned.startsWith("+")) return cleaned;
    if (/^\d+$/.test(cleaned)) return `+${cleaned}`;
    return cleaned;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!scheduledFor) return;
    const combinedPhone = `${selectedCountry.code}${localPhone}`;
    const normalizedPhone = normalizePhone(combinedPhone);
    if (normalizedPhone && !/^\+\d{6,15}$/.test(normalizedPhone)) {
      setPhoneError("Use E.164 format like +9617XXXXXXX (country code required).");
      toast.error("Invalid phone number.");
      return;
    }
    setPhoneError("");
    if (submitting) return;
    setSubmitting(true);
    try {
      await Promise.resolve(
        onAdd({ title, patientAlias, contactPhone: normalizedPhone, scheduledFor, notes })
      );
      toast.success("Appointment added.");
      setTitle("");
      setPatientAlias("");
      setCountryOption(defaultOption);
      setLocalPhone("");
      setScheduledFor("");
      setNotes("");
      setCountryOpen(false);
    } catch (err) {
      toast.error("Failed to add appointment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="appointment-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label className="form-field">
          Appointment Title
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Follow-up review"
            required
          />
        </label>
        <label className="form-field">
          Patient Alias
          <input
            value={patientAlias}
            onChange={(e) => setPatientAlias(e.target.value.toUpperCase())}
            placeholder="e.g. JM-45F"
          />
        </label>
        <label className="form-field">
          Patient Phone (SMS)
          <div className="phone-combo phone-combo-full">
            <div className="country-select" ref={countryRef}>
              <button
                type="button"
                className="country-trigger"
                onClick={() => setCountryOpen((prev) => !prev)}
              >
                <span className="flag-badge" aria-hidden="true">
                  <img src={selectedCountry.flag} alt="" />
                </span>
                <span className="country-code">{selectedCountry.code}</span>
              </button>
              {countryOpen ? (
                <div className="country-menu">
                  {countryCodes.map((item) => (
                    <button
                      type="button"
                      key={`${item.code}-${item.label}`}
                      className="country-option"
                      onMouseDown={() => {
                        setCountryOption(`${item.code}|${item.label}`);
                        setCountryOpen(false);
                      }}
                    >
                      <span className="flag-badge" aria-hidden="true">
                        <img src={item.flag} alt="" />
                      </span>
                      <span className="country-label">{item.label}</span>
                      <span className="country-code">{item.code}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <input
              value={localPhone}
              onChange={(e) => setLocalPhone(e.target.value)}
              placeholder="Phone number"
              className="phone-input"
            />
          </div>
          {phoneError ? <span className="form-error">{phoneError}</span> : null}
        </label>
      </div>
        <label className="form-field">
          Scheduled For
          <input
            ref={scheduledRef}
            type="datetime-local"
            value={scheduledFor}
            onChange={(e) => {
              setScheduledFor(e.target.value);
              if (e.target.value) {
                setTimeout(() => {
                  if (scheduledRef.current) scheduledRef.current.blur();
                }, 0);
              }
            }}
            required
          />
        </label>
      <label className="form-field">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any prep or context for the visit"
        />
      </label>
      <button type="submit" className="primary" disabled={submitting}>
        {submitting ? (
          <span className="btn-inline">
            <Loader2 className="spin" size={16} />
            Adding...
          </span>
        ) : (
          "Add Appointment"
        )}
      </button>
    </form>
  );
}
