import { configureStore } from '@reduxjs/toolkit';
import { apiSlice } from './apiSlice.js';

export const store = configureStore({
  reducer: { [apiSlice.reducerPath]: apiSlice.reducer },
  middleware: (getDefaultMiddleware) => getDefaultMiddleware().concat(apiSlice.middleware),
});
