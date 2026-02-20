import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchAppointments, updateAppointment, deleteAppointment, createAppointment } from "../api.js";

export const loadAppointments = createAsyncThunk("appointments/load", async () => {
  return await fetchAppointments();
});

export const addAppointment = createAsyncThunk("appointments/add", async (payload) => {
  await createAppointment(payload);
  return await fetchAppointments();
});

export const updateAppointmentStatus = createAsyncThunk(
  "appointments/update",
  async ({ appointmentId, payload }) => {
    await updateAppointment(appointmentId, payload);
    return await fetchAppointments();
  }
);

export const removeAppointment = createAsyncThunk(
  "appointments/remove",
  async (appointmentId) => {
    await deleteAppointment(appointmentId);
    return await fetchAppointments();
  }
);

const appointmentsSlice = createSlice({
  name: "appointments",
  initialState: {
    items: [],
    loading: false,
    error: ""
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(loadAppointments.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(loadAppointments.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload || [];
      })
      .addCase(loadAppointments.rejected, (state) => {
        state.loading = false;
        state.error = "Failed to load appointments";
      })
      .addCase(addAppointment.fulfilled, (state, action) => {
        state.items = action.payload || [];
      })
      .addCase(updateAppointmentStatus.fulfilled, (state, action) => {
        state.items = action.payload || [];
      })
      .addCase(removeAppointment.fulfilled, (state, action) => {
        state.items = action.payload || [];
      });
  }
});

export default appointmentsSlice.reducer;
