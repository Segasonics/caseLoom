import { configureStore } from "@reduxjs/toolkit";
import casesReducer from "./casesSlice.js";
import appointmentsReducer from "./appointmentsSlice.js";

export const store = configureStore({
  reducer: {
    cases: casesReducer,
    appointments: appointmentsReducer
  }
});
