import React from 'react';
import { Link, useLocation } from 'react-router-dom';

export function Button({ variant = 'secondary', className = '', type = 'button', ...props }) {
  return <button type={type} className={`ui-button ui-button-${variant} ${className}`} {...props} />;
}

export function Card({ className = '', children, ...props }) {
  return <section className={`ui-card ${className}`} {...props}>{children}</section>;
}

export function Badge({ tone = 'neutral', children, ...props }) {
  return <span className={`ui-badge ui-badge-${tone}`} {...props}>{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions }) {
  return <header className="ui-page-header"><div>{eyebrow && <p className="ui-eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="ui-muted">{description}</p>}</div>{actions && <div className="ui-page-actions">{actions}</div>}</header>;
}

export function Breadcrumbs({ items }) {
  const location = useLocation();
  const crumbs = items || location.pathname.split('/').filter(Boolean).map((part, index, all) => ({ label: decodeURIComponent(part).replace(/-/g, ' '), to: `/${all.slice(0, index + 1).join('/')}` }));
  if (!crumbs.length) return null;
  return <nav className="ui-breadcrumbs" aria-label="Breadcrumb"><Link to="/">Home</Link>{crumbs.map((item, index) => <React.Fragment key={`${item.to || item.label}-${index}`}><span aria-hidden="true">/</span>{index === crumbs.length - 1 ? <span aria-current="page">{item.label}</span> : <Link to={item.to || '#'}>{item.label}</Link>}</React.Fragment>)}</nav>;
}

export function FormField({ label, error, id, className = '', inputRef, ...props }) {
  return <div className={`ui-field ${className}`}><label htmlFor={id}>{label}</label><input id={id} ref={inputRef} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...props} />{error && <span id={`${id}-error`} className="ui-field-error">{error}</span>}</div>;
}

export function EmptyState({ title, children }) {
  return <div className="ui-empty"><strong>{title}</strong>{children && <p>{children}</p>}</div>;
}
