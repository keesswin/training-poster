import { TEMPLATES } from '../poster/layouts';
import { DESIGN_H, DESIGN_W, type Rect, type TemplateId } from '../poster/types';

const R = ({ box: r, ...rest }: { box: Rect } & React.SVGProps<SVGRectElement>) => <rect x={r.x} y={r.y} width={r.w} height={r.h} {...rest} />;

/** Schematic thumbnail built from the real layout geometry, so it can never drift from the output. */
function Thumb({ id }: { id: TemplateId }) {
  const g = TEMPLATES.find((t) => t.id === id)!.geometry(2, true);
  const h = g.headline;
  return (
    <svg viewBox={`0 0 ${DESIGN_W} ${DESIGN_H}`} className="thumb" aria-hidden>
      <rect width={DESIGN_W} height={DESIGN_H} fill="#fff" />
      {g.navyBands.map((b, i) => (
        <R key={i} box={b} fill="#084A91" />
      ))}
      <R box={{ ...g.leadersDeskLogo, y: g.leadersDeskLogo.y + 18, h: 40, w: 190 }} fill="#084A91" opacity={0.85} />
      <R box={{ x: g.institutionLogo.x + 140, y: g.institutionLogo.y + 13, w: 110, h: 50 }} fill="#9db3cf" />
      <rect x={h.x} y={h.y + 8} width={h.w * 0.9} height={44} fill={h.tone === 'dark' ? '#fff' : '#084A91'} />
      <rect x={h.x} y={h.y + 74} width={h.w * 0.55} height={44} fill="#F07B00" />
      {g.slots.map((s, i) => (
        <R key={i} box={s} rx={14} fill={i === 0 ? '#5f87b8' : '#9db3cf'} />
      ))}
    </svg>
  );
}

export default function TemplatePicker({ value, onChange }: { value: TemplateId; onChange: (id: TemplateId) => void }) {
  return (
    <div className="templates" role="radiogroup" aria-label="Poster template">
      {TEMPLATES.map((t) => (
        <button
          key={t.id}
          type="button"
          role="radio"
          aria-checked={value === t.id}
          className={`tpl ${value === t.id ? 'on' : ''}`}
          onClick={() => onChange(t.id)}
          data-testid={`tpl-${t.id}`}
        >
          <Thumb id={t.id} />
          <strong>{t.name}</strong>
          <span>{t.tagline}</span>
        </button>
      ))}
    </div>
  );
}
