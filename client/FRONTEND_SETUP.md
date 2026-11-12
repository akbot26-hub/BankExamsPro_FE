# Frontend setup

The existing application screens and routes are retained. The client now has a shared component layer (`src/components/ui.jsx`), Tailwind CSS v4 utilities, React Router, Redux Toolkit Query, React Hook Form, Yup validation, and a global React Toastify container.

## Run

```sh
n
npm run dev
```

Set `VITE_API_URL` when the API is hosted at a different base path. By default, requests use `/api` (proxied to `http://localhost:4000` by Vite).

## Shared UI

Import `Button`, `Card`, `Badge`, `PageHeader`, `Breadcrumbs`, `FormField`, or `EmptyState` from `src/components/ui.jsx`. Tailwind utilities are available alongside the established product classes and CSS variables.

## Forms and feedback

Use `useForm` with `yupResolver(schema)` for forms. `FormField` renders labels and accessible validation messages. Use `toast.success`, `toast.error`, and related React Toastify helpers for feedback; the global toast container is mounted in `main.jsx`.

## API integration

`src/store/apiSlice.js` is the shared RTK Query API. It adds the current bearer token automatically and exports hooks for common exam, analytics, attempt, and admin reads and mutations. Add endpoint definitions there to share cache tags and invalidation behavior. Existing endpoints not yet migrated can use the legacy `api()` helper in `src/api.js`.

## Existing screens

Sign-in, dashboard, exam schedule, exam instructions and test engine, results, analytics, report, and all five admin views remain available on their existing routes.
