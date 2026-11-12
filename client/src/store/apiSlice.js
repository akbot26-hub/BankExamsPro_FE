import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getToken, MOCK_API, mockApi } from '../api.js';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  prepareHeaders(headers) {
    const token = getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');
    return headers;
  },
});

const appBaseQuery = async (args, api, extraOptions) => {
  if (MOCK_API) {
    try {
      const url = typeof args === 'string' ? args : args.url;
      const method = typeof args === 'string' ? 'GET' : args.method || 'GET';
      const body = typeof args === 'string' ? undefined : args.body;
      return { data: await mockApi(url, { method, body }) };
    } catch (error) {
      return { error: { status: error.status || 500, data: { error: error.message } } };
    }
  }
  return baseQuery(args, api, extraOptions);
};

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery: appBaseQuery,
  tagTypes: ['Exams', 'Exam', 'Attempt', 'Admin'],
  endpoints: (builder) => ({
    getExams: builder.query({ query: () => '/exams', providesTags: ['Exams'] }),
    getExam: builder.query({ query: (id) => `/exams/${id}`, providesTags: (_result, _error, id) => [{ type: 'Exam', id }] }),
    getAttempt: builder.query({ query: (id) => `/attempts/${id}`, providesTags: (_result, _error, id) => [{ type: 'Attempt', id }] }),
    getJourney: builder.query({ query: ({ examId, narrate = false }) => `/analytics/journey/${examId}?narrate=${narrate}` }),
    getReport: builder.query({ query: (examId) => `/analytics/report/${examId}` }),
    getAdminOverview: builder.query({ query: () => '/admin/overview', providesTags: ['Admin'] }),
    getAdminStudents: builder.query({ query: () => '/admin/students', providesTags: ['Admin'] }),
    createExam: builder.mutation({ query: (body) => ({ url: '/admin/exams', method: 'POST', body }), invalidatesTags: ['Exams', 'Admin'] }),
    updateExam: builder.mutation({ query: ({ id, ...body }) => ({ url: `/admin/exams/${id}`, method: 'PATCH', body }), invalidatesTags: (_result, _error, { id }) => ['Exams', { type: 'Exam', id }] }),
  }),
});

export const {
  useGetExamsQuery, useGetExamQuery, useGetAttemptQuery, useGetJourneyQuery,
  useGetReportQuery, useGetAdminOverviewQuery, useGetAdminStudentsQuery,
  useCreateExamMutation, useUpdateExamMutation,
} = apiSlice;
