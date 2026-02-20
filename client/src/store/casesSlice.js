import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import {
  fetchCases,
  fetchCaseDetail,
  createTimelineEvent,
  createDecisionPoint,
  updateCaseStatus,
  deleteCase,
  createTask,
  updateTaskStatus,
  deleteTask
} from "../api.js";

export const loadCases = createAsyncThunk("cases/load", async () => {
  return await fetchCases();
});

export const loadCaseDetail = createAsyncThunk("cases/loadDetail", async (caseId) => {
  return await fetchCaseDetail(caseId);
});

export const addTimelineEvent = createAsyncThunk(
  "cases/addTimelineEvent",
  async ({ caseId, payload }) => {
    await createTimelineEvent(caseId, payload);
    return await fetchCaseDetail(caseId);
  }
);

export const addDecisionPoint = createAsyncThunk(
  "cases/addDecisionPoint",
  async ({ caseId, payload }) => {
    await createDecisionPoint(caseId, payload);
    return await fetchCaseDetail(caseId);
  }
);

export const addTask = createAsyncThunk("cases/addTask", async ({ caseId, payload }) => {
  await createTask(caseId, payload);
  return await fetchCaseDetail(caseId);
});

export const toggleTask = createAsyncThunk(
  "cases/toggleTask",
  async ({ caseId, taskId, status }) => {
    await updateTaskStatus(caseId, taskId, status);
    return await fetchCaseDetail(caseId);
  }
);

export const removeTask = createAsyncThunk(
  "cases/removeTask",
  async ({ caseId, taskId }) => {
    await deleteTask(caseId, taskId);
    return await fetchCaseDetail(caseId);
  }
);

export const closeCase = createAsyncThunk("cases/closeCase", async (caseId) => {
  await updateCaseStatus(caseId, "closed");
  return await fetchCaseDetail(caseId);
});

export const reopenCase = createAsyncThunk("cases/reopenCase", async (caseId) => {
  await updateCaseStatus(caseId, "open");
  return await fetchCaseDetail(caseId);
});

export const removeCase = createAsyncThunk("cases/removeCase", async (caseId) => {
  await deleteCase(caseId);
  return caseId;
});

const casesSlice = createSlice({
  name: "cases",
  initialState: {
    items: [],
    selected: null,
    loading: false,
    error: ""
  },
  reducers: {
    clearSelected(state) {
      state.selected = null;
    }
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadCases.pending, (state) => {
        state.loading = true;
        state.error = "";
      })
      .addCase(loadCases.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload || [];
      })
      .addCase(loadCases.rejected, (state) => {
        state.loading = false;
        state.error = "Failed to load cases";
      })
      .addCase(loadCaseDetail.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(addTimelineEvent.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(addDecisionPoint.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(addTask.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(toggleTask.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(removeTask.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(closeCase.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(reopenCase.fulfilled, (state, action) => {
        state.selected = action.payload || null;
      })
      .addCase(removeCase.fulfilled, (state, action) => {
        state.items = state.items.filter((item) => item._id !== action.payload);
        if (state.selected?.case?._id === action.payload) {
          state.selected = null;
        }
      });
  }
});

export const { clearSelected } = casesSlice.actions;
export default casesSlice.reducer;
