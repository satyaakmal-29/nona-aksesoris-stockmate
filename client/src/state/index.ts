import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface CurrentUser {
  userId:       string;
  name:         string;
  username:     string;
  email:        string;
  role:         string;
  profileImage?: string | null;
  language?:    string;
  notification?: boolean;
  isActive:     boolean;
}

export interface InitialStateTypes {
  isSidebarCollapsed: boolean;
  isDarkMode:         boolean;
  searchTerm:         string;
  language:           string;
  currentUser:        CurrentUser | null;
  isAuthenticated:    boolean;
}

const initialState: InitialStateTypes = {
  isSidebarCollapsed: false,
  isDarkMode:         false,
  searchTerm:         "",
  language:           "English",
  currentUser:        null,
  isAuthenticated:    false,
};

export const globalSlice = createSlice({
  name: "global",
  initialState,
  reducers: {
    setIsSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.isSidebarCollapsed = action.payload;
    },
    setIsDarkMode: (state, action: PayloadAction<boolean>) => {
      state.isDarkMode = action.payload;
    },
    setSearchTerm: (state, action: PayloadAction<string>) => {
      state.searchTerm = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setCurrentUser: (state, action: PayloadAction<CurrentUser | null>) => {
      state.currentUser     = action.payload;
      state.isAuthenticated = action.payload !== null;
      if (action.payload?.language) {
        state.language = action.payload.language;
      }
    },
    clearCurrentUser: (state) => {
      state.currentUser     = null;
      state.isAuthenticated = false;
    },
  },
});

export const {
  setIsSidebarCollapsed,
  setIsDarkMode,
  setSearchTerm,
  setLanguage,
  setCurrentUser,
  clearCurrentUser,
} = globalSlice.actions;

export default globalSlice.reducer;