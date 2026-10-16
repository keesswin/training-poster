interface Props {
  kind: string;
  items: string[];
  current: string;
  onPick: (value: string) => void;
  onForget: (value: string) => void;
}

/** "Saved …" dropdown shown under a text field, with a Forget button for the value currently typed. */
export default function SavedPicker({ kind, items, current, onPick, onForget }: Props) {
  if (!items.length) return null;
  const typed = current.trim().replace(/\s+/g, ' ');
  return (
    <div className="saved">
      <select aria-label={`Saved ${kind}`} value="" onChange={(e) => e.target.value && onPick(e.target.value)} data-testid={`saved-${kind}`}>
        <option value="">Saved {kind} ({items.length})…</option>
        {items.map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
      <button type="button" className="btn small" title={`Forget the ${kind} currently in the box`} disabled={!items.includes(typed)} onClick={() => onForget(current)} data-testid={`forget-${kind}`}>
        Forget
      </button>
    </div>
  );
}
