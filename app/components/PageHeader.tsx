import type { ReactNode } from "react";

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
};

/** Jerarquía y acción principal compartidas por las pantallas operativas. */
export function PageHeader({ eyebrow, title, description, action }: Props) {
  return (
    <header className="page-header">
      <div className="page-header-copy">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action && <div className="page-header-action">{action}</div>}
    </header>
  );
}
