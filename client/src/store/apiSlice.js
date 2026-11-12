import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { getToken } from '../api.js';

const baseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL || '/api',
  prepareHeaders(headers) {
    const token = getToken();
    if (token) headers.set('authorization', `Bearer ${token}`);
    headers.set('content-type', 'application/json');
    return headers;
  },
});

export const apiSlice = createApi({
  reducerPath: 'api',
  baseQuery,
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
