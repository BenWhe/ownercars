// Shared make list for the homepage search and the /browse make dropdown.
//
// Stored adverts hold makes exactly as the DVSA lookup returns them: upper
// case, no accents (e.g. "BMW", "FERRARI"). Browse filtering is a
// case-insensitive exact match, so the *spelling* must match DVSA's form.
// `value` is therefore the upper-case DVSA form; `label` is for display.

const LISTED_MAKES = [
  "Abarth", "AC", "Alfa Romeo", "Alpine", "Aston Martin", "Audi", "Austin",
  "Austin Healey", "Bentley", "BMW", "BYD", "Caterham", "Chevrolet", "Citroen",
  "Cupra", "Dacia", "Daimler", "DS", "Ferrari", "Fiat", "Ford", "Genesis",
  "Honda", "Hyundai", "Ineos", "Jaguar", "Jeep", "Jensen", "Kia", "Lamborghini",
  "Lancia", "Land Rover", "Lexus", "Lotus", "Maserati", "Mazda", "McLaren",
  "Mercedes-Benz", "MG", "MINI", "Mitsubishi", "Morgan", "Morris", "Nissan",
  "Peugeot", "Polestar", "Porsche", "Renault", "Rolls-Royce", "Rover", "Saab",
  "SEAT", "Skoda", "Smart", "Subaru", "Suzuki", "Tesla", "Toyota", "Triumph",
  "TVR", "Vauxhall", "Volkswagen", "Volvo",
];

export type MakeOption = { value: string; label: string };

export function makeValue(make: string): string {
  return make.trim().toUpperCase();
}

const LABEL_BY_VALUE = new Map(LISTED_MAKES.map((m) => [makeValue(m), m]));

// Title case for makes that aren't in the list (e.g. a live make from an
// advert). Very short all-caps names (MG, BYD, DAF) stay upper case.
export function makeLabel(value: string): string {
  const key = makeValue(value);
  const listed = LABEL_BY_VALUE.get(key);
  if (listed) return listed;
  if (key.length <= 3) return key;
  return key
    .toLowerCase()
    .replace(/(^|[\s-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

// Full list plus any live makes (and an optional currently-selected make),
// de-duplicated case-insensitively and sorted by label.
export function buildMakeOptions(live: string[] = [], selected = ""): MakeOption[] {
  const byValue = new Map<string, MakeOption>();

  for (const name of [...LISTED_MAKES, ...live, selected]) {
    if (!name || !name.trim()) continue;
    const value = makeValue(name);
    if (!byValue.has(value)) byValue.set(value, { value, label: makeLabel(value) });
  }

  return [...byValue.values()].sort((a, b) =>
    a.label.localeCompare(b.label, "en", { sensitivity: "base" })
  );
}

// Map an incoming value (e.g. "Porsche" from a URL) onto the canonical
// upper-case form used by the dropdowns.
export function canonicalMake(input: string | null | undefined): string {
  return input && input.trim() ? makeValue(input) : "";
}

export const MAKES: MakeOption[] = buildMakeOptions();
