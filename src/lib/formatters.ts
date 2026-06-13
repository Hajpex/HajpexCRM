/** Format a raw digit string as Swedish thousands-separated number.
 *  "1500000" → "1 500 000"
 *  Numbers under 5 digits are left as-is (avoids formatting years like 1998). */
export function fmtSweNum(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length < 5) return digits;
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, " "); // non-breaking space
}

/** Strip formatting back to raw digit string. */
export function parseSweNum(formatted: string): string {
  return formatted.replace(/\D/g, "");
}

/** React onChange handler factory for number inputs.
 *  Keeps cursor position correct after reformatting. */
export function handleNumberInput(
  e: React.ChangeEvent<HTMLInputElement>,
  onChange: (raw: string) => void
) {
  const input = e.target;
  const selStart = input.selectionStart ?? 0;
  const digitsBefore = input.value.slice(0, selStart).replace(/\D/g, "").length;

  const clean = parseSweNum(input.value);
  onChange(clean);

  requestAnimationFrame(() => {
    const formatted = fmtSweNum(clean);
    let newPos = 0;
    let digitCount = 0;
    for (let i = 0; i < formatted.length; i++) {
      if (/\d/.test(formatted[i])) digitCount++;
      if (digitCount >= digitsBefore) { newPos = i + 1; break; }
    }
    input.setSelectionRange(newPos, newPos);
  });
}
